# GeoSpaX — Milestones 1 & 2 Integration Guide

| File | Contents | Tests |
|---|---|---|
| `geospax-conservation.js` | M1: overlay, protection gap, units, WLC engine + WLC panel | 47 |
| `geospax-conservation-m2.js` | M2: equal-area, fragmentation, connectivity, change detection | 46 |
| `geospax-sdm-fix.js` | **P0-4c**: SDM fallback guards, correct env sampling, chi-square | 48 |
| `geospax-project.js` | **P2-9 / P2-10**: provenance metadata, project save/load | 47 |
| `geospax-raster.js` | **P2-8**: reclassify, Otsu threshold, polygonize | 42 |
| `gsx-select.js` | Dropdown popup replacement (app-wide UI, no deps) | — |
| `test-*.js` | Unit tests, incl. `test-ui.js` run in a real DOM via jsdom | **302 total** |
| `fixtures/*.geojson` | Four polygon datasets (the repo has none) | — |

No new dependencies. All four files use only turf 6.5 and proj4, already vendored.

---

## 1. Script tags

```html
<script src="vendor/turf-6.5.0.min.js"></script>
<script src="vendor/proj4/proj4.js"></script>
<script src="src/geospax-conservation.js"></script>      <!-- M1 — must be first -->
<script src="src/geospax-conservation-m2.js"></script>   <!-- M2 -->
<script src="src/geospax-sdm-fix.js"></script>           <!-- P0-4c -->
<script src="src/geospax-project.js"></script>           <!-- P2-9 / P2-10 -->
<script src="src/geospax-raster.js"></script>            <!-- P2-8 -->
<script src="src/gsx-select.js"></script>               <!-- dropdown popup fix -->
```

Each of the last three throws immediately if `geospax-conservation.js` has not loaded, so an
ordering mistake fails loudly rather than silently.

---

## 2. Second layer selector

Overlay, protection gap and change detection all need two layers. Add beside the existing
`#analysis-layer-select`:

```html
<div class="ad-row">
  <label>Second layer</label>
  <select id="analysis-layer-select-b"></select>
</div>
```

and populate both wherever the first is currently populated:

```js
['analysis-layer-select', 'analysis-layer-select-b'].forEach(function (id) {
  var sel = document.getElementById(id);
  if (!sel) return;
  var prev = sel.value;
  sel.innerHTML = uploadedLayers.map(function (l) {
    return '<option value="' + l.id + '">' + l.name + '</option>';
  }).join('');
  if (prev) sel.value = prev;
});
```

---

## 3. Replacing the WLC panel  (finishes P0-4)

### 3.1 Delete the old function

Remove `runSuitabilityWLC()` entirely. Leaving it preserves a route back to the 22 km binary map.
Then point the existing button at the replacement:

```html
<button class="export-btn primary" onclick="GSX.runSuitabilityWLC()">Run WLC Analysis</button>
```

### 3.2 Replace the panel markup

```html
<div class="ad-subhead">Suitability Mapping (WLC)</div>

<div class="ad-row">
  <label>Cell size (m)</label>
  <input id="gsx-wlc-cellsize" type="number" value="500" min="50" step="50"
         style="width:7em" oninput="GSX.updateWLCCellCount()">
  <span id="gsx-wlc-cellcount" class="ad-hint"></span>
</div>

<!-- criterion rows are generated here -->
<div id="gsx-wlc-criteria"></div>

<div class="ad-row">
  <label>Constraint layer (forces suitability to 0)</label>
  <select id="gsx-wlc-constraint"><option value="">— none —</option></select>
</div>

<div class="ad-row">
  <button class="export-btn" onclick="GSX.renderWLCPanel()">&#x21BB; Refresh criteria</button>
  <button class="export-btn primary" onclick="GSX.runSuitabilityWLC()">Run WLC Analysis</button>
</div>

<div id="gsx-wlc-table"></div>
```

### 3.3 Rebuild the rows when layers change

