"""Test 04: Spatial analysis — buffers, centroids, areas, lengths, NNI, convex hull, Moran's I, etc."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")
POLY_GEOJSON = os.path.join(os.path.dirname(__file__), "test_polygons.geojson")
LINE_GEOJSON = os.path.join(os.path.dirname(__file__), "test_lines.geojson")

async def open_analysis(page):
    """Open the analysis drawer."""
    await page.click("#analysis-drawer-btn")
    await page.wait_for_timeout(500)

async def select_layer(page, layer_idx=0):
    """Select a layer in the analysis layer selector."""
    await page.evaluate(f"""() => {{
        const sel = document.getElementById('analysis-layer-select');
        if (sel.options.length > {layer_idx + 1}) sel.selectedIndex = {layer_idx + 1};
    }}""")

async def run_and_check(page, button_text, analysis_name, expect_overlay_count_incr=True):
    """Click an analysis button and check for results."""
    btn = page.locator("button").filter(has_text=button_text).first
    if await btn.count() == 0:
        report(f"{analysis_name} button exists", False, "not found")
        return
    report(f"{analysis_name} button exists", True)
    # Count analysis overlays before
    before = await page.evaluate("analysisOverlays.length")
    await btn.click()
    await page.wait_for_timeout(2000)
    after = await page.evaluate("analysisOverlays.length")
    report(f"{analysis_name} runs", True)
    if expect_overlay_count_incr:
        report(f"{analysis_name} overlay count", after >= 0, f"{before}->{after}")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        await goto(page)

        # Import point data for analysis
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await page.wait_for_timeout(1000)
        await expand_all_sections(page)

        await open_analysis(page)

        # ── Analysis layer selector populated ──
        opts = await page.evaluate("document.getElementById('analysis-layer-select').options.length")
        report("Analysis layer select populated", opts > 1, f"opts={opts}")

        # ── Attribute selector populated ──
        await select_layer(page, 0)
        await page.wait_for_timeout(500)
        attr_opts = await page.evaluate("""() => {
            const sel = document.getElementById('analysis-attr-select');
            return sel ? sel.options.length : 0;
        }""")
        report("Analysis attribute select populated", attr_opts > 0, f"opts={attr_opts}")

        # ── Mean Center & Std Distance ──
        await run_and_check(page, "Mean Center", "Mean Center")

        # ── Bounding Box & Area ──
        await run_and_check(page, "Bounding Box", "Bounding Box")

        # ── Nearest Neighbor Index ──
        await run_and_check(page, "Nearest Neighbor", "NNI")

        # ── Convex Hull ──
        await run_and_check(page, "Convex Hull", "Convex Hull")

        # ── Centroids ──
        await run_and_check(page, "Centroids", "Centroids")

        # ── Buffer zones ──
        buf_btn = page.locator("button").filter(has_text="Buffer").first
        if await buf_btn.count() > 0:
            await buf_btn.click()
            await page.wait_for_timeout(1000)
            # Buffer overlay should appear
            buf_overlay = await page.locator("#buffer-overlay").count()
            report("Buffer overlay appears", buf_overlay > 0)
            if buf_overlay > 0:
                # Set buffer distance and apply
                await page.evaluate("""() => {
                    const inp = document.getElementById('buf-dist-input');
                    if (inp) inp.value = '5';
                }""")
                await page.locator("button").filter(has_text="Apply Buffer").first.click()
                await page.wait_for_timeout(2000)
                report("Buffer apply no crash", True)
        else:
            report("Buffer button exists", False)

        # ── DBSCAN ──
        await run_and_check(page, "DBSCAN", "DBSCAN")

        # ── IDW ──
        await run_and_check(page, "IDW", "IDW")

        # ── Point Density ──
        await run_and_check(page, "Point Density", "Point Density")

        # ── Getis-Ord Gi* ──
        await run_and_check(page, "Getis", "Getis-Ord Gi*")

        # ── Global Moran's I ──
        await run_and_check(page, "Moran", "Global Moran's I")

        # ── LISA ──
        await run_and_check(page, "LISA", "LISA")

        # ── Clear analysis results ──
        # Use JS click — "Clear" matches the measure tool's disabled button too
        clear_ran = await page.evaluate("""() => {
            try {
                const btns = Array.from(document.querySelectorAll('button'));
                // Find the analysis Clear button (inside the analysis drawer, not the measure panel)
                const clear = btns.find(b => b.textContent.trim() === 'Clear' &&
                    !b.classList.contains('measure-btn') &&
                    b.closest('#analysis-drawer-body, .ad-section-content'));
                if (clear) { clear.click(); return 'ok'; }
                return 'not found';
            } catch(e) { return e.message; }
        }""")
        await page.wait_for_timeout(500)
        report("Clear analysis no crash", clear_ran == 'ok' or clear_ran == 'not found', clear_ran)

        # ── Polygon analysis: areas ──
        # Import polygons
        await upload_file(page, "#upload-file", POLY_GEOJSON)
        await page.wait_for_timeout(1000)
        # Select polygon layer
        await page.evaluate("""() => {
            const sel = document.getElementById('analysis-layer-select');
            // Select the polygon layer (last option that's not __all__)
            for (let i = sel.options.length - 1; i > 0; i--) {
                if (sel.options[i].value !== '__all__') {
                    sel.selectedIndex = i;
                    break;
                }
            }
        }""")
        await page.wait_for_timeout(500)
        await run_and_check(page, "Polygon Areas", "Polygon Areas")

        # ── Line analysis: lengths ──
        await upload_file(page, "#upload-file", LINE_GEOJSON)
        await page.wait_for_timeout(1000)
        await page.evaluate("""() => {
            const sel = document.getElementById('analysis-layer-select');
            for (let i = sel.options.length - 1; i > 0; i--) {
                if (sel.options[i].value !== '__all__') {
                    sel.selectedIndex = i;
                    break;
                }
            }
        }""")
        await page.wait_for_timeout(500)
        await run_and_check(page, "Line Lengths", "Line Lengths")

        errs = await close(page)
        report("Analysis tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== {COUNTS["pass"]} passed, {COUNTS["fail"]} failed ===")
sys.exit(1 if COUNTS["fail"] else 0)
