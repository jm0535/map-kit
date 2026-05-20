# map-kit

A lightweight Web GIS toolkit for interactive geospatial visualization and spatial analysis, built entirely in the browser. Includes a Python pipeline for generating publication-ready static maps with elevation profiles.

**Live demo**: [https://jm0535.github.io/map-kit/](https://jm0535.github.io/map-kit/)

---

## Features

### Web GIS (`index.html`)

A standalone, zero-backend Web GIS application powered by Leaflet, Chart.js, and Turf.js:

#### Data Import
- Drag-and-drop or file picker for **GeoJSON**, **KML/KMZ**, **GPX**, **Shapefile** (.zip), **CSV**, **XLSX**, and **GeoTIFF**
- Smart column mapper for CSV/XLSX — auto-detects lat/lon/elevation columns
- Coordinate reprojection from any supported CRS to EPSG:4326

#### Basemaps
6 free basemaps with opacity control:
- **Topo** (OpenTopoMap), **Satellite** (Esri World Imagery), **Streets** (OSM)
- **Relief** (Esri Shaded Relief), **Terrain** (Esri World Topo), **Dark** (CartoDB Dark Matter)

#### Layer Management
- Toggle visibility, remove layers, reorder
- Feature labels — choose any attribute as map labels with font size control
- Per-layer opacity slider

#### Symbology (QGIS-style)
- **Simple Symbol**: Fill color, size, opacity, stroke color/width/style (solid, dashed, dotted, dash-dot)
- **Marker Shapes**: Circle, square, triangle, diamond, star, cross (SVG-based)
- **Categorized Renderer**: Color features by unique attribute values (16-color palette)
- **Graduated Renderer**: Color ramp by numeric attribute — choose column, classes (2–10), and ramp (Viridis, Heat, Cool, Terrain)
- **Reset** button to return to default styling

#### Elevation Profile
- Automatic profile generation for layers with elevation data
- Multi-layer comparison with toggle checkboxes
- **Click-to-pan**: Click a point on the profile to pan the map to that location
- Resizable bottom panel with drag handle
- Chart.js with distance (km) on X-axis, elevation (m a.s.l.) on Y-axis

#### Spatial Analysis
Select a layer and run analysis tools — results appear in the bottom panel:

| Tool | Description | Reference |
|------|-------------|-----------|
| Mean Center & Std Distance | Geographic mean center with standard distance circle | Mitchell (2005) |
| Bounding Box | Minimum bounding rectangle with width/height/area | — |
| Nearest Neighbor Index (NNI) | Point pattern analysis: clustered / random / dispersed | Clark & Evans (1954) |
| Moran's I | Spatial autocorrelation with inverse-distance weights | Moran (1950) |
| IDW Interpolation | Inverse Distance Weighting surface (p=2, 50×50 grid) | Shepard (1968) |
| Point Density | Concentration heat map | — |
| Weighted Density | Attribute-weighted density surface | — |
| DBSCAN Clustering | Density-based spatial clustering (auto eps, MinPts=3) | Ester et al. (1996) |
| Convex Hull | Minimum convex polygon with perimeter | Andrew's monotone chain |
| Line Lengths | Haversine great-circle distance calculation | — |
| Polygon Areas | Spherical excess area (Chamberlain & Duquette) | — |
| Centroids | Area-weighted centroid (polygons), coordinate mean (points/lines) | — |
| Simplify | Douglas-Peucker with adjustable tolerance | Douglas & Peucker (1973) |
| Buffer | Circular buffer zones (user-specified distance) | — |
| Voronoi / Thiessen | Thiessen polygon tessellation (120×120 grid, haversine distance) | — |

#### Attribute Table
- Select a layer to browse all features in a searchable table
- Click a row to zoom to feature and inspect properties
- Search/filter across all columns

#### Export
- **Map**: PNG or PDF with title, legend, north arrow, scale bar, and optional elevation profile
- **Data**: CSV or GeoJSON per layer

#### UI/UX
- Resizable left and right panels with drag handles
- Dark/light theme toggle
- Minimap overview (bottom-right panel)
- Coordinate display and zoom level in status bar
- Feature inspection on click (right panel)
- Toast notifications for errors and feedback
- Keyboard shortcuts: `+/-` zoom, `F` fullscreen, `L` toggle layers

---

### Static Map Generator (`src/make_maps.py`)

A Python script using GeoPandas, Matplotlib, Folium, and Contextily to generate:

- **Static map** (`docs/transect_map.png`): Topographic basemap with transect lines, study points, and stacked elevation profiles
- **Interactive map** (`docs/transect_map.html`): Folium/Leaflet map with popups and tooltips

---

## Quick Start

### Web GIS

Open `index.html` in a modern web browser:

```bash
# Direct file open
open index.html

# Or serve locally (needed for some features)
python -m http.server 8000
# then navigate to http://localhost:8000
```

### Static Maps

Install dependencies and run the generator:

```bash
pip install geopandas pandas matplotlib folium contextily shapely pyproj
python src/make_maps.py
```

---

## Project Structure

```
map-kit/
├── index.html              # Full-featured standalone Web GIS (GitHub Pages entry point)
├── README.md               # This file
├── src/
│   └── make_maps.py        # Static & interactive map generator
├── data/
│   ├── yus_transect.csv    # Sample biodiversity data (YUS Conservation Area)
│   └── mt_wilhelm_transect.xlsx  # Mt Wilhelm transect data
└── docs/
    ├── transect_map.html   # Generated Folium interactive map
    └── transect_map.png    # Generated static map with elevation profiles
```

---

## Data

The project includes sample elevational transect data from Papua New Guinea:

- **YUS Conservation Area** (Huon Peninsula, Morobe Province): 9 sites, 200m–2800m elevation
- **Mt Wilhelm** (Chimbu Province): 7 sites, 2600m–4509m (Papua New Guinea's highest summit)

The CSV (`data/yus_transect.csv`) contains bird species abundance records across YUS sites.

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
- **Voronoi**: Grid-based approximation (120×120 raster); not a true Voronoi tessellation. Cell boundaries are pixelated.
- **Point Density / Weighted Density**: These are heat-map surfaces, not statistically rigorous KDE or Getis-Ord Gi* analyses.
- **DBSCAN**: Epsilon is auto-derived from the median nearest-neighbor distance × 1.5. For precise control, use a dedicated clustering library.

### Security
- All user-controlled data (layer names, attribute values, property values) is HTML-escaped before insertion into the DOM to prevent XSS.
- Object URLs are revoked after download to prevent memory leaks.

---

## Dependencies

**Web GIS** (all loaded from CDN, no build step required):
- [Leaflet](https://leafletjs.com/) — interactive maps
- [Chart.js](https://www.chartjs.org/) — elevation profiles
- [Turf.js](https://turfjs.org/) — geospatial computations
- [html2canvas](https://html2canvas.hertzen.com/) — map export
- [jsPDF](https://github.com/parallax/jsPDF) — PDF export
- [SheetJS](https://sheetjs.com/) — XLSX parsing
- [shpjs](https://github.com/calvinmetcalf/shpjs) — Shapefile parsing
- [proj4js](http://proj4js.org/) — coordinate reprojection
- [GeoTIFF.js](https://geotiffjs.github.io/) — GeoTIFF parsing
- [toGeoJSON](https://github.com/mapbox/togeojson) — KML/KMZ/GPX conversion

**Python pipeline**:
- geopandas, pandas, matplotlib, folium, contextily, shapely, pyproj

---

## License

MIT
