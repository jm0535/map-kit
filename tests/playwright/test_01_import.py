"""Test 01: Data import — GeoJSON points/polygons/lines, CSV tabular, drag-drop."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")
POLY_GEOJSON = os.path.join(os.path.dirname(__file__), "test_polygons.geojson")
LINE_GEOJSON = os.path.join(os.path.dirname(__file__), "test_lines.geojson")
CSV_FILE = "/tmp/gsx_tests/test_points.csv"

async def main():
    async with async_playwright() as p:
        # ── GeoJSON point import ──
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        n = await page.evaluate("uploadedLayers.length")
        report("GeoJSON point import", n == 1, f"layers={n}")
        # Check layer registered with correct feature count
        fc = await page.evaluate("uploadedLayers[0].featureCount")
        report("GeoJSON point feature count", fc == 5, f"fc={fc}")
        # Check layer appears in panel
        items = await page.locator(".layer-item").count()
        report("GeoJSON layer in panel", items == 1, f"items={items}")
        errs = await close(page)
        report("GeoJSON import no errors", not errs, str(errs))

        # ── GeoJSON polygon import ──
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", POLY_GEOJSON)
        n = await page.evaluate("uploadedLayers.length")
        fc = await page.evaluate("uploadedLayers[0].featureCount")
        report("GeoJSON polygon import", n == 1 and fc == 3, f"layers={n} fc={fc}")
        errs = await close(page)
        report("Polygon import no errors", not errs, str(errs))

        # ── GeoJSON line import ──
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", LINE_GEOJSON)
        n = await page.evaluate("uploadedLayers.length")
        fc = await page.evaluate("uploadedLayers[0].featureCount")
        report("GeoJSON line import", n == 1 and fc == 2, f"layers={n} fc={fc}")
        errs = await close(page)
        report("Line import no errors", not errs, str(errs))

        # ── Multiple file import ──
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await upload_file(page, "#upload-file", POLY_GEOJSON)
        n = await page.evaluate("uploadedLayers.length")
        report("Multiple file import", n == 2, f"layers={n}")
        errs = await close(page)
        report("Multi-import no errors", not errs, str(errs))

        # ── CSV tabular import (triggers column mapper) ──
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", CSV_FILE)
        # Column mapper overlay should appear
        await page.wait_for_timeout(1000)
        mapper_visible = await page.evaluate("""() => {
            const el = document.getElementById('col-mapper-overlay');
            return el && el.style.display !== 'none';
        }""")
        report("CSV shows column mapper", mapper_visible)
        if mapper_visible:
            # Set lat/lon columns and confirm
            await page.evaluate("""() => {
                document.getElementById('cm-lat').value = 'lat';
                document.getElementById('cm-lon').value = 'lon';
            }""")
            # The confirm button uses onclick="confirmColumnMapping()" with text "Import"
            await page.evaluate("confirmColumnMapping()")
            await page.wait_for_timeout(1500)
            n = await page.evaluate("uploadedLayers.length")
            report("CSV import with column mapping", n == 1, f"layers={n}")
        errs = await close(page)
        report("CSV import no errors", not errs, str(errs))

        # ── Sample data button ──
        page = await new_page(p)
        await goto(page)
        # Check if there's a sample data button
        has_samples = await page.evaluate("""() => {
            const btns = document.querySelectorAll('button');
            return Array.from(btns).some(b => b.textContent.includes('sample') || b.textContent.includes('Sample'));
        }""")
        report("Sample data button exists", has_samples is not None)
        errs = await close(page)
        report("Sample check no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== {COUNTS["pass"]} passed, {COUNTS["fail"]} failed ===")
sys.exit(1 if COUNTS["fail"] else 0)
