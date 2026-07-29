const ROOT = process.env.GEOSPAX_ROOT || require('path').resolve(__dirname, '../../..');
const V = p => require('path').join(ROOT, 'vendor', p);
const path=require('path');
global.window = global;
global.turf = require(V('turf-6.5.0.min.js'));
const M = p => path.join(__dirname,'../modules',p);
require(M('geospax-conservation.js'));
require(M('geospax-raster.js'));
const GSX = global.GSX, T = global.turf;

let pass=0,fail=0;
const ok=(n,c,d)=>{c?(pass++,console.log('  PASS  '+n)):(fail++,console.log('  FAIL  '+n+(d?'  → '+d:'')));};
const close=(a,b,tol,n)=>ok(n,Math.abs(a-b)<=tol,`${a} vs ${b}`);

// synthetic raster: 20x20 over 0.2 x 0.2 deg at PNG latitude
function mkRaster(fn, w=20, h=20, nodata=null){
  const vals=[[]];
  for(let y=0;y<h;y++){ const row=[]; for(let x=0;x<w;x++) row.push(fn(x,y)); vals[0].push(row); }
  return { values:vals, width:w, height:h,
           xmin:147.0, xmax:147.2, ymin:-6.9, ymax:-6.7,
           pixelWidth:0.01, pixelHeight:0.01, noDataValue:nodata };
}

console.log('\n=== raster info + histogram ===');
const ramp = mkRaster((x)=>x/19);          // 0..1 left to right
const info = GSX.rasterInfo(ramp,0);
ok('info reads dims', info.width===20 && info.height===20);
close(info.pixelWidth,0.01,1e-9,'pixel width');
const h = GSX.rasterHistogram(ramp,0,10);
ok('histogram ok', h.ok);
close(h.min,0,1e-9,'min'); close(h.max,1,1e-9,'max');
ok('all cells valid', h.validCells===400 && h.noDataCells===0);
ok('counts sum to valid cells', h.counts.reduce((a,b)=>a+b,0)===400);

const constant = mkRaster(()=>0.5);
ok('constant raster rejected with a clear message',
   !GSX.rasterHistogram(constant,0,10).ok);

const withNodata = mkRaster((x,y)=> (y<5 ? -9999 : x/19), 20,20, -9999);
const h2 = GSX.rasterHistogram(withNodata,0,10);
ok('nodata excluded', h2.validCells===300 && h2.noDataCells===100,
   `${h2.validCells}/${h2.noDataCells}`);

console.log('\n=== Otsu ===');
// bimodal: half at 0.1, half at 0.9 -> break should land near 0.5
const bimodal = mkRaster((x)=> x<10 ? 0.1 : 0.9);
const hb = GSX.rasterHistogram(bimodal,0,64);
const otsu = GSX.otsuThreshold(hb);
ok('Otsu separates a bimodal raster', otsu>0.1 && otsu<0.9, String(otsu));
ok('Otsu lands near the midpoint of the tied range',
   Math.abs(otsu-0.5)<0.1, String(otsu));
const otsuRc = GSX.reclassifyBinary(bimodal,{threshold:otsu,operator:'>='});
ok('reclassifying at Otsu splits the raster exactly in half',
   otsuRc.cellsIn===200 && otsuRc.cellsOut===200, `${otsuRc.cellsIn}/${otsuRc.cellsOut}`);
ok('Otsu null on bad histogram', GSX.otsuThreshold({ok:false})===null);

console.log('\n=== reclassify ===');
const rc = GSX.reclassifyBinary(bimodal,{threshold:0.5,operator:'>='});
ok('reclassify ok', rc.ok);
ok('half the cells pass', rc.cellsIn===200 && rc.cellsOut===200,
   `${rc.cellsIn}/${rc.cellsOut}`);
close(rc.proportionIn,0.5,1e-9,'proportion');
const rcLess = GSX.reclassifyBinary(bimodal,{threshold:0.5,operator:'<'});
ok('operator < inverts selection', rcLess.cellsIn===200 && rcLess.cellsOut===200);
ok('missing threshold rejected', !GSX.reclassifyBinary(bimodal,{}).ok);
const rcND = GSX.reclassifyBinary(withNodata,{threshold:0.5,operator:'>='});
ok('nodata never passes threshold', rcND.noDataCells===100);

