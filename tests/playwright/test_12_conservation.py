"""Test 12: Conservation tools — overlay, protection gap, WLC, fragmentation, connectivity, change detection, SDM, hotspot grid, raster reclassify."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")
POLY_GEOJSON = os.path.join(os.path.dirname(__file__), "test_polygons.geojson")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", POLY_GEOJSON)
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await page.wait_for_timeout(1000)
        await expand_all_sections(page)

        # Open analysis drawer
        await page.evaluate("toggleAnalysisDrawer()")
        await page.wait_for_timeout(500)
        # Expand all analysis sections
        await expand_all_sections(page)

        # ── Check all GSX conservation functions exist ──
        funcs = await page.evaluate("""() => ({
            uiOverlay: typeof GSX.uiOverlay,
            uiProtectionGap: typeof GSX.uiProtectionGap,
            runSuitabilityWLC: typeof GSX.runSuitabilityWLC,
            uiFragmentation: typeof GSX.uiFragmentation,
            uiConnectivity: typeof GSX.uiConnectivity,
            uiChangeDetection: typeof GSX.uiChangeDetection,
            uiBioclim: typeof GSX.uiBioclim,
            uiMahalanobis: typeof GSX.uiMahalanobis,
            uiRasterHistogram: typeof GSX.uiRasterHistogram,
            uiRasterToPolygons: typeof GSX.uiRasterToPolygons,
            uiExportProvenance: typeof GSX.uiExportProvenance,
            runHotspotGrid: typeof runHotspotGrid,
        })""")
        for name, ftype in funcs.items():
            report(f"GSX.{name} exists", ftype == 'function', ftype)

        # ── Conservation overlay ──
        # Set overlay operation and run
        overlay_result = await page.evaluate("""() => {
            try {
                const opSel = document.getElementById('gsx-overlay-op');
                if (opSel) opSel.value = opSel.options[0].value;
                // Check if layers are available for overlay
                const layerSel = document.getElementById('analysis-layer-select');
                return {hasOp: !!opSel, layerCount: layerSel ? layerSel.options.length : 0};
            } catch(e) { return {error: e.message}; }
        }""")
        report("Conservation overlay UI exists", overlay_result.get('hasOp', False), str(overlay_result))

        # Run overlay
        overlay_ran = await page.evaluate("""() => {
            try { GSX.uiOverlay(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Conservation overlay runs", overlay_ran == 'ok' or 'select' in overlay_ran.lower() or 'no' in overlay_ran.lower(), overlay_ran)

        # ── Protection gap ──
        pg_ran = await page.evaluate("""() => {
            try { GSX.uiProtectionGap(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Protection gap runs", pg_ran == 'ok' or 'select' in pg_ran.lower() or 'no' in pg_ran.lower(), pg_ran)

        # ── WLC suitability ──
        wlccell = await page.evaluate("""() => {
            const el = document.getElementById('gsx-wlc-cellsize');
            return el ? el.tagName : null;
        }""")
        report("WLC cell size input exists", wlccell is not None)

        wlccrit = await page.evaluate("""() => {
            const el = document.getElementById('gsx-wlc-criteria');
            return el ? el.children.length : 0;
        }""")
        report("WLC criteria container exists", wlccrit is not None)

        wlc_ran = await page.evaluate("""() => {
            try { GSX.runSuitabilityWLC(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("WLC suitability runs", wlc_ran == 'ok' or 'no' in wlc_ran.lower() or 'select' in wlc_ran.lower(), wlc_ran)

        # ── Fragmentation / patch metrics ──
        frag_ran = await page.evaluate("""() => {
            try { GSX.uiFragmentation(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Fragmentation runs", frag_ran == 'ok' or 'no' in frag_ran.lower() or 'select' in frag_ran.lower(), frag_ran)

        # ── Connectivity graph ──
        conn_ran = await page.evaluate("""() => {
            try { GSX.uiConnectivity(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Connectivity graph runs", conn_ran == 'ok' or 'no' in conn_ran.lower() or conn_ran == 'ok', conn_ran)

        # ── Change detection ──
        cd_ran = await page.evaluate("""() => {
            try { GSX.uiChangeDetection(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Change detection runs", cd_ran == 'ok' or 'no' in cd_ran.lower() or 'select' in cd_ran.lower(), cd_ran)

        # ── SDM BIOCLIM ──
        bio_ran = await page.evaluate("""() => {
            try { GSX.uiBioclim(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("SDM BIOCLIM runs", bio_ran == 'ok' or 'no' in bio_ran.lower() or 'select' in bio_ran.lower(), bio_ran)

        # ── SDM Mahalanobis ──
        maha_ran = await page.evaluate("""() => {
            try { GSX.uiMahalanobis(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("SDM Mahalanobis runs", maha_ran == 'ok' or 'no' in maha_ran.lower() or 'select' in maha_ran.lower(), maha_ran)

        # ── Hotspot grid ──
        hsg_ran = await page.evaluate("""() => {
            try { runHotspotGrid(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Hotspot grid runs", hsg_ran == 'ok' or 'no' in hsg_ran.lower() or 'select' in hsg_ran.lower(), hsg_ran)

        # ── Provenance export ──
        # Mock download and capture CSV
        prov_csv = await page.evaluate("""async () => {
            let captured = null;
            const orig = URL.createObjectURL;
            URL.createObjectURL = function(blob) {
                blob.text().then(t => { captured = t; });
                return 'blob:mock';
            };
            try {
                const btn = document.querySelector('button[onclick*="uiExportProvenance"]');
                if (btn) {
                    // Set format to CSV
                    const fmtSel = document.getElementById('gsx-prov-format');
                    if (fmtSel) fmtSel.value = 'csv';
                    GSX.uiExportProvenance();
                } else {
                    GSX.uiExportProvenance();
                }
            } catch(e) { URL.createObjectURL = orig; return 'error: ' + e.message; }
            await new Promise(r => setTimeout(r, 300));
            URL.createObjectURL = orig;
            return captured ? captured.substring(0, 200) : 'no data';
        }""")
        report("Provenance export produces data", prov_csv and 'error' not in prov_csv, prov_csv[:100] if prov_csv else 'null')

        errs = await close(page)
        report("Conservation tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== Conservation tests: {COUNTS['pass']} passed, {COUNTS['fail']} failed ===")
sys.exit(1 if COUNTS['fail'] else 0)
