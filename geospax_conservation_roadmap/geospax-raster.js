/* =====================================================================
   GeoSpaX — Raster Reclassify & Polygonize  (P2-8)

   Closes assignment requirement A1: derive a forest / non-forest extent
   from an index raster (NDVI, canopy cover) and hand it to the vector
   tools as polygons.

   Pipeline:
     raster -> histogram -> threshold (manual or Otsu)
            -> binary mask
            -> run-length rectangles (merged vertically)
            -> GeoJSON polygons
            -> optional dissolve into patches

   Polygonization uses run-length encoding rather than marching squares.
   RLE is exact on a grid, handles interior holes correctly once
   dissolved, and produces far fewer primitives than one-square-per-cell.

   Works with georaster-style objects:
     { values: [band][row][col], width, height,
       xmin, ymin, xmax, ymax, pixelWidth, pixelHeight, noDataValue }

   Load after geospax-conservation.js.
   ===================================================================== */

(function (root) {
  'use strict';

  var T = root.turf;
  var GSX = root.GSX;
  if (!GSX) throw new Error('geospax-conservation.js must load first');

  /* ===================================================================
     Raster access
     =================================================================== */

  /** Normalise a georaster into a flat accessor. */
  GSX.rasterInfo = function (raster, bandIndex) {
    if (!raster) return null;
    var b = bandIndex || 0;
    var band = raster.values && raster.values[b];
    if (!band) return null;
    var height = raster.height || band.length;
    var width = raster.width || (band[0] ? band[0].length : 0);
    return {
      band: band, width: width, height: height,
      xmin: raster.xmin, ymin: raster.ymin, xmax: raster.xmax, ymax: raster.ymax,
      pixelWidth: raster.pixelWidth || ((raster.xmax - raster.xmin) / width),
      pixelHeight: raster.pixelHeight || ((raster.ymax - raster.ymin) / height),
      noDataValue: raster.noDataValue != null ? raster.noDataValue : null,
      cellCount: width * height
    };
  };

  function isData(v, nodata) {
    if (v === null || v === undefined) return false;
    if (typeof v !== 'number' || !isFinite(v)) return false;
    if (nodata !== null && v === nodata) return false;
    return true;
  }

  /**
   * Histogram of valid cells. Used to pick a threshold and to show the
   * user what they are cutting.
   */
  GSX.rasterHistogram = function (raster, bandIndex, bins) {
    var r = GSX.rasterInfo(raster, bandIndex);
    if (!r) return { ok: false, error: 'Could not read raster band.' };
    bins = bins || 64;

    var min = Infinity, max = -Infinity, n = 0;
    for (var y = 0; y < r.height; y++) {
      var row = r.band[y]; if (!row) continue;
      for (var x = 0; x < r.width; x++) {
        var v = row[x];
        if (!isData(v, r.noDataValue)) continue;
        if (v < min) min = v; if (v > max) max = v; n++;
      }
    }
    if (n === 0) return { ok: false, error: 'Raster band contains no valid data.' };
    if (min === max) {
      return { ok: false, error: 'Raster band is constant (every cell = ' + min +
               '). There is nothing to threshold.' };
    }

    var counts = new Array(bins).fill(0);
    var w = (max - min) / bins;
    for (var y2 = 0; y2 < r.height; y2++) {
      var row2 = r.band[y2]; if (!row2) continue;
      for (var x2 = 0; x2 < r.width; x2++) {
        var v2 = row2[x2];
        if (!isData(v2, r.noDataValue)) continue;
        var i = Math.min(bins - 1, Math.floor((v2 - min) / w));
        counts[i]++;
      }
    }
    return { ok: true, min: min, max: max, bins: bins, binWidth: w,
             counts: counts, validCells: n, totalCells: r.cellCount,
             noDataCells: r.cellCount - n };
  };

  /**
   * Otsu's method — the between-class variance maximiser. Gives a
   * defensible default break so the student is not just guessing.
   */
  GSX.otsuThreshold = function (hist) {
    if (!hist || !hist.ok) return null;
    var counts = hist.counts, bins = hist.bins;
    var total = counts.reduce(function (s, c) { return s + c; }, 0);
    if (total === 0) return null;

    var sumAll = 0, i;
    for (i = 0; i < bins; i++) sumAll += i * counts[i];

    var sumB = 0, wB = 0, bestLo = 0, bestHi = 0, bestVar = -1;
    for (i = 0; i < bins; i++) {
      wB += counts[i];
      if (wB === 0) continue;
      var wF = total - wB;
      if (wF === 0) break;
      sumB += i * counts[i];
      var mB = sumB / wB;
      var mF = (sumAll - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between > bestVar + 1e-12) { bestVar = between; bestLo = bestHi = i; }
      else if (Math.abs(between - bestVar) <= 1e-12) { bestHi = i; }
    }
    // With a cleanly bimodal raster the empty bins between the modes all
    // tie for maximum between-class variance. Taking the first tied bin
    // puts the break hard against the lower mode, where a little noise
    // flips it. Use the centre of the tied range instead.
    var best = (bestLo + bestHi) / 2;
    return hist.min + (best + 0.5) * hist.binWidth;
  };

  /* ===================================================================
     Reclassify
     =================================================================== */

  /**
   * Binary mask from a threshold.
   * opts: { threshold, operator: '>=' | '>' | '<=' | '<', bandIndex }
   */
  GSX.reclassifyBinary = function (raster, opts) {
    opts = opts || {};
    var r = GSX.rasterInfo(raster, opts.bandIndex);
    if (!r) return { ok: false, error: 'Could not read raster band.' };
    if (opts.threshold == null || !isFinite(opts.threshold)) {
      return { ok: false, error: 'A numeric threshold is required.' };
    }
    var op = opts.operator || '>=';
    var t = opts.threshold;
    var test = op === '>'  ? function (v) { return v >  t; }
             : op === '<=' ? function (v) { return v <= t; }
             : op === '<'  ? function (v) { return v <  t; }
             :               function (v) { return v >= t; };

    var mask = [], inCount = 0, outCount = 0, noData = 0;
    for (var y = 0; y < r.height; y++) {
      var row = r.band[y] || [];
      var mrow = new Uint8Array(r.width);
      for (var x = 0; x < r.width; x++) {
        var v = row[x];
        if (!isData(v, r.noDataValue)) { mrow[x] = 0; noData++; continue; }
        if (test(v)) { mrow[x] = 1; inCount++; } else { mrow[x] = 0; outCount++; }
      }
      mask.push(mrow);
    }
    return { ok: true, mask: mask, info: r, threshold: t, operator: op,
             cellsIn: inCount, cellsOut: outCount, noDataCells: noData,
             proportionIn: (inCount + outCount) > 0 ? inCount / (inCount + outCount) : 0 };
  };

  /* ===================================================================
     Polygonize
     =================================================================== */

  /**
   * Mask -> rectangles, via run-length encoding with vertical merging.
   *
   * A run is a horizontal span of set cells. Runs in consecutive rows
   * with identical [x0,x1] extend downward into one rectangle. This is
   * exact and typically reduces the primitive count by one to two orders
   * of magnitude versus emitting a square per cell.
   */
  GSX.maskToRectangles = function (mask, info) {
    var open = {};          // key "x0:x1" -> { x0, x1, yStart }
    var rects = [];

    function closeRow(y) {
      Object.keys(open).forEach(function (k) {
        var o = open[k];
        // A run ends at the row after it was last seen — NOT at the row
        // currently being closed. Using `y` here overlapped rectangles
        // by one row and over-counted area.
        if (o._seen !== y) { rects.push({ x0: o.x0, x1: o.x1, y0: o.yStart, y1: o._seen }); delete open[k]; }
      });
    }

    for (var y = 0; y < info.height; y++) {
      var row = mask[y];
      var runs = [];
      var x = 0;
      while (x < info.width) {
        if (row[x]) {
          var start = x;
          while (x < info.width && row[x]) x++;
          runs.push([start, x]);            // [x0, x1) half-open
        } else x++;
      }
      runs.forEach(function (run) {
        var key = run[0] + ':' + run[1];
        if (open[key]) { open[key]._seen = y + 1; }
        else { open[key] = { x0: run[0], x1: run[1], yStart: y, _seen: y + 1 }; }
      });
      closeRow(y + 1);
    }
    Object.keys(open).forEach(function (k) {
      var o = open[k];
      rects.push({ x0: o.x0, x1: o.x1, y0: o.yStart, y1: o._seen });
    });
    return rects;
  };

  /** Rectangles in pixel space -> GeoJSON polygons in map coordinates. */
  GSX.rectanglesToGeoJSON = function (rects, info) {
    var pw = info.pixelWidth, ph = info.pixelHeight;
    return rects.map(function (r, i) {
      var lngA = info.xmin + r.x0 * pw;
      var lngB = info.xmin + r.x1 * pw;
      // row 0 is the TOP of a north-up raster
      var latA = info.ymax - r.y0 * ph;
      var latB = info.ymax - r.y1 * ph;
      return {
        type: 'Feature',
        properties: { rect_id: i, cells: (r.x1 - r.x0) * (r.y1 - r.y0) },
        geometry: { type: 'Polygon', coordinates: [[
          [lngA, latA], [lngB, latA], [lngB, latB], [lngA, latB], [lngA, latA]
        ]] }
      };
    });
  };

  /**
   * Full pipeline.
   * opts: { threshold, operator, bandIndex, dissolve = true,
   *         maxCells = 4000000, maxRects = 20000 }
   */
  GSX.rasterToPolygons = function (raster, opts) {
    opts = opts || {};
    var info = GSX.rasterInfo(raster, opts.bandIndex);
    if (!info) return { ok: false, error: 'Could not read raster band.' };

    var maxCells = opts.maxCells || 4000000;
    if (info.cellCount > maxCells) {
      return { ok: false, error: 'Raster has ' + info.cellCount.toLocaleString() +
        ' cells, above the ' + maxCells.toLocaleString() + ' limit. Downsample it first — ' +
        'polygonizing at full resolution will lock the browser.' };
    }

    var rc = GSX.reclassifyBinary(raster, opts);
    if (!rc.ok) return rc;
    if (rc.cellsIn === 0) {
      return { ok: false, error: 'No cells passed the threshold — nothing to polygonize.' };
    }

    var rects = GSX.maskToRectangles(rc.mask, info);
    var warnings = [];
    var maxRects = opts.maxRects || 20000;
    if (rects.length > maxRects) {
      return { ok: false, error: 'The threshold produced ' + rects.length.toLocaleString() +
        ' fragments, above the ' + maxRects.toLocaleString() + ' limit. The raster is probably ' +
        'noisy — smooth or downsample it, or choose a threshold that separates the classes ' +
        'more cleanly.' };
    }

    var features = GSX.rectanglesToGeoJSON(rects, info);
    var rectCount = features.length;

    if (opts.dissolve !== false) {
      var d = GSX.dissolve(features, null);
      if (d.ok) {
        features = d.features;
      } else {
        warnings.push('Rectangles could not be dissolved into patches (' + d.error +
                      '); returning the un-merged grid rectangles.');
      }
    }

    features.forEach(function (f, i) {
      f.properties = f.properties || {};
      f.properties.class_id = 1;
      f.properties.patch_id = i + 1;
      f.properties.area_m2 = GSX.areaM2(f);
      f.properties.threshold = rc.threshold;
      f.properties.operator = rc.operator;
    });

    var totalM2 = features.reduce(function (s, f) { return s + f.properties.area_m2; }, 0);

    return {
      ok: true,
      features: features,
      patchCount: features.length,
      rectangleCount: rectCount,
      totalAreaM2: totalM2,
      threshold: rc.threshold,
      operator: rc.operator,
      cellsIn: rc.cellsIn,
      cellsOut: rc.cellsOut,
      noDataCells: rc.noDataCells,
      proportionIn: rc.proportionIn,
      warnings: warnings
    };
  };

  /* ===================================================================
     UI
     =================================================================== */

  function unitPref() {
    try { return root.localStorage.getItem('gsx_area_unit') || 'ha'; } catch (e) { return 'ha'; }
  }

  function selectedRaster() {
    var el = document.getElementById('gsx-raster-layer');
    if (!el || !el.value) return null;
    var l = (root.uploadedLayers || []).find(function (x) { return x.id === el.value; });
    if (!l) return null;
    return { layerInfo: l, raster: l.georaster || l.raster || null };
  }

  /** Draw the histogram and suggest an Otsu break. */
  GSX.uiRasterHistogram = function () {
    var sel = selectedRaster();
    var host = document.getElementById('gsx-raster-hist');
    if (!sel || !sel.raster) {
      root.showToast('Select a raster layer first', 'error');
      if (host) host.innerHTML = '';
      return;
    }
    var band = parseInt((document.getElementById('gsx-raster-band') || {}).value, 10) || 0;
    var h = GSX.rasterHistogram(sel.raster, band, 48);
    if (!h.ok) { root.showToast(h.error, 'error'); return h; }

    var otsu = GSX.otsuThreshold(h);
    var tEl = document.getElementById('gsx-raster-threshold');
    if (tEl && !tEl.value) tEl.value = otsu.toFixed(4);

    if (host) {
      var peak = Math.max.apply(null, h.counts) || 1;
      host.innerHTML =
        '<div class="gsx-hist">' +
        h.counts.map(function (c, i) {
          var v = h.min + (i + 0.5) * h.binWidth;
          return '<span title="' + v.toFixed(3) + ' — ' + c + ' cells" style="height:' +
                 Math.max(1, Math.round(c / peak * 60)) + 'px"></span>';
        }).join('') +
        '</div>' +
        '<div class="ad-hint">range ' + h.min.toFixed(3) + ' to ' + h.max.toFixed(3) +
        ' · ' + h.validCells.toLocaleString() + ' valid cells' +
        (h.noDataCells ? ' · ' + h.noDataCells.toLocaleString() + ' no-data' : '') +
        ' · <b>Otsu suggests ' + otsu.toFixed(4) + '</b></div>';
    }
    return { histogram: h, otsu: otsu };
  };

  GSX.uiRasterToPolygons = function () {
    var sel = selectedRaster();
    if (!sel || !sel.raster) { root.showToast('Select a raster layer first', 'error'); return; }
    var band = parseInt((document.getElementById('gsx-raster-band') || {}).value, 10) || 0;
    var t = parseFloat((document.getElementById('gsx-raster-threshold') || {}).value);
    if (!isFinite(t)) {
      root.showToast('Enter a threshold, or click Histogram for an Otsu suggestion', 'error');
      return;
    }
    var opEl = document.getElementById('gsx-raster-op');
    var dissEl = document.getElementById('gsx-raster-dissolve');

    root.showToast('Reclassifying and polygonizing…', 'info');

    root.setTimeout(function () {
      var res = GSX.rasterToPolygons(sel.raster, {
        bandIndex: band, threshold: t,
        operator: opEl ? opEl.value : '>=',
        dissolve: dissEl ? dissEl.checked : true
      });
      if (!res.ok) { root.showToast(res.error, 'error'); return; }

      var fcOut = GSX.fc(res.features);
      var lyr = root.L.geoJSON(fcOut, {
        style: { color: '#276749', weight: 1, fillColor: '#38a169', fillOpacity: 0.55 }
      });
      var name = 'Extent ' + (res.operator) + ' ' + res.threshold.toFixed(3);
      var info = root.addAnalysisLayer(name, [lyr], fcOut);
      if (info && GSX.stampDerived) {
        GSX.stampDerived(info, 'rasterToPolygons',
          sel.layerInfo ? [sel.layerInfo.id] : [],
          { band: band, threshold: res.threshold, operator: res.operator });
      }

      var a = GSX.formatArea(res.totalAreaM2, unitPref());
      res.summaryRows = [
        ['Threshold',            res.operator + ' ' + res.threshold.toFixed(4)],
        ['Cells passing',        res.cellsIn.toLocaleString() + ' of ' +
                                 (res.cellsIn + res.cellsOut).toLocaleString() +
                                 '  (' + (res.proportionIn * 100).toFixed(1) + '%)'],
        ['No-data cells',        res.noDataCells.toLocaleString()],
        ['Rectangles before merge', res.rectangleCount.toLocaleString()],
        ['Patches after merge',  res.patchCount.toLocaleString()],
        ['Total area',           a.display]
      ];
      res.caption = 'Area is measured from raster cell edges, so it inherits the raster\'s ' +
                    'resolution — state the pixel size alongside any figure quoted from this layer.';
      (res.warnings || []).forEach(function (w) { root.showToast(w, 'error'); });
      root.showToast(res.patchCount.toLocaleString() + ' patches, ' + a.display, 'info');
    }, 30);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GSX;

})(typeof window !== 'undefined' ? window : globalThis);