console.log('\n=== RLE polygonize ===');
// single solid block 10 wide x 20 tall -> ONE rectangle
const blockRects = GSX.maskToRectangles(rc.mask, GSX.rasterInfo(bimodal,0));
ok('solid block merges to 1 rectangle', blockRects.length===1, String(blockRects.length));
ok('rectangle spans full height', blockRects[0].y0===0 && blockRects[0].y1===20);
ok('rectangle spans right half', blockRects[0].x0===10 && blockRects[0].x1===20);

// checkerboard -> worst case, one rect per cell
const checker = mkRaster((x,y)=> (x+y)%2 ? 1 : 0);
const cRc = GSX.reclassifyBinary(checker,{threshold:0.5});
const cRects = GSX.maskToRectangles(cRc.mask, GSX.rasterInfo(checker,0));
ok('checkerboard gives one rect per set cell', cRects.length===200, String(cRects.length));
// rectangles must tile the mask exactly — no overlap, no gaps
const cellsFromRects = r => r.reduce((s,x)=>s+(x.x1-x.x0)*(x.y1-x.y0),0);
ok('rectangles tile the block mask exactly (no overlap)',
   cellsFromRects(blockRects)===rc.cellsIn, `${cellsFromRects(blockRects)} vs ${rc.cellsIn}`);
ok('rectangles tile the checkerboard exactly',
   cellsFromRects(cRects)===cRc.cellsIn, `${cellsFromRects(cRects)} vs ${cRc.cellsIn}`);

console.log('\n=== geo conversion ===');
const gj = GSX.rectanglesToGeoJSON(blockRects, GSX.rasterInfo(bimodal,0));
ok('one polygon out', gj.length===1);
const ring = gj[0].geometry.coordinates[0];
close(ring[0][0],147.1,1e-9,'left edge lng = xmin + 10*pw');
close(ring[0][1],-6.7,1e-9,'top edge lat = ymax (row 0 is north)');
close(ring[2][1],-6.9,1e-9,'bottom edge lat = ymin');
ok('ring is closed', ring[0][0]===ring[4][0] && ring[0][1]===ring[4][1]);

console.log('\n=== full pipeline ===');
const res = GSX.rasterToPolygons(bimodal,{threshold:0.5,operator:'>=',dissolve:true});
ok('pipeline ok', res.ok);
ok('1 patch', res.patchCount===1, String(res.patchCount));
// expected area: half the raster extent
const whole = T.polygon([[[147.0,-6.9],[147.0,-6.7],[147.2,-6.7],[147.2,-6.9],[147.0,-6.9]]]);
close(res.totalAreaM2/T.area(whole), 0.5, 0.01, 'area is half the raster extent');
ok('properties stamped', res.features[0].properties.threshold===0.5 &&
   res.features[0].properties.class_id===1);

// donut: hole must be preserved after dissolve
const donut = mkRaster((x,y)=> (x>4&&x<15&&y>4&&y<15) ? ((x>7&&x<12&&y>7&&y<12)?0:1) : 0);
const donutRc = GSX.reclassifyBinary(donut,{threshold:0.5});
const donutRects = GSX.maskToRectangles(donutRc.mask, GSX.rasterInfo(donut,0));
ok('donut rectangles tile exactly (84 cells)',
   cellsFromRects(donutRects)===84, String(cellsFromRects(donutRects)));
const dRes = GSX.rasterToPolygons(donut,{threshold:0.5,dissolve:true});
ok('donut polygonizes', dRes.ok);
const dGeom = dRes.features[0].geometry;
const rings = dGeom.type==='Polygon' ? dGeom.coordinates.length
            : dGeom.coordinates.reduce((s,p)=>s+p.length,0);
ok('INTERIOR HOLE PRESERVED after dissolve', rings>=2, `rings=${rings}`);
// area must exclude the hole
const outerCells=10*10, holeCells=4*4;
close(dRes.totalAreaM2/(T.area(whole)/400), outerCells-holeCells, 1.5,
      'area excludes the hole');

// error paths
ok('empty selection rejected',
   !GSX.rasterToPolygons(bimodal,{threshold:5,operator:'>='}).ok);
ok('oversized raster rejected',
   !GSX.rasterToPolygons(bimodal,{threshold:0.5,maxCells:10}).ok);
const noisy = mkRaster(()=>Math.random());
ok('noisy raster hits the fragment cap with an explanation', (()=>{
  const r=GSX.rasterToPolygons(noisy,{threshold:0.5,maxRects:10});
  return !r.ok && /fragments/.test(r.error);
})());

// undissolved path
const und = GSX.rasterToPolygons(bimodal,{threshold:0.5,dissolve:false});
ok('dissolve:false returns raw rectangles',
   und.ok && und.patchCount===und.rectangleCount);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail===0?0:1);
