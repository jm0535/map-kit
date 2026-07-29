# GeoSpaX — Conservation Planning & Habitat Mapping Implementation Spec

**Target:** make GeoSpaX (`geospax.in4metrix.dev`, repo `jm0535/map-kit`) sufficient for the
FR422 assignment *Species Habitat Assessment & Conservation Plan* without requiring desktop QGIS.

**Audit date:** July 2026, against commit `981887d`.

---

## 1. Audit summary

### 1.1 Already implemented — no work needed

| Capability | Where |
|---|---|
| Species distribution models — BIOCLIM, Mahalanobis | `runBioclimSDM()`, `runMahalanobisSDM()` |
| MaxEnt SDM (server-side, elapid with logistic-regression fallback) | `api/sdm.py`, `runMaxEntSDM()` |
| Conservation hotspot grid (hex/square; count, density, presence/absence) | `runHotspotGrid()` |
| Polygon areas, line lengths, centroids, buffer, convex hull | `runAnalysis()` switch |
| DBSCAN, IDW, point density, weighted density, Voronoi, NNI | `runAnalysis()` switch |
| Getis-Ord Gi\*, Local Moran's I (LISA), Global Moran's I, Moran scatterplot | `runAnalysis()` switch |
| Raster display (GeoTIFF), elevation profile, slope | `vendor/georaster*`, elevation panel |
| Import: GeoJSON, Shapefile, KML, XLSX | `vendor/shpjs`, `togeojson`, `xlsx` |
| Export: GeoJSON, XLSX, Shapefile `.zip`, map image / PDF | `vendor/shp-write`, `jspdf`, `html2canvas` |
| Digitizing, attribute table, symbology, feature info panel | core UI |

A WLC suitability tool exists (`runSuitabilityWLC()`) but **does not yet meet A4** — see §1.4.
GeoSpaX does give more SDM capability than the brief asks for.

### 1.2 Gaps, mapped to the assignment

Assignment Part A (60 marks) requires five GIS outputs. Status:

| # | Assignment requirement | Status | Blocking gap |
|---|---|---|---|
| A1 | Land cover / forest extent | ⚠️ Partial | Can display rasters; cannot classify or reclassify to a forest/non-forest mask, no raster→vector |
| A2 | Quantified forest change **in hectares** | ❌ Missing | No two-date change detection; areas reported in km² only |
| A3 | Protected-area overlay + **calculated protection gap** | ❌ Missing | **No vector overlay at all** — no intersect / difference / union / dissolve / spatial join |
| A4 | Multi-criteria habitat suitability map | ⚠️ Partial | Tool exists but scoring is binary, cells are ~22 km, no distance-decay, no cost/benefit direction — see §1.4 |
| A5 | Fragmentation / connectivity assessment | ❌ Missing | No patch metrics, no core-area, no inter-patch connectivity |

Two further deliverables outside Part A:

| Deliverable | Status | Gap |
|---|---|---|
| Data provenance table | ❌ Missing | Layers carry no source/licence/date metadata |
| Project file (authorship check) | ❌ Missing | No save/load — a GeoSpaX-only student cannot submit the equivalent of a `.qgz` |

### 1.3 The key finding that makes this cheap

`vendor/turf-6.5.0.min.js` is the **full** Turf build — **189 exports**, verified present:

```
intersect  difference  union  dissolve  buffer  area  centroid  distance
nearestPoint  booleanContains  booleanWithin  booleanIntersects  explode
simplify  voronoi  concave  pointsWithinPolygon  collect  tag
nearestPointToLine  polygonToLine  lineIntersect  bboxClip  transformScale
```

Only six are currently called (`area`, `booleanIntersects`, `featureCollection`, `hexGrid`,
`pointsWithinPolygon`, `squareGrid`).

**Implication:** the overlay, change-detection and fragmentation work is almost entirely
UI wiring against algorithms already shipped in the bundle. No new dependencies, no bundle-size
increase, no CDN — consistent with the project's stated "no CDN dependencies" policy.