Call `GSX.renderWLCPanel()` and repopulate `#gsx-wlc-constraint` from the same hook that
refreshes the layer selectors — and once on page load.

### 3.4 Minimal CSS

```css
.gsx-crit { border-left: 3px solid var(--accent, #97BC62);
            padding: 6px 0 6px 10px; margin-bottom: 8px; }
.gsx-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
.gsx-table th { text-align: left; background: #eef3ea; padding: 4px 6px; }
.gsx-table td { padding: 4px 6px; border-top: 1px solid #e2e8f0; }
```

### What the rework changes

| | Before | After |
|---|---|---|
| Cell size | hardcoded ~22 km | user-set, default 500 m, live cell-count warning |
| Polygon criteria | `intersects ? 1 : 0` | presence, **distance decay**, density, or attribute value |
| Point criteria | `min(1, count/5)` — magic 5 | user-set saturation |
| Direction | benefit only | **benefit / cost** toggle |
| Standardisation | none | linear min–max to 0–1 |
| Method record | none | criteria table rendered and exported |

On the supplied fixtures this produced **348 distinct suitability values** where the old code
produced a near-binary surface.

---

## 4. Milestone 2 panel markup

```html
<!-- ============ Area reporting ============ -->
<div class="ad-subhead">Area Reporting</div>
<div class="ad-row">
  <label>Units</label>
  <select id="gsx-area-unit" onchange="GSX.setAreaUnit(this.value)">
    <option value="ha" selected>Hectares (ha)</option>
    <option value="km2">Square kilometres (km²)</option>
    <option value="m2">Square metres (m²)</option>
  </select>
  <label>Method</label>
  <select id="gsx-area-method">
    <option value="spherical" selected>Spherical (WGS84)</option>
    <option value="equalarea">Equal-area (LAEA, auto-centred)</option>
  </select>
</div>

<!-- ============ Fragmentation ============ -->
<div class="ad-subhead">Fragmentation &amp; Patch Metrics</div>
<div class="ad-row">
  <label>Core-area edge depth (m)</label>
  <input id="gsx-core-depth" type="number" value="100" min="1" step="10" style="width:7em">
  <label><input id="gsx-frag-dissolve" type="checkbox"> Dissolve touching patches first</label>
</div>
<div class="ad-row">
  <button class="export-btn primary" onclick="GSX.uiFragmentation()">Run Patch Metrics</button>
</div>

<!-- ============ Connectivity ============ -->
<div class="ad-subhead">Connectivity</div>
<div class="ad-row">
  <label>Link threshold (m)</label>
  <input id="gsx-conn-threshold" type="number" value="500" min="1" step="100" style="width:7em">
  <button class="export-btn primary" onclick="GSX.uiConnectivity()">Build Connectivity Graph</button>
</div>

<!-- ============ Change detection ============ -->
<div class="ad-subhead">Forest Change Detection</div>
<div class="ad-row">
  <span class="ad-hint">Layer 1 = earlier extent (T1). Layer 2 = later extent (T2).</span>
</div>
<div class="ad-row">
  <label>Year T1</label><input id="gsx-year-t1" type="number" placeholder="2015" style="width:6em">
  <label>Year T2</label><input id="gsx-year-t2" type="number" placeholder="2025" style="width:6em">
  <button class="export-btn primary" onclick="GSX.uiChangeDetection()">Detect Change</button>
</div>
```

Each `ui*` function returns `{ summaryRows, caption, … }`. Render `summaryRows` through the
existing results-table routine and **display the caption** — each one states a limitation the
student must otherwise be told verbally, and will otherwise be omitted from Part B.

---

## 5. What Milestone 2 delivers

**P1-4b Equal-area** — auto-centred Lambert Azimuthal Equal-Area via proj4, with interior rings
subtracted. Every result names its method and CRS, so an area figure is never separated from how
it was produced. At PNG latitudes the two methods agree to within 1%, which is itself worth
showing students.

