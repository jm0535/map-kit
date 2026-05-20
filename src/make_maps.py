"""
Generic elevational transect map for YUS and Mt Wilhelm, Papua New Guinea.
Produces: transect_map.png (static) and transect_map.html (interactive).
"""

import geopandas as gpd
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.lines as mlines
import folium
from shapely.geometry import Point, LineString
import contextily as ctx
import warnings
from pathlib import Path
warnings.filterwarnings("ignore")

# Project-relative output directory (repo_root/docs/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = PROJECT_ROOT / "docs"
DOCS_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Study points: YUS Conservation Area transect (Huon Peninsula, Morobe)
# Elevations roughly 200m–2800m along ridge
# ---------------------------------------------------------------------------
yus_points = [
    {"site": "YUS-1", "elevation_m": 200,  "lat": -6.08, "lon": 147.30, "transect": "YUS"},
    {"site": "YUS-2", "elevation_m": 500,  "lat": -6.12, "lon": 147.27, "transect": "YUS"},
    {"site": "YUS-3", "elevation_m": 800,  "lat": -6.16, "lon": 147.24, "transect": "YUS"},
    {"site": "YUS-4", "elevation_m": 1100, "lat": -6.20, "lon": 147.21, "transect": "YUS"},
    {"site": "YUS-5", "elevation_m": 1400, "lat": -6.24, "lon": 147.18, "transect": "YUS"},
    {"site": "YUS-6", "elevation_m": 1700, "lat": -6.28, "lon": 147.15, "transect": "YUS"},
    {"site": "YUS-7", "elevation_m": 2000, "lat": -6.32, "lon": 147.12, "transect": "YUS"},
    {"site": "YUS-8", "elevation_m": 2400, "lat": -6.36, "lon": 147.09, "transect": "YUS"},
    {"site": "YUS-9", "elevation_m": 2800, "lat": -6.40, "lon": 147.06, "transect": "YUS"},
]

# Mt Wilhelm transect (Chimbu Province) — 2600m to 4509m (summit)
mtwilhelm_points = [
    {"site": "MtW-1", "elevation_m": 2600, "lat": -5.78, "lon": 145.00, "transect": "Mt Wilhelm"},
    {"site": "MtW-2", "elevation_m": 2900, "lat": -5.77, "lon": 144.99, "transect": "Mt Wilhelm"},
    {"site": "MtW-3", "elevation_m": 3200, "lat": -5.76, "lon": 144.98, "transect": "Mt Wilhelm"},
    {"site": "MtW-4", "elevation_m": 3500, "lat": -5.75, "lon": 144.97, "transect": "Mt Wilhelm"},
    {"site": "MtW-5", "elevation_m": 3800, "lat": -5.74, "lon": 144.96, "transect": "Mt Wilhelm"},
    {"site": "MtW-6", "elevation_m": 4100, "lat": -5.73, "lon": 144.95, "transect": "Mt Wilhelm"},
    {"site": "MtW-7", "elevation_m": 4509, "lat": -5.720,"lon": 144.943,"transect": "Mt Wilhelm"},
]

all_points = yus_points + mtwilhelm_points
df = pd.DataFrame(all_points)
gdf = gpd.GeoDataFrame(df, geometry=[Point(r.lon, r.lat) for r in df.itertuples()], crs="EPSG:4326")

# Transect lines
yus_line  = LineString([(r["lon"], r["lat"]) for r in yus_points])
mtw_line  = LineString([(r["lon"], r["lat"]) for r in mtwilhelm_points])
lines_gdf = gpd.GeoDataFrame(
    {"transect": ["YUS", "Mt Wilhelm"], "geometry": [yus_line, mtw_line]},
    crs="EPSG:4326"
)

colors = {"YUS": "#D94F2B", "Mt Wilhelm": "#2166AC"}

import numpy as np
from pyproj import Geod

geod = Geod(ellps="WGS84")

def cumulative_distance_km(points):
    """Return cumulative ground distance in km along a list of dicts with lat/lon."""
    dists = [0.0]
    for i in range(1, len(points)):
        _, _, d = geod.inv(points[i-1]["lon"], points[i-1]["lat"],
                           points[i]["lon"],   points[i]["lat"])
        dists.append(dists[-1] + d / 1000.0)
    return dists

yus_dist  = cumulative_distance_km(yus_points)
mtwilhelm_dist = cumulative_distance_km(mtwilhelm_points)

# ---------------------------------------------------------------------------
# 1. STATIC MAP (PNG)
# ---------------------------------------------------------------------------
fig = plt.figure(figsize=(18, 10), facecolor="white")

