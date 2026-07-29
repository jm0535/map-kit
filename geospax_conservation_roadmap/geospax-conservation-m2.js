/* =====================================================================
   GeoSpaX — Conservation Planning Module, Milestone 2

   P1-4b  Equal-area reporting mode      (proj4 LAEA, auto-centred)
   P1-5   Fragmentation / patch metrics  (NP, CA, LPI, TE, ED, MSI, core, CAI, ENN)
   P1-6   Connectivity graph             (components at threshold distance)
   P1-7   Two-date change detection      (loss / gain / persistence + annual rate)

   Extends window.GSX. Load AFTER geospax-conservation.js.
   Depends on turf 6.5 and proj4 — both already vendored.
   ===================================================================== */

(function (root) {
  'use strict';

  var T = root.turf;
  var GSX = root.GSX;
  if (!GSX) throw new Error('geospax-conservation.js must load first');

  var proj4 = root.proj4 ||
    (typeof require !== 'undefined' ? require('/tmp/mapkit/vendor/proj4/proj4.js') : null);

  var WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

  /* ===================================================================
     P1-4b — EQUAL-AREA REPORTING
     =================================================================== */

  /** Lambert Azimuthal Equal-Area centred on the data. */
  GSX.laeaFor = function (features) {
    var bbox;
    try { bbox = T.bbox(GSX.fc(features)); } catch (e) { return null; }
    if (!bbox || !isFinite(bbox[0])) return null;
    var lat0 = ((bbox[1] + bbox[3]) / 2).toFixed(4);
    var lon0 = ((bbox[0] + bbox[2]) / 2).toFixed(4);
    return {
      proj: '+proj=laea +lat_0=' + lat0 + ' +lon_0=' + lon0 +
            ' +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
      label: 'LAEA centred ' + lat0 + ', ' + lon0
    };
  };

  /** Planar ring area (shoelace), metres² once projected. */
  function ringArea(ring) {
    var a = 0;
    for (var i = 0, n = ring.length - 1; i < n; i++) {
      a += (ring[i][0] * ring[i + 1][1]) - (ring[i + 1][0] * ring[i][1]);
    }
    return Math.abs(a / 2);
  }

  function projectRing(ring, projDef) {
    return ring.map(function (c) { return proj4(WGS84, projDef, [c[0], c[1]]); });
  }

  /** Area of one polygonal feature under an equal-area projection. */
  GSX.areaEqualAreaM2 = function (feature, projDef) {
    if (!feature || !feature.geometry) return 0;
    var g = feature.geometry, total = 0;
    var polys = g.type === 'Polygon' ? [g.coordinates]
              : g.type === 'MultiPolygon' ? g.coordinates : [];
    polys.forEach(function (rings) {
      rings.forEach(function (ring, ri) {
        var a = ringArea(projectRing(ring, projDef));
        total += (ri === 0 ? a : -a);      // subtract interior rings
      });
    });
    return Math.max(0, total);
  };

  /**
   * Area of a feature list under the chosen method.
   * mode: 'spherical' (turf, default) | 'equalarea'
   * Returns { m2, method, crs }.
   */
  GSX.measureArea = function (features, mode) {
    var list = [].concat(features || []);
    if (mode === 'equalarea' && proj4) {
      var p = GSX.laeaFor(list);
      if (p) {
        var m2 = list.reduce(function (s, f) {
          return s + GSX.areaEqualAreaM2(f, p.proj);
        }, 0);
        return { m2: m2, method: 'Equal-area (LAEA)', crs: p.label };
      }
    }
    return {
      m2: GSX.areaM2(GSX.fc(list)),
      method: 'Spherical (WGS84)',
      crs: 'EPSG:4326'
    };
  };

  /* ===================================================================
     P1-5 — FRAGMENTATION / PATCH METRICS
     =================================================================== */

  /** Perimeter of a polygonal feature in metres. */
  GSX.perimeterM = function (feature) {
    try {
      var ln = T.polygonToLine(feature);
      var lines = ln.type === 'FeatureCollection' ? ln.features : [ln];
      return lines.reduce(function (s, l) {
        return s + T.length(l, { units: 'kilometers' }) * 1000;
      }, 0);
    } catch (e) { return 0; }
  };

  /**
   * opts: { coreDepthM = 100, areaMode = 'spherical'|'equalarea',
   *         dissolveTouching = false }
   */
  GSX.fragmentation = function (features, opts) {
    opts = opts || {};
    var depth = opts.coreDepthM != null ? opts.coreDepthM : 100;
    var src = GSX.polygonsOnly(features);
    if (src.polys.length === 0) {
      return { ok: false, error: 'Layer contains no polygons.' };
    }

    var polys = src.polys;
    if (opts.dissolveTouching) {
      var d = GSX.dissolve(polys, null);
      if (d.ok) polys = d.features;
    }

    var areaInfo = GSX.measureArea(polys, opts.areaMode);
    var areas = polys.map(function (p) {
      return opts.areaMode === 'equalarea' && proj4
        ? GSX.areaEqualAreaM2(p, GSX.laeaFor(polys).proj)
        : GSX.areaM2(p);
    });
    var totalM2 = areas.reduce(function (s, a) { return s + a; }, 0);
    var perims = polys.map(GSX.perimeterM);
    var totalEdgeM = perims.reduce(function (s, p) { return s + p; }, 0);

    // core areas — turf.buffer returns undefined when the patch is narrower
    // than 2 x depth. That is a real ecological result, not an error.
    var coreFeatures = [], coreM2 = 0, noCoreCount = 0;
    polys.forEach(function (p, i) {
      var c = null;
      try { c = T.buffer(p, -depth, { units: 'meters' }); } catch (e) { c = null; }
      if (!c || !c.geometry ||
          (c.geometry.coordinates && c.geometry.coordinates.length === 0)) {
        noCoreCount++;
        return;
      }
      var a = GSX.areaM2(c);
      if (a <= 0) { noCoreCount++; return; }
      c.properties = Object.assign({}, p.properties, { core_area_m2: a, core_depth_m: depth });
      coreFeatures.push(c);
      coreM2 += a;
    });

    // mean shape index — 1.0 for a perfect circle
    var msi = polys.length
      ? polys.reduce(function (s, p, i) {
          var a = areas[i];
          return s + (a > 0 ? perims[i] / (2 * Math.sqrt(Math.PI * a)) : 0);
        }, 0) / polys.length
      : 0;

    // Euclidean nearest-neighbour distance between patch centroids
    var centroids = polys.map(function (p) { return T.centroid(p); });
    var enn = [];
    for (var i = 0; i < centroids.length; i++) {
      var best = null;
      for (var j = 0; j < centroids.length; j++) {
        if (i === j) continue;
        var dd;
        try { dd = T.distance(centroids[i], centroids[j], { units: 'meters' }); }
        catch (e) { continue; }
        if (best === null || dd < best) best = dd;
      }
      if (best !== null) enn.push(best);
    }

    var sorted = areas.slice().sort(function (a, b) { return a - b; });
    var median = sorted.length
      ? (sorted.length % 2
          ? sorted[(sorted.length - 1) / 2]
          : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
      : 0;
    var largest = sorted.length ? sorted[sorted.length - 1] : 0;
    var totalHa = totalM2 / 10000;

    return {
      ok: true,
      numPatches: polys.length,
      totalAreaM2: totalM2,
      meanPatchM2: polys.length ? totalM2 / polys.length : 0,
      medianPatchM2: median,
      largestPatchM2: largest,
      largestPatchIndex: totalM2 > 0 ? (largest / totalM2) * 100 : 0,
      totalEdgeM: totalEdgeM,
      edgeDensityMPerHa: totalHa > 0 ? totalEdgeM / totalHa : 0,
      meanShapeIndex: msi,
      coreDepthM: depth,
      coreAreaM2: coreM2,
      coreAreaIndex: totalM2 > 0 ? (coreM2 / totalM2) * 100 : 0,
      patchesWithNoCore: noCoreCount,
      meanNearestNeighbourM: enn.length
        ? enn.reduce(function (s, v) { return s + v; }, 0) / enn.length : null,
      coreFeatures: coreFeatures,
      areaMethod: areaInfo.method,
      areaCRS: areaInfo.crs,
      skipped: src.skipped
    };
  };

  /* ===================================================================
     P1-6 — CONNECTIVITY GRAPH
     =================================================================== */

  /** thresholdM: patches whose centroids are within this distance are linked. */
  GSX.connectivity = function (features, thresholdM) {
    var d = thresholdM || 500;
    var src = GSX.polygonsOnly(features);
    if (src.polys.length === 0) {
      return { ok: false, error: 'Layer contains no polygons.' };
    }
    var polys = src.polys;
    var centroids = polys.map(function (p) { return T.centroid(p); });
    var n = polys.length;

    // union-find
    var parent = [];
    for (var i = 0; i < n; i++) parent[i] = i;
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function join(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; }

    var links = [];
    for (var a = 0; a < n; a++) {
      for (var b = a + 1; b < n; b++) {
        var dist;
        try { dist = T.distance(centroids[a], centroids[b], { units: 'meters' }); }
        catch (e) { continue; }
        if (dist <= d) {
          join(a, b);
          links.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [
              centroids[a].geometry.coordinates, centroids[b].geometry.coordinates] },
            properties: { from: a, to: b, dist_m: Math.round(dist) }
          });
        }
      }
    }

    // components
    var groups = {};
    for (var k = 0; k < n; k++) {
      var r = find(k);
      (groups[r] = groups[r] || []).push(k);
    }
    var comps = Object.keys(groups).map(function (r) { return groups[r]; });
    comps.sort(function (x, y) { return y.length - x.length; });

    var compOf = {};
    comps.forEach(function (members, ci) {
      members.forEach(function (m) { compOf[m] = ci; });
    });

    var tagged = polys.map(function (p, i) {
      return {
        type: 'Feature', geometry: p.geometry,
        properties: Object.assign({}, p.properties, {
          component: compOf[i],
          component_size: comps[compOf[i]].length
        })
      };
    });

    var areaOf = function (idxs) {
      return idxs.reduce(function (s, i) { return s + GSX.areaM2(polys[i]); }, 0);
    };

    return {
      ok: true,
      thresholdM: d,
      numPatches: n,
      componentCount: comps.length,
      largestComponentPatches: comps.length ? comps[0].length : 0,
      largestComponentAreaM2: comps.length ? areaOf(comps[0]) : 0,
      isolatedPatches: comps.filter(function (c) { return c.length === 1; }).length,
      linkCount: links.length,
      linkFeatures: links,
      taggedFeatures: tagged
    };
  };

  /* ===================================================================
     P1-7 — TWO-DATE CHANGE DETECTION
     =================================================================== */

  /**
   * opts: { yearT1, yearT2, areaMode }
   * Returns loss / gain / persistence geometry plus the rate figures that
   * make the result comparable with published deforestation statistics.
   */
  GSX.changeDetection = function (t1Features, t2Features, opts) {
    opts = opts || {};
    var a = GSX.unionAll(t1Features);
    var b = GSX.unionAll(t2Features);
    if (!a) return { ok: false, error: 'Time-1 layer contains no polygons.' };
    if (!b) return { ok: false, error: 'Time-2 layer contains no polygons.' };

    var loss = null, gain = null, persist = null;
    try { loss = T.difference(a, b); } catch (e) {}
    try { gain = T.difference(b, a); } catch (e) {}
    try { persist = T.intersect(a, b); } catch (e) {}

    var mode = opts.areaMode;
    var mA = GSX.measureArea([a], mode);
    var mB = GSX.measureArea([b], mode);
    var mL = loss ? GSX.measureArea([loss], mode) : { m2: 0 };
    var mG = gain ? GSX.measureArea([gain], mode) : { m2: 0 };
    var mP = persist ? GSX.measureArea([persist], mode) : { m2: 0 };

    if (loss)    loss.properties    = { change: 'loss',        area_m2: mL.m2 };
    if (gain)    gain.properties    = { change: 'gain',        area_m2: mG.m2 };
    if (persist) persist.properties = { change: 'persistence', area_m2: mP.m2 };

    var net = mB.m2 - mA.m2;
    var years = (opts.yearT1 && opts.yearT2) ? (opts.yearT2 - opts.yearT1) : null;

    return {
      ok: true,
      lossGeom: loss, gainGeom: gain, persistGeom: persist,
      t1AreaM2: mA.m2, t2AreaM2: mB.m2,
      lossAreaM2: mL.m2, gainAreaM2: mG.m2, persistAreaM2: mP.m2,
      lossPctOfT1: mA.m2 > 0 ? (mL.m2 / mA.m2) * 100 : 0,
      gainPctOfT1: mA.m2 > 0 ? (mG.m2 / mA.m2) * 100 : 0,
      netChangeM2: net,
      netChangePct: mA.m2 > 0 ? (net / mA.m2) * 100 : 0,
      years: years,
      annualHaPerYear: years ? (net / 10000) / years : null,
      annualPctPerYear: (years && mA.m2 > 0) ? ((net / mA.m2) * 100) / years : null,
      areaMethod: mA.method, areaCRS: mA.crs,
      // closure check: loss + persistence must equal T1
      residualPct: mA.m2 > 0
        ? Math.abs((mL.m2 + mP.m2) - mA.m2) / mA.m2 * 100 : 0
    };
  };

  /* ===================================================================
     UI WRAPPERS
     =================================================================== */

  function featuresOf(id) {
    var l = (root.uploadedLayers || []).find(function (x) { return x.id === id; });
    if (!l) return [];
    return l.geojsonFeatures || (l.geojson && l.geojson.features) || [];
  }
  function unitPref() {
    try { return root.localStorage.getItem('gsx_area_unit') || 'ha'; } catch (e) { return 'ha'; }
  }
  function areaModePref() {
    var el = document.getElementById('gsx-area-method');
    return el ? el.value : 'spherical';
  }
  function ha(m2) { return GSX.formatArea(m2, unitPref()).display; }

  GSX.uiFragmentation = function () {
    var id = document.getElementById('analysis-layer-select').value;
    if (!id) { root.showToast('Select a layer first', 'error'); return; }
    var depthEl = document.getElementById('gsx-core-depth');
    var depth = parseFloat(depthEl && depthEl.value) || 100;
    var dissEl = document.getElementById('gsx-frag-dissolve');

    root.showToast('Computing patch metrics…', 'info');
    var r = GSX.fragmentation(featuresOf(id), {
      coreDepthM: depth, areaMode: areaModePref(),
      dissolveTouching: dissEl ? dissEl.checked : false
    });
    if (!r.ok) { root.showToast(r.error, 'error'); return; }

    if (r.coreFeatures.length) {
      root.addAnalysisLayer('Core areas (' + depth + ' m edge)',
        [root.L.geoJSON(GSX.fc(r.coreFeatures),
          { style: { color: '#276749', weight: 1, fillColor: '#276749', fillOpacity: 0.5 } })],
        GSX.fc(r.coreFeatures));
    }

    r.summaryRows = [
      ['Number of patches (NP)',        String(r.numPatches)],
      ['Total class area (CA)',         ha(r.totalAreaM2)],
      ['Mean patch size',               ha(r.meanPatchM2)],
      ['Median patch size',             ha(r.medianPatchM2)],
      ['Largest patch',                 ha(r.largestPatchM2)],
      ['Largest patch index (LPI)',     r.largestPatchIndex.toFixed(1) + ' %'],
      ['Total edge (TE)',               (r.totalEdgeM / 1000).toFixed(1) + ' km'],
      ['Edge density (ED)',             r.edgeDensityMPerHa.toFixed(1) + ' m/ha'],
      ['Mean shape index (MSI)',        r.meanShapeIndex.toFixed(2) + '  (1.0 = circular)'],
      ['Core area @ ' + depth + ' m',   ha(r.coreAreaM2)],
      ['Core area index (CAI)',         r.coreAreaIndex.toFixed(1) + ' %'],
      ['Patches with no core area',     r.patchesWithNoCore + ' of ' + r.numPatches],
      ['Mean nearest neighbour (ENN)',  r.meanNearestNeighbourM != null
                                          ? Math.round(r.meanNearestNeighbourM) + ' m' : '—'],
      ['Area method',                   r.areaMethod + ' — ' + r.areaCRS]
    ];
    r.caption = 'Core area depends on the edge depth you chose (' + depth +
      ' m) — state and justify it. ENN is a centroid approximation, not edge-to-edge.';
    root.showToast(r.numPatches + ' patches, LPI ' + r.largestPatchIndex.toFixed(1) + '%', 'info');
    return r;
  };

  GSX.uiConnectivity = function () {
    var id = document.getElementById('analysis-layer-select').value;
    if (!id) { root.showToast('Select a layer first', 'error'); return; }
    var thEl = document.getElementById('gsx-conn-threshold');
    var th = parseFloat(thEl && thEl.value) || 500;

    root.showToast('Building connectivity graph…', 'info');
    var r = GSX.connectivity(featuresOf(id), th);
    if (!r.ok) { root.showToast(r.error, 'error'); return; }

    if (r.linkFeatures.length) {
      root.addAnalysisLayer('Connectivity links (≤ ' + th + ' m)',
        [root.L.geoJSON(GSX.fc(r.linkFeatures),
          { style: { color: '#dd6b20', weight: 2, dashArray: '4,3' } })],
        GSX.fc(r.linkFeatures));
    }
    root.addAnalysisLayer('Patches by component',
      [root.L.geoJSON(GSX.fc(r.taggedFeatures),
        { style: { color: '#2b6cb0', weight: 1, fillColor: '#2b6cb0', fillOpacity: 0.4 } })],
      GSX.fc(r.taggedFeatures));

    r.summaryRows = [
      ['Threshold distance',        th + ' m'],
      ['Patches',                   String(r.numPatches)],
      ['Connected components',      String(r.componentCount)],
      ['Largest component',         r.largestComponentPatches + ' patches, ' +
                                    ha(r.largestComponentAreaM2)],
      ['Isolated patches',          String(r.isolatedPatches)],
      ['Links',                     String(r.linkCount)]
    ];
    r.caption = 'Centroid-distance connectivity only. For true least-cost corridors ' +
                'use QGIS (GRASS r.cost) — this tool does not model terrain or land cover.';
    root.showToast(r.componentCount + ' components, ' + r.isolatedPatches + ' isolated', 'info');
    return r;
  };

  GSX.uiChangeDetection = function () {
    var aId = document.getElementById('analysis-layer-select').value;
    var bId = document.getElementById('analysis-layer-select-b').value;
    if (!aId || !bId) { root.showToast('Select two layers', 'error'); return; }
    if (aId === bId)  { root.showToast('Select two different layers', 'error'); return; }
    var y1 = parseInt((document.getElementById('gsx-year-t1') || {}).value, 10) || null;
    var y2 = parseInt((document.getElementById('gsx-year-t2') || {}).value, 10) || null;

    root.showToast('Detecting change…', 'info');
    var r = GSX.changeDetection(featuresOf(aId), featuresOf(bId),
      { yearT1: y1, yearT2: y2, areaMode: areaModePref() });
    if (!r.ok) { root.showToast(r.error, 'error'); return; }

    var add = function (geom, name, color) {
      if (!geom) return;
      root.addAnalysisLayer(name,
        [root.L.geoJSON(geom, { style: { color: color, weight: 1,
          fillColor: color, fillOpacity: 0.5 } })], GSX.fc([geom]));
    };
    add(r.lossGeom,    'Forest loss',        '#c53030');
    add(r.gainGeom,    'Forest gain',        '#2f855a');
    add(r.persistGeom, 'Forest persistence', '#718096');

    r.summaryRows = [
      ['Extent at T1' + (y1 ? ' (' + y1 + ')' : ''), ha(r.t1AreaM2)],
      ['Extent at T2' + (y2 ? ' (' + y2 + ')' : ''), ha(r.t2AreaM2)],
      ['Loss',        ha(r.lossAreaM2) + '  (' + r.lossPctOfT1.toFixed(1) + '% of T1)'],
      ['Gain',        ha(r.gainAreaM2) + '  (' + r.gainPctOfT1.toFixed(1) + '% of T1)'],
      ['Persistence', ha(r.persistAreaM2)],
      ['Net change',  ha(r.netChangeM2) + '  (' + r.netChangePct.toFixed(1) + '%)']
    ];
    if (r.annualHaPerYear != null) {
      r.summaryRows.push(['Annual rate',
        r.annualHaPerYear.toFixed(1) + ' ha/yr  (' +
        r.annualPctPerYear.toFixed(2) + '%/yr over ' + r.years + ' years)']);
    }
    r.summaryRows.push(['Area method', r.areaMethod + ' — ' + r.areaCRS]);
    if (r.residualPct > 0.5) {
      r.summaryRows.push(['⚠ Geometry check',
        'loss + persistence differs from T1 by ' + r.residualPct.toFixed(2) + '%']);
    }
    root.showToast('Net ' + ha(r.netChangeM2), 'info');
    return r;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GSX;

})(typeof window !== 'undefined' ? window : globalThis);
