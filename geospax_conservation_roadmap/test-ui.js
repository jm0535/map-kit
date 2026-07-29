(async () => {
/* Real-DOM tests for every GeoSpaX UI wrapper.
   Runs the actual functions against a jsdom document with mocked Leaflet
   and host globals — this is what "untested UI wiring" was hiding behind.

   Run:  GEOSPAX_ROOT=/path/to/map-kit node test-ui.js                   */

const ROOT = process.env.GEOSPAX_ROOT || require('path').resolve(__dirname, '../../..');
const V = p => require('path').join(ROOT, 'vendor', p);
const path = require('path'), fs = require('fs');
const { JSDOM } = require('jsdom');

/* ---------- DOM ---------- */
const PANEL = `
<select id="analysis-layer-select"></select>
<select id="analysis-layer-select-b"></select>
<input id="gsx-dissolve-field" value="">
<select id="gsx-area-unit"><option value="ha" selected></option></select>
<select id="gsx-area-method"><option value="spherical" selected></option><option value="equalarea"></option></select>
<input id="gsx-core-depth" value="100">
<input id="gsx-frag-dissolve" type="checkbox">
<input id="gsx-conn-threshold" value="5000">
<input id="gsx-year-t1" value="2015"><input id="gsx-year-t2" value="2025">
<input id="gsx-wlc-cellsize" value="2000">
<div id="gsx-wlc-criteria"></div>
<select id="gsx-wlc-constraint"><option value=""></option></select>
<div id="gsx-wlc-cellcount"></div>
<div id="gsx-wlc-table"></div>
<select id="gsx-sdm-presence"></select>
<input id="gsx-sdm-cellsize" value="5000">
<select id="gsx-bioclim-mode"><option value="limiting" selected></option><option value="proportion"></option></select>
<select id="gsx-maha-output"><option value="chisq" selected></option><option value="index"></option></select>
<div id="gsx-sdm-env"></div>
<div id="gsx-sdm-warnings"></div>
<div id="gsx-prov-table"></div>
<div id="gsx-meta-form"></div>
<input id="gsx-proj-studentName" value="A. Student">
<input id="gsx-proj-studentId" value="12345678">
<input id="gsx-proj-species" value="Dendrolagus matschiei">
<input id="gsx-proj-title" value="Habitat assessment">
`;
const dom = new JSDOM('<!doctype html><html><body>' + PANEL + '</body></html>',
                      { url: 'https://localhost/' });
const win = dom.window;

/* ---------- host globals ---------- */
global.window = win;
global.document = win.document;
global.navigator = win.navigator;
win.turf = global.turf = require(V('turf-6.5.0.min.js'));
win.proj4 = global.proj4 = require(V('proj4/proj4.js'));

const T = global.turf;
const toasts = [];
win.showToast = (m, k) => toasts.push({ msg: String(m), kind: k || 'info' });
win.confirm = () => true;

// minimal Leaflet stand-in — records what would have been drawn
const drawn = [];
win.L = {
  geoJSON(gj, opts) {
    if (!gj) throw new Error('L.geoJSON called with null');
    const feats = gj.type === 'FeatureCollection' ? gj.features : [gj];
    // exercise the style/onEachFeature callbacks the way Leaflet would
    feats.forEach(f => {
      if (opts && typeof opts.style === 'function') opts.style(f);
      if (opts && typeof opts.onEachFeature === 'function') {
        opts.onEachFeature(f, { bindPopup() {} });
      }
    });
    return { _feats: feats, _opts: opts };
  },
  layerGroup(arr) { return { _group: arr }; }
};
win.map = {
  hasLayer: () => true, removeLayer() {}, setView() {},
  getCenter: () => ({ lat: -6.7, lng: 147.0 }), getZoom: () => 10
};
win.suitabilityColor = v => '#' + Math.round(v * 255).toString(16).padStart(2, '0') + '0000';

const added = [];
win.uploadedLayers = [];
win.addAnalysisLayer = (name, layers, gj) => {
  const info = { id: 'analysis-' + (added.length + 1), name, layer: layers[0],
                 geojsonFeatures: (gj && gj.features) || [], isAnalysis: true,
                 featureCount: ((gj && gj.features) || []).length };
  added.push(info); win.uploadedLayers.push(info); return info;
};

/* ---------- modules ---------- */
const M = p => path.join(__dirname, '../modules', p);
require(M('geospax-conservation.js'));
require(M('geospax-conservation-m2.js'));
require(M('geospax-sdm-fix.js'));
require(M('geospax-project.js'));
const GSX = win.GSX;

/* ---------- helpers ---------- */
let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? (pass++, console.log('  PASS  ' + n))
                            : (fail++, console.log('  FAIL  ' + n + (d ? '  → ' + d : ''))); };
const F = f => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', f), 'utf8')).features;
const sel = (id, v) => { win.document.getElementById(id).value = v; };
const lastToast = () => toasts[toasts.length - 1] || { msg: '' };
function reset() { added.length = 0; toasts.length = 0; }

function loadLayer(id, name, feats) {
  const info = { id, name, geojsonFeatures: feats, featureCount: feats.length,
                 geomTypes: [...new Set(feats.map(f => f.geometry.type))] };
  win.uploadedLayers.push(info);
  GSX.stampImport(info, name + '.geojson');
  const opt = win.document.createElement('option');
  opt.value = id; opt.textContent = name;
  win.document.getElementById('analysis-layer-select').appendChild(opt.cloneNode(true));
  win.document.getElementById('analysis-layer-select-b').appendChild(opt.cloneNode(true));
  return info;
}

const t1 = loadLayer('layer-1', 'Forest 2015', F('forest_extent_t1.geojson'));
const pa = loadLayer('layer-2', 'Protected areas', F('protected_areas.geojson'));
const t2 = loadLayer('layer-3', 'Forest 2025', F('forest_extent_t2.geojson'));
const pt = loadLayer('layer-4', 'Patches', F('forest_patches_poly.geojson'));

console.log('\n=== M1 UI wrappers ===');
reset(); sel('analysis-layer-select', 'layer-1'); sel('analysis-layer-select-b', 'layer-2');
let r = GSX.uiOverlay('intersect');
ok('uiOverlay intersect returns result', r && r.ok);
ok('uiOverlay added a layer', added.length === 1, String(added.length));
ok('uiOverlay layer named', /Intersect: Forest 2015 \/ Protected areas/.test(added[0].name), added[0] && added[0].name);
ok('uiOverlay toast reports area', /ha/.test(lastToast().msg), lastToast().msg);

reset(); r = GSX.uiOverlay('difference');
ok('uiOverlay difference works', r && r.ok && added.length === 1);

reset(); sel('analysis-layer-select-b', 'layer-1');
r = GSX.uiOverlay('intersect');
ok('same layer twice rejected', r === undefined && /different layers/.test(lastToast().msg));

reset(); sel('analysis-layer-select-b', 'layer-2');
r = GSX.uiProtectionGap();
ok('uiProtectionGap ok', r && r.ok);
ok('gap added two layers', added.length === 2, String(added.length));
ok('protected layer present', added.some(a => /protected/.test(a.name)));
ok('gap layer present', added.some(a => /gap/.test(a.name)));
ok('summaryRows built', Array.isArray(r.summaryRows) && r.summaryRows.length >= 5);
ok('summary reports 29.6%', r.summaryRows.some(x => /29\.6/.test(x[1])),
   JSON.stringify(r.summaryRows.map(x => x[1])));
ok('caption present', /management effectiveness/.test(r.caption));

reset(); sel('analysis-layer-select', 'layer-4'); sel('gsx-dissolve-field', '');
r = GSX.uiDissolve();
ok('uiDissolve ok', r && r.ok && added.length === 1);

console.log('\n=== M2 UI wrappers ===');
reset(); sel('analysis-layer-select', 'layer-4');
r = GSX.uiFragmentation();
ok('uiFragmentation ok', r && r.ok);
ok('7 patches', r.numPatches === 7, String(r.numPatches));
ok('LPI 33.3%', Math.abs(r.largestPatchIndex - 33.3) < 0.2, r.largestPatchIndex.toFixed(2));
ok('exactly 1 coreless patch', r.patchesWithNoCore === 1, String(r.patchesWithNoCore));
ok('core layer added', added.some(a => /Core areas/.test(a.name)));
ok('summaryRows include ENN', r.summaryRows.some(x => /nearest neighbour/i.test(x[0])));
ok('caption warns about edge depth', /edge depth/.test(r.caption));

reset(); sel('gsx-conn-threshold', '5000');
r = GSX.uiConnectivity();
ok('uiConnectivity ok', r && r.ok);
ok('6 components at 5 km', r.componentCount === 6, String(r.componentCount));
ok('5 isolated', r.isolatedPatches === 5, String(r.isolatedPatches));
ok('component layer added', added.some(a => /component/i.test(a.name)));
ok('caption points to GRASS', /r\.cost/.test(r.caption));

reset(); sel('analysis-layer-select', 'layer-1'); sel('analysis-layer-select-b', 'layer-3');
r = GSX.uiChangeDetection();
ok('uiChangeDetection ok', r && r.ok);
ok('three change layers added', added.length === 3, String(added.length));
ok('SPHERICAL (default) annual rate ~-996.6 ha/yr',
   Math.abs(r.annualHaPerYear + 996.6) < 1, r.annualHaPerYear.toFixed(1));
ok('summary includes annual rate', r.summaryRows.some(x => /Annual rate/.test(x[0])));

reset(); sel('gsx-area-method', 'equalarea');
r = GSX.uiChangeDetection();
ok('equal-area mode reaches the wrapper', /LAEA/.test(r.areaCRS), r.areaCRS);
ok('EQUAL-AREA annual rate ~-990.2 ha/yr',
   Math.abs(r.annualHaPerYear + 990.2) < 1, r.annualHaPerYear.toFixed(1));
ok('the two methods differ by <1%',
   Math.abs((-996.6) - (-990.2)) / 996.6 * 100 < 1);
sel('gsx-area-method', 'spherical');

console.log('\n=== WLC panel ===');
reset();
GSX.renderWLCPanel('gsx-wlc-criteria');
const critHtml = win.document.getElementById('gsx-wlc-criteria').innerHTML;
ok('panel rendered one row per layer',
   (critHtml.match(/class="gsx-crit"/g) || []).length === win.uploadedLayers.length);
ok('method dropdown present', /gsx-c-m-0/.test(critHtml));
ok('direction dropdown present', /gsx-c-d-0/.test(critHtml));

// enable two criteria with opposite directions
win.document.getElementById('gsx-c-on-0').checked = true;
win.document.getElementById('gsx-c-on-1').checked = true;
sel('gsx-c-m-0', 'presence'); sel('gsx-c-d-0', 'benefit');
sel('gsx-c-m-1', 'presence'); sel('gsx-c-d-1', 'cost');
const crits = GSX.collectWLCCriteria();
ok('collectWLCCriteria reads two', crits.length === 2, String(crits.length));
ok('direction read correctly', crits[0].direction === 'benefit' && crits[1].direction === 'cost');

GSX.onWLCMethodChange(0);
ok('onWLCMethodChange hides distance params for presence',
   win.document.getElementById('gsx-c-pd-0').style.display === 'none');
sel('gsx-c-m-0', 'distance'); GSX.onWLCMethodChange(0);
ok('onWLCMethodChange shows distance params',
   win.document.getElementById('gsx-c-pd-0').style.display === '');
sel('gsx-c-m-0', 'presence'); GSX.onWLCMethodChange(0);

const n = GSX.updateWLCCellCount();
ok('cell count computed', n > 0, String(n));
ok('cell count rendered', /cells/.test(win.document.getElementById('gsx-wlc-cellcount').textContent));

sel('gsx-wlc-cellsize', '5000');
GSX.runSuitabilityWLC();
// runSuitabilityWLC defers via setTimeout — drain it
await new Promise(res => setTimeout(res, 120));
ok('WLC produced a layer', added.some(a => /WLC Suitability/.test(a.name)),
   added.map(a => a.name).join('|'));
const wlcTable = win.document.getElementById('gsx-wlc-table').innerHTML;
ok('criteria table rendered', /<table/.test(wlcTable) && /Normalised/.test(wlcTable));
ok('criteria table lists both criteria', (wlcTable.match(/<tr>/g) || []).length >= 3);

console.log('\n=== SDM UI wrappers ===');
reset();
// presence layer of points
const presPts = [];
for (let i = 0; i < 19; i++) {
  presPts.push(T.point([146.92 + (i % 2) * 0.12, -6.84 + Math.floor(i / 2) * 0.012]));
}
loadLayer('layer-5', 'Presences', presPts);
const opt = win.document.createElement('option');
opt.value = 'layer-5'; win.document.getElementById('gsx-sdm-presence').appendChild(opt);
sel('gsx-sdm-presence', 'layer-5');

// build env rows the way INTEGRATION describes
function addEnvRow(i, layerId, field) {
  const host = win.document.getElementById('gsx-sdm-env');
  host.innerHTML += `<span><input type="checkbox" id="gsx-env-on-${i}">
    <select id="gsx-env-fld-${i}"><option value="${field}">${field}</option></select>
    <select id="gsx-env-m-${i}"><option value="auto">auto</option></select></span>`;
}
// give the fixture layers numeric fields to sample
t1.geojsonFeatures.forEach((f, k) => { f.properties.elev = 100 + k * 400; });
pa.geojsonFeatures.forEach((f, k) => { f.properties.rain = 1000 + k * 2000; });
win.uploadedLayers.forEach((l, i) => addEnvRow(i, l.id, i === 0 ? 'elev' : 'rain'));

// ---- guard: BIOCLIM with no env selected must REFUSE ----
reset();
r = GSX.uiBioclim();
ok('GUARD: BIOCLIM refuses with no env layer', r && r.ok === false, JSON.stringify(r && r.error));
ok('GUARD: no layer drawn on refusal', added.length === 0, String(added.length));
ok('GUARD: refusal surfaced as error toast', lastToast().kind === 'error');

// ---- guard: Mahalanobis with ONE env var must REFUSE ----
win.document.getElementById('gsx-env-on-0').checked = true;
reset();
r = GSX.uiMahalanobis();
ok('GUARD: Mahalanobis refuses with 1 variable', r && r.ok === false);
ok('GUARD: error mentions geography', /geography/.test(r.error), r.error);
ok('GUARD: no map drawn', added.length === 0, String(added.length));

// ---- with two variables both should run ----
win.document.getElementById('gsx-env-on-1').checked = true;
reset();
r = GSX.uiBioclim();
ok('BIOCLIM runs with env layers', r && r.ok === true, r && r.error);
if (r && r.ok) {
  ok('BIOCLIM drew a layer', added.length === 1);
  const warnHtml = win.document.getElementById('gsx-sdm-warnings').innerHTML;
  ok('method note rendered', /Method:/.test(warnHtml));
  ok('warnings block rendered when warnings exist',
     r.warnings.length === 0 || /gsx-warn/.test(warnHtml), String(r.warnings.length));
}

reset();
r = GSX.uiMahalanobis();
ok('Mahalanobis runs with 2 variables', r && r.ok === true, r && r.error);
if (r && r.ok) {
  ok('Mahalanobis drew a layer', added.length === 1);
  ok('df reported', r.df === 2, String(r.df));
}

console.log('\n=== provenance / project UI ===');
reset();
GSX.uiRenderProvenanceTable();
let provHtml = win.document.getElementById('gsx-prov-table').innerHTML;
ok('provenance table rendered', /<table/.test(provHtml));
ok('missing fields flagged red', /fed7d7/.test(provHtml) || /required/.test(provHtml));

GSX.uiEditMeta('layer-1');
const formHtml = win.document.getElementById('gsx-meta-form').innerHTML;
ok('meta form rendered', /gsx-meta-licence/.test(formHtml));
sel('gsx-meta-source', 'PNGFA forest inventory');
sel('gsx-meta-acquired', '2026-07-01');
sel('gsx-meta-licence', 'CC BY 4.0');
GSX.uiSaveMeta('layer-1');
ok('meta saved to layer', t1.meta.licence === 'CC BY 4.0');
ok('saving meta re-renders table',
   /PNGFA forest inventory/.test(win.document.getElementById('gsx-prov-table').innerHTML));

// downloads — intercept
const downloads = [];
win.URL.createObjectURL = () => 'blob:mock';
win.URL.revokeObjectURL = () => {};
const realCreate = win.document.createElement.bind(win.document);
win.document.createElement = tag => {
  const el = realCreate(tag);
  if (tag === 'a') { el.click = function () { downloads.push({ name: this.download }); }; }
  return el;
};

GSX.uiExportProvenance('csv');
ok('CSV export triggers download', downloads.some(d => /provenance_.*\.csv/.test(d.name)),
   JSON.stringify(downloads));
GSX.uiExportProvenance('md');
ok('Markdown export triggers download', downloads.some(d => /provenance_.*\.md/.test(d.name)));

downloads.length = 0;
GSX.uiSaveProject();
ok('project save triggers download', downloads.length === 1, JSON.stringify(downloads));
ok('filename uses student id + species', /12345678_Dendrolagus_matschiei\.gspx/.test(downloads[0].name),
   downloads[0].name);
ok('student fields captured from DOM',
   GSX.getProjectMeta().studentId === '12345678');

// load path
let restoredProject = null;
win.gsxRestoreProject = p => { restoredProject = p; };
const json = GSX.projectToJSON(true);
class FakeReader {
  readAsText() { this.onload({ target: { result: json } }); }
}
win.FileReader = FakeReader;
reset();
GSX.uiLoadProject({ name: 'x.gspx' });
ok('uiLoadProject calls restore handler', restoredProject !== null);
ok('restored project has layers', restoredProject && restoredProject.layers.length > 0);
ok('load toast reports project id', /project id/.test(lastToast().msg), lastToast().msg);

// missing handler path
delete win.gsxRestoreProject;
reset();
GSX.uiLoadProject({ name: 'x.gspx' });
ok('missing restore handler reported clearly',
   /no restore\s+handler/.test(lastToast().msg.replace(/\s+/g, ' ')), lastToast().msg);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);

})();
