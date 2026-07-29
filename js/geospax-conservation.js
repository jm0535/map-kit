/* =====================================================================
   GeoSpaX — Conservation Planning Module (Milestone 1)

   P0-1  Vector overlay toolkit      (intersect / difference / union / dissolve / clip / spatial join)
   P0-2  Protection gap report
   P0-3  Hectares as a first-class unit
   P0-4  WLC rework (graded scoring, user cell size, distance decay, cost/benefit)

   Depends only on turf 6.5 (already vendored) and, for the UI wrappers,
   on existing GeoSpaX globals: uploadedLayers, addAnalysisLayer,
   getAnalysisFeatures, showToast, suitabilityColor, L.

   Pure functions (GSX.*) contain no DOM access and are unit-tested in
   test-conservation.js. UI wrappers are at the bottom.
   ===================================================================== */

(function (root) {
  'use strict';

  var T = root.turf;
  var GSX = {};

  /* ===================================================================
     P0-3 — UNITS
     =================================================================== */

  var AREA_UNITS = {
    ha:  { label: 'ha',  factor: 1 / 10000 },
    km2: { label: 'km²', factor: 1 / 1e6 },
    m2:  { label: 'm²',  factor: 1 }
  };

  /** Significant-figure formatter. Keeps 3 s.f. but never rounds a
   *  sub-10 ha figure to an integer, which would hide real change. */
  GSX.formatArea = function (m2, unit) {
    unit = unit || 'ha';
    var u = AREA_UNITS[unit] || AREA_UNITS.ha;
    var v = m2 * u.factor;
    var s;
    if (v === 0)        s = '0';
    else if (v < 10)    s = v.toFixed(2);
    else if (v < 1000)  s = v.toFixed(1);
    else                s = Math.round(v).toLocaleString();
    return { value: v, text: s, unit: u.label, display: s + ' ' + u.label };
  };

  /** Area of a Feature or FeatureCollection in m². */
  GSX.areaM2 = function (gj) {
    if (!gj) return 0;
    try { return T.area(gj); } catch (e) { return 0; }
  };

  /* ===================================================================
     Shared helpers
     =================================================================== */

  function isPolygonal(f) {
    return f && f.geometry &&
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
  }

  /** Keep only polygonal features. Returns {polys, skipped}. */
  GSX.polygonsOnly = function (features) {
    var polys = [], skipped = 0;
    (features || []).forEach(function (f) {
      if (isPolygonal(f)) polys.push(f); else skipped++;
    });
    return { polys: polys, skipped: skipped };
  };

  function fc(features) {
    return { type: 'FeatureCollection', features: features || [] };
  }
  GSX.fc = fc;

  /** Prefix a feature's properties to avoid key collisions on overlay. */
  function prefixProps(props, prefix) {
    var out = {};
    Object.keys(props || {}).forEach(function (k) {
      if (k.charAt(0) === '_') return;          // skip internal keys
      out[prefix + '_' + k] = props[k];
    });
    return out;
  }

  /** Dissolve a polygon list into a single (Multi)Polygon, or null.
   *  turf.union is pairwise in v6, so we reduce. */
  GSX.unionAll = function (features) {
    var r = GSX.polygonsOnly(features).polys;
    if (r.length === 0) return null;
    var acc = r[0];
    for (var i = 1; i < r.length; i++) {
      try {
        var u = T.union(acc, r[i]);
        if (u) acc = u;
      } catch (e) { /* skip malformed geometry rather than abort */ }
    }
    return acc;
  };

  /* ===================================================================
     P0-1 — VECTOR OVERLAY TOOLKIT
     =================================================================== */

  /**
   * Pairwise polygon overlay.
   * mode: 'intersect' | 'difference'
   *
   * Performance: booleanIntersects is used as a cheap pre-filter before
   * the expensive constructive op. Without it this is unusable above a
   * few hundred features per side.
   */
  GSX.overlay = function (featuresA, featuresB, mode) {
    var A = GSX.polygonsOnly(featuresA);
    var B = GSX.polygonsOnly(featuresB);

    if (A.polys.length === 0 || B.polys.length === 0) {
      return { ok: false, error: 'Both layers must contain polygons.',
               skippedA: A.skipped, skippedB: B.skipped };
    }

    var out = [], tested = 0, constructed = 0;

    if (mode === 'intersect') {
      A.polys.forEach(function (a) {
        B.polys.forEach(function (b) {
          tested++;
          var hit;
          try { hit = T.booleanIntersects(a, b); } catch (e) { hit = true; }
          if (!hit) return;
          var piece;
          try { piece = T.intersect(a, b); } catch (e) { piece = null; }
          if (!piece) return;                     // trap: null on no/edge overlap
          constructed++;
          piece.properties = Object.assign(
            {}, prefixProps(a.properties, 'a'), prefixProps(b.properties, 'b'));
          piece.properties.area_m2 = GSX.areaM2(piece);
          out.push(piece);
        });
      });
    } else if (mode === 'difference') {
      // A minus ALL of B — union B once so the result is a true complement.
      var bAll = GSX.unionAll(B.polys);
      A.polys.forEach(function (a) {
        tested++;
        var piece;
        try { piece = bAll ? T.difference(a, bAll) : a; } catch (e) { piece = null; }
        if (!piece) return;                       // fully consumed by B
        constructed++;
        piece.properties = Object.assign({}, prefixProps(a.properties, 'a'));
        piece.properties.area_m2 = GSX.areaM2(piece);
        out.push(piece);
      });
    } else {
      return { ok: false, error: 'Unknown overlay mode: ' + mode };
    }

    return {
      ok: true,
      features: out,
      featureCount: out.length,
      totalAreaM2: out.reduce(function (s, f) { return s + GSX.areaM2(f); }, 0),
      pairsTested: tested,
      pairsConstructed: constructed,
      skippedA: A.skipped,
      skippedB: B.skipped
    };
  };

  /** Dissolve by an optional property. turf.dissolve requires Polygon
   *  (not MultiPolygon), so MultiPolygons are exploded first. */
  GSX.dissolve = function (features, propertyName) {
    var polys = [];
    GSX.polygonsOnly(features).polys.forEach(function (f) {
      if (f.geometry.type === 'Polygon') { polys.push(f); return; }
      f.geometry.coordinates.forEach(function (coords) {
        polys.push({ type: 'Feature', properties: Object.assign({}, f.properties),
                     geometry: { type: 'Polygon', coordinates: coords } });
      });
    });
    if (polys.length === 0) return { ok: false, error: 'No polygons to dissolve.' };
    try {
      var opts = propertyName ? { propertyName: propertyName } : {};
      var d = T.dissolve(fc(polys), opts);
      d.features.forEach(function (f) {
        f.properties = f.properties || {};
        f.properties.area_m2 = GSX.areaM2(f);
      });
      return { ok: true, features: d.features, featureCount: d.features.length,
               totalAreaM2: GSX.areaM2(d) };
    } catch (e) {
      return { ok: false, error: 'Dissolve failed: ' + e.message };
    }
  };

  /** Spatial join: copy a field from polygons onto the points inside them. */
  GSX.spatialJoin = function (pointFeatures, polygonFeatures, field, outField) {
    var pts = (pointFeatures || []).filter(function (f) {
      return f.geometry && f.geometry.type === 'Point';
    });
    var polys = GSX.polygonsOnly(polygonFeatures).polys;
    if (pts.length === 0) return { ok: false, error: 'First layer must contain points.' };
    if (polys.length === 0) return { ok: false, error: 'Second layer must contain polygons.' };

    var target = outField || field;
    var matched = 0;
    var out = pts.map(function (p) {
      var copy = { type: 'Feature', geometry: p.geometry,
                   properties: Object.assign({}, p.properties) };
      for (var i = 0; i < polys.length; i++) {
        var inside;
        try { inside = T.booleanPointInPolygon(p, polys[i]); } catch (e) { inside = false; }
        if (inside) {
          copy.properties[target] =
            polys[i].properties ? polys[i].properties[field] : null;
          matched++;
          break;
        }
      }
      if (!(target in copy.properties)) copy.properties[target] = null;
      return copy;
    });
    return { ok: true, features: out, featureCount: out.length,
             matched: matched, unmatched: out.length - matched };
  };

  /* ===================================================================
     P0-2 — PROTECTION GAP
     =================================================================== */

  /**
   * habitat: species habitat / range polygons
   * pas:     protected-area polygons
   *
   * Returns protected + gap geometry and the summary the rubric asks for.
   */
  GSX.protectionGap = function (habitatFeatures, paFeatures) {
    var hab = GSX.unionAll(habitatFeatures);
    if (!hab) return { ok: false, error: 'Habitat layer contains no polygons.' };
    var pas = GSX.unionAll(paFeatures);
    if (!pas) return { ok: false, error: 'Protected-area layer contains no polygons.' };

    var protectedGeom = null, gapGeom = null;
    try { protectedGeom = T.intersect(hab, pas); } catch (e) { protectedGeom = null; }
    try { gapGeom = T.difference(hab, pas); } catch (e) { gapGeom = null; }

    var totalM2 = GSX.areaM2(hab);
    var protM2  = protectedGeom ? GSX.areaM2(protectedGeom) : 0;
    var gapM2   = gapGeom ? GSX.areaM2(gapGeom) : (protectedGeom ? 0 : totalM2);

    // Which individual PAs are actually involved — useful in Part B.
    var intersecting = [];
    GSX.polygonsOnly(paFeatures).polys.forEach(function (p) {
      var hit;
      try { hit = T.booleanIntersects(hab, p); } catch (e) { hit = false; }
      if (hit) {
        var nm = p.properties && (p.properties.name || p.properties.NAME ||
                 p.properties.pa_name || p.properties.Name);
        intersecting.push(nm || '(unnamed)');
      }
    });

    if (protectedGeom) {
      protectedGeom.properties = { class: 'protected', area_m2: protM2 };
    }
    if (gapGeom) {
      gapGeom.properties = { class: 'gap', area_m2: gapM2 };
    }

    return {
      ok: true,
      protectedGeom: protectedGeom,
      gapGeom: gapGeom,
      totalAreaM2: totalM2,
      protectedAreaM2: protM2,
      gapAreaM2: gapM2,
      protectedPct: totalM2 > 0 ? (protM2 / totalM2) * 100 : 0,
      gapPct: totalM2 > 0 ? (gapM2 / totalM2) * 100 : 0,
      paCount: intersecting.length,
      paNames: intersecting,
      // Closure check — surfaced so a bad geometry cannot pass silently.
      residualPct: totalM2 > 0
        ? Math.abs((protM2 + gapM2) - totalM2) / totalM2 * 100 : 0
    };
  };

  /* ===================================================================
     P0-4 — WLC REWORK
     =================================================================== */

  /** Rescale an array of raw scores to 0–1 (linear min–max). */
  GSX.rescale01 = function (values) {
    var finite = values.filter(function (v) { return typeof v === 'number' && isFinite(v); });
    if (finite.length === 0) return values.map(function () { return 0; });
    var mn = Math.min.apply(null, finite), mx = Math.max.apply(null, finite);
    if (mx === mn) return values.map(function () { return mx > 0 ? 1 : 0; });
    return values.map(function (v) {
      if (typeof v !== 'number' || !isFinite(v)) return 0;
      return (v - mn) / (mx - mn);
    });
  };

  /**
   * Raw (un-rescaled) score of one criterion at one cell centroid.
   *
   * method: 'presence'  1 if the cell centroid falls in / intersects a feature
   *         'distance'  linear decay: max(0, 1 - d/dmax)
   *         'density'   points in cell radius / saturation
   *         'attribute' numeric field of the nearest feature
   */
  GSX.criterionScore = function (centroid, layerFeatures, opts) {
    opts = opts || {};
    var method = opts.method || 'presence';
    var feats = layerFeatures || [];
    if (feats.length === 0) return 0;

    if (method === 'presence') {
      for (var i = 0; i < feats.length; i++) {
        try {
          if (isPolygonal(feats[i])) {
            if (T.booleanPointInPolygon(centroid, feats[i])) return 1;
          } else if (feats[i].geometry && feats[i].geometry.type === 'Point') {
            if (T.distance(centroid, feats[i], { units: 'meters' }) <= (opts.tolerance || 0)) return 1;
          }
        } catch (e) { /* ignore malformed feature */ }
      }
      return 0;
    }

    if (method === 'distance') {
      var dmax = opts.dmax || 1000;                       // metres
      var d = GSX.nearestDistanceM(centroid, feats);
      if (d === null) return 0;
      return Math.max(0, 1 - (d / dmax));
    }

    if (method === 'density') {
      var radius = opts.radius || 1000;                   // metres
      var sat = opts.saturation || 5;                     // user-set, replaces hardcoded 5
      var n = 0;
      feats.forEach(function (f) {
        if (!f.geometry || f.geometry.type !== 'Point') return;
        try {
          if (T.distance(centroid, f, { units: 'meters' }) <= radius) n++;
        } catch (e) { /* skip */ }
      });
      return Math.min(1, n / sat);
    }

    if (method === 'attribute') {
      var field = opts.field;
      var nearest = GSX.nearestFeature(centroid, feats);
      if (!nearest || !nearest.properties) return null;
      var v = nearest.properties[field];
      return (typeof v === 'number' && isFinite(v)) ? v : null;
    }

    return 0;
  };

  /** Shortest distance in metres from a point to any feature. */
  GSX.nearestDistanceM = function (pt, feats) {
    var best = null;
    feats.forEach(function (f) {
      if (!f.geometry) return;
      var d = null;
      try {
        if (f.geometry.type === 'Point') {
          d = T.distance(pt, f, { units: 'meters' });
        } else if (isPolygonal(f)) {
          if (T.booleanPointInPolygon(pt, f)) { d = 0; }
          else {
            var ln = T.polygonToLine(f);
            var lines = ln.type === 'FeatureCollection' ? ln.features : [ln];
            lines.forEach(function (l) {
              var dd = T.pointToLineDistance(pt, l, { units: 'meters' });
              if (d === null || dd < d) d = dd;
            });
          }
        } else if (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') {
          d = T.pointToLineDistance(pt, f, { units: 'meters' });
        }
      } catch (e) { d = null; }
      if (d !== null && (best === null || d < best)) best = d;
    });
    return best;
  };

  GSX.nearestFeature = function (pt, feats) {
    var best = null, bestD = Infinity;
    feats.forEach(function (f) {
      if (!f.geometry) return;
      var c;
      try { c = T.centroid(f); } catch (e) { return; }
      var d;
      try { d = T.distance(pt, c, { units: 'meters' }); } catch (e) { return; }
      if (d < bestD) { bestD = d; best = f; }
    });
    return best;
  };

  /**
   * Weighted Linear Combination.
   *
   * criteria: [{ name, features, weight, method, direction:'benefit'|'cost',
   *              dmax, radius, saturation, field }]
   * bbox:     [minLng, minLat, maxLng, maxLat]
   * cellSizeM: cell side in metres (user-set — no hardcoded 22 km)
   * constraintFeatures: polygons forcing suitability to 0
   */
  GSX.runWLC = function (criteria, bbox, cellSizeM, constraintFeatures) {
    if (!criteria || criteria.length === 0) {
      return { ok: false, error: 'Select at least one criterion.' };
    }
    var cellKm = (cellSizeM || 500) / 1000;
    var grid;
    try {
      grid = T.squareGrid(bbox, cellKm, { units: 'kilometers' });
    } catch (e) {
      return { ok: false, error: 'Could not build grid: ' + e.message };
    }
    if (grid.features.length === 0) {
      return { ok: false, error: 'Grid is empty — check extent and cell size.' };
    }

    var centroids = grid.features.map(function (c) { return T.centroid(c); });

    // 1. raw score per criterion per cell
    var rawByCriterion = criteria.map(function (crit) {
      return centroids.map(function (ct) {
        return GSX.criterionScore(ct, crit.features, crit);
      });
    });

    // 2. rescale to 0-1, then apply cost/benefit direction
    var scaled = rawByCriterion.map(function (raw, i) {
      var s = (criteria[i].method === 'attribute')
        ? GSX.rescale01(raw.map(function (v) { return v === null ? NaN : v; }))
        : raw.map(function (v) { return Math.max(0, Math.min(1, v || 0)); });
      if (criteria[i].direction === 'cost') {
        s = s.map(function (v) { return 1 - v; });
      }
      return s;
    });

    // 3. normalised weights
    var totalW = criteria.reduce(function (s, c) { return s + (c.weight || 1); }, 0);
    var normW = criteria.map(function (c) { return (c.weight || 1) / (totalW || 1); });

    // 4. combine
    var constraint = constraintFeatures && constraintFeatures.length
      ? GSX.polygonsOnly(constraintFeatures).polys : [];

    grid.features.forEach(function (cell, ci) {
      var s = 0;
      for (var k = 0; k < criteria.length; k++) s += scaled[k][ci] * normW[k];

      if (constraint.length) {
        for (var j = 0; j < constraint.length; j++) {
          var hit;
          try { hit = T.booleanPointInPolygon(centroids[ci], constraint[j]); }
          catch (e) { hit = false; }
          if (hit) { s = 0; break; }
        }
      }
      cell.properties = cell.properties || {};
      cell.properties._suitability = Math.max(0, Math.min(1, s));
      criteria.forEach(function (c, k) {
        cell.properties['crit_' + (c.name || k)] = Math.round(scaled[k][ci] * 1000) / 1000;
      });
    });

    // 5. the transparency table that makes the method markable
    var table = criteria.map(function (c, i) {
      return {
        criterion: c.name || ('criterion ' + (i + 1)),
        method: c.method || 'presence',
        direction: c.direction || 'benefit',
        parameter: c.method === 'distance' ? ('dmax ' + (c.dmax || 1000) + ' m')
                 : c.method === 'density'  ? ('radius ' + (c.radius || 1000) +
                                              ' m, saturation ' + (c.saturation || 5))
                 : c.method === 'attribute' ? ('field ' + c.field)
                 : '—',
        rawWeight: c.weight || 1,
        normalisedWeight: Math.round(normW[i] * 1000) / 1000
      };
    });

    return { ok: true, grid: grid, cellCount: grid.features.length,
             cellSizeM: cellSizeM, criteriaTable: table };
  };

  /* ===================================================================
     UI WRAPPERS  (DOM-dependent — not unit-tested)
     =================================================================== */

  function layerById(id) {
    return (root.uploadedLayers || []).find(function (l) { return l.id === id; });
  }
  function featuresOf(id) {
    var l = layerById(id);
    if (!l) return [];
    return l.geojsonFeatures || (l.geojson && l.geojson.features) || [];
  }
  function nameOf(id) {
    var l = layerById(id);
    return l ? l.name : '(layer)';
  }
  function unitPref() {
    try { return root.localStorage.getItem('gsx_area_unit') || 'ha'; }
    catch (e) { return 'ha'; }
  }
  GSX.setAreaUnit = function (u) {
    try { root.localStorage.setItem('gsx_area_unit', u); } catch (e) {}
  };

  function twoLayers() {
    var a = document.getElementById('analysis-layer-select').value;
    var b = document.getElementById('analysis-layer-select-b').value;
    if (!a || !b) { root.showToast('Select two layers', 'error'); return null; }
    if (a === b)  { root.showToast('Select two different layers', 'error'); return null; }
    return { aId: a, bId: b, a: featuresOf(a), b: featuresOf(b),
             aName: nameOf(a), bName: nameOf(b) };
  }

  function styleFor(color) {
    return { color: color, weight: 1.5, fillColor: color, fillOpacity: 0.45 };
  }

  GSX.uiOverlay = function (mode) {
    var L2 = twoLayers(); if (!L2) return;
    root.showToast('Running ' + mode + '…', 'info');
    var res = GSX.overlay(L2.a, L2.b, mode);
    if (!res.ok) { root.showToast(res.error, 'error'); return; }
    if (res.features.length === 0) {
      root.showToast('No ' + mode + ' result — layers may not overlap', 'error'); return;
    }
    var color = mode === 'intersect' ? '#38a169' : '#e53e3e';
    var lyr = root.L.geoJSON(GSX.fc(res.features), { style: styleFor(color) });
    root.addAnalysisLayer(
      (mode === 'intersect' ? 'Intersect: ' : 'Difference: ') + L2.aName + ' / ' + L2.bName,
      [lyr], GSX.fc(res.features));
    var a = GSX.formatArea(res.totalAreaM2, unitPref());
    root.showToast(res.featureCount + ' features, ' + a.display, 'info');
    return res;
  };

  GSX.uiDissolve = function () {
    var id = document.getElementById('analysis-layer-select').value;
    if (!id) { root.showToast('Select a layer first', 'error'); return; }
    var fieldEl = document.getElementById('gsx-dissolve-field');
    var field = fieldEl && fieldEl.value ? fieldEl.value : null;
    var res = GSX.dissolve(featuresOf(id), field);
    if (!res.ok) { root.showToast(res.error, 'error'); return; }
    var lyr = root.L.geoJSON(GSX.fc(res.features), { style: styleFor('#3182ce') });
    root.addAnalysisLayer('Dissolve: ' + nameOf(id), [lyr], GSX.fc(res.features));
    root.showToast(res.featureCount + ' features after dissolve', 'info');
    return res;
  };

  GSX.uiProtectionGap = function () {
    var L2 = twoLayers(); if (!L2) return;
    root.showToast('Computing protection gap…', 'info');
    var res = GSX.protectionGap(L2.a, L2.b);
    if (!res.ok) { root.showToast(res.error, 'error'); return; }

    var unit = unitPref();
    if (res.protectedGeom) {
      root.addAnalysisLayer('Habitat — protected',
        [root.L.geoJSON(res.protectedGeom, { style: styleFor('#2f855a') })],
        GSX.fc([res.protectedGeom]));
    }
    if (res.gapGeom) {
      root.addAnalysisLayer('Habitat — gap (unprotected)',
        [root.L.geoJSON(res.gapGeom, { style: styleFor('#c53030') })],
        GSX.fc([res.gapGeom]));
    }

    res.summaryRows = [
      ['Total habitat area',            GSX.formatArea(res.totalAreaM2, unit).display],
      ['Inside protected areas',        GSX.formatArea(res.protectedAreaM2, unit).display],
      ['Outside protected areas (gap)', GSX.formatArea(res.gapAreaM2, unit).display],
      ['Protected proportion',          res.protectedPct.toFixed(1) + ' %'],
      ['Protected areas intersected',   res.paCount + (res.paNames.length ? ' — ' + res.paNames.join(', ') : '')]
    ];
    if (res.residualPct > 0.5) {
      res.summaryRows.push(['⚠ Geometry check',
        'protected + gap differs from total by ' + res.residualPct.toFixed(2) +
        '% — check for invalid geometry']);
    }
    res.caption = 'Protection gap is computed on mapped extent only; ' +
                  'it does not account for management effectiveness.';
    root.showToast('Protected ' + res.protectedPct.toFixed(1) + '% of habitat', 'info');
    return res;
  };

  /* ===================================================================
     P0-4 UI — WLC PANEL
     Replaces the old runSuitabilityWLC() entirely.
     =================================================================== */

  var WLC_METHODS = [
    ['presence',  'Presence / absence'],
    ['distance',  'Distance decay'],
    ['density',   'Point density'],
    ['attribute', 'Attribute value']
  ];

  /** Numeric fields present on a layer, for the attribute method. */
  function numericFields(features) {
    var keys = {};
    (features || []).slice(0, 50).forEach(function (f) {
      Object.keys(f.properties || {}).forEach(function (k) {
        if (k.charAt(0) === '_') return;
        if (typeof f.properties[k] === 'number' && isFinite(f.properties[k])) keys[k] = true;
      });
    });
    return Object.keys(keys);
  }

  /** Rebuild the criterion rows. Call on panel open and on layer change. */
  GSX.renderWLCPanel = function (containerId) {
    var host = document.getElementById(containerId || 'gsx-wlc-criteria');
    if (!host) return;
    var layers = root.uploadedLayers || [];
    if (layers.length === 0) {
      host.innerHTML = '<div class="ad-hint">Import layers to use as criteria.</div>';
      return;
    }
    host.innerHTML = layers.map(function (l, i) {
      var feats = l.geojsonFeatures || (l.geojson && l.geojson.features) || [];
      var fields = numericFields(feats);
      return '' +
      '<div class="gsx-crit" data-idx="' + i + '" data-layer="' + l.id + '">' +
        '<div class="ad-row">' +
          '<label><input type="checkbox" id="gsx-c-on-' + i + '"> ' +
            (l.name || 'Layer ' + (i + 1)) + '</label>' +
        '</div>' +
        '<div class="ad-row">' +
          '<label>Weight</label>' +
          '<input id="gsx-c-wt-' + i + '" type="number" value="1" min="0" step="0.1" class="gsx-narrow">' +
          '<label>Method</label>' +
          '<select id="gsx-c-m-' + i + '" onchange="GSX.onWLCMethodChange(' + i + ')">' +
            WLC_METHODS.map(function (m) {
              return '<option value="' + m[0] + '">' + m[1] + '</option>';
            }).join('') +
          '</select>' +
          '<label>Direction</label>' +
          '<select id="gsx-c-d-' + i + '">' +
            '<option value="benefit">Benefit (more is better)</option>' +
            '<option value="cost">Cost (less is better)</option>' +
          '</select>' +
        '</div>' +
        '<div class="ad-row gsx-c-params" id="gsx-c-p-' + i + '">' +
          '<span id="gsx-c-pd-' + i + '" style="display:none">' +
            '<label>Max distance (m)</label>' +
            '<input id="gsx-c-dmax-' + i + '" type="number" value="1000" min="1" class="gsx-mid">' +
          '</span>' +
          '<span id="gsx-c-pn-' + i + '" style="display:none">' +
            '<label>Radius (m)</label>' +
            '<input id="gsx-c-rad-' + i + '" type="number" value="1000" min="1" class="gsx-mid">' +
            '<label>Saturation</label>' +
            '<input id="gsx-c-sat-' + i + '" type="number" value="5" min="1" class="gsx-narrow">' +
          '</span>' +
          '<span id="gsx-c-pa-' + i + '" style="display:none">' +
            '<label>Field</label>' +
            '<select id="gsx-c-fld-' + i + '">' +
              (fields.length
                ? fields.map(function (f) { return '<option value="' + f + '">' + f + '</option>'; }).join('')
                : '<option value="">(no numeric fields)</option>') +
            '</select>' +
          '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  };

  GSX.onWLCMethodChange = function (i) {
    var m = document.getElementById('gsx-c-m-' + i);
    if (!m) return;
    var show = { distance: 'pd', density: 'pn', attribute: 'pa' };
    ['pd', 'pn', 'pa'].forEach(function (k) {
      var el = document.getElementById('gsx-c-' + k + '-' + i);
      if (el) el.style.display = (show[m.value] === k) ? '' : 'none';
    });
  };

  /** Live cell-count preview. Students otherwise set 100 m over a province. */
  GSX.updateWLCCellCount = function () {
    var out = document.getElementById('gsx-wlc-cellcount');
    if (!out) return;
    var crits = GSX.collectWLCCriteria();
    if (!crits.length) { out.textContent = 'Select at least one criterion.'; return; }
    var sizeEl = document.getElementById('gsx-wlc-cellsize');
    var cellM = parseFloat(sizeEl && sizeEl.value) || 500;
    var bbox = GSX.criteriaBBox(crits);
    if (!bbox) { out.textContent = 'No usable geometry in selected layers.'; return; }
    // metres per degree at this latitude
    var midLat = (bbox[1] + bbox[3]) / 2;
    var mPerDegLat = 110574;
    var mPerDegLng = 111320 * Math.cos(midLat * Math.PI / 180);
    var nx = Math.ceil(((bbox[2] - bbox[0]) * mPerDegLng) / cellM);
    var ny = Math.ceil(((bbox[3] - bbox[1]) * mPerDegLat) / cellM);
    var n = Math.max(0, nx * ny);
    var msg = '≈ ' + n.toLocaleString() + ' cells (' + nx + ' × ' + ny + ')';
    if (n > 50000) {
      msg += '  ⚠ very large — expect a long wait, consider a bigger cell size';
      out.style.color = '#c53030';
    } else if (n > 20000) {
      msg += '  ⚠ large — this may take several seconds';
      out.style.color = '#b7791f';
    } else {
      out.style.color = '';
    }
    out.textContent = msg;
    return n;
  };

  GSX.criteriaBBox = function (criteria) {
    var all = [];
    criteria.forEach(function (c) { all = all.concat(c.features || []); });
    if (all.length === 0) return null;
    try { return T.bbox(fc(all)); } catch (e) { return null; }
  };

  /** Read the panel into the criteria array runWLC expects. */
  GSX.collectWLCCriteria = function () {
    var out = [];
    (root.uploadedLayers || []).forEach(function (l, i) {
      var on = document.getElementById('gsx-c-on-' + i);
      if (!on || !on.checked) return;
      var g = function (id) { return document.getElementById(id + '-' + i); };
      var method = (g('gsx-c-m') || {}).value || 'presence';
      out.push({
        name: l.name || ('layer' + i),
        features: l.geojsonFeatures || (l.geojson && l.geojson.features) || [],
        weight: parseFloat((g('gsx-c-wt') || {}).value) || 1,
        method: method,
        direction: (g('gsx-c-d') || {}).value || 'benefit',
        dmax: parseFloat((g('gsx-c-dmax') || {}).value) || 1000,
        radius: parseFloat((g('gsx-c-rad') || {}).value) || 1000,
        saturation: parseFloat((g('gsx-c-sat') || {}).value) || 5,
        field: (g('gsx-c-fld') || {}).value || null
      });
    });
    return out;
  };

  /**
   * REPLACEMENT for the original runSuitabilityWLC().
   * Delete the old function — leaving it in place preserves a route back to
   * the 22 km binary map.
   */
  GSX.runSuitabilityWLC = function () {
    var criteria = GSX.collectWLCCriteria();
    if (criteria.length === 0) {
      root.showToast('Select at least one criterion layer', 'error'); return;
    }
    var bad = criteria.filter(function (c) {
      return c.method === 'attribute' && !c.field;
    });
    if (bad.length) {
      root.showToast('Choose a numeric field for: ' + bad.map(function (c) { return c.name; }).join(', '), 'error');
      return;
    }

    var sizeEl = document.getElementById('gsx-wlc-cellsize');
    var cellM = parseFloat(sizeEl && sizeEl.value) || 500;
    var bbox = GSX.criteriaBBox(criteria);
    if (!bbox) { root.showToast('No usable geometry in selected layers', 'error'); return; }

    var n = GSX.updateWLCCellCount();
    if (n > 50000 && !root.confirm('This will build about ' + n.toLocaleString() +
        ' cells and may take a long time. Continue?')) return;

    var constrEl = document.getElementById('gsx-wlc-constraint');
    var constraint = null;
    if (constrEl && constrEl.value) {
      var cl = layerById(constrEl.value);
      if (cl) constraint = cl.geojsonFeatures || (cl.geojson && cl.geojson.features) || [];
    }

    root.showToast('Running WLC on ' + criteria.length + ' criteria…', 'info');

    // Yield once so the toast paints before the synchronous grid build.
    root.setTimeout(function () {
      var res = GSX.runWLC(criteria, bbox, cellM, constraint);
      if (!res.ok) { root.showToast(res.error, 'error'); return; }

      var lyr = root.L.geoJSON(res.grid, {
        style: function (f) {
          return {
            fillColor: root.suitabilityColor(f.properties._suitability || 0),
            fillOpacity: 0.7, color: '#555', weight: 0.3
          };
        },
        onEachFeature: function (f, l) {
          l.bindPopup('<b>Suitability: ' +
            Math.round((f.properties._suitability || 0) * 100) + '%</b>');
        }
      });
      root.addAnalysisLayer('WLC Suitability (' + cellM + ' m)', [lyr], res.grid);

      GSX.renderCriteriaTable(res.criteriaTable);
      root.showToast('WLC complete — ' + res.cellCount.toLocaleString() + ' cells', 'info');
    }, 30);
  };

  /** Render the transparency table. This is what makes the method markable. */
  GSX.renderCriteriaTable = function (rows) {
    var host = document.getElementById('gsx-wlc-table');
    if (!host || !rows) return;
    host.innerHTML =
      '<table class="gsx-table"><thead><tr>' +
      '<th>Criterion</th><th>Method</th><th>Direction</th>' +
      '<th>Parameter</th><th>Weight</th><th>Normalised</th>' +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + r.criterion + '</td><td>' + r.method + '</td>' +
               '<td>' + r.direction + '</td><td>' + r.parameter + '</td>' +
               '<td>' + r.rawWeight + '</td><td>' + r.normalisedWeight + '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<div class="ad-hint">Record these settings in your method — the map cannot be ' +
      'interpreted without them.</div>';
  };

  root.GSX = GSX;

  if (typeof module !== 'undefined' && module.exports) module.exports = GSX;

})(typeof window !== 'undefined' ? window : globalThis);