---

### 1.4 Why the existing WLC does not yet meet A4

`runSuitabilityWLC()` runs, normalises weights correctly (`weightedSum / totalWeight`), and
applies the constraint layer properly as a hard mask (`suitability = 0`). Those parts are sound.
Four things block its use for a graded habitat-suitability map:

| Problem | Code | Consequence |
|---|---|---|
| **Binary scoring for polygon criteria** | `score = intersects > 0 ? 1 : 0` | Every criterion collapses to presence/absence. No graded suitability — the defining feature of WLC. |
| **Magic number for point criteria** | `score = Math.min(1, within.features.length / 5)` | Saturates at 5 points per cell. The 5 is hardcoded and indefensible in a student report. |
| **Fixed ~22 km cells** | `cellSizeDeg = 0.2` → `0.2 × 111 km` | Far too coarse for species-scale habitat assessment. Not user-adjustable. |
| **No distance decay, no cost/benefit direction** | intersects-only test | "Distance to water" and "distance to roads" — the two most standard criteria — cannot be expressed. All criteria are implicitly "more is better". |

Net effect: a student would produce a coarse, near-binary map and could not defend the
methodology in Part B. **This is a P0 fix, not an enhancement.**

### 1.5 SDM audit — BIOCLIM and Mahalanobis

Both run and produce plausible-looking maps. Both contain **silent fallbacks that change the
method without telling the user**, which is the same failure class as the WLC.

**Shared — environmental value extraction (`extractEnvAtPoints`, `interpolateEnvAtPoint`)**

| Problem | Detail |
|---|---|
| **Polygons represented by one vertex** | `getAllCoords(f.geometry)[0]` takes the *first vertex* as the feature's location. A forest block is reduced to one corner. Nothing does point-in-polygon. |
| **"Interpolate" is nearest-neighbour** | The function name promises interpolation; it assigns the nearest feature's value. No IDW, no weighting. |
| **k-fold redundant work** | Mahalanobis calls `varNames.map(v => interpolateEnvAtPoint(coords, envLayers)[v])` — the full nearest-feature scan runs once *per variable* instead of once per cell. |
| Euclidean distance in degrees | `Math.hypot` on lon/lat. At 6°S the lat/lon scale difference is under 1%, so this is **not** a practical problem for PNG — noted for correctness only. |

**BIOCLIM (`runBioclimSDM`)**

| Problem | Detail |
|---|---|
| **Not BIOCLIM** | Score is `inEnvelope / nVars` — partial credit. Classic BIOCLIM is limiting-factor: any variable outside its envelope ⇒ unsuitable. 3 of 4 variables outside currently still scores 0.25. |
| **Percentile trimming is inert at small n** | `p5idx = floor(n·0.05)`, `p95idx = min(n−1, ceil(n·0.95))`. At n = 10 this gives indices 0 and 9 — the full min–max range, no trimming at all. Species records in PNG are typically small-n, so the 5–95% envelope the code claims is rarely what is applied. |
| **Silent fallback to kernel density** | With no environmental layers it computes `exp(−d²/2σ²)` from presence points and labels the output "Bioclim SDM". That is a heat map, not a distribution model. |
| Prediction extent | Buffer is `max(1, range × 0.5)` **degrees** — a floor of ~111 km beyond the data. |

**Mahalanobis (`runMahalanobisSDM`)**

| Problem | Detail |
|---|---|
| **Silent fallback to geography** | If fewer than 2 environmental variables are supplied it computes Mahalanobis distance on **lon/lat**, producing a dispersion ellipse around the presence centroid — labelled as an SDM. One environmental variable is a common student case. |
| **Missing values become 0** | `(v !== null && !isNaN(v)) ? v : 0` on both fitting and prediction. For elevation in metres, a missing value becomes sea level and drags the mean and covariance. |
| **Singular covariance → Euclidean** | `invertMatrix` returns the identity when the pivot is < 1e-10, silently converting Mahalanobis distance to plain Euclidean. Correlated bioclim variables trigger this routinely, with no warning. |
| Index, not probability | Returns D (not D²) and rescales `1/(1+d)`. Monotonic and usable as a relative index, but it is not a probability and should not be described as one. Chi-square on D² with df = n variables is the standard route. |

