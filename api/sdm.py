"""
Vercel Python serverless function: MaxEnt species distribution model.

Expects POST JSON:
{
  "presences": [[lng, lat], ...],
  "env_vars": {"varname": [val_at_presence_1, val_at_presence_2, ...], ...},
  "extent": [minLng, minLat, maxLng, maxLat],
  "resolution": 0.1
}

Returns a GeoJSON FeatureCollection of grid points with a `suitability`
property (0-1). Uses elapid's MaxEnt if installed, otherwise falls back to a
logistic-regression presence/pseudo-absence model (numpy + scikit-learn).
"""
import json
from http.server import BaseHTTPRequestHandler


class handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(200, {})

    def do_GET(self):
        self._send(200, {"status": "ok", "service": "GeoSpaX MaxEnt SDM",
                         "usage": "POST presences + env_vars + extent + resolution"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")

            presences = body.get("presences", [])
            env_vars = body.get("env_vars", {})
            extent = body.get("extent", [-180, -90, 180, 90])
            resolution = float(body.get("resolution", 0.1))

            if not presences or not env_vars:
                self._send(400, {"error": "presences and env_vars are required"})
                return

            result = run_sdm(presences, env_vars, extent, resolution)
            self._send(200, result)
        except Exception as e:  # noqa: BLE001
            self._send(500, {"error": str(e)})


def run_sdm(presences, env_vars, extent, resolution):
    """Try elapid MaxEnt; fall back to logistic regression."""
    try:
        return run_maxent_elapid(presences, env_vars, extent, resolution)
    except Exception:
        return run_logreg_fallback(presences, env_vars, extent, resolution)


def _grid_coords(extent, resolution, cap=8000):
    """Generate grid cell centre coordinates, capped to avoid huge payloads."""
    min_lng, min_lat, max_lng, max_lat = extent
    coords = []
    lng = min_lng
    while lng <= max_lng:
        lat = min_lat
        while lat <= max_lat:
            coords.append([lng, lat])
            if len(coords) >= cap:
                return coords
            lat += resolution
        lng += resolution
    return coords


def run_logreg_fallback(presences, env_vars, extent, resolution):
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    var_names = list(env_vars.keys())
    n_vars = len(var_names)
    n_pres = len(presences)

    # Presence environmental matrix (rows = presence points)
    X_pres = np.array(
        [[float(env_vars[v][i]) for v in var_names] for i in range(n_pres)],
        dtype=float,
    )

    # Pseudo-absences sampled uniformly within each variable's observed range
    lows = X_pres.min(axis=0)
    highs = X_pres.max(axis=0)
    rng = np.random.RandomState(42)
    n_abs = min(max(n_pres * 10, 100), 2000)
    X_abs = rng.uniform(low=lows, high=highs, size=(n_abs, n_vars))

    X = np.vstack([X_pres, X_abs])
    y = np.array([1] * n_pres + [0] * n_abs)

    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    clf = LogisticRegression(max_iter=1000)
    clf.fit(Xs, y)

    # Build prediction grid. We do not have rasters server-side, so we
    # interpolate each grid cell's environment from the nearest presence
    # point (inverse-distance weighting on the two nearest neighbours).
    coords = _grid_coords(extent, resolution)
    pres_xy = np.array(presences, dtype=float)

    grid_env = []
    for lng, lat in coords:
        d = np.sqrt((pres_xy[:, 0] - lng) ** 2 + (pres_xy[:, 1] - lat) ** 2)
        d = np.maximum(d, 1e-9)
        w = 1.0 / (d ** 2)
        w /= w.sum()
        grid_env.append((X_pres * w[:, None]).sum(axis=0))

    if not grid_env:
        return {"type": "FeatureCollection", "features": []}

    Xg = scaler.transform(np.array(grid_env))
    probs = clf.predict_proba(Xg)[:, 1]

    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [c[0], c[1]]},
            "properties": {"suitability": round(float(p), 4)},
        }
        for c, p in zip(coords, probs)
    ]
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {"model": "logistic-regression-fallback", "n_presences": n_pres},
    }


def run_maxent_elapid(presences, env_vars, extent, resolution):
    """Run MaxEnt with elapid using tabular presence/background features."""
    import numpy as np
    from elapid import MaxentModel

    var_names = list(env_vars.keys())
    n_vars = len(var_names)
    n_pres = len(presences)

    X_pres = np.array(
        [[float(env_vars[v][i]) for v in var_names] for i in range(n_pres)],
        dtype=float,
    )

    lows, highs = X_pres.min(axis=0), X_pres.max(axis=0)
    rng = np.random.RandomState(42)
    n_bg = min(max(n_pres * 10, 200), 5000)
    X_bg = rng.uniform(low=lows, high=highs, size=(n_bg, n_vars))

    X = np.vstack([X_pres, X_bg])
    y = np.array([1] * n_pres + [0] * n_bg)

    model = MaxentModel()
    model.fit(X, y)

    coords = _grid_coords(extent, resolution)
    pres_xy = np.array(presences, dtype=float)
    grid_env = []
    for lng, lat in coords:
        d = np.maximum(np.sqrt((pres_xy[:, 0] - lng) ** 2 + (pres_xy[:, 1] - lat) ** 2), 1e-9)
        w = 1.0 / (d ** 2)
        w /= w.sum()
        grid_env.append((X_pres * w[:, None]).sum(axis=0))

    preds = model.predict(np.array(grid_env))
    preds = np.clip(np.array(preds).ravel(), 0, 1)

    features = [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [c[0], c[1]]},
            "properties": {"suitability": round(float(p), 4)},
        }
        for c, p in zip(coords, preds)
    ]
    return {
        "type": "FeatureCollection",
        "features": features,
        "meta": {"model": "elapid-maxent", "n_presences": n_pres},
    }
