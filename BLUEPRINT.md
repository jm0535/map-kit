# GeoSpaX — Blueprint & Changelog

**Version:** 1.1.0  
**Author:** Jimmy Moses  
**Affiliation:** School of Forestry, Faculty of Natural Resources, Papua New Guinea University of Technology  
**URL:** https://geospax.in4metrix.dev/  
**Repository:** https://github.com/jm0535/map-kit  
**License:** MIT  

---

## How to Cite

> Moses, J. (2025). GeoSpaX: Interactive Web GIS & Spatial Analysis (Version 1.1.0) [Computer software]. School of Forestry, Faculty of Natural Resources, Papua New Guinea University of Technology. Retrieved [access date], from https://geospax.in4metrix.dev/

See the in-app **"How to Cite"** tab (bottom panel) for APA, Chicago, Harvard, and BibTeX formats with copy-to-clipboard.

---

## Version History

### v1.2.0 (2025-07-29) — Conservation Module Integration

#### Conservation Planning (Milestone 1)
- **Vector overlay toolkit**: Union, Intersect, Erase operations between two layers (turf.js based)
- **Protection gap reporting**: Identify unprotected areas within a planning boundary
- **WLC suitability rework**: Weighted Linear Combination with criteria table, constraint masking, rescale-01 normalisation
- **Second layer selector**: A/B layer dropdowns for two-layer analysis workflows

#### Conservation Metrics (Milestone 2)
- **Equal-area reporting**: LAEA projection-based area calculations for accurate polygon area summaries
- **Fragmentation metrics**: Patch count, mean patch size, edge density, largest patch index
- **Connectivity analysis**: Nearest-neighbour distances between protected area patches
- **Change detection**: Compare two polygon layers to identify gains, losses, and persistence

#### SDM Correctness Fixes
- **Bioclim SDM rewrite**: Percentile-based envelope with proper env sampling via `sampleEnvAt`
- **Mahalanobis SDM rewrite**: Chi-square survival function for probability, covariance with regularisation
- **Warning system**: Surfaces user warnings for insufficient data, missing env values, singular covariance
- Old `runBioclimSDM`, `runMahalanobisSDM`, `runSDM` removed and replaced by `GSX.runBioclimSDM`, `GSX.runMahalanobisSDM`
- MaxEnt (server-side API) retained as `runMaxEntSDM`

#### Provenance & Project Persistence
- **Provenance stamping**: `GSX.stampImport` on file import, `GSX.stampDerived` on analysis output
- **Provenance table**: View/export lineage metadata (source, operation, timestamp, parameters)
- **Project save/load**: Serialise entire map session to `.geospax` JSON project file
- **Autosave**: Periodic localStorage autosave with recovery prompt on reload
- **Project metadata**: Editable title, author, description, CRS fields

#### Raster Tools
- **Reclassify**: Binary threshold reclassification with Otsu threshold suggestion
- **Polygonize**: Convert raster masks to vector polygons via run-length encoding
- **Histogram**: Display raster value distribution with bin count control

#### Dropdown Rendering Fix (`gsx-select.js`)
- **Problem**: on some Linux/GTK browser builds a `<select>` receives focus on click but the browser never paints its native option popup, leaving every dropdown list unreachable — overlay operation, constraint layer, area units, SDM presence layer, BIOCLIM mode, Mahalanobis output, raster layer/band, and threshold operator among them
- **Fix**: `js/gsx-select.js` suppresses the native popup (`preventDefault()` on `mousedown`) and draws the option list itself as a `position: fixed` panel appended to `<body>`, so no ancestor `overflow` can clip it
- **Non-invasive by design**: the `<select>` elements are left untouched and remain the visible, natively styled controls rendering their own selected-option text. Only the popup is replaced, so all existing CSS, `id`s, `.value` reads and `change`/`onchange` handlers keep working unmodified
- **App-wide via event delegation**: two capture-phase listeners on `document` cover all 38 selects — left sidebar (basemap, per-layer export), bottom bar (profile sort), right panel (attribute table, symbology), analysis drawer, export modal, CSV column mapper, and the layout composer — including selects created or repopulated at runtime, with no per-element registration
- **Behaviour**: keyboard accessible (Enter/Space opens, arrows move, Escape closes), ARIA `listbox`/`option` roles, flips above the control when short of space below, closes on outside click, scroll, resize or blur, and declines to open for `disabled`, `multiple` and empty selects (matching native behaviour)
- **Escape hatch**: `data-gsx-select="off"` on any control restores its native popup
- Drawer select styling also hardened as a no-JS fallback: explicit `appearance: menulist`, larger hit area (26px), and explicit `option` colours