**P1-5 Fragmentation** — NP, CA, mean/median patch size, LPI, total edge, edge density, mean shape
index, core area at a user-set depth, CAI, ENN, and a count of patches too narrow to have any core
at all. That last figure is an ecological result, not an error.

**P1-6 Connectivity** — union-find components at a threshold distance, emitting a link layer and
a `component` attribute on each patch. Deliberately *not* least-cost path: the caption sends
students to QGIS/GRASS `r.cost` for that rather than implying terrain is modelled.

**P1-7 Change detection** — loss, gain and persistence geometry, areas and percentages, net change,
and annual rate in ha/yr and %/yr. The annual rate is what makes a student's number comparable
with published PNG deforestation figures.

Verified on the fixtures (2015→2025, equal-area):

```
T1 57,828 ha   T2 47,926 ha
loss 11,002 ha (19.0%)   gain 1,101 ha (1.9%)   persistence 46,826 ha
net −9,901 ha (−17.1%) = −990.2 ha/yr, −1.71%/yr
closure residual 0.00000%
```

---

## 5b. SDM correctness fixes (P0-4c)

### What changed

Both models previously **degraded silently into a different method**. They now refuse, or warn.

| Problem | Old behaviour | New behaviour |
|---|---|---|
| BIOCLIM with no environmental layers | Gaussian kernel on presence points, labelled "Bioclim SDM" | **Refuses**, and explains that a kernel density tool is what they actually want |
| Mahalanobis with < 2 variables | Distance on lon/lat — a geographic ellipse labelled as an SDM | **Refuses**, and says the result would describe geography |
| Singular covariance | `invertMatrix` returned the identity ⇒ silently Euclidean | Detected, ridge regularisation applied, **lambda disclosed in a warning** |
| Missing values | Replaced with `0` (elevation → sea level) | Records **excluded and counted** |
| Polygon environmental layers | Sampled at the polygon's **first vertex** | Point-in-polygon, then true boundary distance |
| Sampling cost | Re-scanned every layer once per variable | Once per location |
| Percentiles | `floor(n·0.05)` — inert at small n (n=10 gave the full range) | Linearly interpolated |
| BIOCLIM scoring | `inEnvelope / nVars` — partial credit, not BIOCLIM | `mode: 'limiting'` = **true BIOCLIM**; `'proportion'` retained but labelled *NOT standard* |
| Mahalanobis output | `1/(1+D)`, an arbitrary index | `output: 'chisq'` gives **P(χ² > D²)**, a real probability; index retained and labelled as not one |

A zero-width envelope — every presence record sharing one value — now warns too. That variable
carries no information, and the old code would silently accept only that exact value.

### Panel markup

```html
<div class="ad-subhead">Species Distribution Model</div>
<div class="ad-row">
  <label>Presence layer (points)</label>
  <select id="gsx-sdm-presence"></select>
  <label>Cell size (m)</label>
  <input id="gsx-sdm-cellsize" type="number" value="1000" min="100" step="100" style="width:7em">
</div>

<div id="gsx-sdm-env"></div>   <!-- environmental variable rows -->

<div class="ad-row">
  <label>BIOCLIM mode</label>
  <select id="gsx-bioclim-mode">
    <option value="limiting" selected>Limiting factor (true BIOCLIM)</option>
    <option value="proportion">Proportion in envelope (non-standard)</option>
  </select>
  <button class="export-btn primary" onclick="GSX.uiBioclim()">Run BIOCLIM</button>
</div>

<div class="ad-row">
  <label>Mahalanobis output</label>
  <select id="gsx-maha-output">
    <option value="chisq" selected>Chi-square probability</option>
    <option value="index">1/(1+D) index</option>
  </select>
  <button class="export-btn primary" onclick="GSX.uiMahalanobis()">Run Mahalanobis</button>
</div>

<div id="gsx-sdm-warnings"></div>
```

