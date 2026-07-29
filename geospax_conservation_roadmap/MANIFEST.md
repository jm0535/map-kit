# FR422 / GeoSpaX — Complete File Manifest

Everything produced in this session. Three folders: teaching materials you can use as-is,
GeoSpaX code ready to integrate, and the scripts that generated the documents.

---

## 1. Teaching materials

| File | What it is |
|---|---|
| `FR422_Ch1_Wildlife_Management.pptx` | **Chapter 1** (Weeks 1–2) — 25 slides. Definitions, why it matters for PNG forests, New Guinea's rich and prehistoric wildlife. Real CC-licensed wildlife photographs. |
| `FR422_Ch2_Wildlife_Management_PNG.pptx` | **Chapter 2** (Week 3) — 29 slides. Rebuilt from your own lecture PDF, reusing your source screenshots (CEPA, JICA, PNGFA, CBD, TKCP, NBSAP, parks table) at larger type. |
| `FR422_Ch2_Comparison_Slide.pptx` | Single slide — WMA vs Conservation Area vs Protected Area. Insert after your Conservation Areas slide. |
| `FR422_Conservation_Instruments_Handout.docx` | One-page student handout, editable. |
| `FR422_Conservation_Instruments_Handout.pdf` | Same handout, print/Classroom ready. |
| `*_preview.pdf` | PDF renders of each deck for quick viewing without PowerPoint. |

### Three corrections carried into Chapter 2

Flagged because they change what students are taught:

1. **"Wildlife Protection Act"** — no PNG statute of that name. Replaced with the
   **Fauna (Protection and Control) Act 1966**. Your Conservation Areas Act 1978 and
   National Parks Act 1982 were correct and are retained.
2. **World Heritage** — Kuk (2008) is PNG's **only** inscribed site. Parliament House is not one.
   Kuk now has its own slide; the seven tentative-list sites have another.
3. **National parks table** — Tonda and Maza, the two largest entries, are WMAs rather than
   national parks. Your table image is retained with a note.

The Protected Areas Act 2023 was also added — it post-dates your original deck.

**Still open:** the title slides say "Semester 2, 2026" per your instruction, but the lesson plan
on file is Semester 2/2025 (prepared 3 July 2025). Confirm once a 2026 revision is approved.

---

## 2. GeoSpaX — conservation planning modules

### `modules/` — load in this order

```html
<script src="vendor/turf-6.5.0.min.js"></script>
<script src="vendor/proj4/proj4.js"></script>
<script src="src/geospax-conservation.js"></script>      <!-- must be first -->
<script src="src/geospax-conservation-m2.js"></script>
<script src="src/geospax-sdm-fix.js"></script>
<script src="src/geospax-project.js"></script>
<script src="src/geospax-raster.js"></script>
<script src="src/gsx-select.js"></script>               <!-- dropdown popup fix -->
```

| Module | Delivers | Tests |
|---|---|---|
| `geospax-conservation.js` | Overlay toolkit, protection gap, hectares, WLC engine + panel | 47 |
| `geospax-conservation-m2.js` | Equal-area reporting, fragmentation, connectivity, change detection | 46 |
| `geospax-sdm-fix.js` | SDM fallback guards, correct env sampling, chi-square Mahalanobis | 48 |
| `geospax-project.js` | Provenance metadata, `.gspx` project save/load, autosave | 47 |
| `geospax-raster.js` | Reclassify, Otsu threshold, polygonize (closes A1) | 42 |
| `gsx-select.js` | Dropdown popup replacement (app-wide UI, no deps) | — |

No new dependencies — turf 6.5 and proj4 are already vendored in your repo.

### `tests/` — 302 assertions

```bash
cd 2_geospax/tests
GEOSPAX_ROOT=/path/to/map-kit node test-conservation.js   # 47
GEOSPAX_ROOT=/path/to/map-kit node test-m2.js             # 46
GEOSPAX_ROOT=/path/to/map-kit node test-sdm.js            # 48
GEOSPAX_ROOT=/path/to/map-kit node test-project.js        # 47
GEOSPAX_ROOT=/path/to/map-kit node test-raster.js         # 42
GEOSPAX_ROOT=/path/to/map-kit node test-ui.js             # 72 — real DOM, needs jsdom
```

