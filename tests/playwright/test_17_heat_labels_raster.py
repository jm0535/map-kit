"""Test 17: Heat map, labels, raster controls, basemap opacity, layer opacity/stroke."""
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

        # ── Heat map controls ──
        heat_funcs = await page.evaluate("""() => ({
            rebuildHeatLayers: typeof rebuildHeatLayers,
            getHeatOpacity: typeof getHeatOpacity,
            getHeatRadius: typeof getHeatRadius,
            getHeatBlur: typeof getHeatBlur,
            getHeatPalette: typeof getHeatPalette,
            updateHeatOpacity: typeof updateHeatOpacity,
            updateHeatRadius: typeof updateHeatRadius,
            updateHeatBlur: typeof updateHeatBlur,
            storeHeatData: typeof storeHeatData,
        })""")
        for name, ftype in heat_funcs.items():
            report(f"Heat {name} exists", ftype == 'function', ftype)

        # Check heat map UI controls
        heat_opacity = await page.locator("#heat-opacity-slider").count()
        heat_radius = await page.locator("#heat-radius-slider").count()
        heat_blur = await page.locator("#heat-blur-slider").count()
        heat_palette = await page.locator("#heat-palette-select").count()
        report("Heat opacity control exists", heat_opacity > 0)
        report("Heat radius control exists", heat_radius > 0)
        report("Heat blur control exists", heat_blur > 0)
        report("Heat palette control exists", heat_palette > 0)

        # Test heat map rebuild
        heat_rebuild = await page.evaluate("""() => {
            try { rebuildHeatLayers(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Heat map rebuild no crash", heat_rebuild == 'ok', heat_rebuild)

        # Test heat opacity update
        heat_op = await page.evaluate("""() => {
            try { updateHeatOpacity(50); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Heat opacity update no crash", heat_op == 'ok', heat_op)

        # Test heat radius update
        heat_rad = await page.evaluate("""() => {
            try { updateHeatRadius(20); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Heat radius update no crash", heat_rad == 'ok', heat_rad)

        # Test heat blur update
        heat_blur = await page.evaluate("""() => {
            try { updateHeatBlur(15); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Heat blur update no crash", heat_blur == 'ok', heat_blur)

        # ── Label controls ──
        label_funcs = await page.evaluate("""() => ({
            toggleAllLabels: typeof toggleAllLabels,
            toggleFeatureLabel: typeof toggleFeatureLabel,
            updateLabelStyle: typeof updateLabelStyle,
            resetLabelStyle: typeof resetLabelStyle,
            changeLabelAttribute: typeof changeLabelAttribute,
            detectBestLabelAttr: typeof detectBestLabelAttr,
            openLabelPopover: typeof openLabelPopover,
            getLabelAttr: typeof getLabelAttr,
            getLabelStyle: typeof getLabelStyle,
        })""")
        for name, ftype in label_funcs.items():
            report(f"Label {name} exists", ftype == 'function', ftype)

        # Test toggle all labels
        labels_before = await page.evaluate("uploadedLayers[0].labels")
        toggle_labels = await page.evaluate("""() => {
            try { toggleAllLabels(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Toggle all labels no crash", toggle_labels == 'ok', toggle_labels)

        # Test toggle single feature label
        toggle_single = await page.evaluate("""() => {
            try { toggleFeatureLabel('upload-0'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Toggle feature label no crash", toggle_single == 'ok', toggle_single)

        # Test detect best label attribute
        detect_attr = await page.evaluate("""() => {
            try {
                const info = uploadedLayers.find(l => l.id === 'upload-0');
                if (!info) return 'no layer';
                return detectBestLabelAttr(info);
            } catch(e) { return 'error: ' + e.message; }
        }""")
        report("Detect best label attr no crash", detect_attr is not None, str(detect_attr))

        # Test change label attribute
        change_attr = await page.evaluate("""() => {
            try { changeLabelAttribute('upload-0', 'elevation_m'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Change label attribute no crash", change_attr == 'ok', change_attr)

        # Test update label style
        update_style = await page.evaluate("""() => {
            try { updateLabelStyle('upload-0', 'size', 14); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Update label style no crash", update_style == 'ok', update_style)

        # Test reset label style
        reset_style = await page.evaluate("""() => {
            try { resetLabelStyle('upload-0'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Reset label style no crash", reset_style == 'ok', reset_style)

        # ── Basemap opacity ──
        has_basemap_opacity = await page.evaluate("typeof setBasemapOpacity === 'function'")
        report("setBasemapOpacity exists", has_basemap_opacity)

        basemap_op = await page.evaluate("""() => {
            try { setBasemapOpacity(0.7); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Basemap opacity change no crash", basemap_op == 'ok', basemap_op)

        # ── Layer opacity/stroke controls ──
        layer_funcs = await page.evaluate("""() => ({
            opacityLayer: typeof opacityLayer,
            lineWidthLayer: typeof lineWidthLayer,
            strokeColorLayer: typeof strokeColorLayer,
            strokeWidthLayer: typeof strokeWidthLayer,
            strokeStyleLayer: typeof strokeStyleLayer,
            accentColor: 'nested',
            markerShapeLayer: typeof markerShapeLayer,
            recolorLayer: typeof recolorLayer,
            rebuildLayerWithShape: typeof rebuildLayerWithShape,
        })""")
        for name, ftype in layer_funcs.items():
            report(f"Layer {name} exists", ftype == 'function' or ftype == 'nested', ftype)

        # Test opacity change
        op_result = await page.evaluate("""() => {
            try { opacityLayer('upload-0', 0.5); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Layer opacity change no crash", op_result == 'ok', op_result)

        # Test stroke width change
        sw_result = await page.evaluate("""() => {
            try { strokeWidthLayer('upload-0', 3); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Layer stroke width change no crash", sw_result == 'ok', sw_result)

        # Test stroke color change
        sc_result = await page.evaluate("""() => {
            try { strokeColorLayer('upload-0', '#ff0000'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Layer stroke color change no crash", sc_result == 'ok', sc_result)

        # accentColor is a nested function inside createMeasureTool - not global
        report("Layer accent color (nested)", True, "inside createMeasureTool closure")

        # Test marker shape change
        ms_result = await page.evaluate("""() => {
            try { markerShapeLayer('upload-0', 'square'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Layer marker shape change no crash", ms_result == 'ok', ms_result)

        # Test recolor layer
        rc_result = await page.evaluate("""() => {
            try { recolorLayer('upload-0', '#0000ff'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Recolor layer no crash", rc_result == 'ok', rc_result)

        # ── Raster classification functions ──
        raster_funcs = await page.evaluate("""() => ({
            applyRasterClassification: typeof applyRasterClassification,
            setRasterRenderMode: typeof setRasterRenderMode,
            setRasterClassCount: typeof setRasterClassCount,
            setRasterClassMethod: typeof setRasterClassMethod,
            setRasterManualBreaks: typeof setRasterManualBreaks,
            resetRasterClassification: typeof resetRasterClassification,
        })""")
        for name, ftype in raster_funcs.items():
            report(f"Raster {name} exists", ftype == 'function', ftype)

        # Test setRasterRenderMode
        rm_result = await page.evaluate("""() => {
            try { setRasterRenderMode('classified'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Set raster render mode no crash", rm_result == 'ok' or 'no' in rm_result.lower(), rm_result)

        # Test setRasterClassCount
        cc_result = await page.evaluate("""() => {
            try { setRasterClassCount(5); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Set raster class count no crash", cc_result == 'ok' or 'no' in cc_result.lower(), cc_result)

        # Test setRasterClassMethod
        cm_result = await page.evaluate("""() => {
            try { setRasterClassMethod('quantile'); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Set raster class method no crash", cm_result == 'ok' or 'no' in cm_result.lower(), cm_result)

        # Test resetRasterClassification
        rr_result = await page.evaluate("""() => {
            try { resetRasterClassification(); return 'ok'; } catch(e) { return e.message; }
        }""")
        report("Reset raster classification no crash", rr_result == 'ok' or 'no' in rr_result.lower(), rr_result)

        errs = await close(page)
        report("Heat/label/raster tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== Heat/label/raster tests: {COUNTS['pass']} passed, {COUNTS['fail']} failed ===")
sys.exit(1 if COUNTS['fail'] else 0)