**No model evaluation anywhere** — no AUC, TSS, or cross-validation for any of the three models.
The brief does not require it, but a suitability map with no validation is weak evidence in Part B.

**Verdict:** the fallbacks are the priority. A model that quietly becomes a different model is worse
than one that refuses to run, because the student cannot tell and neither can the marker.

## 2. Priority order

| Priority | Item | Assignment impact | Est. effort |
|---|---|---|---|
| **P0** | 1. Vector overlay toolkit | Unblocks A3 | M |
| **P0** | 2. Protection gap report | Directly scored in A3 | S |
| **P0** | 3. Hectares as a first-class unit | A2 wording is explicit | XS |
| **P0** | 4. WLC rework (graded scoring, cell size, decay) | A4 — currently not defensible | M |
| **P1** | 4b. Equal-area reporting mode | Area figures quoted as fact | S |
| **P0** | 4c. SDM fallback guards + env extraction fix | Models silently change method | M |
| **P1** | 5. Fragmentation / patch metrics | Unblocks A5 | M |
| **P1** | 6. Connectivity graph | Completes A5 | M |
| **P1** | 7. Two-date change detection | Unblocks A2 | M |
| **P2** | 8. Raster reclassify + polygonize | Completes A1 | L |
| **P2** | 9. Layer provenance metadata | Deliverable 4 | S |
| **P2** | 10. Project save / load (`.gspx`) | Deliverable 5, authorship | M |
| **P3** | 11. One-click assessment report | Marking efficiency | M |

If time is short, **P0 + P1 alone make GeoSpaX sufficient for Part A**.

> **Changed in v2:** P0-4 (WLC rework) and P1-4b (equal-area) added after auditing
> `runSuitabilityWLC()`; v1 wrongly recorded A4 as met.
> **v3:** P0-4c added after auditing both SDM implementations — see §1.5.
> **v5 (implemented):** every item except P3-11 is built and tested — 302 assertions across six
> suites, including `test-ui.js` which runs the UI wrappers in a real DOM via jsdom.
> P2-8 (raster reclassify + polygonize) landed last and closes A1.

---

## 3. Architectural conventions to follow

Match the existing code — do not introduce a framework.

- **Tool dispatch:** add `case` branches to the `switch(tool)` inside `function runAnalysis(tool)`.
- **Result layers:** always finish by calling
  `addAnalysisLayer(name, leafletLayers, geojsonFC, rasterMeta)`. It assigns
  `id = 'analysis-N'`, wraps in `L.layerGroup`, sets `isAnalysis: true`, and registers
  `geojsonFeatures` so the result is exportable like any other layer.
- **Layer registry:** `uploadedLayers` array; look up with
  `uploadedLayers.find(l => l.id === layerId)`.
- **Feature access:** `getAnalysisFeatures(layerId)`, then
  `pointsFromFeatures / linesFromFeatures / polygonsFromFeatures`.
- **User feedback:** `showToast(msg, 'info'|'error')`.
- **Panel markup:** `<div class="ad-subhead">Section Name</div>` then
  `.export-btn` / `.export-btn.primary` buttons.
- **Long jobs:** the SDM functions already show the pattern for a progress toast — reuse it.
  Anything above ~2,000 features should yield to the event loop so the UI does not freeze.

### 3.1 One shared prerequisite

Every overlay tool needs **two** layers. The analysis panel currently has a single
`#analysis-layer-select`. Add a reusable second selector:

```html
<select id="analysis-layer-select-b"></select>
```

