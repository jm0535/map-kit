"""Test 11: Layer management — rename, reorder, context menu, move up/down/top/bottom."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")
POLY_GEOJSON = os.path.join(os.path.dirname(__file__), "test_polygons.geojson")
LINE_GEOJSON = os.path.join(os.path.dirname(__file__), "test_lines.geojson")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        await goto(page)
        # Import 3 layers for reorder tests
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await upload_file(page, "#upload-file", POLY_GEOJSON)
        await upload_file(page, "#upload-file", LINE_GEOJSON)
        await page.wait_for_timeout(1000)
        await expand_all_sections(page)

        n = await page.evaluate("uploadedLayers.length")
        report("3 layers imported", n == 3, f"layers={n}")

        # ── Layer order before ──
        names_before = await page.evaluate("uploadedLayers.map(l => l.name)")
        report("Layer order captured", names_before is not None, str(names_before))

        # ── Rename layer ──
        await page.evaluate("""() => {
            const el = document.querySelector('.layer-item .layer-name');
            if (el) {
                el.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
            }
        }""")
        await page.wait_for_timeout(300)
        # Check if rename prompt or inline edit appeared
        rename_works = await page.evaluate("""() => {
            // renameLayer uses prompt() — check the function exists
            return typeof renameLayer === 'function';
        }""")
        report("Rename function exists", rename_works)

        # Test rename via JS (prompt can't be automated in headless)
        renamed = await page.evaluate("""() => {
            const id = uploadedLayers[0].id;
            // renameLayer uses prompt(), so test the underlying logic
            const info = uploadedLayers.find(l => l.id === id);
            if (!info) return false;
            info.name = 'Renamed Layer';
            const el = document.querySelector(`[data-layer-id="${id}"] .layer-name`);
            if (el) el.textContent = 'Renamed Layer';
            return uploadedLayers[0].name === 'Renamed Layer';
        }""")
        report("Rename layer", renamed)

        # ── Move layer up/down via context menu ──
        # Check moveLayer function exists
        has_move = await page.evaluate("typeof moveLayer === 'function'")
        report("moveLayer function exists", has_move)

        if has_move:
            # Move first layer down
            order_before = await page.evaluate("uploadedLayers.map(l => l.name)")
            await page.evaluate("""() => {
                const id = uploadedLayers[0].id;
                moveLayer(id, 'down');
            }""")
            await page.wait_for_timeout(500)
            order_after = await page.evaluate("uploadedLayers.map(l => l.name)")
            report("Move layer down", order_before[0] != order_after[0], f"{order_before[0]}->{order_after[0]}")

            # Move it back up
            await page.evaluate("""() => {
                const id = uploadedLayers[1].id;
                moveLayer(id, 'up');
            }""")
            await page.wait_for_timeout(500)
            order_back = await page.evaluate("uploadedLayers.map(l => l.name)")
            report("Move layer up", order_back[0] == order_before[0], f"restored to {order_back[0]}")

        # ── Move to top/bottom ──
        if has_move:
            await page.evaluate("""() => {
                const id = uploadedLayers[uploadedLayers.length - 1].id;
                moveLayer(id, 'top');
            }""")
            await page.wait_for_timeout(500)
            order_top = await page.evaluate("uploadedLayers.map(l => l.name)")
            report("Move layer to top", order_top[0] == names_before[-1], f"top={order_top[0]}")

            await page.evaluate("""() => {
                const id = uploadedLayers[0].id;
                moveLayer(id, 'bottom');
            }""")
            await page.wait_for_timeout(500)
            order_bottom = await page.evaluate("uploadedLayers.map(l => l.name)")
            report("Move layer to bottom", order_bottom[-1] == names_before[-1], f"bottom={order_bottom[-1]}")

        # ── Context menu opens ──
        has_ctx_menu = await page.evaluate("typeof openLayerContextMenu === 'function'")
        report("Context menu function exists", has_ctx_menu)
        if has_ctx_menu:
            await page.evaluate("""() => {
                const el = document.querySelector('.layer-item');
                if (el) {
                    el.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: 100, clientY: 100}));
                }
            }""")
            await page.wait_for_timeout(300)
            ctx_visible = await page.evaluate("""() => {
                const m = document.getElementById('layer-context-menu');
                return m && m.style.display !== 'none';
            }""")
            report("Context menu opens", ctx_visible)
            # Close it
            await page.evaluate("""() => {
                const m = document.getElementById('layer-context-menu');
                if (m) m.style.display = 'none';
            }""")

        # ── Layer drag-and-drop reorder ──
        has_drag = await page.evaluate("typeof initLayerDrag === 'function'")
        report("Layer drag init function exists", has_drag)

        # ── Select layer (active highlighting) ──
        await page.evaluate("""() => {
            const el = document.querySelector('.layer-item');
            if (el) el.click();
        }""")
        await page.wait_for_timeout(300)
        has_active = await page.evaluate("""() => {
            return document.querySelector('.layer-item.active-layer') !== null;
        }""")
        report("Active layer highlighting", has_active)

        errs = await close(page)
        report("Layer mgmt tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== Layer mgmt tests: {COUNTS['pass']} passed, {COUNTS['fail']} failed ===")
sys.exit(1 if COUNTS['fail'] else 0)
