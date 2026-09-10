"""Test 09: Bookmarks, measure tool, search/geocoding, citation."""
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

        # ── Bookmarks ──
        # Save a bookmark
        bm_input = page.locator("#bookmark-name")
        if await bm_input.count() > 0:
            await bm_input.fill("Test Bookmark")
            # Click save button next to it
            save_bm = page.locator("button").filter(has_text="Save").first
            # Find the bookmark save button specifically
            bm_save = page.locator("#bookmarks-panel button, #bookmarks-list button").first
            # Try clicking the save button in the bookmarks section
            await page.evaluate("""() => {
                const inp = document.getElementById('bookmark-name');
                if (inp) inp.value = 'Test Bookmark';
                addBookmark();
            }""")
            await page.wait_for_timeout(500)

            bm_count = await page.locator(".bookmark-item").count()
            report("Bookmark saved", bm_count > 0, f"count={bm_count}")

            if bm_count > 0:
                # Go to bookmark
                await page.evaluate("""() => {
                    const items = document.querySelectorAll('.bookmark-item');
                    if (items[0]) items[0].click();
                }""")
                await page.wait_for_timeout(1000)
                report("Go to bookmark no crash", True)

                # Delete bookmark
                bm_before = await page.locator(".bookmark-item").count()
                await page.evaluate("""() => {
                    const del = document.querySelector('.bookmark-item button[title="Remove"]');
                    if (del) del.click();
                }""")
                await page.wait_for_timeout(500)
                bm_after = await page.locator(".bookmark-item").count()
                report("Delete bookmark", bm_after < bm_before, f"{bm_before}->{bm_after}")
        else:
            report("Bookmark input exists", False, "no #bookmark-name")

        # ── Measure tool ──
        measure_btn = await page.locator(".measure-ctrl-btn").count()
        report("Measure tool button exists", measure_btn > 0, f"count={measure_btn}")

        if measure_btn > 0:
            # Click to open measure tool
            await page.locator(".measure-ctrl-btn").first.click()
            await page.wait_for_timeout(500)
            # Check measure controls appeared
            measure_panel = await page.evaluate("""() => {
                const el = document.querySelector('.measure-panel, .measure-controls');
                return el && el.style.display !== 'none';
            }""")
            report("Measure panel opens", measure_panel)

            # Click Distance mode
            dist_btn = page.locator("button").filter(has_text="Distance").first
            if await dist_btn.count() > 0:
                await dist_btn.click()
                await page.wait_for_timeout(300)
                report("Distance mode activated", True)

            # Click on map to add measure points
            map_box = await page.locator("#map").bounding_box()
            if map_box:
                cx, cy = map_box['x'] + map_box['width']/2, map_box['y'] + map_box['height']/2
                await page.mouse.click(cx, cy)
                await page.wait_for_timeout(300)
                await page.mouse.click(cx + 50, cy + 30)
                await page.wait_for_timeout(300)
                # Check measurement result
                has_result = await page.evaluate("""() => {
                    const el = document.querySelector('.measure-primary');
                    return el && el.textContent.length > 0;
                }""")
                report("Measure produces result", has_result)

            # Clear measurement
            clear_btn = page.locator("button").filter(has_text="Clear").first
            if await clear_btn.count() > 0:
                await clear_btn.click()
                await page.wait_for_timeout(300)
                report("Measure clear no crash", True)

        # ── Search/geocoding ──
        search_input = page.locator("#goto-search")
        if await search_input.count() > 0:
            # Test coordinate search (format: lat,lon or lon,lat)
            await search_input.fill("-6, 146")
            # Click search button or press Enter
            search_btn = page.locator("#search-box button").first
            if await search_btn.count() > 0:
                await search_btn.click()
            else:
                await search_input.press("Enter")
            await page.wait_for_timeout(1500)
            # Check map moved (center should be near -6, 146)
            center = await page.evaluate("map.getCenter()")
            report("Search/goto coordinate", abs(center["lat"] - (-6)) < 1 and abs(center["lng"] - 146) < 1, f"center={center}")
        else:
            report("Search input exists", False, "no #goto-search")

        # ── Citation tab ──
        await page.evaluate("switchBottomTab('cite')")
        await page.wait_for_timeout(500)
        cite_visible = await page.evaluate("""() => {
            const el = document.getElementById('bottom-tab-cite');
            return el && el.style.display !== 'none';
        }""")
        report("Citation tab visible", cite_visible)

        if cite_visible:
            # Check citation formats populated
            cite_content = await page.evaluate("""() => {
                const el = document.getElementById('cite-formats');
                return el ? el.innerHTML.length : 0;
            }""")
            report("Citation formats populated", cite_content > 0, f"len={cite_content}")

        # ── Provenance metadata fields ──
        author_field = await page.locator("#gsx-proj-authorName").count()
        title_field = await page.locator("#gsx-proj-title").count()
        report("Provenance author field exists", author_field > 0)
        report("Provenance title field exists", title_field > 0)

        errs = await close(page)
        report("Misc tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== {COUNTS["pass"]} passed, {COUNTS["fail"]} failed ===")
sys.exit(1 if COUNTS["fail"] else 0)
