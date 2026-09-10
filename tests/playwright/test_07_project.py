"""Test 07: Project save/load/autosave (.gspx)."""
import asyncio, os, sys, os, json, glob
sys.path.insert(0, os.path.dirname(__file__))
from conftest import *

ELEV_GEOJSON = os.path.join(os.path.dirname(__file__), "elev_test.geojson")

async def main():
    async with async_playwright() as p:
        page = await new_page(p)
        await goto(page)

        # ── Save project button exists ──
        save_btn = await page.locator("button").filter(has_text="Save").count()
        report("Save button exists", save_btn > 0)

        # ── Load project button exists ──
        load_btn = await page.locator("button").filter(has_text="Load").count()
        report("Load button exists", load_btn > 0)

        # ── Import data ──
        await upload_file(page, "#upload-file", ELEV_GEOJSON)
        await page.wait_for_timeout(1500)
        n_before = await page.evaluate("uploadedLayers.length")
        report("Data imported before save", n_before == 1, f"layers={n_before}")

        # ── Set provenance metadata ──
        await page.evaluate("""() => {
            const a = document.getElementById('gsx-proj-authorName');
            const t = document.getElementById('gsx-proj-title');
            if (a) a.value = 'Test Author';
            if (t) t.value = 'Test Project';
        }""")

        # ── Save project (capture the JSON) ──
        # Mock the download to capture the .gspx content
        gspx_data = await page.evaluate("""async () => {
            let captured = null;
            // Override URL.createObjectURL and anchor click to capture the blob
            const origCreate = URL.createObjectURL;
            const origRevoke = URL.revokeObjectURL;
            URL.createObjectURL = function(blob) {
                blob.text().then(t => { captured = t; });
                return 'blob:mock';
            };
            // Call save
            try { GSX.uiSaveProject(); } catch(e) { return 'error: ' + e.message; }
            // Wait a tick for blob.text() to resolve
            await new Promise(r => setTimeout(r, 200));
            URL.createObjectURL = origCreate;
            URL.revokeObjectURL = origRevoke;
            return captured;
        }""")
        report("Save project produces JSON", gspx_data and gspx_data.startswith("{"), f"len={len(gspx_data) if gspx_data else 0}")

        if gspx_data and gspx_data.startswith("{"):
            proj = json.loads(gspx_data)
            report("Saved project has layers", "layers" in proj and len(proj.get("layers", [])) > 0, f"layers={len(proj.get('layers', []))}")
            report("Saved project has metadata", "author" in proj or "authorName" in proj, str(list(proj.keys())[:8]))

            # ── Load project ──
            # Write the .gspx to a temp file and load it
            gspx_path = "/tmp/gsx_tests/test_save.gspx"
            with open(gspx_path, "w") as f:
                f.write(gspx_data)

            # Clear layers first
            await page.evaluate("[...uploadedLayers].forEach(l => removeUploadedLayer(l.id))")
            await page.wait_for_timeout(500)
            n_cleared = await page.evaluate("uploadedLayers.length")
            report("Layers cleared before load", n_cleared == 0, f"layers={n_cleared}")

            # Load the .gspx file
            await page.set_input_files("label.analysis-toolbar-btn input[type=file]", gspx_path)
            await page.wait_for_timeout(2000)
            n_loaded = await page.evaluate("uploadedLayers.length")
            report("Load project restores layers", n_loaded > 0, f"layers={n_loaded}")

            # Check layer name matches
            name = await page.evaluate("uploadedLayers[0]?.name")
            report("Loaded layer has name", name is not None and len(name) > 0, f"name={name}")

        # ── Autosave ──
        # Check autosave key exists in localStorage
        autosave = await page.evaluate("localStorage.getItem('gsx_project_autosave')")
        report("Autosave in localStorage", autosave is not None, f"len={len(autosave) if autosave else 0}")

        if autosave:
            auto_obj = json.loads(autosave)
            report("Autosave has layers", "layers" in auto_obj and len(auto_obj.get("layers", [])) > 0)

        # ── Clear autosave ──
        await page.evaluate("GSX.clearAutosave()")
        autosave2 = await page.evaluate("localStorage.getItem('gsx_project_autosave')")
        report("Clear autosave works", autosave2 is None, f"val={autosave2}")

        errs = await close(page)
        report("Project tests no errors", not errs, str(errs))

asyncio.run(main())
print(f"\n=== {COUNTS["pass"]} passed, {COUNTS["fail"]} failed ===")
sys.exit(1 if COUNTS["fail"] else 0)
