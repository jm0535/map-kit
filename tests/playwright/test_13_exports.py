"""Test 13: Exports — profile PNG/PDF/SVG, simple map PNG/PDF, composer export, provenance CSV/Markdown."""
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

        # ── Profile export as PNG ──
        png_result = await page.evaluate("""async () => {
            let captured = null;
            const orig = URL.createObjectURL;
            URL.createObjectURL = function(blob) {
                blob.text().then(t => { captured = t.substring(0, 100); });
                return 'blob:mock';
            };
            try { exportProfile('png'); } catch(e) { URL.createObjectURL = orig; return 'error: ' + e.message; }
            await new Promise(r => setTimeout(r, 500));
            URL.createObjectURL = orig;
            return captured ? 'ok' : 'no data';
        }""")
        report("Profile export PNG", png_result == 'ok', png_result)

        # ── Profile export as SVG ──
        svg_result = await page.evaluate("""async () => {
            let captured = null;
            const orig = URL.createObjectURL;
            URL.createObjectURL = function(blob) {
                blob.text().then(t => { captured = t.substring(0, 200); });
                return 'blob:mock';
            };
            try { exportProfile('svg'); } catch(e) { URL.createObjectURL = orig; return 'error: ' + e.message; }
            await new Promise(r => setTimeout(r, 500));
            URL.createObjectURL = orig;
            return captured || 'no data';
        }""")
        report("Profile export SVG", svg_result and 'error' not in svg_result and svg_result != 'no data', svg_result[:100] if svg_result else 'null')
        report("Profile SVG has SVG content", svg_result and '<svg' in svg_result.lower(), svg_result[:50] if svg_result else 'null')

        # ── Profile export as PDF ──
        pdf_result = await page.evaluate("""async () => {
            let captured = null;
            const orig = URL.createObjectURL;
            URL.createObjectURL = function(blob) {
                blob.arrayBuffer().then(buf => { captured = buf.byteLength; });
                return 'blob:mock';
            };
            try { exportProfile('pdf'); } catch(e) { URL.createObjectURL = orig; return 'error: ' + e.message; }
            await new Promise(r => setTimeout(r, 3000));
            URL.createObjectURL = orig;
            return captured ? 'ok (' + captured + ' bytes)' : 'no data';
        }""")
        report("Profile export PDF", pdf_result and 'ok' in pdf_result, pdf_result)

        # ── Simple map export (PNG) ──
        # Check openExport function exists
        has_open_export = await page.evaluate("typeof openExport === 'function'")
        report("openExport function exists", has_open_export)

        if has_open_export:
            # Open the export overlay
            await page.evaluate("openExport('png')")
            await page.wait_for_timeout(1000)
            export_overlay = await page.evaluate("""() => {
                const el = document.getElementById('export-overlay');
                return el && el.style.display !== 'none';
            }""")
            report("Export overlay opens", export_overlay)

            if export_overlay:
                # Check export controls
                has_format = await page.evaluate("""() => {
                    return !!document.querySelector('#export-overlay select, #export-overlay input');
                }""")
                report("Export overlay has controls", has_format)

                # Close overlay
                await page.evaluate("""() => {
                    const el = document.getElementById('export-overlay');
                    if (el) el.style.display = 'none';
                }""")

        # ── Composer export ──
        await page.evaluate("previewExport()")
        await page.wait_for_timeout(3000)

        # Set export format and check export button
        has_export_btn = await page.locator("#layout-export-btn").count()
        report("Composer export button exists", has_export_btn > 0)

        # Check export format selector
        has_format_sel = await page.locator("#layout-export-format").count()
        report("Composer export format selector exists", has_format_sel > 0)

        # Check DPI input
        has_dpi = await page.locator("#layout-dpi").count()
        report("Composer DPI input exists", has_dpi > 0)

        # Check extent selector
        has_extent = await page.locator("#layout-extent").count()
        report("Composer extent selector exists", has_extent > 0)

        # Try actual export (mock anchor click to capture download)
        composer_export = await page.evaluate("""async () => {
            let captured = null;
            // Mock anchor click to capture the download URL
            const origClick = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function() {
                if (this.href && this.href.startsWith('data:image/png')) {
                    captured = 'ok (' + this.href.length + ' chars)';
                } else if (this.download) {
                    captured = 'ok (download=' + this.download + ')';
                }
            };
            try {
                const fmt = document.getElementById('layout-export-format');
                if (fmt) fmt.value = 'png';
                await layoutExport('png');
            } catch(e) { HTMLAnchorElement.prototype.click = origClick; return 'error: ' + e.message; }
            await new Promise(r => setTimeout(r, 3000));
            HTMLAnchorElement.prototype.click = origClick;
            return captured || 'no data';
        }""")
        report("Composer export PNG", composer_export and 'ok' in str(composer_export), str(composer_export))

        # ── Provenance export CSV ──
        prov_csv = await page.evaluate("""async () => {
            let captured = null;
            const orig = URL.createObjectURL;
            URL.createObjectURL = function(blob) {
                blob.text().then(t => { captured = t; });
                return 'blob:mock';
            };
            try { GSX.uiExportProvenance(); } catch(e) { URL.createObjectURL = orig; return 'error: ' + e.message; }
            await new Promise(r => setTimeout(r, 500));
            URL.createObjectURL = orig;
            return captured ? captured.substring(0, 200) : 'no data';
        }""")
        report("Provenance export produces data", prov_csv and 'error' not in prov_csv, prov_csv[:100] if prov_csv else 'null')

        errs = await close(page)
        report("Export tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== Export tests: {COUNTS['pass']} passed, {COUNTS['fail']} failed ===")
sys.exit(1 if COUNTS['fail'] else 0)