Build the `#gsx-sdm-env` rows the same way as the WLC criteria rows — one per layer with a
checkbox, a numeric-field selector, and a sampling-method dropdown (`auto` / `nearest` / `idw`).
`GSX.collectEnvLayers()` reads ids of the form `gsx-env-on-{i}`, `gsx-env-fld-{i}`, `gsx-env-m-{i}`.

**`#gsx-sdm-warnings` is not decorative.** It is where "your covariance matrix was singular" and
"3 records were excluded" appear. If you do not render it, the fixes are invisible and students
will cite regularised output as exact.

```css
.gsx-warn { background:#fffaf0; border-left:3px solid #dd6b20; padding:8px 10px;
            margin-top:8px; font-size:12px; }
.gsx-note { background:#f0f7ff; border-left:3px solid #3182ce; padding:8px 10px;
            margin-top:8px; font-size:12px; }
```

### Delete the old functions

Remove `runBioclimSDM`, `runMahalanobisSDM`, `extractEnvAtPoints` and `interpolateEnvAtPoint`.
Leaving them keeps a route to the silent fallbacks. The MaxEnt path (`api/sdm.py`) is untouched.

---

## 5c. Provenance and project files (P2-9 / P2-10)

These close assignment deliverables 4 and 5. Until now a GeoSpaX-only student could not submit
either.

### Three integration hooks

**1. On import** — seed what can be known automatically:
```js
GSX.stampImport(layerInfo, file.name);
```

**2. In `addAnalysisLayer`** — record lineage on every derived layer:
```js
GSX.stampDerived(layerInfo, 'protectionGap', ['layer-1','layer-2'], { areaMode: 'equalarea' });
```
This is what turns the provenance table into an audit trail rather than a form to fill in. A
derived layer auto-describes itself as *"Derived: protectionGap from Forest extent 2015 +
Protected areas"*, and derived layers are exempt from the missing-field check because they
inherit provenance from their parents.

**3. A restore handler** — the one piece only you can write, because it depends on how layers are
added to the map:
```js
window.gsxRestoreProject = function (project) {
  clearAllLayers();                                  // your existing routine
  project.layers.forEach(function (l) {
    if (l.isRaster) return;                          // rasters are not embedded
    addGeoJSONLayer(l.geojson, l.name, l.style);     // your existing routine
    var restored = uploadedLayers[uploadedLayers.length - 1];
    restored.meta = l.meta;
    if (l.visible === false && restored.layer) map.removeLayer(restored.layer);
  });
  if (project.view) map.setView([project.view.lat, project.view.lng], project.view.zoom);
};
```
`GSX.uiLoadProject()` reports a clear error rather than failing silently if this is absent.

### Panel markup

```html
<div class="ad-subhead">Data Provenance</div>
<div id="gsx-prov-table"></div>
<div class="ad-row">
  <button class="export-btn" onclick="GSX.uiExportProvenance('csv')">Export CSV</button>
  <button class="export-btn" onclick="GSX.uiExportProvenance('md')">Export Markdown</button>
</div>
<div id="gsx-meta-form"></div>

<div class="ad-subhead">Project</div>
<div class="ad-row">
  <label>Student name</label><input id="gsx-proj-studentName" type="text">
  <label>Student ID</label><input id="gsx-proj-studentId" type="text">
</div>
<div class="ad-row">
  <label>Species</label><input id="gsx-proj-species" type="text">
  <label>Title</label><input id="gsx-proj-title" type="text">
</div>
<div class="ad-row">
  <button class="export-btn primary" onclick="GSX.uiSaveProject()">Save Project (.gspx)</button>
  <label class="export-btn">Load Project
    <input type="file" accept=".gspx,.json" style="display:none"
           onchange="GSX.uiLoadProject(this.files[0])">
  </label>
</div>
```

Add an "Edit provenance" button per layer in the layer panel calling
`GSX.uiEditMeta(layerId)`, and call `GSX.uiRenderProvenanceTable()` whenever layers change.

### Autosave

