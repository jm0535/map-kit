// ═══════════════════════════════════════════════════════════════════════════
// GeoSpaX GeoPackage (.gpkg) Reader
// ═══════════════════════════════════════════════════════════════════════════
// Reads OGC GeoPackage files (SQLite-based) in the browser using sql.js.
// Parses GeoPackage geometry blobs (GP header + WKB) into GeoJSON.
// Supports multiple feature layers per GeoPackage.
// ═══════════════════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  let _sqlReady = null;

  function initSql() {
    if (_sqlReady) return _sqlReady;
    _sqlReady = (async () => {
      if (typeof initSqlJs === 'undefined') {
        throw new Error('sql.js not loaded — cannot read GeoPackage files');
      }
      const SQL = await initSqlJs({
        locateFile: f => 'vendor/sqljs/' + f,
      });
      return SQL;
    })();
    return _sqlReady;
  }

  // ── WKB parser ──────────────────────────────────────────────────────────
  // Parses Well-Known Binary (WKB) into GeoJSON geometry objects.
  // Supports: Point, LineString, Polygon, MultiPoint, MultiLineString,
  //           MultiPolygon, GeometryCollection.

  function parseWKB(buf) {
    const dv = new DataView(buf);
    let offset = 0;

    function readPoint() {
      const x = dv.getFloat64(offset, true); offset += 8;
      const y = dv.getFloat64(offset, true); offset += 8;
      return [x, y];
    }

    function readLineString() {
      const n = dv.getUint32(offset, true); offset += 4;
      const coords = [];
      for (let i = 0; i < n; i++) coords.push(readPoint());
      return coords;
    }

    function readPolygon() {
      const nRings = dv.getUint32(offset, true); offset += 4;
      const rings = [];
      for (let r = 0; r < nRings; r++) {
        const n = dv.getUint32(offset, true); offset += 4;
        const ring = [];
        for (let i = 0; i < n; i++) ring.push(readPoint());
        rings.push(ring);
      }
      return rings;
    }

    function readGeometry() {
      const byteOrder = dv.getUint8(offset); offset += 1;
      const le = (byteOrder === 1); // 1 = little-endian, 0 = big-endian
      const type = dv.getUint32(offset, le); offset += 4;
      const baseType = type & 0xFF;
      const hasZ = (type & 0x80000000) || (type & 0x01) === 0x02; // simplified
      const hasM = false;

      switch (baseType) {
        case 1: { // Point
          const x = dv.getFloat64(offset, le); offset += 8;
          const y = dv.getFloat64(offset, le); offset += 8;
          if (hasZ) { const z = dv.getFloat64(offset, le); offset += 8; return { type: 'Point', coordinates: [x, y, z] }; }
          return { type: 'Point', coordinates: [x, y] };
        }
        case 2: { // LineString
          const n = dv.getUint32(offset, le); offset += 4;
          const coords = [];
          for (let i = 0; i < n; i++) {
            const x = dv.getFloat64(offset, le); offset += 8;
            const y = dv.getFloat64(offset, le); offset += 8;
            if (hasZ) { const z = dv.getFloat64(offset, le); offset += 8; coords.push([x, y, z]); }
            else coords.push([x, y]);
          }
          return { type: 'LineString', coordinates: coords };
        }
        case 3: { // Polygon
          const nRings = dv.getUint32(offset, le); offset += 4;
          const rings = [];
          for (let r = 0; r < nRings; r++) {
            const n = dv.getUint32(offset, le); offset += 4;
            const ring = [];
            for (let i = 0; i < n; i++) {
              const x = dv.getFloat64(offset, le); offset += 8;
              const y = dv.getFloat64(offset, le); offset += 8;
              if (hasZ) { const z = dv.getFloat64(offset, le); offset += 8; ring.push([x, y, z]); }
              else ring.push([x, y]);
            }
            rings.push(ring);
          }
          return { type: 'Polygon', coordinates: rings };
        }
        case 4: { // MultiPoint
          const n = dv.getUint32(offset, le); offset += 4;
          const coords = [];
          for (let i = 0; i < n; i++) {
            const g = readGeometry();
            coords.push(g.coordinates);
          }
          return { type: 'MultiPoint', coordinates: coords };
        }
        case 5: { // MultiLineString
          const n = dv.getUint32(offset, le); offset += 4;
          const coords = [];
          for (let i = 0; i < n; i++) {
            const g = readGeometry();
            coords.push(g.coordinates);
          }
          return { type: 'MultiLineString', coordinates: coords };
        }
        case 6: { // MultiPolygon
          const n = dv.getUint32(offset, le); offset += 4;
          const coords = [];
          for (let i = 0; i < n; i++) {
            const g = readGeometry();
            coords.push(g.coordinates);
          }
          return { type: 'MultiPolygon', coordinates: coords };
        }
        case 7: { // GeometryCollection
          const n = dv.getUint32(offset, le); offset += 4;
          const geoms = [];
          for (let i = 0; i < n; i++) {
            const g = readGeometry();
            geoms.push(g);
          }
          return { type: 'GeometryCollection', geometries: geoms };
        }
        default:
          return null;
      }
    }

    return readGeometry();
  }

  // ── GeoPackage geometry blob parser ────────────────────────────────────
  // GeoPackage stores geometry as a binary blob with a GP header followed
  // by WKB. The header format is defined in OGC GeoPackage spec §2.1.3.

  function parseGpkgGeometry(blob) {
    if (!blob) return null;
    // sql.js returns Uint8Array; normalise to ArrayBuffer
    let buf;
    if (blob instanceof ArrayBuffer) {
      buf = blob;
    } else if (blob instanceof Uint8Array) {
      buf = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
    } else {
      return null;
    }
    const dv = new DataView(buf);

    // GP header (OGC GeoPackage spec §2.1.3)
    const magic0 = dv.getUint8(0);
    const magic1 = dv.getUint8(1);
    if (magic0 !== 0x47 || magic1 !== 0x50) {
      // Not a GP header — try raw WKB
      return parseWKB(buf);
    }

    // const version = dv.getUint8(2);  // not needed for parsing
    const flags = dv.getUint8(3);

    // Byte order: bit 0 of flags (0 = big-endian, 1 = little-endian)
    // const le = (flags & 0x01) ? true : false;  // WKB has its own byte order

    // Envelope type: bits 1-3 of flags
    const envType = (flags >> 1) & 0x07;

    // Header: magic(2) + version(1) + flags(1) + srs_id(4) = 8 bytes
    let headerSize = 8;
    switch (envType) {
      case 0: headerSize += 0; break;           // no envelope
      case 1: headerSize += 32; break;          // XY (4 doubles: minX, maxX, minY, maxY)
      case 2: headerSize += 48; break;          // XYZ (6 doubles)
      case 3: headerSize += 48; break;          // XYM (6 doubles)
      case 4: headerSize += 64; break;          // XYZM (8 doubles)
      default: headerSize += 0; break;         // unknown — assume no envelope
    }

    // WKB starts after the header
    const wkbBuf = buf.slice(headerSize);
    return parseWKB(wkbBuf);
  }

  // ── Main reader ────────────────────────────────────────────────────────

  async function readGeoPackage(file) {
    const SQL = await initSql();
    const buf = await file.arrayBuffer();
    const db = new SQL.Database(new Uint8Array(buf));

    try {
      // Get feature tables from gpkg_contents
      const contents = db.exec(
        "SELECT table_name, data_type, identifier, description FROM gpkg_contents WHERE data_type = 'features'"
      );

      if (!contents.length || !contents[0].values.length) {
        // No feature tables — maybe it has tile or attributes tables
        const allContents = db.exec("SELECT table_name, data_type FROM gpkg_contents");
        if (allContents.length && allContents[0].values.length) {
          const types = allContents[0].values.map(r => r[1]).join(', ');
          throw new Error('GeoPackage has no feature layers. Found: ' + types);
        }
        throw new Error('GeoPackage has no feature tables');
      }

      const layers = [];
      const tables = contents[0].values;

      for (const row of tables) {
        const tableName = row[0];
        const identifier = row[2] || tableName;
        const description = row[3] || '';

        // Get geometry column name from gpkg_geometry_columns
        let geomCol = 'geom';
        try {
          const geomCols = db.exec(
            `SELECT column_name, geometry_type_name, srs_id FROM gpkg_geometry_columns WHERE table_name = '${tableName.replace(/'/g, "''")}'`
          );
          if (geomCols.length && geomCols[0].values.length) {
            geomCol = geomCols[0].values[0][0];
          }
        } catch (e) { /* use default */ }

        // Get column names for this table
        let columns = ['*'];
        let propCols = null;
        try {
          const tableInfo = db.exec(`PRAGMA table_info('${tableName.replace(/'/g, "''")}')`);
          if (tableInfo.length) {
            propCols = tableInfo[0].values
              .map(r => r[1])
              .filter(c => c !== geomCol);
            columns = [geomCol, ...propCols];
          }
        } catch (e) { /* use * */ }

        // Query all rows
        const colList = columns.map(c => `"${c}"`).join(', ');
        const results = db.exec(`SELECT ${colList} FROM "${tableName}"`);

        if (!results.length || !results[0].values.length) {
          continue;
        }

        const resultCols = results[0].columns;
        const geomIdx = resultCols.indexOf(geomCol);
        const features = [];

        for (const dataRow of results[0].values) {
          const geomBlob = geomIdx >= 0 ? dataRow[geomIdx] : null;
          let geometry = null;
          if (geomBlob) {
            try {
              geometry = parseGpkgGeometry(geomBlob);
            } catch (e) {
              console.warn('Failed to parse geometry for row in', tableName, e);
            }
          }

          // Build properties (exclude geometry column)
          const properties = {};
          for (let c = 0; c < resultCols.length; c++) {
            if (resultCols[c] !== geomCol) {
              properties[resultCols[c]] = dataRow[c];
            }
          }

          features.push({ type: 'Feature', geometry, properties });
        }

        layers.push({
          name: identifier || tableName,
          tableName,
          description,
          featureCollection: { type: 'FeatureCollection', features },
        });
      }

      return layers;
    } finally {
      db.close();
    }
  }

  // Export
  root.GeoSpaXGpkg = { readGeoPackage, initSql };
})(window);