#### Module Architecture
- Six JS modules in `js/` directory: `geospax-conservation.js`, `geospax-conservation-m2.js`, `geospax-sdm-fix.js`, `geospax-project.js`, `geospax-raster.js`, `gsx-select.js`
- Global `GSX` object exposes all conservation module functions; `gsx-select.js` is self-contained UI infrastructure exposing `GSXSelect`
- Pure functions (no DOM access) are unit-testable; UI wrappers at bottom of each module
- Old inline WLC/SDM functions removed from `index.html`, replaced by module equivalents

---

### v1.1.0 (2025-07-29)

#### Map Composer Enhancements
- **Attribution label redesign**: Semi-transparent card style with bold "Source:" prefix, draggable, toggleable via sidebar, persisted in templates
- **Legend title & subtitle editing**: Custom editable title/subtitle with live preview and template persistence
- **Legend resizing fix**: Removed CSS constraints blocking resize; re-append resize handle after `buildLayout` content rebuild
- **Enterprise resize handles**: Replaced blue circle markers with standard triangular grip handles (CSS gradients with hover state)
- **Snap-to-grid**: Drag/resize snapping with configurable grid size (2–100px), visual grid overlay, template persistence
- **Sidebar collapse button**: Added collapse/expand toggle for map composer sidebar

#### Export & Layout
- All editing chrome (resize handles, grid overlay, lock badges) hidden during export
- Composer refresh button to pick up layer/symbology/basemap changes without losing layout
- Layout composer: draggable/resizable furniture items (north arrow, scalebar, legend, overview inset) matching QGIS layout behavior
- Grid labels and attribution use transparent background + white text halo for legibility on any basemap

#### Export Panel Restructure
- Collapsible sub-groups (Map Image, Elevation Profile, Bulk Data Export, Per-Layer Export)
- Single format-picker + Export button for per-layer export (ArcGIS Online-style UX)

#### Bug Fixes
- Fix Shapefile export: patch bundled shpwrite to use JSZip 3.x `generateAsync()`
- Fix Shapefile export: replace broken `location.href` data-URI navigation with Blob download
- Fix Shapefile export naming (use layer name not geometry-type label)
- Clarify that bare `.shp` import is unsupported (needs full `.zip` bundle)

#### UI/UX
- Add "How to Cite" tab to bottom panel with FORCE11-compliant citation formats
- Large desktop responsive layout (≥1600px, ≥2000px)
- Tablet landscape and desktop optimization (≥1024px)

#### Drawing Tools
- Snap-to-vertex, body drag, duplicate detection, Ctrl+D shortcut
- Theme colors, accessibility improvements, 8 bug fixes

#### Measurement
- Replace leaflet-measure with custom themed distance+area tool (geodesic distance, spherical area, non-overlapping UI, undo/finish/mode toggle)
- Fix dblclick debounce, area min-points, theme-aware color

#### Symbology
- Vector graduated honour the Classes control (equal-interval classes); sync map, legend, and layout rendering
- QGIS-style tabbed renderer (Simple / Categorized / Graduated for vectors; Continuous / Classified for rasters)

#### Spatial Statistics
- Add Clark-Evans z-test/p-value to NNI
- Moran scatterplot slope row-standardised for consistency
- Fix Polygon Areas to subtract holes and sum all MultiPolygon parts
- UTM auto-projection, KNN weights, and Moran scatterplot
- Inferential spatial statistics: Getis-Ord Gi*, Local Moran's I (LISA), Global Moran's I

#### Conservation Tools
- Hotspot analysis, suitability WLC (Weighted Linear Combination)
- GeoTIFF input support
- Bioclim / Mahalanobis / MaxEnt SDM analysis tools
- Turf.js v6.5.0 and geotiff.js v2.1.3 vendor libraries

#### Other
- Professional feature labeling: halo text, style controls, declutter
- QGIS-style layer panel context menu, correct z-order
- Elevation profile export (PNG / PDF / SVG) at true 300 DPI
- Google Earth-style terrain profile with sort-order toggle
- Enterprise UI redesign with light/dark token system
- All CDN libraries vendored locally (no runtime CDN dependencies)
- Vercel hosting (geospax.in4metrix.dev) + GitHub Pages mirror
- Rebrand from Map-Kit to GeoSpaX
- XLSX export and output-CRS reprojection for all vector exports
- KML and GPX export for vector layers
- Render heatmap layers in Map Layout Composer
- Raster legend: classification breaks (Equal Interval / Quantile / Jenks / Manual)
- Raster legend: gradient swatch for heat / IDW / weighted density layers
- Refresh basemaps: fix broken Relief, add Hillshade + OpenTopoMap + Positron
- CRS picker for CSV/XLSX import flow
- Undo/redo for drawing & editing operations