```js
GSX.startAutosave(60000);              // every 60 s
var a = GSX.hasAutosave();             // on page load
if (a && confirm('Recover unsaved project from ' + a.modified + '?')) GSX.restoreAutosave();
```
Campus power is not reliable; losing a two-hour session is worse than a `localStorage` write.
Autosave fails quietly on quota overflow rather than interrupting work.

### What the file contains

`.gspx` is JSON with a format marker and version, a random `projectId`, `created` / `modified`
timestamps, the student block, map view, and **fully embedded geometry** — a submitted project
must open on your machine without the student's source data. Rasters are the exception: they are
listed by name but not embedded, and the loader warns which must be re-imported.

Validation rejects non-JSON, wrong format, missing version, layers without geometry, and files
written by a **newer** format version — with a message saying so rather than a stack trace.

---

## 5d. Raster reclassify and polygonize (P2-8)

Closes **A1** — derive forest extent from an index raster instead of needing supplied polygons.

Pipeline: raster → histogram → threshold (manual or Otsu) → binary mask → run-length rectangles →
GeoJSON → dissolve into patches. The output feeds straight into overlay, protection gap,
fragmentation and change detection.

Polygonization uses **run-length encoding with vertical merging**, not marching squares. RLE is
exact on a grid, preserves interior holes once dissolved, and on a solid block produces *one*
rectangle rather than one per cell.

### Panel markup

```html
<div class="ad-subhead">Raster → Vector</div>
<div class="ad-row">
  <label>Raster layer</label><select id="gsx-raster-layer"></select>
  <label>Band</label><input id="gsx-raster-band" type="number" value="0" min="0" style="width:4em">
  <button class="export-btn" onclick="GSX.uiRasterHistogram()">Histogram + Otsu</button>
</div>
<div id="gsx-raster-hist"></div>
<div class="ad-row">
  <label>Threshold</label><input id="gsx-raster-threshold" type="number" step="any" style="width:8em">
  <select id="gsx-raster-op">
    <option value="&gt;=" selected>&ge; (at or above)</option>
    <option value="&gt;">&gt; (above)</option>
    <option value="&lt;=">&le; (at or below)</option>
    <option value="&lt;">&lt; (below)</option>
  </select>
  <label><input id="gsx-raster-dissolve" type="checkbox" checked> Merge into patches</label>
</div>
<div class="ad-row">
  <button class="export-btn primary" onclick="GSX.uiRasterToPolygons()">Reclassify &amp; Polygonize</button>
</div>
```

```css
.gsx-hist { display:flex; align-items:flex-end; gap:1px; height:64px; margin:6px 0; }
.gsx-hist span { flex:1; background:#97BC62; }
```

Populate `#gsx-raster-layer` with layers where `isRaster` is true. The module reads the georaster
object from `layer.georaster` or `layer.raster` — adjust `selectedRaster()` if your import stores
it elsewhere.

### Guards

- Constant band → refuses ("there is nothing to threshold").
- No cells pass → refuses rather than emitting an empty layer.
- Above 4,000,000 cells → refuses and tells the user to downsample.
- Above 20,000 fragments → refuses and explains the raster is probably noisy.
- Output is stamped with `GSX.stampDerived`, so the derived layer records its source raster,
  band, threshold and operator in the provenance table automatically.

**Otsu note:** with a cleanly bimodal raster every empty bin between the modes ties for maximum
between-class variance. Taking the first tied bin would put the break hard against the lower mode,
where a little noise flips it — so the implementation returns the **centre of the tied range**.

---

## 6. Testing status

**302 assertions, all passing** across six suites (47 + 46 + 48 + 47 + 42 + 72).
Closure identities are asserted, not assumed:
`intersect + difference = A`, `protected + gap = total`, `loss + persistence = T1`,
`gain + persistence = T2` — each to better than 0.5%, and 0.00000% on the fixtures.

Edge cases covered: MultiPolygon, interior rings, non-polygon input, empty layers, identical
layers, non-overlapping layers, full coverage, and the 0.31 ha patch that makes
`turf.buffer(p, −100)` return `undefined`.

