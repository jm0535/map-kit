# Contributing to GeoSpaX

Thank you for your interest in contributing! This document outlines the standards and workflows for this project.

## Development Setup

```bash
# Clone and enter the repo
git clone git@github.com:jm0535/map-kit.git
cd map-kit

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install with dev dependencies
pip install -e ".[dev]"

# Install pre-commit hooks
pre-commit install
```

## Code Quality

### Linting & Formatting

We use [Ruff](https://docs.astral.sh/ruff/) as the unified linter and formatter:

```bash
# Check for issues
ruff check .

# Auto-fix
ruff check --fix .

# Format
ruff format .
```

### Type Checking

We use [mypy](https://mypy.readthedocs.io/) for static type analysis:

```bash
mypy src/
```

### Pre-commit

Pre-commit hooks run automatically on `git commit`. To run manually:

```bash
pre-commit run --all-files
```

## Project Structure

```text
map-kit/                    # Repository name (app is branded "GeoSpaX")
├── index.html              # Web GIS frontend (standalone, zero-backend)
├── js/                     # GeoSpaX JS modules (loaded by index.html)
│   ├── geospax-conservation.js      # Overlay, WLC, gap analysis
│   ├── geospax-conservation-m2.js   # Fragmentation, connectivity, change detection
│   ├── geospax-sdm-fix.js           # BIOCLIM / Mahalanobis SDM
│   ├── geospax-project.js           # Provenance, project save/load
│   ├── geospax-raster.js            # Reclassify, polygonize
│   ├── geospax-opendata.js          # Open data connectors (Overpass, GBIF, WWF, World Bank, USGS)
│   ├── gsx-select.js                # Dropdown popup replacement (app-wide)
│   └── gsx-calcfield.js             # Calculate field tool (expression parser + weighted conditions)
├── src/
│   ├── make_maps.py        # Legacy script (kept for backward compatibility)
│   └── geospax/            # Python package
│       ├── __init__.py     # Package metadata
│       ├── cli.py          # CLI entry point (geospax)
│       ├── data.py         # Study site data constants
│       └── maps.py         # Map generation functions
├── data/                   # Sample datasets
├── docs/                   # Generated output maps
├── pyproject.toml          # Project config, dependencies, tool settings
└── Makefile                # Common development tasks
```

## Making Changes

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes with type hints and docstrings
3. Run `make lint` and `make typecheck` to verify
4. Commit with a descriptive message
5. Push and open a Pull Request

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat: add new spatial analysis tool`
- `fix: correct Moran's I weight calculation`
- `docs: update README with CLI usage`
- `refactor: extract data constants to data.py`
- `chore: update ruff config`

## Web GIS (`index.html`)

The Web GIS is a single-file application. When modifying:

### Security

- All user-controlled data must be HTML-escaped via `escapeHtml()` before DOM insertion to prevent XSS
- Object URLs must be revoked with `setTimeout(1000)` delay to ensure downloads complete

### UI/UX

- Use the existing overlay/modal pattern for dialogs (no `prompt()`/`alert()`)
- Maintain dark/light theme compatibility (add `body.light` rules for new elements)
- Use toast notifications (`showToast()`) for user feedback
- Dropdown popups are handled by `js/gsx-select.js` - do not add custom dropdown widgets. New `<select>` elements are covered automatically. Add `data-gsx-select="off"` only if a control must use its native popup

### Layer Management

- New layers must be added via `addLayerToPanel()` and pushed to `uploadedLayers`
- Call `refreshExportLayerSelect()`, `refreshAttrLayerSelect()`, and `refreshAnalysisLayerSelect()` after adding/removing layers
- Layer visibility toggle uses the eye icon (`.layer-eye`) synced with a hidden checkbox

### Feature Info

- All feature click handlers must pass `(props, layerId, leafletLayer, featureIndex)` to `showFeatureInfo()`
- The `_fiLayerId` and `_fiIndex` state variables track the current selection for navigation

### Spatial Analysis

- New analysis tools must call `addAnalysisLayer()` which auto-builds GeoJSON and properties
- Heat map layers must provide grid data as point GeoJSON features for export
- Use `_leafletLayerToGeoJSON()` for converting Leaflet layer types to GeoJSON

### Export

- Use `_downloadBlob()` for all file downloads (handles URL revocation safely)
- Use `_csvEscape()` for CSV value escaping (RFC 4180 compliant)
- Use `_layerToFeatures()` for extracting GeoJSON features from any layer type
- Per-layer exports read from the `export-layer-select` dropdown

### Raster Layers (GeoTIFF)

- GeoTIFF layers use `GeoRasterLayer` from `georaster-layer-for-leaflet`, not standard Leaflet vector layers
- Raster pixel values from `parseGeoraster` are nested as `[band][row][column]` - normalize before use
- Recolouring uses `layer.updateColors()` with a `pixelValuesToColorFn` callback, **not** `setOptions()`
- `_interpolateColor()` handles `#rgb`, `#rrggbb`, `rgb()`, and CSS named colours - use it for all palette interpolation
- Raster legend state must use `mode: 'raster'` (not `'simple'`) for the gradient bar to render
- `buildSymbologyControls()` is idempotent - it removes any existing block before rebuilding to prevent duplicate controls
- After adding a raster layer, call `refreshAttrLayerSelect()` and `refreshSymbologyLayerSelect()` so the new layer appears in all dropdowns
- `initLegendState()` must preserve existing raster legend state - check `legendState[id].mode === 'raster'` before overwriting

### Map Composer

- The composer has two modes: **attached** (modal overlay) and **detached** (separate window via `BroadcastChannel`)
- `buildLayout()` handles three layer types: heat layers (via `eachLayer`), vector layers (via GeoJSON), and raster layers (re-instantiated `GeoRasterLayer`)
- Detached composer state is serialised by `_serializeComposerState()` and restored by `_applyComposerState()` - include `isRaster` and `georaster` fields for raster layers
- `_renderScalebar()` uses `_metersPerPixel()` which calls `lmap.project()` (unrounded) - **never** use `latLngToContainerPoint()` which rounds to integers and breaks at low zoom
- Composer zoom uses 0.25 increments (`zoomSnap: 0.25`) matching the main map
- `refreshComposer()` preserves the current view and layout state - do not call `buildLayout()` directly for refreshes

### Open Data Connectors

- All open data connectors live in `js/geospax-opendata.js`
- GBIF searches support both scientific and common names; the record limit is user-configurable with pagination beyond the API's 300-record cap
- Overpass queries are bounded by the current map extent to avoid oversized responses
- Natural Earth data is bundled as GeoJSON in the repo (no runtime fetch needed)
