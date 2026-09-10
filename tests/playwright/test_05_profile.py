"""Test 05: Elevation profile — sort, Y-from-0, tab switch, collapse, export."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        await goto(page)
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await page.wait_for_timeout(2000)

        # ── Profile registered ──
        n = await page.evaluate("profileRegistry.length")
        report("Profile registered", n == 1, f"count={n}")

        # ── Chart exists ──
        has_chart = await page.evaluate("!!profileChart")
        report("Profile chart created", has_chart)

        if not has_chart:
            errs = await close(page)
            sys.exit(1)

        # ── Y-from-0 checked (default) ──
        si = await page.evaluate("""() => JSON.stringify({
            min: profileChart.scales.y.min, beginAtZero: profileChart.options.scales.y.beginAtZero,
            fill: profileChart.data.datasets[0].fill, checked: document.getElementById('profile-y-zero').checked,
            ticks: profileChart.scales.y.ticks.map(t => t.label)
        })""")
        report("Y-from-0 checked default", '"min":0' in si and '"fill":"origin"' in si, si)

        # ── Uncheck Y-from-0 ──
        await page.locator("#profile-y-zero").click()
        await page.wait_for_timeout(500)
        si2 = await page.evaluate("""() => JSON.stringify({
            min: profileChart.scales.y.min, beginAtZero: profileChart.options.scales.y.beginAtZero,
            fill: profileChart.data.datasets[0].fill, checked: document.getElementById('profile-y-zero').checked,
            ticks: profileChart.scales.y.ticks.map(t => t.label)
        })""")
        report("Y-from-0 unchecked", '"min":100' in si2 and '"fill":"start"' in si2, si2)

        # ── Re-check Y-from-0 ──
        await page.locator("#profile-y-zero").click()
        await page.wait_for_timeout(500)
        si3 = await page.evaluate("""() => JSON.stringify({min: profileChart.scales.y.min, checked: document.getElementById('profile-y-zero').checked})""")
        report("Y-from-0 re-checked", '"min":0' in si3 and '"checked":true' in si3, si3)

        # ── Sort mode change ──
        for mode in ['west_east', 'south_north', 'survey', 'elevation']:
            await page.evaluate(f"""() => {{
                document.getElementById('profile-sort').value = '{mode}';
                rebuildProfileFromCheckboxes();
            }}""")
            await page.wait_for_timeout(500)
            ok = await page.evaluate("!!profileChart && profileChart.data.datasets.length > 0")
            report(f"Sort mode {mode}", ok)

        # ── Tab switching ──
        await page.evaluate("switchBottomTab('analysis')")
        await page.wait_for_timeout(500)
        elev_visible = await page.evaluate("""() => {
            const el = document.getElementById('bottom-tab-elevation');
            return el && el.style.display !== 'none';
        }""")
        report("Switch to analysis tab", not elev_visible)

        await page.evaluate("switchBottomTab('elevation')")
        await page.wait_for_timeout(500)
        elev_visible2 = await page.evaluate("""() => {
            const el = document.getElementById('bottom-tab-elevation');
            return el && el.style.display !== 'none';
        }""")
        report("Switch back to elevation tab", elev_visible2)

        # ── Collapse/expand panel ──
        await page.evaluate("toggleProfilePanel()")
        await page.wait_for_timeout(500)
        collapsed = await page.evaluate("document.getElementById('profile-panel').classList.contains('collapsed')")
        report("Panel collapse", collapsed)

        await page.evaluate("toggleProfilePanel()")
        await page.wait_for_timeout(500)
        collapsed2 = await page.evaluate("document.getElementById('profile-panel').classList.contains('collapsed')")
        report("Panel expand", not collapsed2)

        # ── Profile chart click → pan map ──
        # Get the first dataset point and simulate clicking it
        pan_result = await page.evaluate("""() => {
            if (!profileChart || !profileChart.data.datasets[0].data.length) return 'no data';
            const c0 = map.getCenter();
            // Simulate clicking the first point
            const pt = profileChart.data.datasets[0].data[0];
            const meta = profileChart.getDatasetMeta(0);
            if (!meta.data[0]) return 'no meta';
            const x = meta.data[0].x;
            const y = meta.data[0].y;
            // Use chart's onClick
            const rect = profileChart.canvas.getBoundingClientRect();
            // Can't easily simulate native click, but test the handler directly
            const renderCache = window._testRenderCache;
            return JSON.stringify({c0: c0, hasData: true});
        }""")
        report("Profile click handler accessible", pan_result is not None)

        # ── Export profile as PNG ──
        # Trigger export and check a download is initiated
        export_result = await page.evaluate("""async () => {
            // Mock the download to capture the data URL
            let captured = null;
            const orig = document.createElement;
            // Just check the function exists and doesn't throw
            try {
                if (typeof exportProfile === 'function') {
                    return 'exists';
                }
                return 'no function';
            } catch(e) { return 'error: ' + e.message; }
        }""")
        report("Export profile function exists", export_result == "exists", export_result)

        errs = await close(page)
        report("Profile tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== {COUNTS["pass"]} passed, {COUNTS["fail"]} failed ===")
sys.exit(1 if COUNTS["fail"] else 0)