---

### v1.0.0 (Initial Release)

- Standalone Web GIS with zero backend
- Interactive mapping with Leaflet
- Data import: GeoJSON, KML/KMZ, GPX, Shapefile (zip), CSV/XLSX, GeoTIFF
- QGIS-style symbology: Simple, Categorized, Graduated
- Spatial analysis tools: Mean Center, Standard Distance, Bounding Box, NNI, Convex Hull, Line Lengths, Polygon Areas, Centroids, Buffer, Simplify, DBSCAN, IDW, Point Density, Weighted Density, Voronoi
- Elevation profile with Chart.js
- Map Layout Composer with graticule, north arrow, scalebar
- Export: GeoJSON, CSV, XLSX, Shapefile, KML, GPX, PNG, PDF
- Dark/light theme system
- Python package (`geospax`) for publication-ready static and interactive maps

---

## Roadmap

### v1.2.0 (Planned)
- [ ] **3D terrain view** — Cesium or MapLibre GL integration for 3D elevation visualization
- [ ] **Time-series animation** — animate point/layer attributes over a temporal field
- [x] **Spatial join** — point-in-polygon, intersect, union operations between layers *(v1.2.0 conservation module)*
- [ ] **Zonal statistics** — summarize raster values within polygon zones
- [ ] **Layout templates gallery** — preset layouts (A4 portrait, poster, presentation) with one-click apply
- [ ] **Multi-page composer** — chain multiple layout pages for batch map series

### v1.3.0 (Planned)
- [ ] **Kriging interpolation** — ordinary kriging with variogram fitting (replace IDW limitation)
- [ ] **Geographically Weighted Regression (GWR)** — local regression for spatial non-stationarity
- [ ] **Point Pattern Analysis** — Ripley's K, kernel density estimation with bandwidth selection
- [ ] **Raster calculator** — band math and map algebra expressions
- [ ] **WMS/WMTS layer support** — connect to OGC web map services
- [x] **Project save/load** — persist entire map session (layers, styles, layout) as a `.geospax` project file *(v1.2.0 conservation module)*

