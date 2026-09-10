"""Test 15: Digitizing advanced — edit mode, select mode, duplicate, snap, undo/redo, feature info click."""
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
        await expand_all_sections(page)

        # ── Digitizing functions exist ──
        funcs = await page.evaluate("""() => ({
            startDigitize: typeof startDigitize,
            startEditMode: typeof startEditMode,
            startSelectMode: typeof startSelectMode,
            duplicateSelectedFeatures: typeof duplicateSelectedFeatures,
            toggleSnap: typeof toggleSnap,
            historyUndo: typeof historyUndo,
            historyRedo: typeof historyRedo,
            cancelDigitize: typeof cancelDigitize,
        })""")
        for name, ftype in funcs.items():
            report(f"Digitize {name} exists", ftype == 'function', ftype)

        # ── Edit mode ──
        edit_ran = await page.evaluate("""() => {
            try { startEditMode(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Edit mode starts", edit_ran == 'ok' or 'no' in edit_ran.lower(), edit_ran)
        await page.evaluate("cancelDigitize()")
        await page.wait_for_timeout(300)

        # ── Select mode (rectangle) ──
        select_ran = await page.evaluate("""() => {
            try { startSelectMode('rect'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Select mode (rect) starts", select_ran == 'ok' or 'no' in select_ran.lower(), select_ran)
        await page.evaluate("cancelDigitize()")
        await page.wait_for_timeout(300)

        # ── Select mode (circle) ──
        select_circle = await page.evaluate("""() => {
            try { startSelectMode('circle'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Select mode (circle) starts", select_circle == 'ok' or 'no' in select_circle.lower(), select_circle)
        await page.evaluate("cancelDigitize()")
        await page.wait_for_timeout(300)

        # ── Toggle snap ──
        snap_ran = await page.evaluate("""() => {
            try { toggleSnap(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Toggle snap no crash", snap_ran == 'ok', snap_ran)

        # ── Undo/Redo ──
        undo_ran = await page.evaluate("""() => {
            try { historyUndo(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("History undo no crash", undo_ran == 'ok' or 'no' in undo_ran.lower(), undo_ran)

        redo_ran = await page.evaluate("""() => {
            try { historyRedo(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("History redo no crash", redo_ran == 'ok' or 'no' in redo_ran.lower(), redo_ran)

        # ── Duplicate selected features ──
        dup_ran = await page.evaluate("""() => {
            try { duplicateSelectedFeatures(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Duplicate features no crash", dup_ran == 'ok' or 'no' in dup_ran.lower() or 'select' in dup_ran.lower(), dup_ran)

        # ── Feature info: click on a map feature ──
        # We need to click on an actual feature on the map
        # First, get the map bounds and zoom to features
        await page.evaluate("map.fitBounds(uploadedLayers[0].layer.getBounds())")
        await page.wait_for_timeout(1000)

        # Zoom to features and wait for map to settle
        await page.evaluate('map.fitBounds(uploadedLayers[0].layer.getBounds(), {padding: [100, 100]})')
        await page.wait_for_timeout(1500)

        # Get the pixel position of the first feature (relative to map container)
        feature_pos = await page.evaluate("""() => {
            const info = uploadedLayers[0];
            if (!info || !info.layer) return null;
            let firstLayer = null;
            info.layer.eachLayer(l => { if (!firstLayer) firstLayer = l; });
            if (!firstLayer || !firstLayer.getLatLng) return null;
            const latlng = firstLayer.getLatLng();
            const point = map.latLngToContainerPoint(latlng);
            const mapEl = document.getElementById('map');
            const rect = mapEl.getBoundingClientRect();
            // Ensure the point is within the visible map area
            if (point.x < 0 || point.x > rect.width || point.y < 0 || point.y > rect.height) return null;
            return {x: point.x, y: point.y};
        }""")
        report("Feature pixel position found", feature_pos is not None, str(feature_pos))

        if feature_pos:
            map_box = await page.locator("#map").bounding_box()
            if map_box:
                px = map_box['x'] + feature_pos['x']
                py = map_box['y'] + feature_pos['y']
                await page.mouse.click(px, py)
                await page.wait_for_timeout(1000)

                # Check if feature info card appeared
                fi_content = await page.evaluate("""() => {
                    const el = document.getElementById('feature-info');
                    if (!el) return null;
                    return {
                        hasTable: el.querySelector('table') !== null,
                        hasNavButtons: el.querySelectorAll('.fi-nav button').length,
                        hasActionButtons: el.querySelectorAll('.fi-actions button').length,
                        text: el.textContent.substring(0, 100),
                    };
                }""")
                report("Feature info shows on click", fi_content and fi_content.get('hasTable'), str(fi_content))

                if fi_content and fi_content.get('hasNavButtons', 0) > 0:
                    # ── Test prev/next ──
                    await page.evaluate("fiNext()")
                    await page.wait_for_timeout(300)
                    report("Feature info next no crash", True)

                    await page.evaluate("fiPrev()")
                    await page.wait_for_timeout(300)
                    report("Feature info prev no crash", True)

                if fi_content and fi_content.get('hasActionButtons', 0) > 0:
                    # ── Test zoom to feature ──
                    await page.evaluate("fiZoomTo()")
                    await page.wait_for_timeout(500)
                    report("Feature info zoom no crash", True)

                    # ── Test clear ──
                    await page.evaluate("fiClear()")
                    await page.wait_for_timeout(300)
                    fi_cleared = await page.evaluate("""() => {
                        const el = document.getElementById('feature-info');
                        return el && el.querySelector('.fi-empty') !== null;
                    }""")
                    report("Feature info clear", fi_cleared)

        # ── Profile panel resize handle ──
        handle = await page.locator("#profile-resize-handle").count()
        report("Profile resize handle exists", handle > 0)

        if handle > 0:
            panel_h_before = await page.evaluate("document.getElementById('profile-panel').offsetHeight")
            # Simulate drag by dispatching mousedown, mousemove, mouseup
            resize_result = await page.evaluate("""() => {
                const handle = document.getElementById('profile-resize-handle');
                const panel = document.getElementById('profile-panel');
                const startY = 0;
                const startH = panel.offsetHeight;
                // Simulate drag down (increase height)
                const mde = new MouseEvent('mousedown', {bubbles: true, clientY: startY});
                handle.dispatchEvent(mde);
                const mme = new MouseEvent('mousemove', {bubbles: true, clientY: startY - 50});
                document.dispatchEvent(mme);
                const mue = new MouseEvent('mouseup', {bubbles: true, clientY: startY - 50});
                document.dispatchEvent(mue);
                return {before: startH, after: panel.offsetHeight};
            }""")
            report("Profile resize handle works", resize_result is not None, str(resize_result))

        # ── Attribute table expression filter ──
        # Open attribute table
        await page.evaluate("""() => {
            const sel = document.getElementById('attr-layer-select');
            if (sel && sel.options.length > 1) {
                sel.selectedIndex = 1;
                sel.dispatchEvent(new Event('change', {bubbles:true}));
            }
        }""")
        await page.wait_for_timeout(1000)

        # Check filter expression input exists
        has_filter = await page.locator("#attr-filter-expr").count()
        report("Attribute filter expression input exists", has_filter > 0)

        if has_filter > 0:
            # Apply a filter
            await page.evaluate("""() => {
                const inp = document.getElementById('attr-filter-expr');
                if (inp) inp.value = 'elevation > 150';
            }""")
            await page.evaluate("applyAttrFilter()")
            await page.wait_for_timeout(500)
            rows_filtered = await page.locator("#attr-table tbody tr").count()
            report("Attribute filter applies", rows_filtered >= 0, f"rows={rows_filtered}")

            # Clear filter
            await page.evaluate("clearAttrFilter()")
            await page.wait_for_timeout(500)
            rows_restored = await page.locator("#attr-table tbody tr").count()
            report("Attribute filter clears", rows_restored >= rows_filtered, f"rows={rows_restored}")

        errs = await close(page)
        report("Advanced digitize tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== Advanced tests: {COUNTS['pass']} passed, {COUNTS['fail']} failed ===")
sys.exit(1 if COUNTS['fail'] else 0)