populated by the same routine that fills the primary select, and add a helper:

```js
function getTwoLayers() {
  const a = document.getElementById('analysis-layer-select').value;
  const b = document.getElementById('analysis-layer-select-b').value;
  if (!a || !b) { showToast('Select two layers', 'error'); return null; }
  if (a === b)  { showToast('Select two different layers', 'error'); return null; }
  return { a: getAnalysisFeatures(a), b: getAnalysisFeatures(b),
           aName: layerName(a), bName: layerName(b) };
}
```

---

## 4. Feature specifications

### P0-1 — Vector Overlay Toolkit

**Why:** A3 is impossible without it. It is also the single most-used class of GIS operation
students will have met in QGIS (Vector → Geoprocessing), so its absence is conspicuous.

**New panel section:** `Overlay & Geoprocessing`

**Tools** (each a `case` in `runAnalysis`):

| Tool key | Turf call | Notes |
|---|---|---|
| `intersect` | `turf.intersect(polyA, polyB)` | pairwise over both collections; collect non-null results |
| `difference` | `turf.difference(polyA, polyB)` | A minus B — this is what produces the *gap* geometry |
| `unionLayers` | `turf.union(...)` | reduce over all polygons |
| `dissolve` | `turf.dissolve(fc, {propertyName})` | optional group-by field selector |
| `clipTo` | `turf.bboxClip` or intersect | clip layer A to extent of layer B |
| `spatialJoin` | `turf.tag` / `turf.collect` | attach B's attributes to A's points |

**Implementation notes**
- Turf overlay requires `Polygon`/`MultiPolygon`. Reject other geometry types with a clear toast
  rather than failing silently.
- `turf.intersect` returns `null` for non-overlapping pairs — filter these out.
- For *n×m* pairwise work, pre-filter with `turf.booleanIntersects` (already in use) before the
  expensive call. This is the difference between usable and unusable on a 500-polygon layer.
- Carry source attributes through: prefix with the layer name (`pa_name`, `hab_class`) to avoid
  key collisions.

**Acceptance criteria**
1. Load two overlapping polygon layers → `intersect` produces a new layer with only the
   overlapping geometry, and a results table with feature count and total area.
2. `difference` on the same pair produces the complement, and
   `area(intersect) + area(difference) ≈ area(A)` to within 0.5%.
3. Result layers export to GeoJSON and Shapefile like any imported layer.

---

### P0-2 — Protection Gap Report

**Why:** the brief scores a *calculated protection gap*, not just a visual overlay. Making this a
single named tool means every student computes it the same way and you can mark it consistently.

**Inputs:** layer A = species habitat / range polygon(s); layer B = protected areas.

**Outputs**
1. Results table:

   | Metric | Value |
   |---|---|
   | Total habitat area | ha |
   | Area inside protected areas | ha |
   | Area outside protected areas (**the gap**) | ha |
   | Protected proportion | % |
   | Protected areas intersected | count + names |

2. Two result layers: `Habitat — protected` and `Habitat — gap`, styled green/red by default.

**Algorithm**
```
habitat  = union(A)                       // dissolve overlapping range polygons first
pas      = union(B)
protected = intersect(habitat, pas)
gap       = difference(habitat, pas)
pct       = area(protected) / area(habitat) * 100
```

**Acceptance:** on a synthetic case where a 100 ha square habitat overlaps a PA by exactly a
quarter, the tool reports 25 ha protected, 75 ha gap, 25.0%.

**Teaching note to surface in the UI:** add a one-line caption —
*"Protection gap is computed on mapped extent only; it does not account for management
effectiveness."* This pre-empts the most common overclaim in student reports.

---

### P0-3 — Hectares as a first-class unit

**Why:** the brief specifies hectares. Students currently have to convert by hand, which is where
arithmetic marks get lost.

- Add `area_ha` alongside the existing `area_km2` in the Polygon Areas tool
  (`ha = km² × 100`).
