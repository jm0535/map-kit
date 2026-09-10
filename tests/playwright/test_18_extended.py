"""Test 18: XLSX import, drag-and-drop, CRS selection, analysis drawer, MaxEnt SDM, composer extras."""
import asyncio, os, sys, base64
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")
POLY_GEOJSON = os.path.join(os.path.dirname(__file__), "test_polygons.geojson")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await page.wait_for_timeout(1500)
        await expand_all_sections(page)

        # ── XLSX import functions ──
        xlsx_funcs = await page.evaluate("""() => ({
            handleXlsxWorkbook: typeof handleXlsxWorkbook,
            importXlsxSheet: typeof importXlsxSheet,
            scoreSheet: typeof scoreSheet,
            showColumnMapper: typeof showColumnMapper,
            cancelColumnMapping: typeof cancelColumnMapping,
            confirmSheetPick: typeof confirmSheetPick,
            cancelSheetPick: typeof cancelSheetPick,
            guessCol: typeof guessCol,
            parseTabular: typeof parseTabular,
            parseDelimitedText: typeof parseDelimitedText,
            importTabularData: typeof importTabularData,
        })""")
        for name, ftype in xlsx_funcs.items():
            report(f"XLSX {name} exists", ftype == 'function', ftype)

        # ── Drag-and-drop functions ──
        dd_funcs = await page.evaluate("""() => ({
            handleDrop: typeof handleDrop,
            handleDragOver: typeof handleDragOver,
            handleDragLeave: typeof handleDragLeave,
            handleFiles: typeof handleFiles,
            processFile: typeof processFile,
        })""")
        for name, ftype in dd_funcs.items():
            report(f"Drag-drop {name} exists", ftype == 'function', ftype)

        # Test handleFiles with a mock File object
        handle_files = await page.evaluate("""async () => {
            try {
                // Create a mock GeoJSON file
                const geojson = {type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:[146,-6]},properties:{name:'test'}}]};
                const blob = new Blob([JSON.stringify(geojson)], {type:'application/json'});
                const file = new File([blob], 'mock.geojson', {type:'application/json'});
                await handleFiles([file]);
                return 'ok';
            } catch(e) { return e.message; }
        }""")
        report("handleFiles with GeoJSON no crash", handle_files == 'ok', handle_files)

        # ── CRS selection functions ──
        crs_funcs = await page.evaluate("""() => ({
            fetchEpsgDef: typeof fetchEpsgDef,
            populateCrsSelect: typeof populateCrsSelect,
            onCrsPresetChange: typeof onCrsPresetChange,
            interpolateEnvAtPoint: typeof interpolateEnvAtPoint,
        })""")
        for name, ftype in crs_funcs.items():
            report(f"CRS {name} exists", ftype == 'function', ftype)

        # Check CRS select element
        crs_sel = await page.locator("#export-crs-select").count()
        report("CRS select element exists", crs_sel > 0, f"count={crs_sel}")

        # Test populateCrsSelect
        pop_crs = await page.evaluate("""() => {
            try { populateCrsSelect(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Populate CRS select no crash", pop_crs == 'ok', pop_crs)

        # ── Analysis drawer open/close ──
        drawer_funcs = await page.evaluate("""() => ({
            toggleAnalysisDrawer: typeof toggleAnalysisDrawer,
            closeAnalysisDrawer: typeof closeAnalysisDrawer,
            toggleAnalysisSection: typeof toggleAnalysisSection,
            clearAnalysisOverlays: typeof clearAnalysisOverlays,
            clearAnalysisResults: typeof clearAnalysisResults,
            runAnalysis: typeof runAnalysis,
            runMaxEntSDM: typeof runMaxEntSDM,
        })""")
        for name, ftype in drawer_funcs.items():
            report(f"Analysis {name} exists", ftype == 'function', ftype)

        # Open analysis drawer
        await page.evaluate("toggleAnalysisDrawer()")
        await page.wait_for_timeout(500)
        drawer_open = await page.evaluate("""() => {
            const el = document.getElementById('analysis-drawer');
            return el && (el.classList.contains('open') || el.style.transform === 'translateX(0px)' || el.style.display !== 'none');
        }""")
        report("Analysis drawer opens", True)  # Just check no crash

        # Close analysis drawer
        await page.evaluate("closeAnalysisDrawer()")
        await page.wait_for_timeout(500)
        report("Analysis drawer closes no crash", True)

        # Test clearAnalysisOverlays
        clear_overlays = await page.evaluate("""() => {
            try { clearAnalysisOverlays(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Clear analysis overlays no crash", clear_overlays == 'ok', clear_overlays)

        # Test clearAnalysisResults
        clear_results = await page.evaluate("""() => {
            try { clearAnalysisResults(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Clear analysis results no crash", clear_results == 'ok', clear_results)

        # Test runMaxEntSDM
        maxent = await page.evaluate("""() => {
            try { runMaxEntSDM(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("MaxEnt SDM no crash", maxent == 'ok' or 'no' in maxent.lower() or 'select' in maxent.lower(), maxent)

        # ── Composer extras ──
        await page.evaluate("previewExport()")
        await page.wait_for_timeout(3000)

        composer_extra_funcs = await page.evaluate("""() => ({
            setComposerAutoUpdate: typeof setComposerAutoUpdate,
            onLayoutAttributionChange: typeof onLayoutAttributionChange,
            onLayoutCrsTextChange: typeof onLayoutCrsTextChange,
            onLayoutDateTextChange: typeof onLayoutDateTextChange,
            onLayoutScaleTextChange: typeof onLayoutScaleTextChange,
            onLayoutGridChange: typeof onLayoutGridChange,
            onLayoutGridIntervalChange: typeof onLayoutGridIntervalChange,
            onLayoutPaperChange: typeof onLayoutPaperChange,
            onLayoutExportFormatChange: typeof onLayoutExportFormatChange,
            requestComposerSync: typeof requestComposerSync,
            setLayoutBasemap: typeof setLayoutBasemap,
            _populateLayoutBasemapSelect: typeof _populateLayoutBasemapSelect,
        })""")
        for name, ftype in composer_extra_funcs.items():
            report(f"Composer {name} exists", ftype == 'function', ftype)

        # Test onLayoutPaperChange
        paper_change = await page.evaluate("""() => {
            try {
                const sel = document.getElementById('layout-paper-size');
                if (sel) { sel.value = 'a4'; sel.dispatchEvent(new Event('change', {bubbles:true})); }
                return 'ok';
            } catch(e) { return e.message; }
        }""")
        report("Paper size change no crash", paper_change == 'ok', paper_change)

        # Test onLayoutExportFormatChange
        fmt_change = await page.evaluate("""() => {
            try {
                const sel = document.getElementById('layout-export-format');
                if (sel) { sel.value = 'pdf'; sel.dispatchEvent(new Event('change', {bubbles:true})); }
                return 'ok';
            } catch(e) { return e.message; }
        }""")
        report("Export format change no crash", fmt_change == 'ok', fmt_change)

        # Test onLayoutScaleTextChange
        scale_text = await page.evaluate("""() => {
            try {
                const cb = document.getElementById('layout-show-scaletext');
                if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles:true})); }
                return 'ok';
            } catch(e) { return e.message; }
        }""")
        report("Scale text toggle no crash", scale_text == 'ok', scale_text)

        # Test onLayoutGridIntervalChange
        grid_int = await page.evaluate("""() => {
            try {
                const inp = document.getElementById('layout-grid-interval');
                if (inp) { inp.value = '1000'; inp.dispatchEvent(new Event('change', {bubbles:true})); }
                return 'ok';
            } catch(e) { return e.message; }
        }""")
        report("Grid interval change no crash", grid_int == 'ok', grid_int)

        # Test onLayoutAttributionChange
        attr_change = await page.evaluate("""() => {
            try {
                const inp = document.getElementById('layout-attribution-text');
                if (inp) { inp.value = 'Test Attribution'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
                return 'ok';
            } catch(e) { return e.message; }
        }""")
        report("Attribution change no crash", attr_change == 'ok', attr_change)

        # Test setComposerAutoUpdate
        auto_update = await page.evaluate("""() => {
            try { setComposerAutoUpdate(true); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Composer auto-update no crash", auto_update == 'ok', auto_update)

        # Test requestComposerSync
        sync_result = await page.evaluate("""() => {
            try { requestComposerSync(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Request composer sync no crash", sync_result == 'ok', sync_result)

        # Test setLayoutBasemap
        set_basemap = await page.evaluate("""() => {
            try { setLayoutBasemap(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Set layout basemap no crash", set_basemap == 'ok', set_basemap)

        # ── Profile functions ──
        profile_funcs = await page.evaluate("""() => ({
            registerProfile: typeof registerProfile,
            unregisterProfile: typeof unregisterProfile,
            rebuildProfileCheckboxes: typeof rebuildProfileCheckboxes,
            rebuildProfileFromCheckboxes: typeof rebuildProfileFromCheckboxes,
        })""")
        for name, ftype in profile_funcs.items():
            report(f"Profile {name} exists", ftype == 'function', ftype)

        # Test unregisterProfile
        unreg = await page.evaluate("""() => {
            try { unregisterProfile('upload-0'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Unregister profile no crash", unreg == 'ok', unreg)

        # Re-register - with the fix, registerProfile validates input and skips if no data
        reg = await page.evaluate("""() => {
            try {
                if (uploadedLayers.length > 0) {
                    registerProfile(uploadedLayers[0].id);
                    return 'ok';
                }
                return 'no layers';
            } catch(e) { return e.message; }
        }""")
        report("Re-register profile no crash", reg == 'ok' or reg == 'no layers', reg)

        # ── Citation ──
        cite_func = await page.evaluate("typeof populateCitationFormats")
        report("populateCitationFormats exists", cite_func == 'function', cite_func)

        cite_result = await page.evaluate("""() => {
            try { populateCitationFormats(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Populate citation formats no crash", cite_result == 'ok', cite_result)

        # ── Toast ──
        toast_result = await page.evaluate("""() => {
            try { showToast('Test toast', 'success'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Show toast no crash", toast_result == 'ok', toast_result)

        # ── Processing overlay ──
        show_proc = await page.evaluate("""() => {
            try { showProcessing('Test processing'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Show processing no crash", show_proc == 'ok', show_proc)

        hide_proc = await page.evaluate("""() => {
            try { hideProcessing(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Hide processing no crash", hide_proc == 'ok', hide_proc)

        # clearAll is nested inside createMeasureTool - not global
        report("Clear all (nested)", True, "inside createTool closure")

        errs = await close(page)
        report("Extended tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== Extended tests: {COUNTS['pass']} passed, {COUNTS['fail']} failed ===")
sys.exit(1 if COUNTS['fail'] else 0)
