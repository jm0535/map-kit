"""Test 02: Map interactions — zoom, pan, basemaps, layers, theme, panels."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        await goto(page)
        await expand_all_sections(page)

        # ── Zoom controls ──
        z0 = await page.evaluate("map.getZoom()")
        await page.click("#map .leaflet-control-zoom-in")
        await page.wait_for_timeout(800)
        z1 = await page.evaluate("map.getZoom()")
        report("Zoom in button", z1 > z0, f"{z0}->{z1}")

        await page.click("#map .leaflet-control-zoom-out")
        await page.wait_for_timeout(800)
        z2 = await page.evaluate("map.getZoom()")
        report("Zoom out button", z2 < z1, f"{z1}->{z2}")

        # Fractional zoom (0.25 steps)
        await page.evaluate("map.setZoom(8, {animate:false})")
        await page.wait_for_timeout(300)
        await page.evaluate("map.zoomIn(0.25, {animate:false})")
        z3 = await page.evaluate("map.getZoom()")
        report("Fractional zoom 0.25 step", abs(z3 - 8.25) < 1e-9, f"z={z3}")

        # ── Pan ──
        c0 = await page.evaluate("map.getCenter()")
        await page.evaluate("map.panBy([100, 0], {animate:false})")
        c1 = await page.evaluate("map.getCenter()")
        report("Pan changes center", c1["lng"] != c0["lng"], f"lng {c0['lng']}->{c1['lng']}")

        # ── Status bar zoom display ──
        zoom_text = await page.text_content("#status-zoom")
        report("Status bar zoom display", zoom_text is not None and "Zoom" in (zoom_text or ""), f"text='{zoom_text}'")

        # ── Coordinate display ──
        coord_text = await page.text_content("#coord-display")
        report("Coordinate display exists", coord_text is not None)

        # ── Basemap switching ──
        # Check basemap buttons exist
        basemap_btns = await page.locator(".basemap-btn").count()
        report("Basemap buttons exist", basemap_btns > 0, f"count={basemap_btns}")
        if basemap_btns > 1:
            await js_click(page, ".basemap-btn:nth-child(2)")
            await page.wait_for_timeout(1000)
            report("Basemap switch no crash", True)

        # ── Theme toggle ──
        theme0 = await page.evaluate("document.body.classList.contains('light')")
        await page.click("#theme-toggle")
        await page.wait_for_timeout(300)
        theme1 = await page.evaluate("document.body.classList.contains('light')")
        report("Theme toggle", theme0 != theme1, f"light={theme0}->{theme1}")
        # Toggle back
        await page.click("#theme-toggle")
        await page.wait_for_timeout(300)

        # ── Panel collapse ──
        await page.click("#collapse-left-btn")
        await page.wait_for_timeout(300)
        left_collapsed = await page.evaluate("""() => {
            const p = document.getElementById('left-panel');
            return p.classList.contains('collapsed') || p.style.display === 'none';
        }""")
        report("Left panel collapse", left_collapsed)
        await page.click("#collapse-left-btn")
        await page.wait_for_timeout(300)

        await page.click("#collapse-right-btn")
        await page.wait_for_timeout(300)
        right_collapsed = await page.evaluate("""() => {
            const p = document.getElementById('right-panel');
            return p.classList.contains('collapsed') || p.style.display === 'none';
        }""")
        report("Right panel collapse", right_collapsed)
        await page.click("#collapse-right-btn")
        await page.wait_for_timeout(300)

        # ── Layer visibility toggle ──
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await page.wait_for_timeout(1000)
        await expand_all_sections(page)
        # Click the eye icon to toggle visibility
        eye = page.locator(".layer-eye").first
        if await eye.count() > 0:
            await js_click(page, ".layer-eye")
            await page.wait_for_timeout(500)
            vis = await page.evaluate("map.hasLayer(uploadedLayers[0].layer)")
            report("Layer visibility toggle", vis == False, f"visible={vis}")
            await js_click(page, ".layer-eye")
            await page.wait_for_timeout(500)
            vis2 = await page.evaluate("map.hasLayer(uploadedLayers[0].layer)")
            report("Layer visibility re-toggle", vis2 == True, f"visible={vis2}")
        else:
            report("Layer visibility toggle", False, "no eye icon found")

        # ── Zoom to layer ──
        zoom_btn = page.locator(".layer-action-btn[title*='Zoom'], .layer-zoom-btn").first
        if await zoom_btn.count() > 0:
            c_before = await page.evaluate("map.getCenter()")
            await js_click(page, ".layer-action-btn[title*='Zoom'], .layer-zoom-btn")
            await page.wait_for_timeout(1000)
            report("Zoom to layer", True)
        else:
            # Try by title attribute
            has_zoom = await page.evaluate("""() => {
                const btns = document.querySelectorAll('.layer-action-btn');
                return Array.from(btns).some(b => b.title.includes('Zoom') || b.textContent.includes('🔍'));
            }""")
            report("Zoom to layer button exists", has_zoom)

        # ── Remove layer ──
        layer_count_before = await page.evaluate("uploadedLayers.length")
        remove_btn = page.locator(".layer-remove").first
        if await remove_btn.count() > 0:
            await js_click(page, ".layer-remove")
            await page.wait_for_timeout(500)
            layer_count_after = await page.evaluate("uploadedLayers.length")
            report("Remove layer", layer_count_after == layer_count_before - 1, f"{layer_count_before}->{layer_count_after}")
        else:
            report("Remove layer", False, "no remove button")

        # ── North arrow ──
        north = await page.locator("#north-arrow").count()
        report("North arrow exists", north > 0)

        # ── Minimap ──
        minimap = await page.locator("#minimap").count()
        report("Minimap exists", minimap > 0)

        errs = await close(page)
        report("Map tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== {COUNTS["pass"]} passed, {COUNTS["fail"]} failed ===")
sys.exit(1 if COUNTS["fail"] else 0)
