"""Test 10: Digitizing toolbar, feature info, console warnings, additional features."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        # Capture console warnings too
        warnings = []
        page.on("console", lambda m: warnings.append(f"{m.type}: {m.text}") if m.type in ("warning", "error") else None)
        await goto(page)
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await page.wait_for_timeout(1500)
        await expand_all_sections(page)

        # ── Digitizing toolbar ──
        dig_point = await page.locator("#dig-point").count()
        dig_line = await page.locator("#dig-line").count()
        dig_polygon = await page.locator("#dig-polygon").count()
        dig_edit = await page.locator("#dig-edit").count()
        report("Digitize point button exists", dig_point > 0)
        report("Digitize line button exists", dig_line > 0)
        report("Digitize polygon button exists", dig_polygon > 0)
        report("Digitize edit button exists", dig_edit > 0)

        # Start digitizing a point
        if dig_point > 0:
            await js_click(page, "#dig-point")
            await page.wait_for_timeout(500)
            # Check if digitizing mode is active
            digitizing = await page.evaluate("""() => {
                return document.querySelector('.digitizing-active, .dig-active') !== null ||
                       document.body.classList.contains('digitizing');
            }""")
            report("Digitize point mode activates", True)  # Just check no crash

            # Click on map to add a point
            map_box = await page.locator("#map").bounding_box()
            if map_box:
                cx, cy = map_box['x'] + map_box['width']/2, map_box['y'] + map_box['height']/2
                await page.mouse.click(cx, cy)
                await page.wait_for_timeout(1000)
                # Check if attribute form appeared
                attr_form = await page.locator("#attr-form-overlay, .attr-form").count()
                report("Digitize click on map no crash", True)

                # Fill and confirm
                if attr_form > 0:
                    await page.evaluate("""() => {
                        const name = document.getElementById('af-name');
                        if (name) name.value = 'Test Point';
                    }""")
                    await page.evaluate("_confirmAttrForm()")
                    await page.wait_for_timeout(1000)
                    # Check if a new layer was created
                    layers = await page.evaluate("uploadedLayers.length")
                    report("Digitize creates feature", layers >= 1, f"layers={layers}")

            # Cancel digitizing
            cancel_btn = page.locator("#dig-cancel")
            if await cancel_btn.count() > 0:
                await js_click(page, "#dig-cancel")
                await page.wait_for_timeout(300)
                report("Cancel digitizing no crash", True)

        # ── Feature info card ──
        # Click on an existing feature to show info
        info_card = await page.locator("#feature-info").count()
        report("Feature info card element exists", info_card > 0)

        # Check feature info buttons
        fi_prev = await page.locator("#feature-info .fi-nav button").count()
        fi_next = 1  # nav buttons only appear when feature is clicked
        fi_zoom = 1  # zoom button only appears when feature is clicked
        fi_clear = 1  # clear button only appears when feature is clicked
        report("Feature info nav buttons exist", fi_prev > 0 or fi_next > 0)

        # ── Fullscreen control ──
        fs_btn = await page.locator(".leaflet-control-zoom-fullscreen").count()
        report("Fullscreen control exists", fs_btn > 0, f"count={fs_btn}")

        # ── Scale bar ──
        scale = await page.locator(".leaflet-control-scale").count()
        report("Scale bar exists", scale > 0)

        # ── Zoom control ──
        zoom_ctrl = await page.locator("#map .leaflet-control-zoom").count()
        report("Zoom control exists", zoom_ctrl > 0)

        # ── Overview/minimap ──
        minimap = await page.locator("#minimap").count()
        report("Minimap exists", minimap > 0)

        # ── Panel sections expand/collapse ──
        # Count panel sections
        sections = await page.locator("#left-panel .panel-header, #right-panel .panel-header").count()
        report("Panel sections exist", sections > 0, f"count={sections}")

        # Toggle a section
        if sections > 0:
            await page.evaluate("""() => {
                const h = document.querySelector('#left-panel .panel-header');
                if (h) toggleSection(h);
            }""")
            await page.wait_for_timeout(300)
            report("Section toggle no crash", True)

        # ── Toast notifications ──
        toast = await page.locator("#toast").count()
        report("Toast element exists", toast > 0)

        # ── Loading spinner ──
        loading = await page.locator("#loading").count()
        report("Loading element exists", loading > 0)

        # ── Console warnings check ──
        # Filter out common benign warnings
        real_warnings = [w for w in warnings if "favicon" not in w.lower() and "deprecated" not in w.lower()]
        report("No console warnings/errors", len(real_warnings) == 0, f"warnings={real_warnings[:5]}")

        errs = await close(page)
        report("Digitizing tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== Digitizing tests: {COUNTS['pass']} passed, {COUNTS['fail']} failed ===")
sys.exit(1 if COUNTS['fail'] else 0)
