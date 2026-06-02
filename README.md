# GeoSpaX

A modern geospatial web application that combines interactive mapping capabilities with powerful visualization tools for spatial data analysis, built entirely in the browser. Includes a Python package for generating publication-ready static and interactive maps with elevation profiles.

**Live demo**: [https://jm0535.github.io/geospax/](https://jm0535.github.io/geospax/)

---

## Features

### Web GIS (`index.html`)

A standalone, zero-backend Web GIS application powered by Leaflet and Chart.js:

#### Data Import

- Drag-and-drop or file picker for **GeoJSON**, **KML/KMZ**, **GPX**, **Shapefile** (.zip), **CSV**, **XLSX**, and **GeoTIFF**
- Smart column mapper for CSV/XLSX — auto-detects lat/lon/elevation columns
- Coordinate reprojection from any supported CRS to EPSG:4326

#### Basemaps

6 free basemaps with opacity control:

- **Topo** (OpenTopoMap), **Satellite** (Esri World Imagery), **Streets** (OSM)
- **Relief** (Esri Shaded Relief), **Terrain** (Esri World Topo), **Dark** (CartoDB Dark Matter)

#### Layer Management

- **Eye icon toggle** — click the eye to show/hide each layer (QGIS-style visibility toggle)
- **Rename layer** — double-click the layer name to edit inline (Enter to confirm, Escape to cancel)
- **Zoom to layer** — click the 🔍 button or right-click the layer name to zoom to layer extent
- Remove layers, view feature count
- Feature labels — choose any attribute as map labels with font size control
- Per-layer opacity slider
- Click layer name to select for symbology editing

#### Digitizing (QGIS-Style Drawing)

Draw new features directly on the map using the digitizing toolbar (top-right of map):

- **Point** — click once to place a marker
- **Line** — click to add vertices, double-click to finish
- **Polygon** — click to add vertices, double-click to close the polygon
- **Attribute form** — after drawing, enter name, description, and category
- **Cancel** — press Escape or click the cancel button
- Drawn features are stored in a **"Drawn Features"** layer that is fully exportable (GeoJSON, CSV, Shapefile)
- Vertex markers shown during drawing with dashed preview of line/polygon
- Crosshair cursor during digitizing mode

#### Symbology (QGIS-style)

- **Layer selector** dropdown to pick which layer to style
- **Simple Symbol**: Fill color, size, opacity, stroke color/width/style (solid, dashed, dotted, dash-dot)
- **Marker Shapes**: Circle, square, triangle, diamond, star, cross (SVG-based)
- **Categorized Renderer**: Color features by unique attribute values (16-color palette)
- **Graduated Renderer**: Color ramp by numeric attribute — choose column, classes (2–10), and ramp (Viridis, Heat, Cool, Terrain)
- **Reset** button to return to default styling
- **Editable legend labels** — click categorized legend entries on the map to rename them inline

#### Feature Info (Right Panel)

- Click any feature on the map to inspect its attributes
- **Layer name** with color swatch and **geometry type badge** (Point/Line/Polygon)
- **Coordinate display** (lat, lng) in monospace
- **Feature navigation** — Previous/Next buttons with counter (e.g., "Feature 3 of 16")
- **Zoom to feature** button
- **Copy attributes** to clipboard
- **Clear** button to reset panel
- **Map highlight** — selected feature gets a dashed blue overlay on the map
- Scrollable property table for many attributes

#### Elevation Profile

- Automatic profile generation for layers with elevation data
- Multi-layer comparison with toggle checkboxes
- **Click-to-pan**: Click a point on the profile to pan the map to that location
- Resizable bottom panel with drag handle
- Chart.js with distance (km) on X-axis, elevation (m a.s.l.) on Y-axis

#### Spatial Analysis

Select a layer and run analysis tools — results appear in the bottom panel and are added as exportable layers:

| Tool | Description | Reference |
| --- | --- | --- |
| Mean Center & Std Distance | Geographic mean center with standard distance circle | Mitchell (2005) |
| Bounding Box | Minimum bounding rectangle with width/height/area | — |
| Nearest Neighbor Index (NNI) | Point pattern analysis: clustered / random / dispersed | Clark & Evans (1954) |
| Moran's I | Spatial autocorrelation with inverse-distance weights | Moran (1950) |
| IDW Interpolation | Inverse Distance Weighting surface (p=2, 50x50 grid) | Shepard (1968) |
| Point Density | Concentration heat map | — |
| Weighted Density | Attribute-weighted density surface | — |
| DBSCAN Clustering | Density-based spatial clustering (auto eps, MinPts=3) | Ester et al. (1996) |
| Convex Hull | Minimum convex polygon with perimeter | Andrew's monotone chain |
| Line Lengths | Haversine great-circle distance calculation | — |
| Polygon Areas | Spherical excess area (Chamberlain & Duquette) | — |
| Centroids | Area-weighted centroid (polygons), coordinate mean (points/lines) | — |
| Simplify | Douglas-Peucker with adjustable tolerance | Douglas & Peucker (1973) |
| Buffer | Circular buffer zones (user-specified distance) | — |
| Voronoi / Thiessen | Thiessen polygon tessellation (120x120 grid, haversine distance) | — |

#### Attribute Table

- Select a layer to browse all features in a searchable table
- Click a row to zoom to feature, highlight it on the map, and inspect properties in Feature Info
- Search/filter across all columns

#### Export

All imported and analysis-generated layers are fully exportable:

- **Map export**: PNG or PDF with title, legend, north arrow, scale bar, and optional elevation profile (72–400 DPI)
- **All-layer data**: CSV (with `_layer` column for attribution) or GeoJSON (with `_layer` property per feature)
- **Per-layer export**: GeoJSON, CSV, or Shapefile (.zip) for any individual layer
- Heat map layers (IDW, Density, Weighted Density) export as point features with value attributes
- Buffer circles export as 24-sided polygon approximations

#### UI/UX

- Resizable left and right panels with drag handles
- Dark/light theme toggle
- Minimap overview (bottom-right panel)
- Coordinate display and zoom level in status bar
- Feature inspection on click (right panel)
- Toast notifications for errors and feedback
- Keyboard shortcuts: `+/-` zoom, `F` fullscreen, `L` toggle layers
- In-app User Guide panel

---

### Python Package (`geospax`)

A Python package using GeoPandas, Matplotlib, Folium, and Contextily to generate:

- **Static map** (`docs/transect_map.png`): Topographic basemap with transect lines, study points, and stacked elevation profiles
- **Interactive map** (`docs/transect_map.html`): Folium/Leaflet map with popups and tooltips

#### CLI Usage

```bash
# Install the package
pip install -e .

# Generate both maps
geospax

# Options
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

## Quick Start

### Web GIS

Open `index.html` in a modern web browser:

```bash
# Direct file open
open index.html

# Or serve locally (recommended)
make serve
# then navigate to http://localhost:8000
```

### Python Package

```bash
# Create virtual environment and install
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Generate maps
geospax

# Or use legacy script
python src/make_maps.py
```

---

## Project Structure

```text
geospax/
├── index.html                # Full-featured standalone Web GIS (GitHub Pages entry point)
├── README.md                 # This file
├── LICENSE                   # MIT License
├── CONTRIBUTING.md           # Contribution guidelines
├── pyproject.toml            # Project config, dependencies, tool settings
├── Makefile                  # Common development tasks
├── .editorconfig             # Editor settings
├── .gitignore                # Git ignore rules
├── .pre-commit-config.yaml   # Pre-commit hooks
├── src/
│   ├── make_maps.py          # Legacy script (backward compatible)
│   └── geospax/              # Python package
│       ├── __init__.py       # Package metadata
│       ├── cli.py            # CLI entry point (geospax)
│       ├── data.py           # Study site data constants
│       └── maps.py           # Map generation functions
├── data/                     # Local data files (git-ignored, not synced)
└── docs/
    ├── transect_map.html     # Generated Folium interactive map (tracked)
    └── transect_map.png      # Generated static map (git-ignored; run `make build`)
```

> **Note:** The `data/` directory and the large `docs/transect_map.png` render are
> git-ignored and kept local only. The study-site data used by the Python pipeline
> is built in to `src/geospax/data.py`, so the maps regenerate without any data files.

---

## Data

The Python pipeline ships with built-in sample elevational transect data from Papua New
Guinea (defined in `src/geospax/data.py`):

- **YUS Conservation Area** (Huon Peninsula, Morobe Province): 9 sites, 200 m - 2800 m elevation
- **Mt Wilhelm** (Chimbu Province): 7 sites, 2600 m - 4509 m (Papua New Guinea's highest summit)

The `data/` directory is reserved for your own local datasets (CSV/XLSX). It is
git-ignored, so personal data is never synced to the remote. Load such files into the
Web GIS (`index.html`) directly via the in-app import controls.

---

## Technical Notes

### Coordinate Reference System

All data is handled in **EPSG:4326** (WGS 84). Imported data in other CRS is reprojected client-side using `proj4js`.

### Distance & Area Calculations

- Distances use the **haversine formula** (R = 6,371,000 m)
- Polygon areas use the **spherical excess formula** (Chamberlain & Duquette, 2009)
- Centroids for polygons use the **area-weighted shoelace** method

### Spatial Analysis Limitations

- **Buffer**: Circular approximation per vertex; not a true geometric buffer. Use QGIS/PostGIS for production buffers.
- **Voronoi**: Grid-based approximation (120x120 raster); not a true Voronoi tessellation. Cell boundaries are pixelated.
- **Point Density / Weighted Density**: These are heat-map surfaces, not statistically rigorous KDE or Getis-Ord Gi* analyses.
- **DBSCAN**: Epsilon is auto-derived from the median nearest-neighbor distance x 1.5. For precise control, use a dedicated clustering library.

### Security

- All user-controlled data (layer names, attribute values, property values) is HTML-escaped before insertion into the DOM to prevent XSS.
- Object URLs are revoked after download (1-second delay) to prevent memory leaks while ensuring downloads complete.

---

## Development

### Code Quality Tools

| Tool | Purpose | Config |
| --- | --- | --- |
| [Ruff](https://docs.astral.sh/ruff/) | Linter + formatter | `pyproject.toml` |
| [mypy](https://mypy.readthedocs.io/) | Static type checker | `pyproject.toml` |
| [pre-commit](https://pre-commit.com/) | Git hook automation | `.pre-commit-config.yaml` |
| [EditorConfig](https://editorconfig.org/) | Cross-editor consistency | `.editorconfig` |

### Running Checks

```bash
make check    # lint + typecheck
make lint     # ruff check
make format   # ruff format
```

---

## Dependencies

**Web GIS** (all loaded from CDN, no build step required):

- [Leaflet](https://leafletjs.com/) — interactive maps
- [Chart.js](https://www.chartjs.org/) — elevation profiles
- [html2canvas](https://html2canvas.hertzen.com/) — map export (PNG/PDF)
- [jsPDF](https://github.com/parallax/jsPDF) — PDF export
- [shp-write](https://github.com/mapbox/shp-write) — Shapefile export
- [SheetJS](https://sheetjs.com/) — XLSX parsing
- [shpjs](https://github.com/calvinmetcalf/shpjs) — Shapefile parsing
- [GeoRaster](https://github.com/GeoTIFF/georaster) + [GeoRaster Layer](https://github.com/GeoTIFF/georaster-layer-for-leaflet) — GeoTIFF parsing
- [toGeoJSON](https://github.com/mapbox/togeojson) — KML/KMZ/GPX conversion
- [Leaflet Heat](https://github.com/Leaflet/Leaflet.heat) — heat map layers
- [Leaflet Measure](https://github.com/ljagis/leaflet-measure) — distance/area measurement
- [Leaflet Fullscreen](https://github.com/brunob/leaflet.fullscreen) — fullscreen control

**Python package**:

- geopandas, pandas, matplotlib, folium, contextily, shapely, pyproj

**Dev dependencies**:

- ruff, mypy, pre-commit

---

## License

[MIT](LICENSE)