The SDM suite verifies the guards *fire*, not just that the code runs: BIOCLIM refuses without
environmental variables, Mahalanobis refuses below two, singular covariance is detected and the
ridge disclosed, and the chi-square implementation is checked against published critical values
(df 1–4 at p = 0.05 → 3.841, 5.991, 7.815, 9.488).

The project suite verifies rejection paths — corrupt JSON, wrong format marker, missing version,
a *newer* format version, and layers stripped of geometry — plus a full save → parse → restore
round trip preserving geometry, provenance and project id.

**Measured performance** (Node, single core — browser will be slower):

| Operation | Time |
|---|---|
| Overlay 500 × 500 polygons | 1.0 s |
| WLC 24,649 cells × 1 criterion | 1.5 s |
| Fragmentation, 200 patches | 0.14 s |
| Connectivity, 200 patches | 0.01 s |

WLC scales linearly with criteria — 5 criteria × 25,000 cells is roughly 7–8 s. The cell-count
warning is wired in and triggers above 20,000 cells, with a confirm dialog above 50,000.

### UI wrappers ARE now tested

`test-ui.js` runs every `ui*` function against a real jsdom document with a mocked Leaflet and
mocked host globals. It exercises the style and `onEachFeature` callbacks the way Leaflet would,
asserts which layers get added and what the summary rows say, drives the WLC panel through
`renderWLCPanel` → `collectWLCCriteria` → `runSuitabilityWLC`, intercepts downloads, and drives the
project save/load round trip.

Two assertions in it matter more than the rest:

```
GUARD: BIOCLIM refuses with no env layer     — and draws nothing
GUARD: Mahalanobis refuses with 1 variable   — and draws nothing
```

That is the whole point of P0-4c, verified rather than asserted.

What jsdom does **not** cover: real Leaflet rendering, real projection of layers onto tiles,
CSS layout, and browser performance. Run these six checks once in the actual app:

1. Load the app, import `fixtures/forest_extent_t1.geojson` and `protected_areas.geojson`.
2. Run Protection Gap — expect **29.6% protected, 70.4% gap**.
3. Import `forest_extent_t2.geojson`, run Change Detection with years 2015/2025 — expect
   **−996.6 ha/yr** with the default *Spherical* area method, or **−990.2 ha/yr** if you switch
   to *Equal-area*. The two differ by 0.6%; both are correct for their method.
4. Import `forest_patches_poly.geojson`, run Patch Metrics at 100 m — expect **7 patches,
   LPI 33.3%, and 1 patch with no core area**.
5. Run Connectivity at 5,000 m — expect **6 components, 5 isolated**.
6. Configure two WLC criteria with opposite directions and confirm the criteria table renders.
7. Load a GeoTIFF, click Histogram + Otsu, then Reclassify & Polygonize — the result must be a
   polygon layer usable by the vector tools.
8. Save a project, reload the page, load the `.gspx` — layers, styles and provenance must return.

If any disagree with the numbers above, the wiring is wrong, not the maths — the maths is
asserted across 302 tests. Checks 7 and 8 are the only genuinely new surface; the SDM guards are
already covered by `test-ui.js`.

---

## 7. Where this leaves the assignment

| Requirement | Status after M1 + M2 |
|---|---|
| A1 Land cover / forest extent | ✅ Complete (raster reclassify + polygonize) |
| A2 Forest change in hectares | ✅ Complete, with annual rate |
| A3 Protected-area overlay + gap | ✅ Complete |
| A4 Multi-criteria suitability | ✅ Complete and defensible |
| A5 Fragmentation / connectivity | ✅ Complete |
| Deliverable 4 — provenance table | ✅ Complete, with lineage on derived layers |
| Deliverable 5 — project file | ✅ Complete (`.gspx`, with project id) |

**All five Part A requirements and both outstanding deliverables are now complete.** The only
roadmap item left is P3-11, the optional one-click report, which is convenience rather than
capability.
