"""Test 03: Symbology & styling — single, categorized, graduated, labels, legend."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")
RICHNESS = os.path.join(os.path.dirname(__file__), "..", "..", "samples", "sample_species_richness.geojson")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", RICHNESS)
        await page.wait_for_timeout(1500)
        await expand_all_sections(page)

        # ── Symbology panel exists ──
        panel = await page.locator("#symbology-panel").count()
        report("Symbology panel exists", panel > 0)

        # ── Select a layer in symbology ──
        # Click on the first layer item to select it
        await js_click(page, ".layer-item")
        await page.wait_for_timeout(500)

        # Check symbology controls are populated
        has_controls = await page.evaluate("""() => {
            const sel = document.getElementById('symbology-layer-select');
            return sel && sel.options.length > 0;
        }""")
        report("Symbology layer select populated", has_controls)

        # ── Single-symbol: change fill color ──
        # Find the color input for fill
        color_input = await page.evaluate("""() => {
            const inputs = document.querySelectorAll('#symbology-controls input[type="color"]');
            return inputs.length;
        }""")
        report("Color picker inputs exist", color_input > 0, f"count={color_input}")

        if color_input > 0:
            # Change fill color
            result = await page.evaluate("""() => {
                const colorInput = document.querySelector('#symbology-controls input[type="color"]');
                if (!colorInput) return 'no color input';
                colorInput.value = '#ff0000';
                colorInput.dispatchEvent(new Event('change', {bubbles:true}));
                return 'ok';
            }""")
            await page.wait_for_timeout(500)
            report("Fill color change applied", result == "ok", result)

        # ── Opacity slider ──
        opacity = await page.evaluate("""() => {
            const slider = document.querySelector('#symbology-controls input[type="range"]');
            if (!slider) return null;
            return {min: slider.min, max: slider.max, value: slider.value};
        }""")
        report("Opacity slider exists", opacity is not None, str(opacity))

        # ── Categorized renderer ──
        # Click the "Categorized" tab
        cat_tab_count = await page.locator("button[data-tab='categorized'], #sym-tab-categorized").count()
        if cat_tab_count > 0:
            await page.locator("button[data-tab='categorized'], #sym-tab-categorized").first.click()
            await page.wait_for_timeout(500)
            # Check categorized controls appeared
            cat_attr = await page.locator("#cat-attr-select, [id^='cat-attr']").count()
            cat_visible = cat_attr > 0
            report("Categorized tab shows controls", cat_visible)

            if cat_visible:
                # Apply categorized
                apply_btn = page.locator("button").filter(has_text="Apply").first
                if await apply_btn.count() > 0:
                    await page.evaluate("applyCategorized('upload-0')")
                    await page.wait_for_timeout(1000)
                    report("Categorized apply no crash", True)
        else:
            report("Categorized tab exists", False, "no tab found")

        # ── Graduated renderer ──
        grad_tab_count = await page.locator("button[data-tab='graduated'], #sym-tab-graduated").count()
        if grad_tab_count > 0:
            await page.locator("button[data-tab='graduated'], #sym-tab-graduated").first.click()
            await page.wait_for_timeout(500)
            grad_attr = await page.locator("#grad-attr-select, [id^='grad-attr']").count()
            grad_visible = grad_attr > 0
            report("Graduated tab shows controls", grad_visible)

            if grad_visible:
                apply_btn = page.locator("button").filter(has_text="Apply").first
                if await apply_btn.count() > 0:
                    await page.evaluate("applyGraduated('upload-0')")
                    await page.wait_for_timeout(1000)
                    report("Graduated apply no crash", True)
        else:
            report("Graduated tab exists", False, "no tab found")

        # ── Reset symbology ──
        reset_btn = page.locator("button").filter(has_text="Reset").first
        if await reset_btn.count() > 0:
            await page.evaluate("resetSymbology()")
            await page.wait_for_timeout(500)
            report("Reset symbology no crash", True)

        # ── Label popover ──
        label_btn = page.locator(".layer-label-btn").first
        if await label_btn.count() > 0:
            await js_click(page, ".layer-label-btn")
            await page.wait_for_timeout(500)
            popover = await page.locator("#lp-overlay, .label-popover").count()
            report("Label popover opens", popover > 0)
            # Close it
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(300)
        else:
            report("Label button exists", False, "no label button")

        # ── Map legend ──
        legend = await page.locator(".map-legend, .leaflet-control-map-legend").count()
        report("Map legend exists", legend > 0, f"count={legend}")

        errs = await close(page)
        report("Symbology tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== {COUNTS["pass"]} passed, {COUNTS["fail"]} failed ===")
sys.exit(1 if COUNTS["fail"] else 0)