### v1.4.0 (Planned)
- [ ] **R Console (WebR)** — integrated R terminal in bottom panel via WebR (R compiled to WebAssembly)
  - Runs entirely client-side — no backend required (fits GeoSpaX zero-backend architecture)
  - ~30MB WASM binary downloaded on first use, cached thereafter
  - Data bridge: pass active layer GeoJSON from JS into R `sf` data frames via `js2r()`
  - Inline plot rendering — R graphics output to canvas/SVG, display in panel or export
  - Package support: `sf`, `terra`, `gstat` (kriging), `spdep` (spatial autocorrelation), `tmap` (thematic maps)
  - Terminal UI with command history, syntax highlighting, multi-line input
  - **Technical challenges:**
    - Requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers on Vercel for `SharedArrayBuffer` — must verify tile server (Esri, OpenTopoMap, CartoDB) compatibility with COEP
    - WASM memory ceiling ~2–4GB — large datasets may need chunking or sampling
    - Not all R packages with C/Fortran dependencies compile to WASM — check [WebR packages list](https://docs.r-wasm.org/webr/latest/packages.html)
    - Consider lazy-loading: only fetch WebR binary when user first opens R Console tab
  - **Alternative:** hybrid mode — detect optional local R backend (`ws://localhost:8787`) via Plumber/Shiny for power users who want full R ecosystem
- [ ] **Collaborative editing** — real-time multi-user map editing via WebSocket
- [ ] **Plugin architecture** — user-defined analysis tools via JavaScript plugin API
- [ ] **Mobile responsive layout** — touch-optimized UI for tablets and phones
- [ ] **Offline mode** — service worker for full offline capability including basemap caching
- [ ] **Print-to-scale** — WYSIWYG print dialog with exact scale ratio (1:50,000 etc.)
- [ ] **Map series** — atlas generation: one map per feature in a polygon layer

### Future Considerations
- [ ] **DOI assignment** — Zenodo integration for citable software releases
- [ ] **CITATION.cff** — machine-readable citation metadata file
- [ ] **CodeMeta.json** — full software metadata for discoverability
- [ ] **WebAssembly port** — performance-critical spatial algorithms in Rust/WASM
- [ ] **Vector tiles** — MVT/PBF vector tile layer support
- [ ] **PostGIS connector** — direct database connection for enterprise workflows
- [ ] **ArcGIS REST integration** — consume ArcGIS Online/Enterprise feature services
- [ ] **AI-assisted classification** — supervised classification from training polygons
- [ ] **Story maps** — narrative scroll-driven map storytelling mode

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    index.html (single file)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ Left     │  │ Map      │  │ Right Panel           │  │
│  │ Panel    │  │ Viewport │  │ (Feature Info,        │  │
│  │ (Import, │  │ (Leaflet)│  │  Symbology, Labels)   │  │
│  │  Layers, │  │          │  │                       │  │
│  │  Analysis│  │          │  └──────────────────────┘  │
│  │  Export) │  │          │  ┌──────────────────────┐  │
│  │          │  │          │  │ Bottom Panel          │  │
│  │          │  │          │  │ (Elevation Profile,   │  │
│  │          │  │          │  │  Analysis Results,    │  │
│  │          │  │          │  │  How to Cite)         │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│                                                         │
│  vendor/ — all libraries (no CDN at runtime)            │
│  Leaflet, Chart.js, html2canvas, jsPDF, SheetJS,        │
│  shpjs, shp-write, toGeoJSON, proj4js, GeoRaster,       │
│  Leaflet.heat, Leaflet Measure, Leaflet Fullscreen      │
│                                                         │
│  js/ — GeoSpaX conservation modules (GSX namespace)     │
│  geospax-conservation.js  — M1: overlay, WLC, gap       │
│  geospax-conservation-m2.js — M2: area, fragmentation   │
│  geospax-sdm-fix.js      — Bioclim/Mahalanobis rewrite  │
│  geospax-project.js      — provenance, save/load         │
│  geospax-raster.js       — reclassify, polygonize        │
│  gsx-select.js           — dropdown popup (app-wide UI)  │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles
1. **Zero backend** — everything runs in the browser; no server, no database
2. **No CDN at runtime** — all libraries vendored for offline capability
3. **Single-file deployment** — `index.html` + `vendor/` is the entire app
4. **Enterprise GIS UX** — modelled on QGIS/ArcGIS Pro patterns
5. **Accessibility** — dark/light theme, keyboard shortcuts, ARIA labels
6. **Security** — all user input HTML-escaped, Object URLs revoked after download

### Technology Stack
| Layer | Technology |
| --- | --- |
| Web GIS | Vanilla JS + Leaflet 1.9.4 |
| Charts | Chart.js 4.4.0 |
| Export | html2canvas 1.4.1, jsPDF 2.5.1 |
| Data I/O | SheetJS, shpjs, shp-write, toGeoJSON |
| CRS | proj4js 2.11.0 |
| Raster | GeoRaster + GeoRaster Layer for Leaflet |
| Conservation | turf.js 6.5.0 (overlay, WLC, fragmentation) |
| SDM | Bioclim/Mahalanobis (client-side), MaxEnt (server API) |
| Provenance | GSX module (stampImport/stampDerived, .geospax project) |
| UI controls | `gsx-select.js` — dropdown popup replacement (no dependencies) |
| Python pkg | GeoPandas, Matplotlib, Folium, Contextily |
| Hosting | Vercel (primary) + GitHub Pages (mirror) |

---

## Development Workflow

```bash
# Local development
make serve                    # Serve on localhost:8000

# Python package
pip install -e ".[dev]"
geospax                       # Generate maps

# Quality checks
make lint                     # Ruff linter
make format                   # Ruff formatter
make typecheck                # mypy type checker
make check                    # All checks

# Deployment
git push origin main          # Auto-deploys to both Vercel and GitHub Pages
```

---

## Contact

**Jimmy Moses**  
Deputy Head, School of Forestry  
Faculty of Natural Resources  
Papua New Guinea University of Technology  
Private Mail Bag, Lae 411  
Morobe Province, Papua New Guinea  

**Project:** https://geospax.in4metrix.dev/  
**Source:** https://github.com/jm0535/map-kit  
**Organization:** https://www.in4metrix.dev  

---

*This document is maintained alongside the codebase. Update the changelog with each release and review the roadmap quarterly.*
