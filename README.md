# GeoSpaX

A modern geospatial web application that combines interactive mapping capabilities with powerful visualization tools for spatial data analysis, built entirely in the browser. Includes a Python package for generating publication-ready static and interactive maps with elevation profiles.

**Live app**: [https://geospax.in4metrix.dev](https://geospax.in4metrix.dev) &nbsp;·&nbsp; **Mirror (GitHub Pages)**: [https://jm0535.github.io/map-kit/](https://jm0535.github.io/map-kit/)

---

## Quick Start

### Web GIS

```bash
# Serve locally (recommended — avoids CORS for local file loading)
make serve
# then open http://localhost:8000

# Or just open the file directly
open index.html
```

**Try the sample dataset** — drag `samples/sample_species_richness.geojson` onto the map (or use **Import → Choose file**). It contains 41 species-richness survey points across two Papua New Guinea montane transects and is designed to produce clear hot-spot and autocorrelation results straight away.

### Python Package

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
geospax                      # generate both maps
geospax --output-dir docs/ --dpi 300 --verbose
```

---

## User Guide — Web GIS

### Importing Data

Open the **Import** panel (left sidebar, folder icon). Drag and drop files directly onto the map or click **Choose file**.

| Format | Notes |
| --- | --- |
| **GeoJSON** (`.geojson`, `.json`) | Any valid RFC 7946 file; named `crs` member honoured |
| **KML / KMZ** (`.kml`, `.kmz`) | Placemarks, lines, polygons; extended data attributes imported |
| **GPX** (`.gpx`) | Waypoints, tracks, routes |
| **Shapefile** (`.zip`) | Zip file containing `.shp`, `.dbf`, `.prj` (and optionally `.shx`); reprojected from `.prj` CRS automatically |
| **CSV / XLSX** (`.csv`, `.xlsx`) | Must contain latitude and longitude columns; a smart column mapper auto-detects common column names (`lat`, `latitude`, `y`, `lon`, `longitude`, `x`, etc.); optional `elevation` / `z` column for profiles |
| **GeoTIFF** (`.tif`, `.tiff`) | Raster layers rendered with a colour ramp; single or multi-band |

After import the layer appears in the **Layers** panel and the map zooms to its extent.

---

### Map Controls

| Control | Location | Action |
| --- | --- | --- |
| Zoom in / out | Top-left `+` / `−` | Click or keyboard `+` / `−` |
| Fullscreen | Top-right | Toggle browser fullscreen (`F`) |
| Measurement tool | Toolbar | Draw polyline or polygon to measure distance / area |
| Minimap | Bottom-right | Overview of current viewport |
| Basemap selector | Left panel | Switch between 6 free basemaps (see below) |
| Basemap opacity | Left panel | Slider 0–100% |

**Basemaps**: OpenTopoMap (Topo), Esri World Imagery (Satellite), OpenStreetMap (Streets), Esri Shaded Relief (Relief), Esri World Topo (Terrain), CartoDB Dark Matter (Dark).

---

### Layer Panel

Every imported or analysis-generated layer appears here.

| Action | How |
| --- | --- |
| Toggle visibility | Click the **eye icon** next to the layer |
| Rename | Double-click the layer name; press Enter to confirm or Esc to cancel |
| Zoom to layer | Click the 🔍 button, or right-click the layer name |
| Remove layer | Click the **×** button |
| Select for styling | Click the layer name to highlight it in the Symbology panel |
| Per-layer opacity | Slider in the layer row |
| Feature labels | Choose any attribute column; adjust font size |

---

### Symbology

Click a layer name to open **Symbology** controls.

- **Simple Symbol** — fill colour, marker size, opacity, stroke colour / width / style (solid, dashed, dotted, dash-dot). Marker shapes: circle, square, triangle, diamond, star, cross.
- **Categorized** — one colour per unique attribute value (16-colour palette). Click legend entries on the map to rename them inline.
- **Graduated** — numeric attribute divided into 2–10 classes using a colour ramp (Viridis, Heat, Cool, Terrain).
- **Reset** — returns the layer to default styling.

---

### Digitizing

Draw new features using the toolbar at the top-right of the map (pencil icons):

1. Click **Point**, **Line**, or **Polygon**.
2. Click the map to add vertices. Double-click to finish a line or polygon.
3. Fill in the attribute form (name, description, category).
4. The feature is added to the **"Drawn Features"** layer, which is fully exportable.

Press **Esc** at any time to cancel. A crosshair cursor shows when digitizing mode is active.

---

### Feature Info Panel (right sidebar)

Click any feature on the map to inspect it:

- Layer name, colour swatch, geometry type badge (Point / Line / Polygon)
- Latitude / longitude in monospace
- Scrollable attribute table
- **Previous / Next** buttons to navigate features in the same layer
- **Zoom to feature** button
- **Copy attributes** to clipboard
- The selected feature is highlighted on the map with a dashed blue overlay.

---

### Attribute Table

Open **Attribute Table** from the toolbar. Select a layer to see all features in a searchable table. Click a row to zoom to that feature and inspect it in the Feature Info panel.

---

### Elevation Profile

Layers with an elevation attribute (column named `elevation`, `elev`, `alt`, `z`, etc.) automatically populate the **Elevation Profile** panel at the bottom of the screen:

- Distance (km) on the X-axis, elevation (m a.s.l.) on the Y-axis.
- Multi-layer comparison via toggle checkboxes.
- Click a point on the profile chart to pan the map to that location.
- Drag the top edge of the panel to resize it.

---

### Export

Open the **Export** panel. All layers — imported, drawn, and analysis outputs — are available.

#### Output CRS selector

Before exporting, choose the target coordinate reference system from the **Output CRS** dropdown. The default is **EPSG:4326 (WGS 84)**. Other presets include UTM zones, national grids (British National Grid, GDA2020, etc.), and Web Mercator. Coordinates are reprojected client-side via proj4js.

#### Data exports

| Button | Format | Best for |
| --- | --- | --- |
| Export layer as **GeoJSON** | RFC 7946 + named `crs` member | QGIS, ArcGIS, web apps |
| Export all as **GeoJSON** | One file, `_layer` property per feature | Bulk data exchange |
| Export layer as **CSV** | Flat table with `longitude` / `latitude` columns | Excel, R, Python |
| Export all as **CSV** | One file, `_layer` column | Bulk tabular analysis |
| Export layer as **XLSX** | Excel workbook, one sheet | Stakeholder reports |
| Export all as **XLSX** | Excel workbook, one sheet per layer | Stakeholder reports |
| Export layer as **Shapefile** | `.zip` with `.shp` / `.dbf` / `.prj` / `.shx` | QGIS, ArcGIS, MapInfo |
| Export layer as **KML** | OGC KML 2.2 | Google Earth, ArcGIS Earth |
| Export layer as **GPX** | GPX 1.1 | GPS devices, Garmin, OsmAnd |

> **Heat map layers** (IDW, Density, Weighted Density) export as point features with a `value` attribute because they are internally stored as point grids, not rasters.
> **Buffer layers** export as 24-sided polygon approximations.

#### Map image exports

- **Export map as PNG** — captures the current viewport with title, legend, north arrow, and scale bar at 72–400 DPI.
- **Export map as PDF** — same content embedded in a PDF page (A4 portrait or landscape).

---

## Spatial Analysis Guide

Open the **Analysis** panel (beaker icon). Select a layer from the dropdown, then run any tool. Results appear in the bottom panel and are added as new, exportable layers.

### Geometric / Descriptive Tools

#### Mean Center & Standard Distance

Computes the geographic mean of all point coordinates (the "centre of gravity" of the distribution) and a standard distance circle whose radius equals the standard deviation of distances from the mean center.

**Results table**: mean latitude, mean longitude, standard distance (km).
**Use it when**: you need a single representative location for a point cloud, or want to compare the geographic centre of two groups.

---

#### Bounding Box

Minimum axis-aligned rectangle enclosing all features.

**Results table**: min/max longitude and latitude, width (km), height (km), area (km²).

---

#### Nearest Neighbor Index (NNI)

Compares observed mean nearest-neighbor distances with expected distances under complete spatial randomness (Clark & Evans 1954).

**NNI < 1** — features are **clustered** (observed spacing is smaller than random).
**NNI ≈ 1** — features are **randomly distributed**.
**NNI > 1** — features are **dispersed** (regularly spaced, e.g., planted trees, grid surveys).

The associated z-score and p-value test whether the pattern differs significantly from random. A p < 0.05 with NNI < 1 is strong evidence of non-random clustering.

---

#### Convex Hull

Smallest convex polygon enclosing all features (Andrew's monotone chain algorithm).

**Results**: hull polygon with perimeter (km) and area (km²). Useful as a study-area extent or to compare range sizes between groups.

---

#### Line Lengths

Calculates the haversine great-circle length of each line feature.

**Results**: attribute table with `length_km` appended to each feature; total shown in the panel.

---

#### Polygon Areas

Calculates the spherical excess area of each polygon (Chamberlain & Duquette 2009, accurate to < 0.3% for polygons up to continental scale).

**Results**: attribute table with `area_km2` appended to each feature; total shown in the panel.

---

#### Centroids

Point at the geometric centre of each feature.

- **Polygons**: area-weighted centroid (shoelace method).
- **Lines**: coordinate mean of all vertices.
- **Points**: returns the points themselves.

---

#### Buffer

Creates a circular buffer of a user-specified radius (metres) around each point or along each line vertex. The result is a 24-sided polygon approximation.

> For production-grade buffers — especially for irregular shapes, lines, or polygons — use QGIS (Vector → Geoprocessing → Buffer) or PostGIS `ST_Buffer`.

---

#### Simplify (Douglas-Peucker)

Reduces vertex count while preserving shape. Set **Tolerance (°)** — higher values simplify more aggressively.

**Use it when**: exporting to a web map and file size matters; polygon has more detail than is visible at the target scale.

---

#### DBSCAN Clustering

Density-Based Spatial Clustering of Applications with Noise (Ester et al. 1996). Groups points into clusters without requiring you to specify the number of clusters. Points that don't belong to any cluster are labelled **noise** (cluster = −1).

**Parameters**: epsilon (neighbourhood radius) is auto-derived from 1.5× the median nearest-neighbor distance; MinPts = 3.

**Results layer**: each point gets a `cluster` attribute (integer ≥ 0 = cluster ID; −1 = noise). Useful for finding natural groupings before running hotspot analysis.

---

#### IDW Interpolation

Inverse Distance Weighting surface (Shepard 1968, p = 2) on a 50 × 50 grid. Estimates values at unsampled locations by weighting nearby observations more heavily.

**Use it when**: you have a numeric attribute (e.g., species richness, rainfall) and want to visualise a continuous surface across your study area.

**Limitations**: IDW does not model spatial autocorrelation structure and can create "bull's-eye" artefacts around isolated high or low points. For kriging-quality interpolation use R (`gstat`) or ArcGIS Pro.

---

#### Point Density

Counts points within a moving kernel window on a 50 × 50 grid. Equivalent to a simple kernel density estimate.

**Limitation**: Not a statistically rigorous test of clustering. Use **Getis-Ord Gi*** for significance-tested hot spots.

---

#### Weighted Density

Same as Point Density but weights each point by a selected numeric attribute (e.g., richness value, count). Shows where high-value features concentrate in space.

---

#### Voronoi / Thiessen Polygons

Divides the plane so that every location is assigned to its nearest point. Computed on a 120 × 120 raster grid; boundaries may appear slightly pixelated at close zoom.

**Use it when**: allocating service areas, delineating nearest-feature catchments, or as a first-pass spatial interpolation method.

---

## Inferential Spatial Statistics

These four tools go beyond description: they test whether spatial patterns are statistically significant and locate specific features driving that pattern. All four tools share a common **weights and projection** subsystem described below.

### Spatial Weights Options

Open **Analysis → Weights type** to choose how neighbours are defined.

| Option | Description | When to use |
| --- | --- | --- |
| **Distance band** | Two features are neighbours if they are within *d* km. Default: auto-computed as the minimum distance that gives every feature at least one neighbour. | Continuous fields, regular sampling grids |
| **K-nearest neighbours (KNN)** | Each feature's *k* nearest features are neighbours (default k = 8). Every feature always gets exactly *k* neighbours regardless of density. | Irregular sampling, sparse outliers, variable density |

**UTM auto-projection**: distances are computed on a projected coordinate system (auto-selected UTM zone based on the layer centroid) rather than on raw longitude / latitude degrees. This removes the distortion that lat/lon degree distances introduce near the equator and at high latitudes.

---

### Getis-Ord Gi* (Hot Spot Analysis)

**Reference**: Ord & Getis (1995), *Geographical Analysis* 27(4).

Gi* asks: *"Is the value at location i, together with the values of its neighbours, unusually high or low compared with the global mean?"*

For each feature, GeoSpaX computes a z-score and two-tailed p-value. Features with large positive z-scores are **hot spots** (high-value clusters); features with large negative z-scores are **cold spots** (low-value clusters).

#### Confidence levels and map colours

| Colour | Label | z-score | Interpretation |
| --- | --- | --- | --- |
| Deep red | 99% hot spot | z ≥ 2.576 | Extremely strong evidence of a spatial hot spot |
| Red | 95% hot spot | z ≥ 1.960 | Strong evidence of a spatial hot spot |
| Orange | 90% hot spot | z ≥ 1.645 | Moderate evidence of a spatial hot spot |
| Grey | Not significant | \|z\| < 1.645 | No evidence the local cluster differs from random |
| Light blue | 90% cold spot | z ≤ −1.645 | Moderate evidence of a spatial cold spot |
| Blue | 95% cold spot | z ≤ −1.960 | Strong evidence of a spatial cold spot |
| Dark blue | 99% cold spot | z ≤ −2.576 | Extremely strong evidence of a spatial cold spot |

#### FDR correction

When **Apply FDR correction** is checked (default), significance thresholds are adjusted using the Benjamini-Hochberg False Discovery Rate procedure. This prevents spurious hot spots when many features are tested simultaneously. The number of features passing FDR correction is shown in the results table. **Uncheck FDR only** if you are running an exploratory analysis and expect few tests.

#### Interpreting Gi* results for ecology

- A **hot spot** does not mean the individual values are extreme — it means the local neighbourhood average is significantly higher than the global average.
- In species-richness surveys, a 95% hot spot cluster at mid-elevation likely marks a **refugium, optimal habitat, or resource concentration** worth prioritising for conservation.
- A **cold spot** cluster (consistently low richness) may indicate habitat degradation, edge effects, or unsuitable microclimate.
- **Not significant** features may simply have too few neighbours within the band — try increasing the distance band or switching to KNN.

---

### Local Moran's I — LISA (Cluster & Outlier Analysis)

**Reference**: Anselin (1995), *Geographical Analysis* 27(2).

LISA (Local Indicators of Spatial Association) decomposes the global Moran's I into a contribution per feature and classifies each feature into one of four cluster / outlier types based on its value and its neighbours' values.

Significance is assessed by conditional permutation (999 random re-labellings of neighbouring values with the focal value held fixed). The pseudo-p-value is the proportion of permutations that produce a local Moran's I as extreme as or more extreme than observed.

#### Cluster / outlier types and colours

| Colour | Type | Focal value | Neighbour values | Interpretation |
| --- | --- | --- | --- | --- |
| Red | **HH** (High-High) | High | High | Core of a spatial cluster — a hot spot surrounded by hot spots |
| Blue | **LL** (Low-Low) | Low | Low | Core of a spatial cluster — a cold spot surrounded by cold spots |
| Orange | **HL** (High-Low) | High | Low | **Spatial outlier** — a high-value feature surrounded by low-value neighbours |
| Light blue | **LH** (Low-High) | Low | High | **Spatial outlier** — a low-value feature surrounded by high-value neighbours |
| Grey | Not significant | — | — | No evidence of significant local autocorrelation |

> *High* and *Low* are relative to the global mean; the boundary is at the mean value.

#### Interpreting LISA results for ecology

- **HH clusters** identify the core of biodiversity hot spots — prioritise these sites for protection.
- **LL clusters** identify consistently depauperate areas. Investigate whether the cause is anthropogenic or environmental.
- **HL outliers** are unexpectedly species-rich patches within a low-richness landscape — often micro-refugia, stream courses, or protected remnant patches. These are high conservation value per unit area.
- **LH outliers** are unexpectedly poor patches within a rich landscape — potential habitat degradation signals worth investigating on the ground.

---

### Global Moran's I (Spatial Autocorrelation Test)

**Reference**: Cliff & Ord (1981); randomization-variance formula from Moran (1950).

Global Moran's I summarises the degree of spatial autocorrelation across the *entire* layer in a single index, then tests whether it differs significantly from zero (the expected value under spatial randomness).

#### Output table

| Value | What it is |
| --- | --- |
| **Moran's I** | Observed index (range approximately −1 to +1, but not strictly bounded) |
| **Expected I** | −1/(n − 1); the mean under the null hypothesis of no autocorrelation |
| **Variance** | Cliff & Ord (1981) randomization variance; accounts for the actual distribution of values |
| **z-score** | (I − E[I]) / √Var(I) — standard normal deviate |
| **p-value** | Two-tailed probability under H₀: no spatial autocorrelation |

#### Interpreting Global Moran's I

| I | Pattern |
| --- | --- |
| I >> E[I], z > 1.96, p < 0.05 | **Positive autocorrelation** — similar values cluster in space (e.g., high-richness sites near other high-richness sites) |
| I ≈ E[I] | **Random** — no detectable spatial structure |
| I << E[I], z < −1.96, p < 0.05 | **Negative autocorrelation** — dissimilar values are neighbours (checkerboard pattern) |

A significant positive I confirms that spatial analysis tools (Gi*, LISA) are operating on genuinely autocorrelated data, which is a prerequisite for meaningful hot-spot results.

A non-significant I does **not** mean all hot spots are absent — it means on average there is no global trend. Local clusters can still exist even when the global index is near zero.

---

### Moran Scatterplot

A diagnostic chart that visualises Global Moran's I and helps identify which features are driving autocorrelation.

**X-axis**: standardised attribute value (z-score) for each feature.
**Y-axis**: spatial lag — the mean standardised value of that feature's neighbours.

The slope of the regression line through the scatter equals the Global Moran's I.

#### Quadrant interpretation

| Quadrant | X | Spatial lag Y | Cluster type |
| --- | --- | --- | --- |
| **Upper-right (HH)** | High | High | Positive autocorrelation — high values surrounded by high neighbours |
| **Lower-left (LL)** | Low | Low | Positive autocorrelation — low values surrounded by low neighbours |
| **Upper-left (LH)** | Low | High | Negative autocorrelation — low value with high neighbours |
| **Lower-right (HL)** | High | Low | Negative autocorrelation — high value with low neighbours |

Points far from the origin in HH or LL quadrants are the strongest contributors to positive Moran's I and correspond to LISA HH/LL clusters. Points far from the origin in LH or HL quadrants are spatial outliers.

The chart is interactive: hover a point to see the feature's site name and attribute value.

---

## Sample Dataset

`samples/sample_species_richness.geojson` — 41 fictional but ecologically realistic species-richness survey points across two montane transects in Papua New Guinea:

- **YUS transect** (Huon Peninsula, ~146°E): 26 sites from 50 m to 3190 m elevation. Richness peaks at ~1800–2000 m (mid-elevation hump), producing a clear hot-spot cluster detectable by Gi* and LISA.
- **Wilhelm transect** (Chimbu Province, ~145°E): 15 sites from 2620 m to 4509 m. Uniformly low richness at high elevation; forms a cold-spot cluster.

**Attributes**: `site`, `transect`, `elevation_m`, `species_richness`, `tree_cover_pct`, `rainfall_mm`, `surveyed`.

**Recommended analysis workflow**:

1. Import the file (drag onto map).
2. Run **Graduated** symbology on `species_richness` (Viridis, 6 classes) to see the elevational pattern.
3. Run **Global Moran's I** → expect significant positive I (~0.8) confirming strong spatial autocorrelation.
4. Run **Getis-Ord Gi*** with KNN (k = 6) → mid-elevation YUS sites should appear as 95–99% hot spots; upper Wilhelm sites as cold spots.
5. Run **LISA** → HH cluster at the richness peak, LL cluster near the summit, HL/LH outliers at transitions.
6. Run **Moran Scatterplot** → regression slope should match the Global Moran's I value.
7. Run **IDW Interpolation** on `species_richness` → visualise the continuous richness surface.

---

## Project Structure

```text
map-kit/                      # Repository name (app is branded "GeoSpaX")
├── index.html                # Full-featured standalone Web GIS (entry point for Vercel + GitHub Pages)
├── vercel.json               # Vercel static hosting config (geospax.in4metrix.dev)
├── .vercelignore             # Files excluded from the Vercel deployment
├── README.md                 # This file
├── LICENSE                   # MIT License
├── CONTRIBUTING.md           # Contribution guidelines
├── pyproject.toml            # Project config, dependencies, tool settings
├── Makefile                  # Common development tasks
├── .editorconfig             # Editor settings
├── .gitignore                # Git ignore rules
├── .pre-commit-config.yaml   # Pre-commit hooks
├── samples/
│   └── sample_species_richness.geojson   # Demo dataset (see Sample Dataset above)
├── vendor/                   # All third-party JS/CSS libraries (no CDN at runtime)
│   ├── leaflet/
│   ├── leaflet-measure/
│   ├── leaflet-fullscreen/
│   ├── leaflet-heat/
│   ├── xlsx/
│   ├── proj4/
│   ├── shpjs/
│   ├── togeojson/
│   ├── chartjs/
│   ├── html2canvas/
│   ├── jspdf/
│   ├── georaster/
│   ├── georaster-layer/
│   ├── shp-write/
│   └── fonts/inter/          # Inter 400/500/600/700 woff2 (vendored from @fontsource/inter)
├── src/
│   ├── make_maps.py          # Legacy script (backward compatible)
│   └── geospax/              # Python package
│       ├── __init__.py
│       ├── cli.py
│       ├── data.py
│       └── maps.py
├── data/                     # Local data files (git-ignored, not synced)
└── docs/
    ├── transect_map.html     # Generated Folium interactive map (tracked)
    └── transect_map.png      # Generated static map (git-ignored; run `make build`)
```

---

### Python Package (`geospax`)

A Python package using GeoPandas, Matplotlib, Folium, and Contextily to generate:

- **Static map** (`docs/transect_map.png`): Topographic basemap with transect lines, study points, and stacked elevation profiles
- **Interactive map** (`docs/transect_map.html`): Folium/Leaflet map with popups and tooltips

#### CLI Usage

```bash
geospax                                        # generate both maps
geospax --output-dir docs/ --dpi 300 --verbose
geospax --static-only
geospax --interactive-only
```

#### Makefile Targets

```bash
make help              # Show all targets
make lint              # Run Ruff linter
make format            # Run Ruff formatter
make typecheck         # Run mypy type checker
make check             # Run all checks
make build             # Generate both maps
make build-static      # Generate static map only
make build-interactive # Generate interactive map only
make serve             # Serve Web GIS on localhost:8000
make clean             # Remove generated files
```

---

## Deployment

GeoSpaX is a single static file (`index.html`) with all libraries vendored under `vendor/`, so it deploys to any static host with no build step.

### Vercel (primary — `geospax.in4metrix.dev`)

The repo includes `vercel.json` (static config + security headers + immutable cache for `/vendor/*`) and `.vercelignore` (excludes the Python pipeline from the deployment).

1. In Vercel, **Add New → Project** and import the `jm0535/map-kit` GitHub repo.
2. **Framework Preset:** `Other`. Leave **Build Command** empty and **Output Directory** as `.`. Vercel serves `index.html` automatically.
3. Deploy. You'll get a default `*.vercel.app` URL.
4. **Project → Settings → Domains → Add** `geospax.in4metrix.dev`.
5. Vercel shows a DNS record to create. In your `in4metrix.dev` DNS provider, add:

   ```
   Type:   CNAME
   Name:   geospax
   Value:  cname.vercel-dns.com
   ```

   SSL is issued automatically once DNS propagates (~5 minutes). Every push to `main` auto-deploys.

### GitHub Pages (mirror — `jm0535.github.io/map-kit/`)

Under **repo Settings → Pages**: *Source = Deploy from a branch*, *Branch = `main` / `/ (root)`*. Both hosts serve the same `index.html` from `main` and stay in sync on every push.

---

## Technical Notes

### No CDN Dependencies

All third-party libraries are vendored in `vendor/`. The app works fully offline after the initial page load. The only runtime network requests are:

- **Map tile servers** (OpenTopoMap, Esri, CartoDB) — for basemap tiles
- **Nominatim** (`nominatim.openstreetmap.org`) — for the search/geocoding bar
- **epsg.io** — for on-demand CRS definitions used by the CRS reprojection panel

### Coordinate Reference System

All data is handled in **EPSG:4326** (WGS 84) internally. Imported data in other CRS is reprojected client-side using proj4js. The Export panel's **Output CRS** selector reprojects on export.

### Distance & Area Calculations

- Distances use the **haversine formula** (R = 6,371,000 m)
- Polygon areas use the **spherical excess formula** (Chamberlain & Duquette, 2009)
- Centroids for polygons use the **area-weighted shoelace** method
- Inferential statistics distances use **auto-UTM projected coordinates** (via proj4js) for accuracy

### Spatial Statistics Implementation

| Statistic | Implementation | Reference |
| --- | --- | --- |
| Getis-Ord Gi* | z-score + analytical variance; BH FDR correction | Ord & Getis (1995) |
| Local Moran's I | Conditional permutation (999 perms), pseudo-p-value | Anselin (1995) |
| Global Moran's I | Cliff & Ord randomization variance; two-tailed z-test | Cliff & Ord (1981) |
| Normal CDF | Abramowitz & Stegun 7.1.26 rational approximation (|error| < 7.5×10⁻⁸) | A&S (1964) |
| BH FDR | Benjamini-Hochberg step-up procedure | Benjamini & Hochberg (1995) |

Results match GeoDa and ArcGIS Pro for well-formed datasets.

### Analysis Limitations

- **Buffer**: Circular approximation per vertex; not a true geometric buffer. Use QGIS / PostGIS `ST_Buffer` for production use.
- **Voronoi**: Grid-based approximation (120 × 120 raster); cell boundaries are pixelated.
- **IDW**: Does not model spatial autocorrelation; may produce bull's-eye artefacts. Use kriging for production interpolation.
- **DBSCAN**: Epsilon is auto-derived; for precise cluster control use a dedicated library.
- **LISA permutation p-values**: Based on 999 permutations; p-values < 0.001 are reported as `< 0.001`.

### Security

- All user-controlled data (layer names, attribute values) is HTML-escaped before DOM insertion to prevent XSS.
- Object URLs are revoked after download to prevent memory leaks.

---

## Dependencies

### Web GIS (vendored, no CDN)

| Library | Version | Purpose |
| --- | --- | --- |
| [Leaflet](https://leafletjs.com/) | 1.9.4 | Interactive maps |
| [Chart.js](https://www.chartjs.org/) | 4.4.0 | Elevation profiles, Moran scatterplot |
| [html2canvas](https://html2canvas.hertzen.com/) | 1.4.1 | Map PNG export |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | Map PDF export |
| [SheetJS](https://sheetjs.com/) | 0.20.3 | XLSX import and export |
| [shp-write](https://github.com/mapbox/shp-write) | 0.3.2 | Shapefile export |
| [shpjs](https://github.com/calvinmetcalf/shpjs) | 6.1.0 | Shapefile import |
| [toGeoJSON](https://github.com/mapbox/togeojson) | 0.16.0 | KML / GPX import |
| [proj4js](https://github.com/proj4js/proj4js) | 2.11.0 | CRS reprojection |
| [GeoRaster](https://github.com/GeoTIFF/georaster) | 1.6.0 | GeoTIFF parsing |
| [GeoRaster Layer](https://github.com/GeoTIFF/georaster-layer-for-leaflet) | 3.10.0 | GeoTIFF rendering |
| [Leaflet Heat](https://github.com/Leaflet/Leaflet.heat) | 0.2.0 | Heat map layers |
| [Leaflet Measure](https://github.com/ljagis/leaflet-measure) | 3.1.0 | Distance / area measurement |
| [Leaflet Fullscreen](https://github.com/brunob/leaflet.fullscreen) | 3.0.0 | Fullscreen control |
| [Inter font](https://rsms.me/inter/) | 4.0 | UI typeface (woff2, latin subset) |

### Python package

- geopandas, pandas, matplotlib, folium, contextily, shapely, pyproj

### Dev

- ruff, mypy, pre-commit

---

## Development

```bash
make check    # lint + typecheck
make lint     # ruff check
make format   # ruff format
```

| Tool | Purpose | Config |
| --- | --- | --- |
| [Ruff](https://docs.astral.sh/ruff/) | Linter + formatter | `pyproject.toml` |
| [mypy](https://mypy.readthedocs.io/) | Static type checker | `pyproject.toml` |
| [pre-commit](https://pre-commit.com/) | Git hook automation | `.pre-commit-config.yaml` |

---

## License

[MIT](LICENSE)
