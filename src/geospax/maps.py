"""Static and interactive map generation for elevational transects.

Produces:
    - transect_map.png  — publication-ready static map with elevation profiles
    - transect_map.html — interactive Folium/Leaflet map with popups

References:
    - Geodesic distance: pyproj.Geod (WGS84)
    - Basemap tiles: OpenTopoMap / OpenStreetMap via contextily
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Any

import contextily as ctx
import folium
import matplotlib.lines as mlines
import matplotlib.pyplot as plt
import pyproj
from matplotlib.gridspec import GridSpec
from pyproj import Geod

if TYPE_CHECKING:
    import geopandas as gpd
    import pandas as pd

logger = logging.getLogger(__name__)

geod = Geod(ellps="WGS84")


# ---------------------------------------------------------------------------
# Geodesic helpers
# ---------------------------------------------------------------------------


def cumulative_distance_km(points: list[dict[str, Any]]) -> list[float]:
    """Return cumulative ground distance in km along a list of dicts with lat/lon.

    Uses WGS84 geodesic inverse via pyproj.Geod.
    """
    dists: list[float] = [0.0]
    for i in range(1, len(points)):
        _, _, d = geod.inv(
            points[i - 1]["lon"],
            points[i - 1]["lat"],
            points[i]["lon"],
            points[i]["lat"],
        )
        dists.append(dists[-1] + d / 1000.0)
    return dists


# ---------------------------------------------------------------------------
# Static map builder
# ---------------------------------------------------------------------------


def build_static_map(
    gdf: gpd.GeoDataFrame,
    lines_gdf: gpd.GeoDataFrame,
    yus_points: list[dict[str, Any]],
    mtwilhelm_points: list[dict[str, Any]],
    colors: dict[str, str],
    out_png: Path,
    *,
    dpi: int = 200,
    pad_deg: float = 0.5,
) -> Path:
    """Build and save the static map with elevation profiles.

    Args:
        gdf: GeoDataFrame of study points (EPSG:4326).
        lines_gdf: GeoDataFrame of transect lines (EPSG:4326).
        yus_points: YUS transect site records.
        mtwilhelm_points: Mt Wilhelm transect site records.
        colors: Mapping of transect name to hex colour.
        out_png: Output path for the PNG file.
        dpi: Resolution in dots per inch.
        pad_deg: Padding in degrees around data extent.

    Returns:
        Path to the saved PNG file.
    """
    yus_dist = cumulative_distance_km(yus_points)
    mtwilhelm_dist = cumulative_distance_km(mtwilhelm_points)

    fig = plt.figure(figsize=(18, 10), facecolor="white")

    gs = GridSpec(
        2, 2, figure=fig, width_ratios=[1.6, 1], height_ratios=[1, 1], hspace=0.45, wspace=0.08
    )

    ax_map = fig.add_subplot(gs[:, 0])
    ax_yus = fig.add_subplot(gs[0, 1])
    ax_mtw = fig.add_subplot(gs[1, 1])

    gdf_web = gdf.to_crs("EPSG:3857")
    lines_web = lines_gdf.to_crs("EPSG:3857")

    # Derive map extent from data with padding
    lons = [p["lon"] for p in yus_points + mtwilhelm_points]
    lats = [p["lat"] for p in yus_points + mtwilhelm_points]
    transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    x_min, y_min = transformer.transform(min(lons) - pad_deg, min(lats) - pad_deg)
    x_max, y_max = transformer.transform(max(lons) + pad_deg, max(lats) + pad_deg)
    ax_map.set_xlim(x_min, x_max)
    ax_map.set_ylim(y_min, y_max)

    # Basemap - fallback to OpenStreetMap if OpenTopoMap fails
    try:
        ctx.add_basemap(ax_map, crs="EPSG:3857", source=ctx.providers.OpenTopoMap, zoom=9, alpha=0.9)
        logger.info("OpenTopoMap basemap loaded")
    except Exception:
        ctx.add_basemap(
            ax_map, crs="EPSG:3857", source=ctx.providers.OpenStreetMap.Mapnik, zoom=9, alpha=0.9
        )
        logger.warning("OpenTopoMap unavailable, fell back to OpenStreetMap")

    # Transect lines
    for _, row in lines_web.iterrows():
        xs, ys = row.geometry.xy
        ax_map.plot(xs, ys, color=colors[row["transect"]], linewidth=2.5, linestyle="--", alpha=0.85, zorder=2)

    # Study points
    for transect, grp in gdf_web.groupby("transect"):
        ax_map.scatter(
            grp.geometry.x, grp.geometry.y, color=colors[transect], s=55, zorder=4, edgecolors="white", linewidths=0.8
        )
        for _, row in grp.iterrows():
            ax_map.annotate(
                row["site"],
                xy=(row.geometry.x, row.geometry.y),
                xytext=(5, 4),
                textcoords="offset points",
                fontsize=6,
                color="white",
                fontweight="bold",
                bbox=dict(boxstyle="round,pad=0.15", fc=colors[transect], ec="none", alpha=0.75),
                zorder=5,
            )

    ax_map.set_axis_off()
    ax_map.set_title("YUS & Mt Wilhelm Elevational Transects - Papua New Guinea", fontsize=12, fontweight="bold", pad=8)

    # Map legend
    handles = [
        mlines.Line2D(
            [],
            [],
            color=colors["YUS"],
            lw=2.5,
            ls="--",
            marker="o",
            markersize=7,
            markerfacecolor=colors["YUS"],
            markeredgecolor="white",
            label="YUS Conservation Area",
        ),
        mlines.Line2D(
            [],
            [],
            color=colors["Mt Wilhelm"],
            lw=2.5,
            ls="--",
            marker="o",
            markersize=7,
            markerfacecolor=colors["Mt Wilhelm"],
            markeredgecolor="white",
            label="Mt Wilhelm Transect",
        ),
    ]
    ax_map.legend(handles=handles, loc="lower left", fontsize=8.5, framealpha=0.92, edgecolor="#aaaaaa", fancybox=True)

    # YUS elevation profile
    yus_elev = [p["elevation_m"] for p in yus_points]
    yus_sites = [p["site"] for p in yus_points]

    ax_yus.fill_between(yus_dist, yus_elev, alpha=0.25, color=colors["YUS"])
    ax_yus.plot(yus_dist, yus_elev, color=colors["YUS"], linewidth=2, zorder=3)
    ax_yus.scatter(yus_dist, yus_elev, color=colors["YUS"], s=50, edgecolors="white", linewidths=0.8, zorder=4)

    for d, e, _ in zip(yus_dist, yus_elev, yus_sites, strict=True):
        ax_yus.annotate(
            f"{e} m", xy=(d, e), xytext=(0, 6), textcoords="offset points", fontsize=7, ha="center", color=colors["YUS"]
        )

    ax_yus.set_xticks(yus_dist)
    ax_yus.set_xticklabels(yus_sites, rotation=40, ha="right", fontsize=7.5)
    ax_yus.set_ylabel("Elevation (m a.s.l.)", fontsize=9)
    ax_yus.set_title("YUS Transect Profile", fontsize=10, fontweight="bold", color=colors["YUS"])
    ax_yus.set_ylim(0, max(yus_elev) * 1.18)
    ax_yus.grid(True, linestyle=":", alpha=0.5)
    ax_yus.spines[["top", "right"]].set_visible(False)
    ax_yus.set_xlabel("Distance along transect (km)", fontsize=8)

    # Mt Wilhelm elevation profile
    mtw_elev = [p["elevation_m"] for p in mtwilhelm_points]
    mtw_sites = [p["site"] for p in mtwilhelm_points]

    ax_mtw.fill_between(mtwilhelm_dist, mtw_elev, alpha=0.25, color=colors["Mt Wilhelm"])
    ax_mtw.plot(mtwilhelm_dist, mtw_elev, color=colors["Mt Wilhelm"], linewidth=2, zorder=3)
    ax_mtw.scatter(
        mtwilhelm_dist, mtw_elev, color=colors["Mt Wilhelm"], s=50, edgecolors="white", linewidths=0.8, zorder=4
    )

    for d, e, _ in zip(mtwilhelm_dist, mtw_elev, mtw_sites, strict=True):
        ax_mtw.annotate(
            f"{e} m",
            xy=(d, e),
            xytext=(0, 6),
            textcoords="offset points",
            fontsize=7,
            ha="center",
            color=colors["Mt Wilhelm"],
        )

    ax_mtw.set_xticks(mtwilhelm_dist)
    ax_mtw.set_xticklabels(mtw_sites, rotation=40, ha="right", fontsize=7.5)
    ax_mtw.set_ylabel("Elevation (m a.s.l.)", fontsize=9)
    ax_mtw.set_title("Mt Wilhelm Transect Profile", fontsize=10, fontweight="bold", color=colors["Mt Wilhelm"])
    ax_mtw.set_ylim(2200, max(mtw_elev) * 1.08)
    ax_mtw.grid(True, linestyle=":", alpha=0.5)
    ax_mtw.spines[["top", "right"]].set_visible(False)
    ax_mtw.set_xlabel("Distance along transect (km)", fontsize=8)

    # Footer note
    fig.text(
        0.5,
        0.005,
        "Note: Study point locations are indicative. Replace with actual GPS coordinates before publication.",
        ha="center",
        fontsize=7.5,
        color="#777777",
        style="italic",
    )

    out_png.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(out_png, dpi=dpi, bbox_inches="tight", facecolor="white")
    plt.close()
    logger.info("Static map saved: %s", out_png)
    return out_png


# ---------------------------------------------------------------------------
# Interactive map builder
# ---------------------------------------------------------------------------


def build_interactive_map(
    df: pd.DataFrame,
    yus_points: list[dict[str, Any]],
    mtwilhelm_points: list[dict[str, Any]],
    colors: dict[str, str],
    out_html: Path,
    *,
    zoom_start: int = 7,
) -> Path:
    """Build and save the Folium interactive map.

    Args:
        df: DataFrame of all study points.
        yus_points: YUS transect site records.
        mtwilhelm_points: Mt Wilhelm transect site records.
        colors: Mapping of transect name to hex colour.
        out_html: Output path for the HTML file.
        zoom_start: Initial zoom level.

    Returns:
        Path to the saved HTML file.
    """
    center_lat = (df["lat"].min() + df["lat"].max()) / 2
    center_lon = (df["lon"].min() + df["lon"].max()) / 2

    m = folium.Map(location=[center_lat, center_lon], zoom_start=zoom_start, tiles="OpenTopoMap", attr="OpenTopoMap")

    # Transect lines
    folium.PolyLine(
        locations=[(r["lat"], r["lon"]) for r in yus_points],
        color=colors["YUS"],
        weight=3,
        dash_array="8 4",
        tooltip="YUS Transect",
    ).add_to(m)
    folium.PolyLine(
        locations=[(r["lat"], r["lon"]) for r in mtwilhelm_points],
        color=colors["Mt Wilhelm"],
        weight=3,
        dash_array="8 4",
        tooltip="Mt Wilhelm Transect",
    ).add_to(m)

    # Study point markers
    for _, row in df.iterrows():
        folium.CircleMarker(
            location=[row["lat"], row["lon"]],
            radius=8,
            color="white",
            weight=1.5,
            fill=True,
            fill_color=colors[row["transect"]],
            fill_opacity=0.9,
            tooltip=f"<b>{row['site']}</b><br>Elevation: {row['elevation_m']} m",
            popup=folium.Popup(
                f"<b>{row['site']}</b><br>"
                f"Transect: {row['transect']}<br>"
                f"Elevation: {row['elevation_m']} m a.s.l.<br>"
                f"Lat: {row['lat']:.4f}, Lon: {row['lon']:.4f}",
                max_width=200,
            ),
        ).add_to(m)

    # Legend
    legend_html = """
    <div style="position:fixed;bottom:30px;left:30px;z-index:1000;
         background:white;padding:12px 16px;border-radius:8px;
         box-shadow:2px 2px 8px rgba(0,0,0,0.3);font-family:Arial;font-size:13px;">
      <b>Elevational Transects - PNG</b><br><br>
      <span style="color:#E05C2A;">&#11044;</span>
      &nbsp;YUS Conservation Area<br>
      <span style="color:#2A7AE0;">&#11044;</span>
      &nbsp;Mt Wilhelm (4,509 m)<br><br>
      <span style="font-size:11px;color:#888;">Click markers for details</span>
    </div>
    """
    m.get_root().html.add_child(folium.Element(legend_html))

    out_html.parent.mkdir(parents=True, exist_ok=True)
    m.save(str(out_html))
    logger.info("Interactive map saved: %s", out_html)
    return out_html
