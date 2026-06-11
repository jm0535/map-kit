import json
import sys

def handler(request):
    # CORS headers
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    }

    if request.method == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    try:
        body = json.loads(request.body)
        presences = body.get("presences", [])
        env_vars = body.get("env_vars", {})
        extent = body.get("extent", [-180, -90, 180, 90])
        resolution = body.get("resolution", 0.1)

        # Try elapid first, fall back to sklearn
        try:
            import elapid
            result = run_maxent_elapid(presences, env_vars, extent, resolution)
        except ImportError:
            result = run_maxent_fallback(presences, env_vars, extent, resolution)

        return {
            "statusCode": 200,
            "headers": headers,
            "body": json.dumps(result)
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": str(e)})
        }


def run_maxent_fallback(presences, env_vars, extent, resolution):
    """Bioclim + logistic regression fallback"""
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    import math

    if not presences or not env_vars:
        return {"type": "FeatureCollection", "features": []}

    var_names = list(env_vars.keys())
    n_vars = len(var_names)

    # Build presence feature matrix
    presence_features = []
    for i, pt in enumerate(presences):
        row = []
        for var in var_names:
            vals = env_vars[var]
            if i < len(vals):
                row.append(vals[i])
            else:
                row.append(0)
        presence_features.append(row)

    X_pres = np.array(presence_features)

    # Generate pseudo-absences
    n_abs = min(len(presences) * 10, 1000)
    rng = np.random.RandomState(42)

    X_abs = rng.uniform(
        low=[v.min() for v in [np.array(env_vars[k]) for k in var_names]],
        high=[v.max() for v in [np.array(env_vars[k]) for k in var_names]],
        size=(n_abs, n_vars)
    )

    X = np.vstack([X_pres, X_abs])
    y = np.array([1]*len(presences) + [0]*n_abs)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    clf = LogisticRegression(max_iter=1000)
    clf.fit(X_scaled, y)

    # Generate output grid
    minLng, minLat, maxLng, maxLat = extent
    features = []

    grid_points = []
    coords_list = []
    lng_val = minLng
    while lng_val <= maxLng:
        lat_val = minLat
        while lat_val <= maxLat:
            coords_list.append([lng_val, lat_val])
            # interpolate env values based on position — use mean as simplified fallback
            row = []
            for var in var_names:
                vals = np.array(env_vars[var])
                row.append(float(vals.mean()))
            grid_points.append(row)
            lat_val += resolution
        lng_val += resolution

    if grid_points:
        X_grid = np.array(grid_points)
        X_grid_scaled = scaler.transform(X_grid)
        probs = clf.predict_proba(X_grid_scaled)[:, 1]

        for i, (coord, prob) in enumerate(zip(coords_list, probs)):
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": coord},
                "properties": {"suitability": float(prob)}
            })

    return {"type": "FeatureCollection", "features": features}


def run_maxent_elapid(presences, env_vars, extent, resolution):
    """Run MaxEnt using elapid"""
    import numpy as np
    import elapid

    # This would use elapid's MaxEnt implementation
    # For now return the fallback
    return run_maxent_fallback(presences, env_vars, extent, resolution)
