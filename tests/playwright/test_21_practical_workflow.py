"""End-to-end test of the FR422 GeoSpaX practical workflow using real lab data."""
import asyncio, sys, os
sys.path.insert(0, '/home/jmoses/Documents/workspace/projects/github/mapkit/tests/playwright')
from conftest import *
from playwright.async_api import async_playwright

LAB_FILE = "/home/jmoses/Documents/workspace/projects/github/mapkit/practical_assignment/lab_Paradisaea_guilielmi_occurrences.geojson"
SCREENSHOT_DIR = "/home/jmoses/Documents/workspace/projects/github/mapkit/practical_assignment/screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def screenshot(page, name):
    path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
    await page.screenshot(path=path, full_page=False)
    print(f"  Screenshot: {path}")

async def main():
    async with async_playwright() as p:
        page = await new_page(p, viewport={"width": 1600, "height": 1000})
        await goto(page, wait=3000)
        errors = page._gsx_errors

        # ── Step 0: Import ──
        print("\n=== Step 0: Import lab file ===")
        await expand_all_sections(page)
        await page.set_input_files('#upload-file', LAB_FILE)
        await page.wait_for_timeout(4000)
        feat_count = await page.evaluate("""() => {
            const info = uploadedLayers.find(l => l.name && l.name.includes('Paradisaea'));
            if (!info) return null;
            let count = 0; info.layer.eachLayer(() => count++); return count;
        }""")
        report("Import lab file (128 features)", feat_count == 128, f"features={feat_count}")
        await screenshot(page, "01_imported")

        species_id = await page.evaluate("""() => uploadedLayers.find(l => l.name && l.name.includes('Paradisaea'))?.id""")

        # Attribute table
        await page.evaluate(f"openAttrTableForLayer('{species_id}')")
        await page.wait_for_timeout(2000)
        attr_rows = await page.evaluate("""() => document.querySelectorAll('#attr-table tbody tr').length""")
        report("Attribute table shows 128 rows", attr_rows == 128, f"rows={attr_rows}")
        await screenshot(page, "02_attribute_table")

        # ── Step 1: Convex Hull ──
        print("\n=== Step 1: Convex Hull (Map 1) ===")
        await expand_all_sections(page)
        await page.evaluate(f"""() => {{
            const sel = document.getElementById('analysis-layer-select');
            for (let i = 0; i < sel.options.length; i++) {{
                if (sel.options[i].text.includes('Paradisaea')) {{ sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); break; }}
            }}
        }}""")
        await page.wait_for_timeout(500)
        await page.evaluate("runAnalysis('convexHull')")
        await page.wait_for_timeout(2000)
        hull_exists = await page.evaluate("""() => !!uploadedLayers.find(l => l.name && l.name.includes('Convex Hull'))""")
        results_text = await page.evaluate("""() => {
            const el = document.getElementById('analysis-results-content');
            if (!el || el.style.display === 'none') return null;
            return el.textContent.substring(0, 500);
        }""")
        report("Convex Hull created", hull_exists)
        report("Convex Hull results shown", results_text and 'Hull' in results_text, f"results={results_text[:200] if results_text else 'none'}")
        await screenshot(page, "03_convex_hull")

        # ── Step 2: Feature labels ──
        print("\n=== Step 2: Feature labels ===")
        # Labels are set via the label popover on the layer panel - click the tag icon
        label_result = await page.evaluate("""async (speciesId) => {
            // Find the label button in the layer panel
            const btn = document.querySelector(`[onclick*="openLabelPopover('${speciesId}'"]`);
            if (!btn) return { error: 'no label button found' };
            btn.click();
            await new Promise(r => setTimeout(r, 500));
            // Find the label select inside the popover
            const popover = document.getElementById('lp-' + speciesId);
            if (!popover || !popover.classList.contains('show')) return { error: 'popover not open' };
            // Find the field select
            const selects = popover.querySelectorAll('select');
            let fieldSel = null;
            for (const s of selects) {
                for (const o of s.options) {
                    if (o.value === 'site') { s.value = 'site'; s.dispatchEvent(new Event('change')); fieldSel = s; break; }
                }
                if (fieldSel) break;
            }
            return { ok: !!fieldSel, field: fieldSel ? 'site' : null };
        }""", species_id)
        report("Label field set to 'site'", label_result.get('ok', False), f"result={label_result}")
        await page.wait_for_timeout(1000)
        await screenshot(page, "04_labels")

        # ── Step 3: Graduated symbology ──
        print("\n=== Step 3: Graduated symbology (Map 2) ===")
        await page.evaluate(f"selectSymbologyLayer('{species_id}')")
        await page.wait_for_timeout(500)
        # Switch to graduated tab
        await page.evaluate(f"""() => setSymbologyTab('{species_id}', 'graduated')""")
        await page.wait_for_timeout(500)
        # Set field to tree_cover_pct
        field_result = await page.evaluate(f"""() => {{
            const sel = document.getElementById('grad-attr-{species_id}');
            if (!sel) return {{ error: 'no grad-attr select' }};
            for (let i = 0; i < sel.options.length; i++) {{
                if (sel.options[i].value === 'tree_cover_pct') {{ sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); return {{ field: 'tree_cover_pct' }}; }}
            }}
            return {{ error: 'not found', options: Array.from(sel.options).map(o => o.value).slice(0, 10) }};
        }}""")
        report("Graduated field = tree_cover_pct", 'field' in field_result, f"result={field_result}")
        await page.wait_for_timeout(500)
        # Set classes to 5
        await page.evaluate(f"""() => {{
            const input = document.getElementById('grad-classes-{species_id}');
            if (input) {{ input.value = '5'; input.dispatchEvent(new Event('input')); input.dispatchEvent(new Event('change')); }}
        }}""")
        await page.wait_for_timeout(300)
        # Apply
        await page.evaluate("""(sid) => {
            const btn = document.querySelector('[onclick="applyGraduated(\\'' + sid + '\\')"]');
            if (btn) btn.click();
            else { try { applyGraduated(sid); } catch(e) {} }
        }""", species_id)
        await page.wait_for_timeout(1500)
        legend_info = await page.evaluate("""() => {
            const legend = document.querySelector('.map-legend');
            if (!legend) return { error: 'no legend', visible: false };
            const body = legend.querySelector('.map-legend-body');
            return {
                visible: legend.style.display !== 'none',
                bodyHidden: body ? body.classList.contains('hidden') : null,
                bodyChildren: body ? body.children.length : 0,
                html: legend.innerHTML.substring(0, 500)
            };
        }""")
        report("Graduated legend visible", legend_info.get('visible', False) and legend_info.get('bodyChildren', 0) > 0, f"legend={legend_info}")
        await screenshot(page, "05_graduated")

        # ── Step 4: Gi* ──
        print("\n=== Step 4: Gi* (Map 3) ===")
        await expand_all_sections(page)
        await page.evaluate(f"""() => {{
            const sel = document.getElementById('analysis-layer-select');
            for (let i = 0; i < sel.options.length; i++) {{
                if (sel.options[i].text.includes('Paradisaea')) {{ sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); break; }}
            }}
        }}""")
        await page.wait_for_timeout(500)
        # Set analysis attribute to tree_cover_pct
        gi_field = await page.evaluate("""() => {
            const sel = document.getElementById('analysis-attr-select');
            if (!sel) return { error: 'no analysis-attr-select' };
            for (let i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value === 'tree_cover_pct') { sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); return { field: 'tree_cover_pct' }; }
            }
            return { error: 'not found', options: Array.from(sel.options).map(o => o.value) };
        }""")
        report("Analysis attr = tree_cover_pct", 'field' in gi_field, f"result={gi_field}")
        await page.wait_for_timeout(500)
        # Run Gi*
        await page.evaluate("runAnalysis('gistar')")
        await page.wait_for_timeout(5000)
        gi_results = await page.evaluate("""() => {
            const el = document.getElementById('analysis-results-content');
            if (!el || el.style.display === 'none') return null;
            return el.textContent.substring(0, 800);
        }""")
        report("Gi* results shown", gi_results and ('hot' in gi_results.lower() or 'Gi*' in gi_results or 'z' in gi_results.lower()), f"results={gi_results[:300] if gi_results else 'none'}")
        await screenshot(page, "06_gi_star")

        # ── Step 5: Calculate Field ──
        print("\n=== Step 5: Calculate Field (Map 4) ===")
        await expand_all_sections(page)
        await page.evaluate(f"""() => {{
            const sel = document.getElementById('analysis-layer-select');
            for (let i = 0; i < sel.options.length; i++) {{
                if (sel.options[i].text.includes('Paradisaea')) {{ sel.selectedIndex = i; sel.dispatchEvent(new Event('change')); break; }}
            }}
        }}""")
        await page.wait_for_timeout(500)
        # Expand Attributes section
        await page.evaluate("""() => {
            document.querySelectorAll('.ad-section-title').forEach(t => {
                if (t.textContent.includes('Attributes')) {
                    t.classList.remove('collapsed');
                    let el = t.nextElementSibling;
                    while (el && !el.classList.contains('ad-section-title')) { el.classList.remove('ad-collapsed'); el = el.nextElementSibling; }
                }
            });
        }""")
        await page.wait_for_timeout(300)
        # Set output field name
        await page.evaluate("""() => {
            const input = document.getElementById('gsx-calc-out');
            if (input) { input.value = 'habitat_score'; input.dispatchEvent(new Event('input')); }
        }""")
        await page.wait_for_timeout(300)
        cf_state = await page.evaluate("""() => ({
            fieldname: document.getElementById('gsx-calc-out')?.value,
            rowCount: document.querySelectorAll('.gsx-calc-row').length
        })""")
        report("Calculate field UI visible", cf_state.get('fieldname') == 'habitat_score', f"state={cf_state}")

        # Fill rows: elevation_m between 0 and 2000 weight 1, tree_cover_pct >= 50 weight 1, rainfall_mm >= 2500 weight 1
        cf_fill = await page.evaluate("""() => {
            const rows = document.querySelectorAll('.gsx-calc-row');
            if (rows.length < 3) return { error: 'not enough rows', count: rows.length };
            // Row 0: elevation_m between 0 and 2000, weight 1
            const r0 = rows[0];
            const f0 = r0.querySelector('.gsx-calc-f');
            for (const o of f0.options) if (o.value === 'elevation_m') { f0.value = 'elevation_m'; f0.dispatchEvent(new Event('change')); break; }
            const t0 = r0.querySelector('.gsx-calc-t'); t0.value = 'between'; t0.dispatchEvent(new Event('change'));
            GSXCF.syncRowTest(r0);  // explicitly sync so the 'max' input shows
            r0.querySelector('.gsx-calc-a').value = '0';
            r0.querySelector('.gsx-calc-b').value = '2000';
            r0.querySelector('.gsx-calc-w').value = '1';
            // Row 1: tree_cover_pct >= 50, weight 1
            const r1 = rows[1];
            const f1 = r1.querySelector('.gsx-calc-f');
            for (const o of f1.options) if (o.value === 'tree_cover_pct') { f1.value = 'tree_cover_pct'; f1.dispatchEvent(new Event('change')); break; }
            const t1 = r1.querySelector('.gsx-calc-t'); t1.value = '>='; t1.dispatchEvent(new Event('change'));
            GSXCF.syncRowTest(r1);
            r1.querySelector('.gsx-calc-a').value = '50';
            r1.querySelector('.gsx-calc-w').value = '1';
            // Row 2: rainfall_mm >= 2500, weight 1
            const r2 = rows[2];
            const f2 = r2.querySelector('.gsx-calc-f');
            for (const o of f2.options) if (o.value === 'rainfall_mm') { f2.value = 'rainfall_mm'; f2.dispatchEvent(new Event('change')); break; }
            const t2 = r2.querySelector('.gsx-calc-t'); t2.value = '>='; t2.dispatchEvent(new Event('change'));
            GSXCF.syncRowTest(r2);
            r2.querySelector('.gsx-calc-a').value = '2500';
            r2.querySelector('.gsx-calc-w').value = '1';
            // Validate
            GSXCF.validate();
            return { ok: true, rows: rows.length };
        }""")
        report("Calculate field rows filled", 'ok' in cf_fill, f"result={cf_fill}")
        await page.wait_for_timeout(500)
        await screenshot(page, "07_calcfield_filled")

        # Check preview
        preview = await page.evaluate("""() => {
            const el = document.getElementById('gsx-calc-preview');
            return el ? { text: el.textContent.substring(0, 300) } : { error: 'no preview' };
        }""")
        report("Calculate field preview shown", 'text' in preview and len(preview.get('text', '')) > 0, f"preview={preview.get('text', '')[:200]}")

        # Run
        await page.evaluate("""() => { const btn = document.getElementById('gsx-calc-run'); if (btn) btn.click(); }""")
        await page.wait_for_timeout(3000)
        cf_results = await page.evaluate("""() => {
            const el = document.getElementById('analysis-results-content');
            if (!el || el.style.display === 'none') return { error: 'no results' };
            return { text: el.textContent.substring(0, 500), visible: el.style.display !== 'none' };
        }""")
        report("Calculate field results shown", cf_results.get('text', '') and ('Features written' in cf_results['text'] or 'habitat_score' in cf_results['text']), f"results={cf_results.get('text', '')[:300]}")
        await screenshot(page, "08_calcfield_results")

        # Check habitat_score field
        habitat_check = await page.evaluate("""() => {
            const info = uploadedLayers.find(l => l.name && l.name.includes('Paradisaea'));
            if (!info) return { error: 'no layer' };
            let found = false; let vals = [];
            info.layer.eachLayer(sub => {
                if (sub.feature && sub.feature.properties && 'habitat_score' in sub.feature.properties) {
                    found = true;
                    if (vals.length < 5) vals.push(sub.feature.properties.habitat_score);
                }
            });
            return { found, vals };
        }""")
        report("habitat_score field added", habitat_check.get('found', False), f"sample={habitat_check.get('vals')}")

        # ── Step 6: Composer ──
        print("\n=== Step 6: Map Composer ===")
        await page.evaluate("previewExport()")
        await page.wait_for_timeout(5000)
        composer_open = await page.evaluate("""() => document.getElementById('layout-modal').classList.contains('show')""")
        report("Composer opened", composer_open)
        await screenshot(page, "09_composer_open")

        # Set title
        await page.evaluate("""() => {
            const i = document.getElementById('layout-title-input');
            if (i) { i.value = 'FR422 study area, Emperor Bird-of-paradise (Paradisaea guilielmi)'; i.dispatchEvent(new Event('input')); }
        }""")
        await page.wait_for_timeout(500)
        # Set subtitle
        await page.evaluate("""() => {
            const i = document.getElementById('layout-subtitle-input');
            if (i) { i.value = 'GBIF PNG teaching extract, 09 September 2026, not a census'; i.dispatchEvent(new Event('input')); }
        }""")
        await page.wait_for_timeout(500)
        # Enable CRS text
        await page.evaluate("""() => {
            const chk = document.getElementById('layout-show-crs');
            if (chk && !chk.checked) { chk.checked = true; chk.dispatchEvent(new Event('change')); }
            onLayoutCrsTextChange();
        }""")
        await page.wait_for_timeout(500)
        title_display = await page.evaluate("""() => ({
            text: document.getElementById('layout-title')?.textContent,
            visible: document.getElementById('layout-title')?.style.display !== 'none'
        })""")
        report("Title set in composer", title_display.get('visible') and title_display.get('text'), f"title={title_display.get('text', '')}")
        await screenshot(page, "10_composer_titled")

        elements = await page.evaluate("""() => ({
            scalebar: !!document.querySelector('#layout-scale .sb-bar'),
            northArrow: !!document.querySelector('#layout-north'),
            legend: !!document.querySelector('#layout-legend'),
            title: document.querySelector('#layout-title')?.style.display !== 'none',
            crsText: document.querySelector('#layout-crs-text')?.style.display !== 'none',
            scaleText: document.querySelector('#layout-scaletext')?.style.display !== 'none',
            dateText: document.querySelector('#layout-datetext')?.style.display !== 'none',
        })""")
        report("Composer has scale bar", elements.get('scalebar', False))
        report("Composer has north arrow", elements.get('northArrow', False))
        report("Composer has legend", elements.get('legend', False))
        report("Composer has title", elements.get('title', False))
        report("Composer has CRS text", elements.get('crsText', False))
        print(f"  Elements: {elements}")

        # ── Step 7: Export CRS ──
        print("\n=== Step 7: Export to EPSG:32755 ===")
        await page.evaluate("""() => document.getElementById('layout-modal').classList.remove('show')""")
        await page.wait_for_timeout(1000)
        crs_result = await page.evaluate("""() => {
            const sel = document.getElementById('export-crs-select');
            if (!sel) return { error: 'no CRS select' };
            for (let i = 0; i < sel.options.length; i++) {
                if (sel.options[i].value.includes('32755') || sel.options[i].text.includes('32755')) {
                    sel.selectedIndex = i; sel.dispatchEvent(new Event('change'));
                    return { code: sel.options[i].value, label: sel.options[i].text };
                }
            }
            return { error: 'not found', count: sel.options.length };
        }""")
        report("Output CRS set to EPSG:32755", 'code' in crs_result, f"result={crs_result}")

        # ── Summary ──
        print(f"\n=== SUMMARY: {COUNTS['pass']} passed, {COUNTS['fail']} failed ===")
        if errors:
            for e in errors: print(f"  ERROR: {e}")
        await page._gsx_browser.close()
        return COUNTS['fail'] == 0

asyncio.run(main())
