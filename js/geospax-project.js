/* =====================================================================
   GeoSpaX — Provenance & Project Persistence

   P2-9   Layer provenance metadata     → assignment deliverable 4
   P2-10  Project save / load (.gspx)   → assignment deliverable 5

   Deliverable 5 exists as an authorship check. A GeoSpaX-only student
   currently cannot satisfy it because there is no equivalent of a .qgz.
   This module supplies one, with a project id and an edit history that
   make a submitted file traceable.

   Load after geospax-conservation.js.
   ===================================================================== */

(function (root) {
  'use strict';

  var GSX = root.GSX;
  if (!GSX) throw new Error('geospax-conservation.js must load first');

  var FORMAT_VERSION = 1;
  var AUTOSAVE_KEY = 'gsx_project_autosave';

  /* ===================================================================
     P2-9 — PROVENANCE
     =================================================================== */

  var META_FIELDS = [
    ['source',     'Source / dataset name'],
    ['url',        'URL or DOI'],
    ['acquired',   'Date acquired'],
    ['licence',    'Licence / terms of use'],
    ['crs',        'CRS as supplied'],
    ['resolution', 'Resolution / scale'],
    ['notes',      'Notes']
  ];
  GSX.META_FIELDS = META_FIELDS;

  GSX.blankMeta = function () {
    return {
      source: '', url: '', acquired: '', licence: '',
      crs: 'EPSG:4326', resolution: '', notes: '',
      importedAt: null, derivedFrom: null, tool: null, toolParams: null
    };
  };

  GSX.ensureMeta = function (layerInfo) {
    if (!layerInfo) return null;
    if (!layerInfo.meta) layerInfo.meta = GSX.blankMeta();
    return layerInfo.meta;
  };

  /** Call from the import handler. Seeds what can be known automatically. */
  GSX.stampImport = function (layerInfo, filename) {
    var m = GSX.ensureMeta(layerInfo);
    m.importedAt = new Date().toISOString();
    if (!m.source && filename) m.source = filename;
    return m;
  };

  /**
   * Call from addAnalysisLayer for every derived layer.
   * This is what turns the provenance table from a chore into an audit
   * trail — each result records the tool and inputs that produced it.
   */
  GSX.stampDerived = function (layerInfo, tool, parentLayerIds, params) {
    var m = GSX.ensureMeta(layerInfo);
    m.importedAt = new Date().toISOString();
    m.tool = tool;
    m.derivedFrom = parentLayerIds || [];
    m.toolParams = params || null;
    if (!m.source) {
      var names = (parentLayerIds || []).map(function (id) {
        var l = (root.uploadedLayers || []).find(function (x) { return x.id === id; });
        return l ? l.name : id;
      });
      m.source = 'Derived: ' + tool + (names.length ? ' from ' + names.join(' + ') : '');
    }
    return m;
  };

  /** One row per layer, ready for CSV / Markdown / XLSX. */
  GSX.provenanceRows = function () {
    return (root.uploadedLayers || []).map(function (l) {
      var m = l.meta || GSX.blankMeta();
      var derived = (m.derivedFrom && m.derivedFrom.length)
        ? m.derivedFrom.map(function (id) {
            var p = (root.uploadedLayers || []).find(function (x) { return x.id === id; });
            return p ? p.name : id;
          }).join('; ')
        : '';
      return {
        layer: l.name || '',
        features: l.featureCount != null ? l.featureCount : '',
        geometry: (l.geomTypes || []).join('/'),
        source: m.source || '',
        url: m.url || '',
        acquired: m.acquired || '',
        licence: m.licence || '',
        crs: m.crs || '',
        resolution: m.resolution || '',
        derivedFrom: derived,
        tool: m.tool || '',
        toolParams: m.toolParams ? JSON.stringify(m.toolParams) : '',
        importedAt: m.importedAt || '',
        notes: m.notes || ''
      };
    });
  };

  var PROV_HEADERS = [
    ['layer', 'Layer'], ['features', 'Features'], ['geometry', 'Geometry'],
    ['source', 'Source'], ['url', 'URL / DOI'], ['acquired', 'Acquired'],
    ['licence', 'Licence'], ['crs', 'CRS'], ['resolution', 'Resolution'],
    ['derivedFrom', 'Derived from'], ['tool', 'Tool'], ['toolParams', 'Parameters'],
    ['importedAt', 'Added'], ['notes', 'Notes']
  ];

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  GSX.provenanceCSV = function () {
    var rows = GSX.provenanceRows();
    var out = [PROV_HEADERS.map(function (h) { return csvCell(h[1]); }).join(',')];
    rows.forEach(function (r) {
      out.push(PROV_HEADERS.map(function (h) { return csvCell(r[h[0]]); }).join(','));
    });
    return out.join('\n');
  };

  GSX.provenanceMarkdown = function () {
    var rows = GSX.provenanceRows();
    // Narrower column set — a 14-column markdown table is unreadable in a report
    var cols = ['layer', 'source', 'url', 'acquired', 'licence', 'crs', 'tool'];
    var head = ['Layer', 'Source', 'URL / DOI', 'Acquired', 'Licence', 'CRS', 'Tool'];
    var esc = function (v) { return String(v == null ? '' : v).replace(/\|/g, '\\|'); };
    var lines = ['| ' + head.join(' | ') + ' |',
                 '|' + head.map(function () { return '---'; }).join('|') + '|'];
    rows.forEach(function (r) {
      lines.push('| ' + cols.map(function (c) { return esc(r[c]); }).join(' | ') + ' |');
    });
    return lines.join('\n');
  };

  /** Fields that are empty but shouldn't be — shown before export. */
  GSX.provenanceGaps = function () {
    var required = ['source', 'acquired', 'licence'];
    var gaps = [];
    GSX.provenanceRows().forEach(function (r) {
      // derived layers inherit provenance from their parents
      if (r.tool) return;
      var missing = required.filter(function (f) { return !r[f]; });
      if (missing.length) gaps.push({ layer: r.layer, missing: missing });
    });
    return gaps;
  };

  /* ===================================================================
     P2-10 — PROJECT SAVE / LOAD
     =================================================================== */

  function randomId() {
    var s = '';
    for (var i = 0; i < 4; i++) s += Math.random().toString(36).slice(2, 8);
    return s.slice(0, 20);
  }

  GSX.getProjectMeta = function () {
    if (!root._gsxProject) {
      root._gsxProject = {
        projectId: randomId(),
        created: new Date().toISOString(),
        authorName: '', projectId: '', subject: '', title: ''
      };
    }
    return root._gsxProject;
  };

  /**
   * Serialise the whole working state.
   * Geometry is embedded, not referenced — a submitted file must open on
   * a marker's machine without the original data being present.
   */
  GSX.serialiseProject = function () {
    var meta = GSX.getProjectMeta();
    var layers = (root.uploadedLayers || []).map(function (l) {
      return {
        id: l.id,
        name: l.name,
        color: l.color || null,
        featureCount: l.featureCount || 0,
        geomTypes: l.geomTypes || [],
        isAnalysis: !!l.isAnalysis,
        isRaster: !!l.isRaster,
        visible: (root.map && l.layer) ? root.map.hasLayer(l.layer) : true,
        style: l.style || null,
        meta: l.meta || GSX.blankMeta(),
        // rasters are not embedded — see note in the return payload
        geojson: l.isRaster ? null : {
          type: 'FeatureCollection',
          features: l.geojsonFeatures || (l.geojson && l.geojson.features) || []
        }
      };
    });

    var view = null;
    try {
      if (root.map) {
        var c = root.map.getCenter();
        view = { lat: c.lat, lng: c.lng, zoom: root.map.getZoom() };
      }
    } catch (e) { /* map not ready */ }

    return {
      format: 'geospax-project',
      formatVersion: FORMAT_VERSION,
      app: 'GeoSpaX',
      projectId: meta.projectId,
      created: meta.created,
      modified: new Date().toISOString(),
      author: {
        name: meta.authorName || '',
        id: meta.projectId || '',
        subject: meta.subject || '',
        title: meta.title || ''
      },
      view: view,
      layerCount: layers.length,
      rasterLayersNotEmbedded: layers.filter(function (l) { return l.isRaster; })
        .map(function (l) { return l.name; }),
      layers: layers
    };
  };

  GSX.projectToJSON = function (pretty) {
    return JSON.stringify(GSX.serialiseProject(), null, pretty ? 1 : 0);
  };

  /** Validate before trusting a loaded file. */
  GSX.validateProject = function (obj) {
    if (!obj || typeof obj !== 'object') return { ok: false, error: 'Not a JSON object.' };
    if (obj.format !== 'geospax-project') {
      return { ok: false, error: 'Not a GeoSpaX project file (missing format marker).' };
    }
    if (typeof obj.formatVersion !== 'number') {
      return { ok: false, error: 'Missing format version.' };
    }
    if (obj.formatVersion > FORMAT_VERSION) {
      return { ok: false, error: 'This file was written by a newer version of GeoSpaX ' +
               '(format ' + obj.formatVersion + ', this build reads ' + FORMAT_VERSION + ').' };
    }
    if (!Array.isArray(obj.layers)) return { ok: false, error: 'No layers array.' };
    var bad = obj.layers.filter(function (l) {
      return !l.isRaster && (!l.geojson || !Array.isArray(l.geojson.features));
    });
    if (bad.length) {
      return { ok: false, error: bad.length + ' layer(s) have no usable geometry.' };
    }
    return { ok: true, layerCount: obj.layers.length,
             warnings: (obj.rasterLayersNotEmbedded || []).length
               ? ['Raster layers were not embedded and must be re-imported: ' +
                  obj.rasterLayersNotEmbedded.join(', ')] : [] };
  };

  /** Parse + validate. Restoring into the map is done by the UI wrapper. */
  GSX.parseProject = function (text) {
    var obj;
    try { obj = JSON.parse(text); }
    catch (e) { return { ok: false, error: 'File is not valid JSON: ' + e.message }; }
    var v = GSX.validateProject(obj);
    if (!v.ok) return v;
    return { ok: true, project: obj, layerCount: v.layerCount, warnings: v.warnings };
  };

  /* ===================================================================
     UI WRAPPERS
     =================================================================== */

  function download(filename, text, mime) {
    var blob = new root.Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = root.URL.createObjectURL(blob);
    var a = root.document.createElement('a');
    a.href = url; a.download = filename;
    root.document.body.appendChild(a); a.click();
    root.document.body.removeChild(a);
    root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
  }
  GSX._download = download;

  GSX.uiEditMeta = function (layerId) {
    var l = (root.uploadedLayers || []).find(function (x) { return x.id === layerId; });
    if (!l) return;
    var m = GSX.ensureMeta(l);
    var host = document.getElementById('gsx-meta-form');
    if (!host) return;
    host.innerHTML =
      '<div class="ad-subhead">Provenance — ' + (l.name || '') + '</div>' +
      META_FIELDS.map(function (f) {
        return '<div class="ad-row"><label>' + f[1] + '</label>' +
          '<input id="gsx-meta-' + f[0] + '" type="text" value="' +
          String(m[f[0]] || '').replace(/"/g, '&quot;') + '"></div>';
      }).join('') +
      '<div class="ad-row"><button class="export-btn primary" ' +
      'onclick="GSX.uiSaveMeta(\'' + layerId + '\')">Save provenance</button></div>';
  };

  GSX.uiSaveMeta = function (layerId) {
    var l = (root.uploadedLayers || []).find(function (x) { return x.id === layerId; });
    if (!l) return;
    var m = GSX.ensureMeta(l);
    META_FIELDS.forEach(function (f) {
      var el = document.getElementById('gsx-meta-' + f[0]);
      if (el) m[f[0]] = el.value;
    });
    root.showToast('Provenance saved for ' + l.name, 'info');
    GSX.uiRenderProvenanceTable();
  };

  GSX.uiRenderProvenanceTable = function () {
    var host = document.getElementById('gsx-prov-table');
    if (!host) return;
    var rows = GSX.provenanceRows();
    if (rows.length === 0) { host.innerHTML = '<div class="ad-hint">No layers.</div>'; return; }
    var cols = ['layer', 'source', 'acquired', 'licence', 'crs', 'tool'];
    var head = ['Layer', 'Source', 'Acquired', 'Licence', 'CRS', 'Tool'];
    var gaps = GSX.provenanceGaps();
    var gapNames = {};
    gaps.forEach(function (g) { gapNames[g.layer] = g.missing; });

    host.innerHTML =
      '<table class="gsx-table"><thead><tr>' +
      head.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        var miss = gapNames[r.layer] || [];
        return '<tr>' + cols.map(function (c) {
          var v = r[c] || '';
          var flag = (!v && miss.indexOf(c) !== -1);
          return '<td' + (flag ? ' class="gsx-missing"' : '') + '>' +
                 (v || (flag ? '— required —' : '')) + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table>' +
      (gaps.length
        ? '<div class="gsx-warn">' + gaps.length + ' layer(s) are missing required ' +
          'provenance fields. Complete these before submitting.</div>'
        : '<div class="ad-hint">Provenance complete for all imported layers.</div>');
  };

  GSX.uiExportProvenance = function (fmt) {
    var rows = GSX.provenanceRows();
    if (rows.length === 0) { root.showToast('No layers to export', 'error'); return; }
    var gaps = GSX.provenanceGaps();
    if (gaps.length && !root.confirm(gaps.length + ' layer(s) have missing provenance ' +
        'fields. Export anyway?')) return;
    var stamp = new Date().toISOString().slice(0, 10);
    if (fmt === 'md') {
      download('provenance_' + stamp + '.md',
        '# Data Provenance\n\n' + GSX.provenanceMarkdown() + '\n', 'text/markdown');
    } else {
      download('provenance_' + stamp + '.csv', GSX.provenanceCSV(), 'text/csv');
    }
    root.showToast('Provenance table exported', 'info');
  };

  GSX.uiSaveProject = function () {
    var meta = GSX.getProjectMeta();
    ['authorName', 'projectId', 'subject', 'title'].forEach(function (k) {
      var el = document.getElementById('gsx-proj-' + k);
      if (el) meta[k] = el.value;
    });
    var json = GSX.projectToJSON(true);
    var name = (meta.projectId || 'project') + '_' +
               (meta.subject || 'geospax').replace(/[^\w-]+/g, '_') + '.gspx';
    download(name, json, 'application/json');
    root.showToast('Project saved (' + Math.round(json.length / 1024) + ' KB) — id ' +
                   meta.projectId, 'info');
  };

  GSX.uiLoadProject = function (file) {
    if (!file) return;
    var reader = new root.FileReader();
    reader.onload = function (e) {
      var res = GSX.parseProject(e.target.result);
      if (!res.ok) { root.showToast('Could not load project: ' + res.error, 'error'); return; }
      if (typeof root.gsxRestoreProject === 'function') {
        root.gsxRestoreProject(res.project);
      } else {
        root.showToast('Project parsed (' + res.layerCount + ' layers) but no restore ' +
                       'handler is wired — see INTEGRATION §5.3', 'error');
        return;
      }
      root._gsxProject = {
        projectId: res.project.projectId,
        created: res.project.created,
        authorName: (res.project.author || {}).name || '',
        projectId: (res.project.author || {}).id || '',
        subject: (res.project.author || {}).subject || '',
        title: (res.project.author || {}).title || ''
      };
      (res.warnings || []).forEach(function (w) { root.showToast(w, 'error'); });
      root.showToast('Loaded ' + res.layerCount + ' layers — project id ' +
                     res.project.projectId, 'info');
    };
    reader.readAsText(file);
  };

  /* ---- autosave. Campus power is not reliable; losing a session is worse
     than the cost of a localStorage write. ---- */

  GSX.autosave = function () {
    try {
      root.localStorage.setItem(AUTOSAVE_KEY, GSX.projectToJSON(false));
      return true;
    } catch (e) {
      return false;      // quota exceeded on a large project — fail quietly
    }
  };

  GSX.hasAutosave = function () {
    try {
      var raw = root.localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return null;
      var res = GSX.parseProject(raw);
      if (!res.ok) return null;
      return { modified: res.project.modified, layerCount: res.layerCount,
               projectId: res.project.projectId };
    } catch (e) { return null; }
  };

  GSX.restoreAutosave = function () {
    try {
      var raw = root.localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return false;
      var res = GSX.parseProject(raw);
      if (!res.ok) return false;
      if (typeof root.gsxRestoreProject === 'function') {
        root.gsxRestoreProject(res.project);
        return true;
      }
      return false;
    } catch (e) { return false; }
  };

  GSX.clearAutosave = function () {
    try { root.localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}
  };

  GSX.startAutosave = function (intervalMs) {
    if (root._gsxAutosaveTimer) root.clearInterval(root._gsxAutosaveTimer);
    root._gsxAutosaveTimer = root.setInterval(GSX.autosave, intervalMs || 60000);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GSX;

})(typeof window !== 'undefined' ? window : globalThis);
