// ═══════════════════════════════════════════════════════════════════════════
// GeoSpaX Open Data Connectors
// Free, no-API-key data sources: OSM Overpass, GBIF, Natural Earth, USGS WMS
// ═══════════════════════════════════════════════════════════════════════════

const GSX_OpenData = (function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _getMapBBox() {
    const b = map.getBounds();
    return {
      south: b.getSouth(), west: b.getWest(),
      north: b.getNorth(), east: b.getEast(),
    };
  }

  function _osmToGeoJSON(elements) {
    // Convert Overpass API JSON elements to GeoJSON FeatureCollection
    const nodes = {};
    const features = [];

    for (const el of elements) {
      if (el.type === 'node' && el.lat !== undefined) {
        nodes[el.id] = { lat: el.lat, lon: el.lon };
      }
    }

    for (const el of elements) {
      if (el.type === 'node' && el.lat !== undefined) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
          properties: Object.assign({ id: el.id }, el.tags || {}),
        });
      } else if (el.type === 'way' && el.geometry) {
        // 'out geom' gives us coordinates directly
        const coords = el.geometry.map(p => [p.lon, p.lat]);
        const isClosed = coords.length >= 4 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1];
        features.push({
          type: 'Feature',
          geometry: { type: isClosed ? 'Polygon' : 'LineString', coordinates: isClosed ? [coords] : coords },
          properties: Object.assign({ id: el.id }, el.tags || {}),
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }

  // ── 1. OpenStreetMap Overpass API ────────────────────────────────────────

  const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  let _overpassIdx = 0;

  async function overpassQuery() {
    const tagInput = document.getElementById('overpass-tag');
    if (!tagInput || !tagInput.value.trim()) {
      showToast('Enter an OSM tag (e.g. amenity=school)', 'error');
      return;
    }

    const tag = tagInput.value.trim();
    // Parse key=value or just key
    let tagFilter;
    if (tag.includes('=')) {
      const [k, v] = tag.split('=', 2);
      tagFilter = `["${k.trim()}"="${v.trim()}"]`;
    } else {
      tagFilter = `["${tag.trim()}"]`;
    }

    const bbox = _getMapBBox();
    const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    const query = `[out:json][timeout:25];(node${tagFilter}(${bboxStr});way${tagFilter}(${bboxStr});relation${tagFilter}(${bboxStr}););out center geom;`;

    showProcessing('Querying OpenStreetMap Overpass API…');

    try {
      const data = await _overpassFetch(query);
      hideProcessing();

      if (!data.elements || data.elements.length === 0) {
        showToast('No features found for tag: ' + tag, 'info');
        return;
      }

      const geojson = _osmToGeoJSON(data.elements);
      const name = 'OSM: ' + tag;
      addUploadedGeoJSON(geojson, name, nextColor());
      showToast(`Loaded ${geojson.features.length} features from OSM`, 'success');
    } catch (e) {
      hideProcessing();
      showToast('Overpass query failed: ' + e.message, 'error');
    }
  }

  async function _overpassFetch(query) {
    // Try each endpoint in turn
    for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
      const endpoint = OVERPASS_ENDPOINTS[(_overpassIdx + attempt) % OVERPASS_ENDPOINTS.length];
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        _overpassIdx = (_overpassIdx + attempt) % OVERPASS_ENDPOINTS.length;
        return await resp.json();
      } catch (e) {
        if (attempt === OVERPASS_ENDPOINTS.length - 1) throw e;
      }
    }
  }

  // ── 2. GBIF Biodiversity Occurrence API ──────────────────────────────────

  async function gbifQuery() {
    const taxonInput = document.getElementById('gbif-taxon');
    if (!taxonInput || !taxonInput.value.trim()) {
      showToast('Enter a scientific name (e.g. Panthera leo)', 'error');
      return;
    }

    const taxonName = taxonInput.value.trim();
    const limitSelect = document.getElementById('gbif-limit');
    const limit = limitSelect ? parseInt(limitSelect.value) : 300;

    showProcessing('Searching GBIF occurrences…');

    try {
      // Step 1: resolve taxon name to GBIF taxon key
      const matchResp = await fetch(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(taxonName)}`
      );
      if (!matchResp.ok) throw new Error('Taxon match failed (HTTP ' + matchResp.status + ')');
      const matchData = await matchResp.json();
      const taxonKey = matchData.usageKey;
      if (!taxonKey) {
        hideProcessing();
        showToast('No matching taxon found for: ' + taxonName, 'error');
        return;
      }

      // Step 2: search occurrences within map bbox
      const bbox = _getMapBBox();
      const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
      const searchUrl = `https://api.gbif.org/v1/occurrence/search?taxon_key=${taxonKey}` +
        `&limit=${limit}&offset=0` +
        `&bbox=${bboxStr}` +
        `&hasCoordinate=true`;

      const occResp = await fetch(searchUrl);
      if (!occResp.ok) throw new Error('Occurrence search failed (HTTP ' + occResp.status + ')');
      const occData = await occResp.json();
      hideProcessing();

      if (!occData.results || occData.results.length === 0) {
        showToast('No occurrences found for ' + taxonName + ' in current view', 'info');
        return;
      }

      // Convert to GeoJSON
      const features = occData.results
        .filter(r => r.decimalLatitude !== undefined && r.decimalLongitude !== undefined)
        .map(r => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.decimalLongitude, r.decimalLatitude] },
          properties: {
            species: r.species || r.scientificName || taxonName,
            kingdom: r.kingdom || '',
            phylum: r.phylum || '',
            class: r.class || '',
            order: r.order || '',
            family: r.family || '',
            genus: r.genus || '',
            year: r.year || '',
            month: r.month || '',
            basisOfRecord: r.basisOfRecord || '',
            institution: r.institutionCode || '',
            catalogNumber: r.catalogNumber || '',
            gbifID: r.key || '',
          },
        }));

      if (features.length === 0) {
        showToast('No georeferenced occurrences found', 'info');
        return;
      }

      const geojson = { type: 'FeatureCollection', features };
      const name = 'GBIF: ' + taxonName;
      addUploadedGeoJSON(geojson, name, nextColor());
      showToast(`Loaded ${features.length} occurrence records from GBIF`, 'success');
    } catch (e) {
      hideProcessing();
      showToast('GBIF query failed: ' + e.message, 'error');
    }
  }

  // ── 3. Natural Earth Reference Layers ────────────────────────────────────

  const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

  async function naturalEarthAdd() {
    const sel = document.getElementById('naturalearth-layer');
    if (!sel) return;
    const layerKey = sel.value;
    const layerName = sel.options[sel.selectedIndex].textContent;

    showProcessing('Loading Natural Earth: ' + layerName + '…');

    try {
      const url = NE_BASE + layerKey + '.geojson';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const geojson = await resp.json();
      hideProcessing();

      if (!geojson.features || geojson.features.length === 0) {
        showToast('No features in layer: ' + layerName, 'info');
        return;
      }

      addUploadedGeoJSON(geojson, 'NE: ' + layerName, nextColor());
      showToast(`Loaded ${geojson.features.length} features from Natural Earth`, 'success');
    } catch (e) {
      hideProcessing();
      showToast('Natural Earth load failed: ' + e.message, 'error');
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────
  return {
    overpassQuery,
    gbifQuery,
    naturalEarthAdd,
  };
})();
