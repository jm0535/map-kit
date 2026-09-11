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

  // ── 4. WWF/RESOLVE Terrestrial Ecoregions ────────────────────────────────

  async function ecoregionsAdd() {
    showProcessing('Loading WWF/RESOLVE Terrestrial Ecoregions…');
    try {
      const resp = await fetch('https://openlayers.org/data/vector/ecoregions.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const geojson = await resp.json();
      hideProcessing();

      if (!geojson.features || geojson.features.length === 0) {
        showToast('No ecoregion data available', 'info');
        return;
      }

      addUploadedGeoJSON(geojson, 'WWF Ecoregions (846)', nextColor());
      showToast(`Loaded ${geojson.features.length} terrestrial ecoregions`, 'success');
    } catch (e) {
      hideProcessing();
      showToast('Ecoregions load failed: ' + e.message, 'error');
    }
  }

  // ── 5. Marine Ecoregions of the World (MEOW) ────────────────────────────
  // (Now handled by marineAdd() below via the VLIZ WFS layer selector)

  // ── 6. Marine Boundaries (VLIZ/MarineRegions, global, CORS-enabled) ──────

  const VLIZ_BASE = 'https://geo.vliz.be/geoserver/wfs?service=WFS&version=1.0.0' +
    '&request=GetFeature&outputFormat=application/json&maxFeatures=100';

  const MARINE_LAYERS = {
    'eez': { name: 'Exclusive Economic Zones (global)', typeName: 'MarineRegions:eez' },
    'eez_12nm': { name: 'Territorial Seas (12 NM, global)', typeName: 'MarineRegions:eez_12nm' },
    'eez_24nm': { name: 'Contiguous Zones (24 NM, global)', typeName: 'MarineRegions:eez_24nm' },
    'eez_boundaries': { name: 'EEZ Boundaries (global)', typeName: 'MarineRegions:eez_boundaries' },
    'ecoregions': { name: 'Marine Ecoregions (MEOW)', typeName: 'Ecoregions:ecoregions' },
  };

  async function marineAdd() {
    const sel = document.getElementById('marine-layer');
    if (!sel) return;
    const key = sel.value;
    const layer = MARINE_LAYERS[key];
    if (!layer) return;

    showProcessing('Loading Marine Boundaries: ' + layer.name + '…');
    try {
      const url = VLIZ_BASE + '&typeName=' + layer.typeName;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const geojson = await resp.json();
      hideProcessing();

      if (!geojson.features || geojson.features.length === 0) {
        showToast('No features in layer: ' + layer.name, 'info');
        return;
      }

      addUploadedGeoJSON(geojson, 'Marine: ' + layer.name, nextColor());
      showToast(`Loaded ${geojson.features.length} features from MarineRegions`, 'success');
    } catch (e) {
      hideProcessing();
      showToast('Marine layer load failed: ' + e.message, 'error');
    }
  }

  // ── 7. World Bank Indicators ────────────────────────────────────────────

  const WB_INDICATORS = {
    'SP.POP.TOTL': 'Total Population',
    'NY.GDP.MKTP.CD': 'GDP (current US$)',
    'EN.ATM.CO2E.KT': 'CO2 Emissions (kt)',
    'AG.LND.FRST.ZS': 'Forest Area (% of land area)',
    'EN.LND.LTSS.ZS': 'Land area below 5m elevation (%)',
    'ER.LND.PTLD.ZS': 'Protected land area (%)',
    'AG.LND.AGRI.ZS': 'Agricultural land (%)',
    'SH.STA.WASH.P5': 'Deaths from unsafe water (per 100k)',
  };

  async function worldBankQuery() {
    const indSel = document.getElementById('wb-indicator');
    if (!indSel) return;
    const indicatorCode = indSel.value;
    const indicatorName = WB_INDICATORS[indicatorCode] || indicatorCode;

    showProcessing('Fetching World Bank: ' + indicatorName + '…');
    try {
      // Fetch indicator data for all countries (most recent year)
      const url = 'https://api.worldbank.org/v2/country/all/indicator/' + indicatorCode +
        '?format=json&per_page=300&date=2020:2024&mrnev=1';
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      hideProcessing();

      // WB API returns [metadata, results array]
      const results = Array.isArray(data) && data.length >= 2 ? data[1] : null;
      if (!results || results.length === 0) {
        showToast('No data for indicator: ' + indicatorName, 'info');
        return;
      }

      // Convert to point GeoJSON using country centroid coordinates
      const features = results
        .filter(r => r.country && r.value !== null && r.countryiso3code)
        .map(r => ({
          type: 'Feature',
          geometry: null, // Will be set from country geojson if available
          properties: {
            country: r.country.value || '',
            iso3: r.countryiso3code || '',
            indicator: indicatorName,
            value: r.value,
            year: r.date || '',
            unit: r.unit || '',
          },
        }));

      // Fetch country centroids from Natural Earth to geocode
      const neResp = await fetch(NE_BASE + 'ne_110m_admin_0_countries.geojson');
      if (neResp.ok) {
        const neGeo = await neResp.json();
        const countryCentroids = {};
        for (const f of neGeo.features) {
          const props = f.properties || {};
          const iso3 = props.ISO_A3 || props.iso_a3 || '';
          if (iso3 && f.geometry) {
            // Simple centroid from bounds
            let coords = [];
            if (f.geometry.type === 'Polygon') coords = f.geometry.coordinates[0];
            else if (f.geometry.type === 'MultiPolygon') coords = f.geometry.coordinates[0][0];
            if (coords.length > 0) {
              let lat = 0, lon = 0;
              for (const c of coords) { lon += c[0]; lat += c[1]; }
              lat /= coords.length; lon /= coords.length;
              countryCentroids[iso3] = [lon, lat];
            }
          }
        }
        // Assign coordinates to features
        for (const f of features) {
          const centroid = countryCentroids[f.properties.iso3];
          if (centroid) {
            f.geometry = { type: 'Point', coordinates: centroid };
          }
        }
      }

      const geocoded = features.filter(f => f.geometry !== null);
      if (geocoded.length === 0) {
        showToast('No geocodable data for indicator: ' + indicatorName, 'info');
        return;
      }

      const geojson = { type: 'FeatureCollection', features: geocoded };
      addUploadedGeoJSON(geojson, 'WB: ' + indicatorName, nextColor());
      showToast(`Loaded ${geocoded.length} country records from World Bank`, 'success');
    } catch (e) {
      hideProcessing();
      showToast('World Bank query failed: ' + e.message, 'error');
    }
  }

  // ── 8. OSM Quick Queries (pre-configured for common categories) ───────────
  // One-click Overpass queries for roads, rivers, lakes, wetlands, mountains,
  // conservation areas, forests, and mining areas. All use the current map bbox.

  const OSM_QUICK_QUERIES = {
    roads: {
      label: 'Roads',
      icon: '\u{1F6E3}\u{FE0F}',
      desc: 'highway=motorway, trunk, primary, secondary, tertiary, residential, unclassified, track',
      tag: 'highway',
      values: ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'track'],
      layerName: 'OSM: Roads',
    },
    rivers: {
      label: 'Rivers & Streams',
      icon: '\u{1F4A7}',
      desc: 'waterway=river, stream, canal, tidal_creek',
      tag: 'waterway',
      values: ['river', 'stream', 'canal', 'tidal_creek'],
      layerName: 'OSM: Rivers',
    },
    lakes: {
      label: 'Lakes & Ponds',
      icon: '\u{1F3DE}\u{FE0F}',
      desc: 'natural=water (lakes, ponds, reservoirs)',
      tag: 'natural',
      values: ['water'],
      layerName: 'OSM: Lakes',
    },
    wetlands: {
      label: 'Wetlands & Swamps',
      icon: '\u{1F33C}',
      desc: 'natural=wetland (swamps, marshes, bogs, mangroves)',
      tag: 'natural',
      values: ['wetland'],
      layerName: 'OSM: Wetlands',
    },
    mountains: {
      label: 'Mountains & Peaks',
      icon: '\u{26F0}\u{FE0F}',
      desc: 'natural=peak, volcano, ridge, cliff, saddle',
      tag: 'natural',
      values: ['peak', 'volcano', 'ridge', 'cliff', 'saddle'],
      layerName: 'OSM: Mountains',
    },
    conservation: {
      label: 'Conservation Areas',
      icon: '\u{1F9BE}',
      desc: 'boundary=protected_area, national_park; leisure=nature_reserve',
      tag: null, // multi-tag query
      layerName: 'OSM: Conservation Areas',
    },
    forest: {
      label: 'Forest & Timber',
      icon: '\u{1F332}',
      desc: 'landuse=forest, forestry; natural=wood',
      tag: null,
      layerName: 'OSM: Forest & Timber',
    },
    mining: {
      label: 'Mining & Quarries',
      icon: '\u{26CF}\u{FE0F}',
      desc: 'landuse=quarry; man_made=mineshaft; historic=mine',
      tag: null,
      layerName: 'OSM: Mining Areas',
    },
  };

  async function osmQuickQuery(key) {
    const cfg = OSM_QUICK_QUERIES[key];
    if (!cfg) return;

    const bbox = _getMapBBox();
    const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

    // Build Overpass QL query
    let tagFilters;
    if (cfg.tag && cfg.values) {
      // Single tag with multiple values: ["key"~"value1|value2|..."]
      tagFilters = `["${cfg.tag}"~"^(${cfg.values.join('|')})$"]`;
    } else if (key === 'conservation') {
      // Multi-tag: boundary=protected_area OR boundary=national_park OR leisure=nature_reserve
      tagFilters = null;
    } else if (key === 'forest') {
      tagFilters = null;
    } else if (key === 'mining') {
      tagFilters = null;
    }

    let query;
    if (tagFilters) {
      query = `[out:json][timeout:25];(node${tagFilters}(${bboxStr});way${tagFilters}(${bboxStr});relation${tagFilters}(${bboxStr}););out center geom;`;
    } else if (key === 'conservation') {
      query = `[out:json][timeout:25];(` +
        `way["boundary"="protected_area"](${bboxStr});` +
        `way["boundary"="national_park"](${bboxStr});` +
        `way["leisure"="nature_reserve"](${bboxStr});` +
        `relation["boundary"="protected_area"](${bboxStr});` +
        `relation["boundary"="national_park"](${bboxStr});` +
        `relation["leisure"="nature_reserve"](${bboxStr});` +
        `);out center geom;`;
    } else if (key === 'forest') {
      query = `[out:json][timeout:25];(` +
        `way["landuse"="forest"](${bboxStr});` +
        `way["landuse"="forestry"](${bboxStr});` +
        `way["natural"="wood"](${bboxStr});` +
        `relation["landuse"="forest"](${bboxStr});` +
        `relation["landuse"="forestry"](${bboxStr});` +
        `relation["natural"="wood"](${bboxStr});` +
        `);out center geom;`;
    } else if (key === 'mining') {
      query = `[out:json][timeout:25];(` +
        `way["landuse"="quarry"](${bboxStr});` +
        `node["man_made"="mineshaft"](${bboxStr});` +
        `node["historic"="mine"](${bboxStr});` +
        `way["historic"="mine"](${bboxStr});` +
        `);out center geom;`;
    }

    showProcessing('Querying OpenStreetMap: ' + cfg.label + '...');
    try {
      const data = await _overpassFetch(query);
      hideProcessing();

      if (!data.elements || data.elements.length === 0) {
        showToast('No ' + cfg.label + ' found in current map view', 'info');
        return;
      }

      const geojson = _osmToGeoJSON(data.elements);
      addUploadedGeoJSON(geojson, cfg.layerName, nextColor());
      showToast(`Loaded ${geojson.features.length} ${cfg.label} from OSM`, 'success');
    } catch (e) {
      hideProcessing();
      showToast(cfg.label + ' query failed: ' + e.message, 'error');
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────
  return {
    overpassQuery,
    gbifQuery,
    naturalEarthAdd,
    ecoregionsAdd,
    marineAdd,
    worldBankQuery,
    osmQuickQuery,
    OSM_QUICK_QUERIES,
  };
})();
