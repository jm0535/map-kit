"""Test 14: Composer features — templates, scalebar, north arrow, grid, snap, subtitle, date, CRS."""
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
        await page.evaluate("previewExport()")
        await page.wait_for_timeout(3000)

        # ── Composer sidebar controls exist ──
        controls = await page.evaluate("""() => ({
            paperSize: !!document.getElementById('layout-paper-size'),
            paperBg: !!document.getElementById('layout-paper-bg'),
            titleInput: !!document.getElementById('layout-title-input'),
            subtitleInput: !!document.getElementById('layout-subtitle-input'),
            scaleTextInput: !!document.getElementById('layout-scaletext'),
            dateInput: !!document.getElementById('layout-datetext'),
            crsInput: !!document.getElementById('layout-crs-text'),
            snapGrid: !!document.getElementById('layout-snap-grid'),
            gridSize: !!document.getElementById('layout-grid-size'),
            showGrid: !!document.getElementById('layout-show-grid'),
            coordFormat: !!document.getElementById('layout-coord-format'),
            gridInterval: !!document.getElementById('layout-grid-interval'),
            scalebarStyle: !!document.getElementById('layout-scalebar-style'),
            northStyle: !!document.getElementById('layout-north-style'),
            legendTitle: !!document.getElementById('layout-legend-title-input'),
            legendSubtitle: !!document.getElementById('layout-legend-subtitle-input'),
            includeLegend: !!document.getElementById('layout-include-legend'),
            templateName: !!document.getElementById('layout-template-name'),
            templateList: !!document.getElementById('layout-template-list'),
            refreshBtn: !!document.getElementById('layout-refresh-btn'),
            detachBtn: !!document.getElementById('layout-detach-btn'),
            exportBtn: !!document.getElementById('layout-export-btn'),
            exportFormat: !!document.getElementById('layout-export-format'),
            dpi: !!document.getElementById('layout-dpi'),
            extent: !!document.getElementById('layout-extent'),
        })""")
        for name, exists in controls.items():
            report(f"Composer {name} exists", exists)

        # ── Title input ──
        await page.evaluate("""() => {
            const inp = document.getElementById('layout-title-input');
            if (inp) { inp.value = 'Test Title'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
        }""")
        await page.wait_for_timeout(300)
        title = await page.evaluate("""() => document.getElementById('layout-title')?.textContent""")
        report("Title updates on input", title and 'Test Title' in title, f"text='{title}'")

        # ── Subtitle input ──
        await page.evaluate("""() => {
            const inp = document.getElementById('layout-subtitle-input');
            if (inp) { inp.value = 'Test Subtitle'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
        }""")
        await page.wait_for_timeout(300)
        subtitle = await page.evaluate("""() => document.getElementById('layout-subtitle')?.textContent""")
        report("Subtitle updates on input", subtitle and 'Test Subtitle' in subtitle, f"text='{subtitle}'")

        # ── Scalebar style change ──
        scalebar_changed = await page.evaluate("""() => {
            const sel = document.getElementById('layout-scalebar-style');
            if (!sel) return false;
            sel.value = 'line';
            sel.dispatchEvent(new Event('change', {bubbles:true}));
            return true;
        }""")
        await page.wait_for_timeout(500)
        report("Scalebar style change no crash", scalebar_changed)

        # ── North arrow style change ──
        north_changed = await page.evaluate("""() => {
            const sel = document.getElementById('layout-north-style');
            if (!sel) return false;
            sel.value = 'simple';
            sel.dispatchEvent(new Event('change', {bubbles:true}));
            return true;
        }""")
        await page.wait_for_timeout(500)
        report("North arrow style change no crash", north_changed)

        # ── Grid toggle ──
        grid_toggled = await page.evaluate("""() => {
            const cb = document.getElementById('layout-show-grid');
            if (!cb) return false;
            cb.checked = true;
            cb.dispatchEvent(new Event('change', {bubbles:true}));
            return true;
        }""")
        await page.wait_for_timeout(500)
        report("Grid toggle no crash", grid_toggled)

        # ── Snap-to-grid toggle ──
        snap_toggled = await page.evaluate("""() => {
            const cb = document.getElementById('layout-snap-grid');
            if (!cb) return false;
            cb.checked = true;
            cb.dispatchEvent(new Event('change', {bubbles:true}));
            return true;
        }""")
        await page.wait_for_timeout(300)
        report("Snap-to-grid toggle no crash", snap_toggled)

        # ── Legend title ──
        await page.evaluate("""() => {
            const inp = document.getElementById('layout-legend-title-input');
            if (inp) { inp.value = 'My Legend'; inp.dispatchEvent(new Event('input', {bubbles:true})); }
            const cb = document.getElementById('layout-include-legend');
            if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles:true})); }
        }""")
        await page.wait_for_timeout(500)
        legend_title = await page.evaluate("""() => { const el = document.querySelector('#layout-legend .layout-legend-handle'); return el ? el.textContent : null; }""")
        report("Legend title updates", legend_title and 'My Legend' in legend_title, f"text='{legend_title}'")

        # ── Save template ──
        template_saved = await page.evaluate("""() => {
            const inp = document.getElementById('layout-template-name');
            if (!inp) return false;
            inp.value = 'Test Template';
            saveLayoutTemplate();
            return true;
        }""")
        await page.wait_for_timeout(500)
        report("Save template no crash", template_saved)

        # Check template appears in list
        template_count = await page.evaluate("""() => {
            const list = document.getElementById('layout-template-list');
            return list ? list.children.length : 0;
        }""")
        report("Template saved to list", template_count > 0, f"count={template_count}")

        # ── Load template ──
        template_loaded = await page.evaluate("""() => {
            const list = document.getElementById('layout-template-list');
            if (!list || list.children.length === 0) return false;
            // Click the first template
            list.children[0].click();
            return true;
        }""")
        await page.wait_for_timeout(500)
        report("Load template no crash", template_loaded)

        # ── Delete template ──
        template_deleted = await page.evaluate("""() => {
            const list = document.getElementById('layout-template-list');
            if (!list || list.children.length === 0) return false;
            const before = list.children.length;
            const nameEl = list.children[0].querySelector('.tmpl-name');
            const name = nameEl ? nameEl.textContent : null;
            if (name) deleteLayoutTemplate(name);
            return before;
        }""")
        await page.wait_for_timeout(500)
        template_after = await page.evaluate("""() => document.getElementById('layout-template-list')?.children.length || 0""")
        report("Delete template", template_after < template_deleted, f"{template_deleted}->{template_after}")

        # ── Paper background change ──
        bg_changed = await page.evaluate("""() => {
            const sel = document.getElementById('layout-paper-bg');
            if (!sel) return false;
            sel.value = '#ffffff';
            sel.dispatchEvent(new Event('change', {bubbles:true}));
            return true;
        }""")
        await page.wait_for_timeout(300)
        report("Paper background change no crash", bg_changed)

        # ── Composer sidebar collapse ──
        sidebar_collapsed = await page.evaluate("""() => {
            const btn = document.getElementById('sidebar-collapse-btn');
            if (!btn) return false;
            btn.click();
            return true;
        }""")
        await page.wait_for_timeout(300)
        report("Sidebar collapse no crash", sidebar_collapsed)

        # Expand back
        await page.evaluate("""() => {
            const btn = document.getElementById('sidebar-expand-btn');
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(300)

        errs = await close(page)
        report("Composer feature tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== Composer feature tests: {COUNTS['pass']} passed, {COUNTS['fail']} failed ===")
sys.exit(1 if COUNTS['fail'] else 0)