`GEOSPAX_ROOT` points at the repo so the vendored libraries resolve. If you drop the modules into
`src/` and the tests into `tests/` inside the repo, the default path works without the variable.

### `fixtures/` — polygon test data

**Every dataset in your `samples/` folder is Points**, including `forest_patches.geojson`, which
stores `patch_area_ha` as an attribute on a centroid. There was no polygon geometry anywhere in
the repo, so nothing polygon-based could be tested. These four fill that gap, located in the
Markham Valley / Lae hinterland:

| File | Contents |
|---|---|
| `forest_extent_t1.geojson` | 3 forest blocks, 2015 — 58,207 ha |
| `forest_extent_t2.geojson` | Same blocks 2025, two clearings carved out, one regrowth patch — 48,240 ha |
| `protected_areas.geojson` | Wampit WMA + Markham Conservation Area |
| `forest_patches_poly.geojson` | 7 patches with three deliberate edge cases |

The edge cases are the ones that produce **silently wrong answers** rather than errors:
a 0.31 ha patch where `turf.buffer(p, −100)` returns `undefined`; a polygon with an interior
ring; and a MultiPolygon.

### `docs/`

| File | Contents |
|---|---|
| `GEOSPAX_CONSERVATION_ROADMAP.md` | Full audit and 11-item work plan. §1.4 is the WLC audit, §1.5 the SDM audit. |
| `INTEGRATION.md` | Panel markup, insertion points, CSS, and the browser checklist. **Read §6 before teaching with this.** |

---

## 3. Source scripts

Included so you can regenerate or modify the documents yourself rather than asking for a rebuild.

| Script | Produces |
|---|---|
| `build_chapter1_deck.js` | Chapter 1 pptx |
| `build_chapter2_deck.js` | Chapter 2 pptx |
| `build_comparison_slide.js` | Comparison slide |
| `build_handout.js` | Handout docx |
| `generate_fixtures.js` | The four geojson fixtures |
| `icons2.js`, `geticons.js`, `geticons2.js` | Icon rendering helpers used by the deck builders |

Run with `NODE_PATH=/usr/local/lib/node_modules_global node <script>`. The deck builders expect
`pptxgenjs`; the handout builder expects `docx`.

The Chapter 2 builder reads images from `photos/ch2/` — those are extracted from your own lecture
PDF via `pdfimages -png`, so re-extract them if you rebuild from a different source.

---

## Current status

| Assignment requirement | Status |
|---|---|
| A1 Land cover / forest extent | ✅ Complete (raster reclassify + polygonize) |
| A2 Forest change in hectares | ✅ Complete, with annual rate |
| A3 Protected-area overlay + gap | ✅ Complete |
| A4 Multi-criteria suitability | ✅ Complete and defensible |
| A5 Fragmentation / connectivity | ✅ Complete |
| Deliverable 4 — provenance table | ✅ Complete |
| Deliverable 5 — project file | ✅ Complete |

**Everything on the roadmap is done except P3-11**, the optional one-click report.

---

## What is verified, and what is left to you

**UI wrappers are now tested in a real DOM.** `test-ui.js` drives every `ui*` function through
jsdom with a mocked Leaflet, and asserts that both SDM guards refuse *and draw nothing*. What
jsdom cannot cover is real Leaflet rendering, CSS layout and browser performance —
`INTEGRATION.md` §6 lists eight checks to run once in the live app.

**One correction the DOM tests caught:** the change-detection figure I quoted earlier
(−990.2 ha/yr) is the *equal-area* result. The UI defaults to *spherical*, which gives
**−996.6 ha/yr**. Both are correct for their method and they differ by 0.6%; the checklist now
states both so a correct result is not mistaken for a fault.

**Two things I cannot settle for you:**

1. **"Semester 2, 2026"** on the title slides. You asked for it, but the lesson plan on file is
   Semester 2/2025 (prepared 3 July 2025). Whether a 2026 revision has been approved is an
   institutional fact I have no way to check — change it or leave it as you see fit.
2. **Protected Areas Act 2023 regulations** were still being developed after the Act passed in
   February 2024. The slides, handout and roadmap all carry that caveat, but confirm current CEPA
   procedure before teaching it as settled.
