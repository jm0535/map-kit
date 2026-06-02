"""Command-line interface for map-kit map generation."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, Point

from map_kit.data import MT_WILHELM_POINTS, TRANSECT_COLORS, YUS_POINTS
from map_kit.maps import build_interactive_map, build_static_map


def _build_geodataframes() -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame, pd.DataFrame]:
    """Construct GeoDataFrames from built-in study site data."""
    all_points = YUS_POINTS + MT_WILHELM_POINTS
    df = pd.DataFrame(all_points)
    gdf = gpd.GeoDataFrame(df, geometry=[Point(r.lon, r.lat) for r in df.itertuples()], crs="EPSG:4326")

    yus_line = LineString([(r["lon"], r["lat"]) for r in YUS_POINTS])
    mtw_line = LineString([(r["lon"], r["lat"]) for r in MT_WILHELM_POINTS])
    lines_gdf = gpd.GeoDataFrame(
        {"transect": ["YUS", "Mt Wilhelm"], "geometry": [yus_line, mtw_line]},
        crs="EPSG:4326",
    )
    return gdf, lines_gdf, df


def main(argv: list[str] | None = None) -> None:
    """Entry point for the make-maps CLI."""
    parser = argparse.ArgumentParser(
        prog="make-maps",
        description="Generate static and interactive transect maps for PNG study sites.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("docs"),
        help="Directory for output files (default: docs/)",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=200,
        help="DPI for static map (default: 200)",
    )
    parser.add_argument(
        "--static-only",
        action="store_true",
        help="Generate only the static PNG map",
    )
    parser.add_argument(
        "--interactive-only",
        action="store_true",
        help="Generate only the interactive HTML map",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s  %(name)s  %(message)s",
    )

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = Path(__file__).resolve().parent.parent.parent / output_dir

    gdf, lines_gdf, df = _build_geodataframes()

    if not args.interactive_only:
        build_static_map(
            gdf=gdf,
            lines_gdf=lines_gdf,
            yus_points=YUS_POINTS,
            mtwilhelm_points=MT_WILHELM_POINTS,
            colors=TRANSECT_COLORS,
            out_png=output_dir / "transect_map.png",
            dpi=args.dpi,
        )

    if not args.static_only:
        build_interactive_map(
            df=df,
            yus_points=YUS_POINTS,
            mtwilhelm_points=MT_WILHELM_POINTS,
            colors=TRANSECT_COLORS,
            out_html=output_dir / "transect_map.html",
        )

    logging.getLogger(__name__).info("Done. Output directory: %s", output_dir)


if __name__ == "__main__":
    main()