- Add a global unit toggle (ha / km² / m²) in the analysis panel; persist to `localStorage`
  (already used elsewhere in the app).
- Apply consistently to overlay, change-detection and fragmentation outputs.
- Keep 3 significant figures for ha; do not round to integers below 10 ha.

---

### P0-4 — WLC Rework (graded scoring, cell size, distance decay)

**Why:** A4. The current tool produces a near-binary map at ~22 km resolution. See §1.4.

Keep what works — weight normalisation and the constraint mask are already correct. Replace the
scoring layer.

**4a. User-set cell size.** Replace the hardcoded `cellSizeDeg = 0.2` with an input in metres
(default 500 m, sensible range 100 m – 5 km). Show the resulting cell count before running and
warn above ~20,000 cells. This alone is the single biggest improvement.

**4b. Per-criterion scoring method.** Each selected criterion layer gets a dropdown:

| Method | Applies to | Score |
|---|---|---|
| Presence/absence | any | 1 if intersects, else 0 (current behaviour, retained) |
| **Distance decay** | any | `score = max(0, 1 − d/dmax)` where `d` = cell centroid to nearest feature, `dmax` user-set |
| **Density** | points | points per cell ÷ user-set saturation count (replaces the hardcoded 5) |
| **Attribute value** | any | numeric field, rescaled to 0–1 across the layer |

Distance uses `turf.nearestPoint` for point layers, `turf.polygonToLine` + `turf.pointToLineDistance`
for polygons and lines — all already vendored.

**4c. Criterion direction.** Add a benefit/cost toggle per criterion. Cost inverts the score
(`1 − score`). Without this, "distance to roads" and "distance to logging concession" cannot be
expressed, and those are exactly the disturbance criteria the brief's threat analysis needs.

**4d. Standardisation.** Rescale every criterion to 0–1 before weighting. Offer linear min–max as
the default and note in the tooltip that the choice of rescaling affects the result.

**4e. Transparency output.** Alongside the suitability layer, emit a criteria table:
criterion name, method, direction, `dmax`/saturation, raw weight, normalised weight. This is what
lets a student document their method — and lets you mark it.

**Acceptance criteria**
1. Two criteria, equal weights, one benefit and one cost, produce a map where a cell scoring 1.0
   on both inputs yields 0.5 — confirming the cost inversion applies.
2. Setting cell size to 500 m over a 20 km study area yields ~1,600 cells, not 1.
3. A distance-decay criterion with `dmax = 2000 m` produces a visible gradient, not a hard edge.
4. The criteria table exports with the layer.

---

### P1-4b — Equal-Area Reporting Mode

**Why:** every hectare figure in the assignment is quoted as fact in Part B. Turf's spherical area
on WGS84 is acceptable at PNG latitudes and this scale, but the plan should not leave it implicit.

- Add a projection setting for area/length reporting: **WGS84 spherical (default)** or
  **equal-area** — reproject with `proj4` (already vendored) to a PNG-appropriate equal-area CRS
  before computing. A Lambert Azimuthal Equal-Area centred on the data extent is a reasonable
  automatic choice; expose the chosen CRS string in the results table.
- Apply to Polygon Areas, protection gap, change detection and fragmentation outputs.
- Report the method used in every area table, so the number is never separated from how it was
  produced.
- Add a short note to the README so the limitation is documented, not just handled.

**Acceptance:** a 1° × 1° polygon at 6°S reports an area within 0.5% of its true value under the
equal-area mode, and the results table names the CRS used.

---

### P1-5 — Fragmentation / Patch Metrics

**Why:** A5. Also the analytical heart of the habitat-loss argument in Part B.

**Input:** one polygon layer of habitat patches (or a classified forest layer).

**Metrics table**

