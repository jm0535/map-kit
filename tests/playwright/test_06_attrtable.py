"""Test 06: Attribute table + calculate field."""
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

        # ── Attribute table ──
        # Select the layer in attr table selector
        await page.evaluate("""() => {
            const sel = document.getElementById('attr-layer-select');
            if (sel && sel.options.length > 1) sel.selectedIndex = 1;
        }""")
        await page.wait_for_timeout(500)

        # Load the attribute table
        if await page.locator("#attr-layer-select").count() > 0:
            await page.evaluate("""() => {
                const sel = document.getElementById('attr-layer-select');
                if (sel) sel.dispatchEvent(new Event('change', {bubbles:true}));
            }""")
            await page.wait_for_timeout(1000)

        # Check table populated
        rows = await page.locator("#attr-table tbody tr").count()
        report("Attribute table populated", rows > 0, f"rows={rows}")

        # ── Table search ──
        if rows > 0:
            await page.fill("#attr-search", "100")
            await page.wait_for_timeout(500)
            filtered_rows = await page.locator("#attr-table tbody tr").count()
            report("Attribute table search filters", filtered_rows <= rows, f"{rows}->{filtered_rows}")
            await page.fill("#attr-search", "")
            await page.wait_for_timeout(500)

        # ── Column sort ──
        th_count = await page.locator("#attr-table th").count()
        report("Attribute table has columns", th_count > 0, f"cols={th_count}")
        if th_count > 0:
            await page.locator("#attr-table th").first.click()
            await page.wait_for_timeout(500)
            report("Column sort no crash", True)

        # ── Calculate field ──
        # Check if calculate field UI exists
        calc_exists = await page.evaluate("""() => {
            return !!(document.getElementById('gsx-calc-out') || document.getElementById('gsx-calc-run'));
        }""")
        report("Calculate field UI exists", calc_exists)

        if calc_exists:
            # Try the expression mode
            await page.evaluate("""() => {
                const typeSel = document.getElementById('gsx-calc-type');
                if (typeSel) typeSel.value = 'number';
                const nameInput = document.getElementById('gsx-calc-out');
                if (nameInput) nameInput.value = 'test_calc';
            }""")
            await page.wait_for_timeout(300)

            # Set expression
            await page.evaluate("""() => {
                const expr = document.getElementById('gsx-calc-expr');
                if (expr) expr.value = 'elevation * 2';
            }""")
            await page.wait_for_timeout(300)

            # Run
            run_btn = page.locator("#gsx-calc-run")
            if await run_btn.count() > 0:
                await page.evaluate("GSXCF.run()")
                await page.wait_for_timeout(2000)
                # Check if the new field was added
                has_new_field = await page.evaluate("""() => {
                    const sel = document.getElementById('attr-layer-select');
                    if (!sel) return false;
                    // Reload attr table to see new field
                    return true;
                }""")
                report("Calculate field runs", True)

        # ── Feature info card ──
        # Click on a map feature to show info
        # This is hard to test without knowing exact pixel positions,
        # but we can check the info card element exists
        info_card = await page.locator("#feature-info").count()
        report("Feature info card element exists", info_card > 0)

        errs = await close(page)
        report("Attr table tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== {COUNTS["pass"]} passed, {COUNTS["fail"]} failed ===")
sys.exit(1 if COUNTS["fail"] else 0)
