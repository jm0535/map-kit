"""Study site data for YUS Conservation Area and Mt Wilhelm transects."""

from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Study points: YUS Conservation Area transect (Huon Peninsula, Morobe)
# Elevations roughly 200 m - 2800 m along ridge
# ---------------------------------------------------------------------------
YUS_POINTS: list[dict[str, Any]] = [
    {"site": "YUS-1", "elevation_m": 200, "lat": -6.08, "lon": 147.30, "transect": "YUS"},
    {"site": "YUS-2", "elevation_m": 500, "lat": -6.12, "lon": 147.27, "transect": "YUS"},
    {"site": "YUS-3", "elevation_m": 800, "lat": -6.16, "lon": 147.24, "transect": "YUS"},
    {"site": "YUS-4", "elevation_m": 1100, "lat": -6.20, "lon": 147.21, "transect": "YUS"},
    {"site": "YUS-5", "elevation_m": 1400, "lat": -6.24, "lon": 147.18, "transect": "YUS"},
    {"site": "YUS-6", "elevation_m": 1700, "lat": -6.28, "lon": 147.15, "transect": "YUS"},
    {"site": "YUS-7", "elevation_m": 2000, "lat": -6.32, "lon": 147.12, "transect": "YUS"},
    {"site": "YUS-8", "elevation_m": 2400, "lat": -6.36, "lon": 147.09, "transect": "YUS"},
    {"site": "YUS-9", "elevation_m": 2800, "lat": -6.40, "lon": 147.06, "transect": "YUS"},
]

# Mt Wilhelm transect (Chimbu Province) — 2600 m to 4509 m (summit)
MT_WILHELM_POINTS: list[dict[str, Any]] = [
    {"site": "MtW-1", "elevation_m": 2600, "lat": -5.78, "lon": 145.00, "transect": "Mt Wilhelm"},
    {"site": "MtW-2", "elevation_m": 2900, "lat": -5.77, "lon": 144.99, "transect": "Mt Wilhelm"},
    {"site": "MtW-3", "elevation_m": 3200, "lat": -5.76, "lon": 144.98, "transect": "Mt Wilhelm"},
    {"site": "MtW-4", "elevation_m": 3500, "lat": -5.75, "lon": 144.97, "transect": "Mt Wilhelm"},
    {"site": "MtW-5", "elevation_m": 3800, "lat": -5.74, "lon": 144.96, "transect": "Mt Wilhelm"},
    {"site": "MtW-6", "elevation_m": 4100, "lat": -5.73, "lon": 144.95, "transect": "Mt Wilhelm"},
    {"site": "MtW-7", "elevation_m": 4509, "lat": -5.720, "lon": 144.943, "transect": "Mt Wilhelm"},
]

TRANSECT_COLORS: dict[str, str] = {
    "YUS": "#D94F2B",
    "Mt Wilhelm": "#2166AC",
}