# GridSpec: map left (square-ish), two elevation profiles stacked right
from matplotlib.gridspec import GridSpec
gs = GridSpec(2, 2, figure=fig,
              width_ratios=[1.6, 1],
              height_ratios=[1, 1],
              hspace=0.45, wspace=0.08)

ax_map  = fig.add_subplot(gs[:, 0])   # full left column
ax_yus  = fig.add_subplot(gs[0, 1])   # top right
ax_mtw  = fig.add_subplot(gs[1, 1])   # bottom right

gdf_web   = gdf.to_crs("EPSG:3857")
lines_web = lines_gdf.to_crs("EPSG:3857")

# --- set map extent tightly around PNG study area ---
import pyproj
transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
x_min, y_min = transformer.transform(143.5, -7.2)
x_max, y_max = transformer.transform(148.5, -4.5)
ax_map.set_xlim(x_min, x_max)
ax_map.set_ylim(y_min, y_max)

# Basemap
try:
    ctx.add_basemap(ax_map, crs="EPSG:3857",
                    source=ctx.providers.OpenTopoMap, zoom=9, alpha=0.9)
except Exception:
    ctx.add_basemap(ax_map, crs="EPSG:3857", zoom=9, alpha=0.9)

# Transect lines
for _, row in lines_web.iterrows():
    xs, ys = row.geometry.xy
    ax_map.plot(xs, ys, color=colors[row["transect"]], linewidth=2.5,
                linestyle="--", alpha=0.85, zorder=2)

# Study points
for transect, grp in gdf_web.groupby("transect"):
    ax_map.scatter(grp.geometry.x, grp.geometry.y,
                   color=colors[transect], s=55, zorder=4,
                   edgecolors="white", linewidths=0.8)
    for _, row in grp.iterrows():
        ax_map.annotate(row["site"],
                        xy=(row.geometry.x, row.geometry.y),
                        xytext=(5, 4), textcoords="offset points",
                        fontsize=6, color="white",
                        fontweight="bold",
                        bbox=dict(boxstyle="round,pad=0.15",
                                  fc=colors[transect], ec="none", alpha=0.75),
                        zorder=5)

ax_map.set_axis_off()
ax_map.set_title("YUS & Mt Wilhelm Elevational Transects — Papua New Guinea",
                 fontsize=12, fontweight="bold", pad=8)

# Map legend
handles = [
    mlines.Line2D([], [], color=colors["YUS"], lw=2.5, ls="--",
                  marker="o", markersize=7, markerfacecolor=colors["YUS"],
                  markeredgecolor="white", label="YUS Conservation Area"),
    mlines.Line2D([], [], color=colors["Mt Wilhelm"], lw=2.5, ls="--",
                  marker="o", markersize=7, markerfacecolor=colors["Mt Wilhelm"],
                  markeredgecolor="white", label="Mt Wilhelm Transect"),
]
ax_map.legend(handles=handles, loc="lower left", fontsize=8.5,
              framealpha=0.92, edgecolor="#aaaaaa",
              fancybox=True)

# ---------------------------------------------------------------------------
# 2. YUS elevation profile (top right)
# ---------------------------------------------------------------------------
yus_elev = [p["elevation_m"] for p in yus_points]
yus_sites = [p["site"] for p in yus_points]

ax_yus.fill_between(yus_dist, yus_elev, alpha=0.25, color=colors["YUS"])
ax_yus.plot(yus_dist, yus_elev, color=colors["YUS"], linewidth=2, zorder=3)
ax_yus.scatter(yus_dist, yus_elev, color=colors["YUS"], s=50,
               edgecolors="white", linewidths=0.8, zorder=4)

for d, e, s in zip(yus_dist, yus_elev, yus_sites):
    ax_yus.annotate(f"{e} m", xy=(d, e), xytext=(0, 6),
                    textcoords="offset points", fontsize=7,
                    ha="center", color=colors["YUS"])

ax_yus.set_xticks(yus_dist)
ax_yus.set_xticklabels(yus_sites, rotation=40, ha="right", fontsize=7.5)
ax_yus.set_ylabel("Elevation (m a.s.l.)", fontsize=9)
ax_yus.set_title("YUS Transect Profile", fontsize=10, fontweight="bold",
                 color=colors["YUS"])
ax_yus.set_ylim(0, max(yus_elev) * 1.18)
ax_yus.grid(True, linestyle=":", alpha=0.5)
ax_yus.spines[["top", "right"]].set_visible(False)
ax_yus.set_xlabel("Distance along transect (km)", fontsize=8)

