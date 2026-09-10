"""Test 08: Map composer — attached, detached, lock, export, templates."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await page.wait_for_timeout(1500)

        # ── Open composer (preview) ──
        await page.evaluate("previewExport()")
        await page.wait_for_timeout(3000)
        modal_visible = await page.evaluate("""() => {
            const m = document.getElementById('layout-modal');
            return m && m.style.display !== 'none';
        }""")
        report("Composer modal opens", modal_visible)

        if not modal_visible:
            errs = await close(page)
            sys.exit(1)

        # ── Layout map exists ──
        has_layout_map = await page.evaluate("!!layoutMap")
        report("Layout map created", has_layout_map)

        # ── Layers rendered in composer ──
        layer_count = await page.evaluate("layoutLayers.length")
        report("Composer has layers", layer_count > 0, f"count={layer_count}")

        # ── Lock/unlock main map ──
        locked_initial = await page.evaluate("mainLocked")
        report("Composer initial lock state", locked_initial is not None, f"locked={locked_initial}")

        # Unlock
        await page.evaluate("toggleLayoutLock('main')")
        await page.wait_for_timeout(500)
        unlocked = await page.evaluate("mainLocked")
        report("Unlock composer", unlocked == True, f"unlocked={unlocked}")

        # Zoom controls appear when unlocked
        zoom_btns = await page.locator("#layout-map .leaflet-control-zoom-in").count()
        report("Zoom buttons when unlocked", zoom_btns == 1, f"count={zoom_btns}")

        # Fractional zoom in composer
        cz0 = await page.evaluate("layoutMap.getZoom()")
        await page.evaluate("layoutMap.setZoom(layoutMap.getZoom() - 2, {animate:false})")
        await page.wait_for_timeout(300)
        cz0b = await page.evaluate("layoutMap.getZoom()")
        await page.evaluate("""() => {
            const btn = document.querySelector('#layout-map .leaflet-control-zoom-in');
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(300)
        cz1 = await page.evaluate("layoutMap.getZoom()")
        report("Composer fractional zoom", abs((cz1 - cz0b) - 0.25) < 1e-9, f"{cz0b}->{cz1}")

        # Re-lock
        await page.evaluate("toggleLayoutLock('main')")
        await page.wait_for_timeout(500)
        relocked = await page.evaluate("mainLocked")
        zoom_btns2 = await page.locator("#layout-map .leaflet-control-zoom-in").count()
        report("Re-lock removes zoom buttons", relocked == False and zoom_btns2 == 0, f"locked={relocked} btns={zoom_btns2}")

        # ── Paper size change ──
        await page.evaluate("""() => {
            const sel = document.getElementById('layout-paper-size');
            if (sel) sel.value = 'a4_landscape';
        }""")
        await page.evaluate("""() => {
            const sel = document.getElementById('layout-paper-size');
            if (sel) sel.dispatchEvent(new Event('change', {bubbles:true}));
        }""")
        await page.wait_for_timeout(1000)
        report("Paper size change no crash", True)

        # ── Title input ──
        await page.evaluate("""() => {
            const inp = document.getElementById('layout-title-input');
            if (inp) { inp.value = 'Test Map Title'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
        }""")
        await page.wait_for_timeout(300)
        title_text = await page.evaluate("""() => {
            const el = document.getElementById('layout-title');
            return el ? el.textContent : null;
        }""")
        report("Title input updates layout", title_text and "Test Map" in title_text, f"text='{title_text}'")

        # ── Legend toggle ──
        await page.evaluate("""() => {
            const cb = document.getElementById('layout-include-legend');
            if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles:true})); }
        }""")
        await page.wait_for_timeout(500)
        legend_visible = await page.evaluate("""() => {
            const el = document.getElementById('layout-legend');
            return el && el.style.display !== 'none' && el.innerHTML.length > 0;
        }""")
        report("Legend visible in composer", legend_visible)

        # ── Refresh composer ──
        await page.evaluate("refreshComposer()")
        await page.wait_for_timeout(2000)
        report("Refresh composer no crash", True)

        # ── Close layout modal ──
        await page.evaluate("closeLayoutModal()")
        await page.wait_for_timeout(500)
        modal_closed = await page.evaluate("""() => {
            const m = document.getElementById('layout-modal');
            return !m || !m.classList.contains('show');
        }""")
        report("Composer modal closes", modal_closed)

        # ── Detached composer ──
        # Reopen and detach
        await page.evaluate("previewExport()")
        await page.wait_for_timeout(3000)
        async with page.expect_popup() as pop_info:
            await page.click("#layout-detach-btn")
        pop = await pop_info.value
        pop.on("pageerror", lambda e: page._gsx_errors.append(f"POPUP: {e}"))
        await pop.wait_for_load_state("domcontentloaded")
        await pop.wait_for_timeout(3500)

        # Check detached composer loaded
        pop_has_map = await pop.evaluate("!!layoutMap")
        report("Detached composer has layout map", pop_has_map)

        pop_layers = await pop.evaluate("uploadedLayers.length")
        report("Detached composer syncs layers", pop_layers == 1, f"layers={pop_layers}")

        # Test zoom in detached
        await pop.evaluate("toggleLayoutLock('main')")
        await pop.wait_for_timeout(500)
        pop_zoom_btns = await pop.locator("#layout-map .leaflet-control-zoom-in").count()
        report("Detached zoom buttons when unlocked", pop_zoom_btns == 1, f"count={pop_zoom_btns}")

        # Test fractional zoom in detached
        await pop.evaluate("layoutMap.setZoom(layoutMap.getZoom() - 2, {animate:false})")
        await pop.wait_for_timeout(300)
        pz0 = await pop.evaluate("layoutMap.getZoom()")
        await pop.evaluate("""() => {
            const btn = document.querySelector('#layout-map .leaflet-control-zoom-in');
            if (btn) btn.click();
        }""")
        await pop.wait_for_timeout(300)
        pz1 = await pop.evaluate("layoutMap.getZoom()")
        report("Detached fractional zoom", abs((pz1 - pz0) - 0.25) < 1e-9, f"{pz0}->{pz1}")

        # Close popout
        await pop.close()

        errs = await close(page)
        report("Composer tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== {COUNTS["pass"]} passed, {COUNTS["fail"]} failed ===")
sys.exit(1 if COUNTS["fail"] else 0)
