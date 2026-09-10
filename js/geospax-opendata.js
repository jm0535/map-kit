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
      showToast('Enter a species name (e.g. lion or Panthera leo)', 'error');
      return;
    }

    const taxonName = taxonInput.value.trim();
    const limitInput = document.getElementById('gbif-limit');
    let limit = limitInput ? parseInt(limitInput.value) : 300;
    if (isNaN(limit) || limit < 1) limit = 1;
    if (limit > 10000) limit = 10000;

    showProcessing('Searching GBIF occurrences…');

    try {
      // Step 1: resolve name to GBIF taxon key
      // Try scientific name match first, then fall back to full-text search
      // (which handles common/vernacular names like "lion", "oak", "monarch")
      let taxonKey = null;
      let resolvedName = taxonName;

      // 1a: Try exact scientific name match
      const matchResp = await fetch(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(taxonName)}`
      );
      if (matchResp.ok) {
        const matchData = await matchResp.json();
        if (matchData.usageKey) {
          taxonKey = matchData.usageKey;
          resolvedName = matchData.scientificName || taxonName;
        }
      }

      // 1b: If no scientific match, try full-text species search (handles common names)
      if (!taxonKey) {
        const searchResp = await fetch(
          `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(taxonName)}&rank=SPECIES&limit=20&qField=VERNACULAR`
        );
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          if (searchData.results && searchData.results.length > 0) {
            // Find the result whose vernacular name best matches the query
            const qLower = taxonName.toLowerCase();
            let best = searchData.results[0];
            for (const r of searchData.results) {
              const vn = (r.vernacularNames || []).map(v => v.vernacularName.toLowerCase());
              if (vn.some(n => n === qLower)) { best = r; break; }
            }
            // Use nubKey (backbone taxonomy key) for occurrence search, fall back to key
            taxonKey = best.nubKey || best.key;
            resolvedName = best.scientificName || taxonName;
          }
        }
      }

      // 1c: Broader search without VERNACULAR field restriction
      if (!taxonKey) {
        const searchResp2 = await fetch(
          `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(taxonName)}&limit=20`
        );
        if (searchResp2.ok) {
          const searchData2 = await searchResp2.json();
          if (searchData2.results && searchData2.results.length > 0) {
            // Prefer species-level results
            const speciesResult = searchData2.results.find(r => r.rank === 'SPECIES');
            const r = speciesResult || searchData2.results[0];
            // Use nubKey for backbone taxonomy, fall back to key
            taxonKey = r.nubKey || r.key;
            resolvedName = r.scientificName || taxonName;
          }
        }
      }

      if (!taxonKey) {
        hideProcessing();
        showToast('No matching species found for: ' + taxonName, 'error');
        return;
      }

      // Step 2: search occurrences within map bbox (paginate, max 300 per request)
      const bbox = _getMapBBox();
      const bboxStr = `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
      const PAGE_SIZE = 300;
      let allResults = [];
      let offset = 0;
      let total = Infinity;

      while (offset < limit && offset < total && offset < 100000) {
        const pageLen = Math.min(PAGE_SIZE, limit - offset);
        const pageUrl = `https://api.gbif.org/v1/occurrence/search?taxon_key=${taxonKey}` +
          `&limit=${pageLen}&offset=${offset}` +
          `&bbox=${bboxStr}` +
          `&hasCoordinate=true`;

        const occResp = await fetch(pageUrl);
        if (!occResp.ok) throw new Error('Occurrence search failed (HTTP ' + occResp.status + ')');
        const occData = await occResp.json();
        total = occData.count || 0;

        if (!occData.results || occData.results.length === 0) break;
        allResults = allResults.concat(occData.results);
        offset += occData.results.length;
        if (occData.results.length < pageLen) break; // no more results
        if (offset < limit && offset < total) {
          showProcessing(`Fetching GBIF occurrences… ${Math.min(offset, limit)} / ${Math.min(total, limit)}`);
        }
      }
      hideProcessing();

      if (allResults.length === 0) {
        showToast('No occurrences found for ' + taxonName + ' in current view', 'info');
        return;
      }

      // Convert to GeoJSON
      const features = allResults
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
      showToast(`Loaded ${features.length} of ${total} occurrence records from GBIF`, 'success');
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