# ---------------------------------------------------------------------------
# 3. Mt Wilhelm elevation profile (bottom right)
# ---------------------------------------------------------------------------
mtw_elev  = [p["elevation_m"] for p in mtwilhelm_points]
mtw_sites = [p["site"] for p in mtwilhelm_points]

ax_mtw.fill_between(mtwilhelm_dist, mtw_elev, alpha=0.25, color=colors["Mt Wilhelm"])
ax_mtw.plot(mtwilhelm_dist, mtw_elev, color=colors["Mt Wilhelm"], linewidth=2, zorder=3)
ax_mtw.scatter(mtwilhelm_dist, mtw_elev, color=colors["Mt Wilhelm"], s=50,
               edgecolors="white", linewidths=0.8, zorder=4)

for d, e, s in zip(mtwilhelm_dist, mtw_elev, mtw_sites):
    ax_mtw.annotate(f"{e} m", xy=(d, e), xytext=(0, 6),
                    textcoords="offset points", fontsize=7,
                    ha="center", color=colors["Mt Wilhelm"])

ax_mtw.set_xticks(mtwilhelm_dist)
ax_mtw.set_xticklabels(mtw_sites, rotation=40, ha="right", fontsize=7.5)
ax_mtw.set_ylabel("Elevation (m a.s.l.)", fontsize=9)
ax_mtw.set_title("Mt Wilhelm Transect Profile", fontsize=10, fontweight="bold",
                 color=colors["Mt Wilhelm"])
ax_mtw.set_ylim(2200, max(mtw_elev) * 1.08)
ax_mtw.grid(True, linestyle=":", alpha=0.5)
ax_mtw.spines[["top", "right"]].set_visible(False)
ax_mtw.set_xlabel("Distance along transect (km)", fontsize=8)

# Footer note
fig.text(0.5, 0.005,
         "Note: Study point locations are indicative. Replace with actual GPS coordinates before publication.",
         ha="center", fontsize=7.5, color="#777777", style="italic")

out_png = DOCS_DIR / "transect_map.png"
plt.savefig(out_png, dpi=200, bbox_inches="tight", facecolor="white")
plt.close()
print(f"Static map saved: {out_png}")

# ---------------------------------------------------------------------------
# 3. INTERACTIVE MAP (HTML)
# ---------------------------------------------------------------------------
center_lat = (gdf["lat"].min() + gdf["lat"].max()) / 2
center_lon = (gdf["lon"].min() + gdf["lon"].max()) / 2

m = folium.Map(location=[center_lat, center_lon], zoom_start=7,
               tiles="OpenTopoMap", attr="OpenTopoMap")

# Transect lines
folium.PolyLine(
    locations=[(r["lat"], r["lon"]) for r in yus_points],
    color=colors["YUS"], weight=3, dash_array="8 4",
    tooltip="YUS Transect"
).add_to(m)
folium.PolyLine(
    locations=[(r["lat"], r["lon"]) for r in mtwilhelm_points],
    color=colors["Mt Wilhelm"], weight=3, dash_array="8 4",
    tooltip="Mt Wilhelm Transect"
).add_to(m)

# Study point markers
for _, row in df.iterrows():
    folium.CircleMarker(
        location=[row["lat"], row["lon"]],
        radius=8,
        color="white", weight=1.5,
        fill=True, fill_color=colors[row["transect"]], fill_opacity=0.9,
        tooltip=f"<b>{row['site']}</b><br>Elevation: {row['elevation_m']} m",
        popup=folium.Popup(
            f"<b>{row['site']}</b><br>"
            f"Transect: {row['transect']}<br>"
            f"Elevation: {row['elevation_m']} m a.s.l.<br>"
            f"Lat: {row['lat']:.4f}, Lon: {row['lon']:.4f}",
            max_width=200
        )
    ).add_to(m)

# Legend
legend_html = """
<div style="position:fixed;bottom:30px;left:30px;z-index:1000;
     background:white;padding:12px 16px;border-radius:8px;
     box-shadow:2px 2px 8px rgba(0,0,0,0.3);font-family:Arial;font-size:13px;">
  <b>Elevational Transects — PNG</b><br><br>
  <span style="color:#E05C2A;">&#11044;</span>
  &nbsp;YUS Conservation Area<br>
  <span style="color:#2A7AE0;">&#11044;</span>
  &nbsp;Mt Wilhelm (4,509 m)<br><br>
  <span style="font-size:11px;color:#888;">Click markers for details</span>
</div>
"""
m.get_root().html.add_child(folium.Element(legend_html))

out_html = DOCS_DIR / "transect_map.html"
m.save(str(out_html))
print(f"Interactive map saved: {out_html}")