| Metric | Definition |
|---|---|
| Number of patches (NP) | feature count after dissolve of touching polygons |
| Total class area (CA) | ha |
| Mean / median patch size | ha |
| Largest patch index (LPI) | largest patch ÷ total class area × 100 |
| Total edge (TE) | sum of patch perimeters, km |
| Edge density (ED) | TE ÷ CA, m ha⁻¹ |
| Mean shape index (MSI) | perimeter ÷ (2√(π × area)), area-weighted option |
| Core area | area remaining after inward buffer of user-set edge depth |
| Core area index (CAI) | core ÷ total × 100 |
| Mean nearest-neighbour distance (ENN) | mean centroid-to-nearest-patch distance, m |

**Implementation**
- Core area: `turf.buffer(patch, -depth, {units:'meters'})`. Turf returns `undefined` when a patch
  is smaller than twice the edge depth — treat as **zero core area**, and report the count of
  such patches separately. That count is itself an ecologically meaningful result and worth
  surfacing.
- Default edge depth 100 m, user-editable. State the default in the UI — edge depth is a
  judgement call and students should have to defend theirs.
- ENN: compute centroids, then `turf.nearestPoint` excluding self. Note in the tooltip that this is
  a centroid approximation, not true edge-to-edge distance.

**Output:** metrics table + optional `Core areas` layer.

---

### P1-6 — Connectivity Graph

**Why:** completes A5 and gives Part B a defensible basis for proposing corridors.

**Input:** patch layer + threshold distance *d* (metres, default 500).

**Algorithm**
1. Compute patch centroids.
2. Build an edge for every pair whose centroid distance ≤ *d*.
3. Find connected components (simple union-find).
4. Report: component count, largest component size (patches and ha), isolated patch count.

**Output**
- `Connectivity links` line layer (one line per edge, attribute `dist_m`).
- `component` attribute written back onto a copy of the patch layer, symbolised categorically.

**Scope discipline:** do **not** attempt least-cost path or circuit theory in the browser. If a
student needs true least-cost corridors, that is a legitimate reason to send them to QGIS
(GRASS `r.cost`). Say so in the tooltip — an honest boundary is better than a bad implementation.

---

### P1-7 — Two-Date Change Detection

**Why:** A2 requires *quantified* change in hectares.

**Vector path** (implement first — cheaper, and matches the data students will actually get):
- Inputs: forest extent T1, forest extent T2, plus year labels.
- Outputs three layers and a table:

| Class | Geometry | Area (ha) | % of T1 |
|---|---|---|---|
| Loss | `difference(T1, T2)` | | |
| Gain | `difference(T2, T1)` | | |
| Persistence | `intersect(T1, T2)` | | |

- Also report net change (ha and %) and, if year labels are given, **annual rate of change**
  (ha yr⁻¹ and % yr⁻¹). The annual rate is what makes the number comparable to published
  PNG deforestation figures, so it is worth computing for the student rather than leaving to them.

**Raster path** (later): difference two single-band rasters with a user threshold; classify into
loss / gain / no-change; report cell counts × cell area.

---

### P2-8 — Raster Reclassify & Polygonize

**Why:** completes A1 so a student can derive forest extent from an index raster rather than
needing a ready-made polygon layer.

- **Reclassify:** single band + threshold(s) → classed raster. Show a histogram to help pick the
  break, and offer Otsu's method as a suggested default.
- **Polygonize:** marching-squares contour at the class boundary → polygons, so the output feeds
  straight into P0-1, P1-4 and P1-6.
- Cap at a sensible raster size and warn above it; downsample rather than freezing the tab.

This is the largest single item on the list. It is genuinely optional if you supply students with
pre-classified forest polygons in the data pack.

---

### P2-9 — Layer Provenance Metadata

**Why:** the brief's data provenance table is a graded deliverable, and it is the mechanism by
which "where did this layer come from?" becomes answerable.

- Extend the layer info object with:
  ```js
  meta: { source: '', url: '', acquired: '', licence: '', crs: 'EPSG:4326', resolution: '', notes: '' }
  ```
