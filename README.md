# map-kit

A lightweight Web GIS toolkit for interactive geospatial visualization and spatial analysis, built entirely in the browser. Includes a Python pipeline for generating publication-ready static maps with elevation profiles.

## Features

### Web GIS (`index.html`)

A standalone, zero-backend Web GIS application powered by Leaflet and Chart.js:

- **Data Import**: Drag-and-drop CSV, XLSX, GeoJSON, Shapefile (.zip), KML/KMZ, GPX, GeoTIFF
- **Interactive Mapping**: Multiple basemaps (topo, satellite, streets, relief, terrain, dark), layer toggles, opacity controls
- **Elevation Profiles**: Dynamic Chart.js profiles comparing multiple transects with cumulative distance
- **Spatial Analysis**: Mean center, bounding box, nearest neighbor index, Moran's I, IDW interpolation, kernel density, hotspot maps, DBSCAN clustering, convex hull, buffer, Voronoi polygons
- **Attribute Table**: Searchable, clickable table with feature inspection
- **Export**: PNG/PDF map composition with title, legend, north arrow, and scale bar; CSV and GeoJSON export
- **UI**: Resizable panels, dark/light theme toggle, minimap overview, coordinate display

### Static Map Generator (`make_maps.py`)

A Python script using GeoPandas, Matplotlib, Folium, and Contextily to generate:

- **Static map** (`transect_map.png`): Topographic basemap with transect lines, study points, and stacked elevation profiles
- **Interactive map** (`transect_map.html`): Folium/Leaflet map with popups and tooltips

## Quick Start

### Web GIS

Open `index.html` directly in a modern web browser:

```bash
open index.html
# or
python -m http.server 8000
# then navigate to http://localhost:8000
```

### Static Maps

Install dependencies and run the generator:

```bash
pip install geopandas pandas matplotlib folium contextily shapely pyproj
python src/make_maps.py
```

## Project Structure

| Path | Description |
|------|-------------|
| `index.html` | Full-featured standalone Web GIS (GitHub Pages entry point) |
| `src/make_maps.py` | Static & interactive map generator |
| `data/yus_transect.csv` | Sample biodiversity data (species abundance) |
| `data/mt_wilhelm_transect.xlsx` | Mt Wilhelm transect data |
| `docs/transect_map.html` | Generated Folium interactive map |
| `docs/transect_map.png` | Generated static map with elevation profiles |

## Data

The project includes sample elevational transect data from Papua New Guinea:

- **YUS Conservation Area** (Huon Peninsula, Morobe): 9 sites, 200m–2800m elevation
- **Mt Wilhelm** (Chimbu Province): 7 sites, 2600m–4509m (summit)

The CSV (`data/yus_transect.csv`) contains bird species abundance records across YUS sites.

## Dependencies

**Web GIS**: None (all libraries loaded from CDN)

**Python pipeline**:

- geopandas
- pandas
- matplotlib
- folium
- contextily
- shapely
- pyproj

## License

MIT
