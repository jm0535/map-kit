/* =====================================================================
   GeoSpaX — SDM Correctness Fixes  (P0-4c)

   Replaces extractEnvAtPoints / interpolateEnvAtPoint / runBioclimSDM /
   runMahalanobisSDM.

   Governing principle: a model must never silently become a different
   model. Every degradation is either refused or surfaced as a warning
   the user has to see.

   Fixes:
     1. Environmental sampling uses point-in-polygon, then true distance —
        not the first vertex of the polygon.
     2. Sampling happens once per location, not once per variable.
     3. Percentiles are linearly interpolated (the old index arithmetic
        was inert at small n).
     4. BIOCLIM offers true limiting-factor scoring, and refuses to run
        without environmental variables instead of returning a heat map.
     5. Mahalanobis refuses with fewer than 2 variables instead of
        silently modelling geography.
     6. Missing values are excluded and counted, not replaced with 0.
     7. Singular covariance is detected and reported; ridge regularisation
        is applied and disclosed, rather than silently becoming Euclidean.
     8. Optional chi-square probability on D², which is the defensible
        alternative to the arbitrary 1/(1+d) index.

   Load after geospax-conservation.js.
   ===================================================================== */

(function (root) {
  'use strict';

  var T = root.turf;
  var GSX = root.GSX;
  if (!GSX) throw new Error('geospax-conservation.js must load first');

  /* ===================================================================
     1. ENVIRONMENTAL SAMPLING  (fixes 1 & 2)
     =================================================================== */

  /**
   * Sample one environmental layer at one location.
   *
   * opts: { field, method: 'auto'|'nearest'|'idw', k: 3, power: 2,
   *         maxDistM: null }
   *
   * 'auto' — if the layer is polygonal, use the polygon containing the
   *          point; if none contains it, fall back to nearest by TRUE
   *          distance (not first-vertex distance) and flag it.
   *          If the layer is points, use IDW over the k nearest.
   *
   * Returns { value, source, distanceM } where source is one of
   * 'containing' | 'nearest' | 'idw' | null.
   */
  GSX.sampleEnvAt = function (pt, features, opts) {
    opts = opts || {};
    var field = opts.field;
    var method = opts.method || 'auto';
    var maxD = opts.maxDistM || null;
    var feats = features || [];
    if (feats.length === 0) return { value: null, source: null, distanceM: null };

    var val = function (f) {
      if (!f || !f.properties) return null;
      var v = f.properties[field];
      return (typeof v === 'number' && isFinite(v)) ? v : null;
    };

    var polys = feats.filter(function (f) {
      return f.geometry &&
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
    });
    var points = feats.filter(function (f) {
      return f.geometry && f.geometry.type === 'Point';
    });

    // --- polygonal: containment first (this is the bug being fixed) ---
    if (polys.length && method !== 'idw') {
      for (var i = 0; i < polys.length; i++) {
        var inside;
        try { inside = T.booleanPointInPolygon(pt, polys[i]); } catch (e) { inside = false; }
        if (inside) {
          return { value: val(polys[i]), source: 'containing', distanceM: 0 };
        }
      }
      // not contained — nearest by true distance to the boundary
      var bestP = null, bestD = Infinity;
      polys.forEach(function (p) {
        var d = GSX.nearestDistanceM(pt, [p]);
        if (d !== null && d < bestD) { bestD = d; bestP = p; }
      });
      if (bestP && (maxD === null || bestD <= maxD)) {
        return { value: val(bestP), source: 'nearest', distanceM: bestD };
      }
      if (points.length === 0) {
        return { value: null, source: null, distanceM: bestD === Infinity ? null : bestD };
      }
    }

    // --- points: IDW over k nearest, or plain nearest ---
    if (points.length) {
      var withD = [];
      points.forEach(function (p) {
        var v = val(p);
        if (v === null) return;
        var d;
        try { d = T.distance(pt, p, { units: 'meters' }); } catch (e) { return; }
        if (maxD !== null && d > maxD) return;
        withD.push({ v: v, d: d });
      });
      if (withD.length === 0) return { value: null, source: null, distanceM: null };
      withD.sort(function (a, b) { return a.d - b.d; });

      if (method === 'nearest') {
        return { value: withD[0].v, source: 'nearest', distanceM: withD[0].d };
      }
      var k = Math.min(opts.k || 3, withD.length);
      var power = opts.power || 2;
      if (withD[0].d === 0) {
        return { value: withD[0].v, source: 'idw', distanceM: 0 };
      }
      var num = 0, den = 0;
      for (var j = 0; j < k; j++) {
        var w = 1 / Math.pow(withD[j].d, power);
        num += w * withD[j].v; den += w;
      }
      return { value: den > 0 ? num / den : null, source: 'idw', distanceM: withD[0].d };
    }

    return { value: null, source: null, distanceM: null };
  };

  /**
   * Sample every variable at every location — ONCE per location.
   * The old code re-scanned every layer once per variable.
   *
   * envLayers: [{ name, features, field, method, k, power, maxDistM }]
   * Returns { matrix: [[v,...] per location], varNames, missing: {var: n},
   *           sources: {containing, nearest, idw, none} }
   */
  GSX.sampleEnvMatrix = function (locations, envLayers) {
    var varNames = envLayers.map(function (l, i) { return l.name || ('var' + i); });
    var missing = {}; varNames.forEach(function (n) { missing[n] = 0; });
    var sources = { containing: 0, nearest: 0, idw: 0, none: 0 };

    var matrix = locations.map(function (loc) {
      return envLayers.map(function (l, i) {
        var r = GSX.sampleEnvAt(loc, l.features, l);
        sources[r.source || 'none']++;
        if (r.value === null) missing[varNames[i]]++;
        return r.value;
      });
    });

    return { matrix: matrix, varNames: varNames, missing: missing, sources: sources };
  };

  /* ===================================================================
     2. STATISTICS HELPERS  (fix 3)
     =================================================================== */

  /** Linearly interpolated percentile. p in [0,1]. */
  GSX.percentile = function (sortedValues, p) {
    var n = sortedValues.length;
    if (n === 0) return null;
    if (n === 1) return sortedValues[0];
    var idx = (n - 1) * p;
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sortedValues[lo];
    return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
  };

  /** Regularised lower incomplete gamma P(a,x) — series + continued fraction. */
  function gammaP(a, x) {
    if (x < 0 || a <= 0) return NaN;
    if (x === 0) return 0;
    var gln = logGamma(a);
    if (x < a + 1) {                       // series
      var ap = a, sum = 1 / a, del = sum;
      for (var n = 1; n < 300; n++) {
        ap++; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - gln);
    }
    // continued fraction for Q, then invert
    var b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (var i = 1; i < 300; i++) {
      var an = -i * (i - a);
      b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c;         if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; var delta = d * c; h *= delta;
      if (Math.abs(delta - 1) < 1e-12) break;
    }
    var q = Math.exp(-x + a * Math.log(x) - gln) * h;
    return 1 - q;
  }

  function logGamma(z) {
    var g = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
             -176.61502916214059, 12.507343278686905, -0.13857109526572012,
             9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    z -= 1;
    var x = 0.99999999999980993;
    for (var i = 0; i < g.length; i++) x += g[i] / (z + i + 1);
    var t = z + g.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  /** P(X > x) for chi-square with df degrees of freedom. */
  GSX.chiSquareSurvival = function (x, df) {
    if (x <= 0) return 1;
    return 1 - gammaP(df / 2, x / 2);
  };

  /** Covariance matrix of an n x p matrix about a mean vector. */
  GSX.covariance = function (matrix, mean) {
    var n = matrix.length, p = mean.length;
    var cov = [];
    for (var i = 0; i < p; i++) {
      cov[i] = [];
      for (var j = 0; j < p; j++) {
        var s = 0;
        for (var r = 0; r < n; r++) s += (matrix[r][i] - mean[i]) * (matrix[r][j] - mean[j]);
        cov[i][j] = n > 1 ? s / (n - 1) : 0;
      }
    }
    return cov;
  };

  /**
   * Gauss-Jordan inversion that REPORTS singularity instead of silently
   * returning the identity (which turned Mahalanobis into Euclidean).
   * Applies ridge regularisation if needed and says so.
   */
  GSX.invertMatrixSafe = function (m, ridge) {
    var n = m.length;
    var work = m.map(function (r) { return r.slice(); });
    var applied = 0;

    function attempt(mat) {
      var aug = mat.map(function (row, i) {
        var id = new Array(n).fill(0); id[i] = 1;
        return row.concat(id);
      });
      for (var col = 0; col < n; col++) {
        var maxRow = col;
        for (var r = col + 1; r < n; r++) {
          if (Math.abs(aug[r][col]) > Math.abs(aug[maxRow][col])) maxRow = r;
        }
        var tmp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = tmp;
        var pivot = aug[col][col];
        if (Math.abs(pivot) < 1e-10) return null;      // singular
        for (var j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
        for (var r2 = 0; r2 < n; r2++) {
          if (r2 === col) continue;
          var f = aug[r2][col];
          for (var j2 = 0; j2 < 2 * n; j2++) aug[r2][j2] -= f * aug[col][j2];
        }
      }
      return aug.map(function (row) { return row.slice(n); });
    }

    var inv = attempt(work);
    if (inv) return { inv: inv, singular: false, ridge: 0 };

    // ridge: add lambda to the diagonal, escalating until invertible
    var trace = 0;
    for (var i = 0; i < n; i++) trace += Math.abs(m[i][i]);
    var base = (trace / n) || 1;
    var lambda = base * 1e-6;
    for (var attemptN = 0; attemptN < 12; attemptN++) {
      var reg = m.map(function (row, i) {
        return row.map(function (v, j) { return i === j ? v + lambda : v; });
      });
      inv = attempt(reg);
      if (inv) { applied = lambda; break; }
      lambda *= 10;
    }
    if (!inv) return { inv: null, singular: true, ridge: 0 };
    return { inv: inv, singular: true, ridge: applied };
  };

  GSX.mahalanobisD2 = function (x, mean, invCov) {
    var p = mean.length, diff = [], i, j;
    for (i = 0; i < p; i++) diff[i] = x[i] - mean[i];
    var d2 = 0;
    for (i = 0; i < p; i++) {
      var s = 0;
      for (j = 0; j < p; j++) s += invCov[i][j] * diff[j];
      d2 += diff[i] * s;
    }
    return Math.max(0, d2);
  };

  /* ===================================================================
     3. BIOCLIM  (fixes 3, 4)
     =================================================================== */

  /**
   * opts: { mode: 'limiting'|'proportion', lower: 0.05, upper: 0.95,
   *         cellSizeM, bufferM }
   *
   * 'limiting'   — true BIOCLIM: any variable outside its envelope ⇒ 0.
   * 'proportion' — the previous behaviour, retained but named honestly.
   *
   * REFUSES to run without environmental variables. The old code fell
   * back to a Gaussian kernel and labelled the output "Bioclim SDM".
   */
  GSX.bioclim = function (presences, envLayers, opts) {
    opts = opts || {};
    var warnings = [];

    if (!envLayers || envLayers.length === 0) {
      return { ok: false,
        error: 'BIOCLIM requires at least one environmental variable. ' +
               'Without one there is no envelope to fit — add an environmental ' +
               'layer, or use a kernel density tool if a density surface is what you want.' };
    }
    if (!presences || presences.length < 5) {
      return { ok: false, error: 'BIOCLIM needs at least 5 presence records (have ' +
               (presences ? presences.length : 0) + ').' };
    }

    var mode = opts.mode || 'limiting';
    var lower = opts.lower != null ? opts.lower : 0.05;
    var upper = opts.upper != null ? opts.upper : 0.95;

    var sampled = GSX.sampleEnvMatrix(presences, envLayers);
    var varNames = sampled.varNames;

    // envelopes, with proper interpolated percentiles
    var envelopes = {};
    varNames.forEach(function (name, vi) {
      var vals = sampled.matrix
        .map(function (row) { return row[vi]; })
        .filter(function (v) { return typeof v === 'number' && isFinite(v); })
        .sort(function (a, b) { return a - b; });
      if (vals.length < 3) {
        warnings.push('Variable "' + name + '" had only ' + vals.length +
                      ' usable values and was excluded.');
        return;
      }
      envelopes[name] = {
        min: GSX.percentile(vals, lower),
        max: GSX.percentile(vals, upper),
        n: vals.length,
        absMin: vals[0], absMax: vals[vals.length - 1]
      };
      if (vals.length < 20) {
        warnings.push('Variable "' + name + '": only ' + vals.length +
                      ' records — the ' + Math.round(lower * 100) + '–' +
                      Math.round(upper * 100) + '% envelope is close to the full range.');
      }
      if (envelopes[name].min === envelopes[name].max) {
        warnings.push('Variable "' + name + '" has an identical value at every presence ' +
                      'record (' + envelopes[name].min + '). The envelope has zero width, so ' +
                      'this variable carries no information and will accept only that exact ' +
                      'value. Check the layer and the field you selected.');
      }
    });

    var used = Object.keys(envelopes);
    if (used.length === 0) {
      return { ok: false, error: 'No environmental variable had enough usable values.' };
    }
    Object.keys(sampled.missing).forEach(function (k) {
      if (sampled.missing[k] > 0) {
        warnings.push(sampled.missing[k] + ' of ' + presences.length +
                      ' presence records had no value for "' + k + '" and were excluded.');
      }
    });
    if (sampled.sources.nearest > 0) {
      warnings.push(sampled.sources.nearest + ' samples fell outside every polygon and used ' +
                    'the nearest feature instead.');
    }

    // prediction grid
    var bbox = T.bbox(GSX.fc(presences));
    var bufKm = (opts.bufferM != null ? opts.bufferM : 10000) / 1000;
    var grid;
    try {
      var padded = T.bbox(T.buffer(T.bboxPolygon(bbox), bufKm, { units: 'kilometers' }));
      grid = T.squareGrid(padded, (opts.cellSizeM || 1000) / 1000, { units: 'kilometers' });
    } catch (e) {
      return { ok: false, error: 'Could not build prediction grid: ' + e.message };
    }

    var centroids = grid.features.map(function (c) { return T.centroid(c); });
    var predEnv = GSX.sampleEnvMatrix(centroids, envLayers);

    grid.features.forEach(function (cell, ci) {
      var row = predEnv.matrix[ci];
      var inCount = 0, evaluated = 0, limiting = null;
      used.forEach(function (name) {
        var vi = varNames.indexOf(name);
        var v = row[vi];
        if (typeof v !== 'number' || !isFinite(v)) return;
        evaluated++;
        var e = envelopes[name];
        if (v >= e.min && v <= e.max) inCount++;
        else if (limiting === null) limiting = name;
      });
      var s;
      if (evaluated === 0) s = null;
      else if (mode === 'limiting') s = (inCount === evaluated) ? 1 : 0;
      else s = inCount / evaluated;
      cell.properties = cell.properties || {};
      cell.properties._suitability = s === null ? 0 : s;
      cell.properties._evaluated = evaluated;
      cell.properties._limiting = limiting;
      if (s === null) cell.properties._nodata = true;
    });

    return {
      ok: true, grid: grid, mode: mode, envelopes: envelopes,
      variablesUsed: used, warnings: warnings,
      cellCount: grid.features.length,
      methodNote: mode === 'limiting'
        ? 'True BIOCLIM: a cell is suitable only if EVERY variable falls inside its ' +
          Math.round(lower * 100) + '–' + Math.round(upper * 100) + '% envelope.'
        : 'Proportional envelope (NOT standard BIOCLIM): suitability is the fraction of ' +
          'variables inside their envelope.'
    };
  };

  /* ===================================================================
     4. MAHALANOBIS  (fixes 5, 6, 7, 8)
     =================================================================== */

  /**
   * opts: { output: 'chisq'|'index', cellSizeM, bufferM }
   *
   * REFUSES with fewer than 2 environmental variables. The old code
   * silently modelled lon/lat instead.
   */
  GSX.mahalanobisSDM = function (presences, envLayers, opts) {
    opts = opts || {};
    var warnings = [];

    if (!envLayers || envLayers.length < 2) {
      return { ok: false,
        error: 'Mahalanobis distance requires at least 2 environmental variables (have ' +
               (envLayers ? envLayers.length : 0) + '). With fewer, the result would ' +
               'describe geography rather than environment.' };
    }
    if (!presences || presences.length < 5) {
      return { ok: false, error: 'Needs at least 5 presence records (have ' +
               (presences ? presences.length : 0) + ').' };
    }

    var sampled = GSX.sampleEnvMatrix(presences, envLayers);
    var varNames = sampled.varNames;

    // EXCLUDE incomplete records — do not substitute 0
    var complete = [], dropped = 0;
    sampled.matrix.forEach(function (row) {
      if (row.every(function (v) { return typeof v === 'number' && isFinite(v); })) complete.push(row);
      else dropped++;
    });
    if (dropped > 0) {
      warnings.push(dropped + ' of ' + presences.length + ' presence records were incomplete ' +
                    'and were excluded (not replaced with zero).');
    }
    if (complete.length < varNames.length + 2) {
      return { ok: false, error: 'Only ' + complete.length + ' complete records for ' +
               varNames.length + ' variables — too few to estimate a covariance matrix.' };
    }

    var mean = varNames.map(function (_, i) {
      return complete.reduce(function (s, r) { return s + r[i]; }, 0) / complete.length;
    });
    var cov = GSX.covariance(complete, mean);
    var invRes = GSX.invertMatrixSafe(cov);
    if (!invRes.inv) {
      return { ok: false, error: 'Covariance matrix could not be inverted even with ' +
               'regularisation — your variables are almost certainly perfectly correlated. ' +
               'Remove one and re-run.' };
    }
    if (invRes.singular) {
      warnings.push('Covariance matrix was singular or near-singular — ridge regularisation ' +
                    '(lambda = ' + invRes.ridge.toExponential(2) + ') was applied. This ' +
                    'usually means two variables are highly correlated. Results are ' +
                    'regularised Mahalanobis, not exact.');
    }

    var bbox = T.bbox(GSX.fc(presences));
    var bufKm = (opts.bufferM != null ? opts.bufferM : 10000) / 1000;
    var grid;
    try {
      var padded = T.bbox(T.buffer(T.bboxPolygon(bbox), bufKm, { units: 'kilometers' }));
      grid = T.squareGrid(padded, (opts.cellSizeM || 1000) / 1000, { units: 'kilometers' });
    } catch (e) {
      return { ok: false, error: 'Could not build prediction grid: ' + e.message };
    }

    var centroids = grid.features.map(function (c) { return T.centroid(c); });
    var predEnv = GSX.sampleEnvMatrix(centroids, envLayers);
    var output = opts.output || 'chisq';
    var df = varNames.length;
    var noData = 0;

    grid.features.forEach(function (cell, ci) {
      var row = predEnv.matrix[ci];
      cell.properties = cell.properties || {};
      if (!row.every(function (v) { return typeof v === 'number' && isFinite(v); })) {
        cell.properties._suitability = 0;
        cell.properties._nodata = true;
        noData++;
        return;
      }
      var d2 = GSX.mahalanobisD2(row, mean, invRes.inv);
      cell.properties._d2 = d2;
      cell.properties._suitability = (output === 'chisq')
        ? GSX.chiSquareSurvival(d2, df)     // a probability, not an index
        : 1 / (1 + Math.sqrt(d2));
    });

    if (noData > 0) {
      warnings.push(noData + ' of ' + grid.features.length + ' grid cells had incomplete ' +
                    'environmental data and were set to 0.');
    }

    return {
      ok: true, grid: grid, warnings: warnings,
      variablesUsed: varNames, df: df,
      recordsUsed: complete.length, recordsDropped: dropped,
      ridge: invRes.ridge, wasSingular: invRes.singular,
      cellCount: grid.features.length,
      methodNote: output === 'chisq'
        ? 'Suitability is P(chi-square > D2) with ' + df + ' df — a probability that a ' +
          'site is as typical as the presence records.'
        : 'Suitability is 1/(1+D), a relative index. It is NOT a probability.'
    };
  };

  /* ===================================================================
     5. UI WRAPPERS
     =================================================================== */

  /** Surface warnings prominently — the whole point of this module. */
  GSX.renderSDMWarnings = function (result, hostId) {
    var host = document.getElementById(hostId || 'gsx-sdm-warnings');
    if (!host) return;
    var parts = [];
    if (result.methodNote) {
      parts.push('<div class="gsx-note"><b>Method:</b> ' + result.methodNote + '</div>');
    }
    if (result.warnings && result.warnings.length) {
      parts.push('<div class="gsx-warn"><b>⚠ ' + result.warnings.length +
        ' warning' + (result.warnings.length > 1 ? 's' : '') + '</b><ul>' +
        result.warnings.map(function (w) { return '<li>' + w + '</li>'; }).join('') +
        '</ul></div>');
    }
    host.innerHTML = parts.join('');
  };

  function collectEnvLayers() {
    var out = [];
    (root.uploadedLayers || []).forEach(function (l, i) {
      var on = document.getElementById('gsx-env-on-' + i);
      if (!on || !on.checked) return;
      var fld = document.getElementById('gsx-env-fld-' + i);
      var mth = document.getElementById('gsx-env-m-' + i);
      out.push({
        name: l.name || ('var' + i),
        features: l.geojsonFeatures || (l.geojson && l.geojson.features) || [],
        field: fld ? fld.value : null,
        method: mth ? mth.value : 'auto',
        k: 3, power: 2
      });
    });
    return out;
  }
  GSX.collectEnvLayers = collectEnvLayers;

  function presenceFeatures() {
    var id = document.getElementById('gsx-sdm-presence');
    if (!id || !id.value) return [];
    var l = (root.uploadedLayers || []).find(function (x) { return x.id === id.value; });
    if (!l) return [];
    return (l.geojsonFeatures || (l.geojson && l.geojson.features) || [])
      .filter(function (f) { return f.geometry && f.geometry.type === 'Point'; });
  }

  function renderSDMGrid(result, name) {
    var lyr = root.L.geoJSON(result.grid, {
      style: function (f) {
        return {
          fillColor: root.suitabilityColor(f.properties._suitability || 0),
          fillOpacity: f.properties._nodata ? 0.15 : 0.7,
          color: '#555', weight: 0.3
        };
      },
      onEachFeature: function (f, l) {
        var s = Math.round((f.properties._suitability || 0) * 100);
        var extra = f.properties._limiting
          ? '<br>Limiting variable: ' + f.properties._limiting : '';
        if (f.properties._nodata) extra += '<br><i>no environmental data</i>';
        l.bindPopup('<b>Suitability: ' + s + '%</b>' + extra);
      }
    });
    root.addAnalysisLayer(name, [lyr], result.grid);
  }

  GSX.uiBioclim = function () {
    var pres = presenceFeatures();
    var env = collectEnvLayers();
    var modeEl = document.getElementById('gsx-bioclim-mode');
    var cellEl = document.getElementById('gsx-sdm-cellsize');
    root.showToast('Running BIOCLIM…', 'info');
    var r = GSX.bioclim(pres, env, {
      mode: modeEl ? modeEl.value : 'limiting',
      cellSizeM: parseFloat(cellEl && cellEl.value) || 1000
    });
    if (!r.ok) { root.showToast(r.error, 'error'); return r; }
    renderSDMGrid(r, 'BIOCLIM (' + r.mode + ')');
    GSX.renderSDMWarnings(r);
    root.showToast('BIOCLIM complete — ' + r.warnings.length + ' warning(s)', 'info');
    return r;
  };

  GSX.uiMahalanobis = function () {
    var pres = presenceFeatures();
    var env = collectEnvLayers();
    var outEl = document.getElementById('gsx-maha-output');
    var cellEl = document.getElementById('gsx-sdm-cellsize');
    root.showToast('Running Mahalanobis…', 'info');
    var r = GSX.mahalanobisSDM(pres, env, {
      output: outEl ? outEl.value : 'chisq',
      cellSizeM: parseFloat(cellEl && cellEl.value) || 1000
    });
    if (!r.ok) { root.showToast(r.error, 'error'); return r; }
    renderSDMGrid(r, 'Mahalanobis (' + (outEl ? outEl.value : 'chisq') + ')');
    GSX.renderSDMWarnings(r);
    root.showToast('Mahalanobis complete — ' + r.recordsUsed + ' records, ' +
                   r.warnings.length + ' warning(s)', 'info');
    return r;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GSX;

})(typeof window !== 'undefined' ? window : globalThis);