- Auto-populate `source` on import with the filename and import timestamp; leave the rest editable
  via a small form in the layer panel.
- **Export provenance table** as CSV / XLSX / Markdown — one row per layer.
- Auto-fill provenance for derived layers: an analysis result should record the tool that made it
  and its parent layers (`derived_from: ['layer-2','layer-5'], tool: 'protectionGap'`). That single
  field converts the provenance table from a chore into an audit trail.

---

### P2-10 — Project Save / Load (`.gspx`)

**Why:** the assignment requires a project file as the authorship check. Without this, a student
using GeoSpaX cannot satisfy deliverable 5 and must use QGIS regardless.

- Serialise to a single JSON file: layer list, geometries (or source references), styles,
  analysis results, provenance metadata, map view, app version.
- `Save Project` → download `.gspx`; `Load Project` → restore state.
- Include `created`, `modified` and a random `projectId` — this is what makes a submitted project
  traceable and discourages file-swapping.
- Autosave the working project to `localStorage` (already a dependency) and offer recovery on
  reload. Students on unreliable campus power will lose work otherwise.

---

### P3-11 — One-Click Assessment Report

**Why:** marking 30 submissions is far faster if every report has the same skeleton.

Bundle into a single PDF (`jspdf` + `html2canvas` are already vendored):
- title block (student name, species, date, project ID)
- map image at current extent with legend, scalebar, north arrow
- every analysis results table run in the session
- the provenance table
- an auto-generated limitations section listing which tools were used and their stated caveats

---

## 5. Suggested build order

**Milestone 1 — "Part A is possible in the browser"**
P0-1, P0-2, P0-3, **P0-4**. After this, A3 and A4 are genuinely supported.
P0-4 is included here because without it A4 is only nominally met.

**Milestone 2 — "Part A is complete"**
P1-4b, P1-5, P1-6, P1-7. After this, A2 and A5 are supported and area figures are defensible;
only A1 still needs supplied polygons.

**Milestone 3 — "Submittable"**
P2-9, P2-10. Deliverables 4 and 5 satisfied; GeoSpaX becomes a valid alternative to QGIS
for the whole assignment.

**Milestone 4 — polish**
P2-8, P3-11.

Milestones 1 and 2 are the ones that matter for this semester. If the lab-hours approval for
Weeks 6–9 does not come through, Milestones 1–3 are what would let you rescale the brief to the
browser-based version without losing assessed content.

---

## 6. Testing

The `samples/` directory already contains suitable fixtures:

- `forest_patches.geojson` → P1-5 fragmentation, P1-6 connectivity
- `habitat_survey_grid.geojson` → P0-1 overlay
- `butterfly_presences.geojson` → SDM inputs, P0-2 as a species layer
- `sample_species_richness.geojson` → hotspot grid, IDW
- `stream_water_sources.geojson`, `vine_host_plants.geojson` → WLC criteria layers

**Add two fixtures** to test the new tools properly:
- `protected_areas.geojson` — a WMA/national park polygon layer overlapping `forest_patches`,
  so P0-2 has a real target.
- `forest_extent_t1.geojson` / `forest_extent_t2.geojson` — a two-date pair with known loss
  and gain areas, for P1-7.

Include at least one geometry edge case in each: a patch smaller than twice the default core-area
edge depth, a multipart polygon, and a polygon with an interior ring. These are exactly the cases
that produce silent wrong answers rather than errors.

---

## 7. Two design cautions

**Do not let the browser tool imply more precision than it has.** The README is already good about
this — it tells users to go to QGIS or PostGIS for production buffers, and to R or ArcGIS for
kriging. Keep that discipline for every tool added here. A protection-gap figure computed from
coarse polygons in EPSG:4326 is an estimate, and the UI should say so, because students will quote
it as fact in Part B otherwise.

**Watch the equal-area problem.** Now specified as a work item — see P1-4b.
