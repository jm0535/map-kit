/* GeoSpaX — Calculate field (gsx-calcfield.js)
 * Write a new attribute on a vector layer from existing fields, client-side.
 * Two modes: Weighted conditions (form) and Expression (small language).
 * This is an attribute calculation — not a distribution or suitability model.
 * No rasters, no interpolation, no reprojection. Geometry and CRS unchanged.
 */
(function () {
  'use strict';
  var root = window;
  if (!root.GSX) root.GSX = {};

  // ─────────────────────────────────────────────────────────────────────────
  // Expression language: tokenizer
  // ─────────────────────────────────────────────────────────────────────────
  var OPS = ['&&', '||', '==', '!=', '>=', '<=', '+', '-', '*', '/', '%', '>', '<', '!', '?', ':', '(', ')', ',', '='];

  function tokenize(src) {
    var toks = [];
    var i = 0;
    while (i < src.length) {
      var ch = src[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        var j = i;
        while (j < src.length && /[0-9.]/.test(src[j])) j++;
        // optional exponent
        if (src[j] === 'e' || src[j] === 'E') {
          var k = j + 1;
          if (src[k] === '+' || src[k] === '-') k++;
          if (/[0-9]/.test(src[k] || '')) { k++; while (k < src.length && /[0-9]/.test(src[k])) k++; j = k; }
        }
        var num = src.slice(i, j);
        if ((num.match(/\./g) || []).length > 1) return { error: 'Malformed number "' + num + '" at position ' + (i + 1), toks: null };
        toks.push({ t: 'num', v: parseFloat(num), pos: i });
        i = j;
        continue;
      }
      if (ch === '"' || ch === "'") {
        var quote = ch, end = src.indexOf(quote, i + 1);
        if (end < 0) return { error: 'Unterminated ' + (quote === '"' ? 'field name' : 'string') + ' at position ' + (i + 1), toks: null };
        var str = src.slice(i + 1, end);
        toks.push({ t: quote === '"' ? 'field' : 'str', v: str, pos: i });
        i = end + 1;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        var m = i;
        while (m < src.length && /[A-Za-z0-9_]/.test(src[m])) m++;
        var word = src.slice(i, m);
        toks.push({ t: 'ident', v: word, pos: i });
        i = m;
        continue;
      }
      var matched = null;
      for (var o = 0; o < OPS.length; o++) {
        if (src.indexOf(OPS[o], i) === i) { matched = OPS[o]; break; }
      }
      // longest-match first for two-char ops
      if (src.indexOf('==', i) === i) matched = '==';
      if (src.indexOf('!=', i) === i) matched = '!=';
      if (src.indexOf('>=', i) === i) matched = '>=';
      if (src.indexOf('<=', i) === i) matched = '<=';
      if (src.indexOf('&&', i) === i) matched = '&&';
      if (src.indexOf('||', i) === i) matched = '||';
      if (!matched) return { error: 'Unexpected character "' + ch + '" at position ' + (i + 1), toks: null };
      toks.push({ t: 'op', v: matched, pos: i });
      i += matched.length;
    }
    return { toks: toks, error: null };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Parser (recursive descent). parse() returns {ok, ast|error, fields}
  // ─────────────────────────────────────────────────────────────────────────
  var FUNCS = {
    abs: [1, 1], min: [1, Infinity], max: [1, Infinity], round: [1, 2],
    floor: [1, 1], ceil: [1, 1], sqrt: [1, 1], log: [1, 1], exp: [1, 1], pow: [2, 2],
    coalesce: [1, Infinity], isnull: [1, 1], if: [3, 3],
    length: [1, 1], concat: [1, Infinity], lower: [1, 1], upper: [1, 1],
    to_int: [1, 1], to_num: [1, 1], to_text: [1, 1]
  };

  function Parser(toks, knownFields) {
    this.toks = toks; this.i = 0; this.fields = [];
    this.known = knownFields || null;
  }
  Parser.prototype.peek = function () { return this.toks[this.i] || null; };
  Parser.prototype.next = function () { return this.toks[this.i++] || null; };
  Parser.prototype.err = function (msg, tok) {
    return { ok: false, error: msg + (tok && tok.pos != null ? ' (at position ' + (tok.pos + 1) + ')' : '') };
  };
  Parser.prototype.expectOp = function (op) {
    var t = this.next();
    if (!t || t.t !== 'op' || t.v !== op) return this.err('Expected "' + op + '"', t || this.toks[this.toks.length - 1]);
    return null;
  };
  Parser.prototype.parse = function () {
    var node = this.ternary();
    if (node.error) return node;
    if (this.i < this.toks.length) return this.err('Unexpected "' + this.toks[this.i].v + '"', this.toks[this.i]);
    return { ok: true, ast: node, fields: this.fields };
  };
  Parser.prototype.ternary = function () {
    var cond = this.or();
    if (cond.error) return cond;
    var t = this.peek();
    if (t && t.t === 'op' && t.v === '?') {
      this.next();
      var a = this.ternary();
      if (a.error) return a;
      var e = this.expectOp(':');
      if (e) return e;
      var b = this.ternary();
      if (b.error) return b;
      return { k: 'cond', cond: cond, a: a, b: b };
    }
    return cond;
  };
  Parser.prototype.or = function () {
    var l = this.and();
    if (l.error) return l;
    while (this.peek() && this.peek().t === 'op' && this.peek().v === '||') {
      this.next();
      var r = this.and();
      if (r.error) return r;
      l = { k: 'or', l: l, r: r };
    }
    return l;
  };
  Parser.prototype.and = function () {
    var l = this.cmp();
    if (l.error) return l;
    while (this.peek() && this.peek().t === 'op' && this.peek().v === '&&') {
      this.next();
      var r = this.cmp();
      if (r.error) return r;
      l = { k: 'and', l: l, r: r };
    }
    return l;
  };
  Parser.prototype.cmp = function () {
    var l = this.add();
    if (l.error) return l;
    var t = this.peek();
    if (t && t.t === 'op' && ['>', '>=', '<', '<=', '==', '!=', '='].indexOf(t.v) >= 0) {
      this.next();
      var r = this.add();
      if (r.error) return r;
      var op = t.v === '=' ? '==' : t.v;
      return { k: 'cmp', op: op, l: l, r: r };
    }
    return l;
  };
  Parser.prototype.add = function () {
    var l = this.mul();
    if (l.error) return l;
    while (this.peek() && this.peek().t === 'op' && (this.peek().v === '+' || this.peek().v === '-')) {
      var op = this.next().v;
      var r = this.mul();
      if (r.error) return r;
      l = { k: 'arith', op: op, l: l, r: r };
    }
    return l;
  };
  Parser.prototype.mul = function () {
    var l = this.unary();
    if (l.error) return l;
    while (this.peek() && this.peek().t === 'op' && (this.peek().v === '*' || this.peek().v === '/' || this.peek().v === '%')) {
      var op = this.next().v;
      var r = this.unary();
      if (r.error) return r;
      l = { k: 'arith', op: op, l: l, r: r };
    }
    return l;
  };
  Parser.prototype.unary = function () {
    var t = this.peek();
    if (t && t.t === 'op' && (t.v === '!' || t.v === '-')) {
      this.next();
      var inner = this.unary();
      if (inner.error) return inner;
      return { k: t.v === '!' ? 'not' : 'neg', v: inner };
    }
    return this.primary();
  };
  Parser.prototype.primary = function () {
    var t = this.next();
    if (!t) return this.err('Unexpected end of expression');
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'field') {
      if (this.known && this.known.indexOf(t.v) < 0)
        return this.err('Unknown field "' + t.v + '"', t);
      if (this.fields.indexOf(t.v) < 0) this.fields.push(t.v);
      return { k: 'field', name: t.v };
    }
    if (t.t === 'ident') {
      var w = t.v.toLowerCase();
      if (w === 'true') return { k: 'bool', v: true };
      if (w === 'false') return { k: 'bool', v: false };
      if (w === 'null') return { k: 'null' };
      var nt = this.peek();
      if (nt && nt.t === 'op' && nt.v === '(') {
        // function call
        var fname = t.v;
        if (!FUNCS[fname]) return this.err('Unknown function "' + fname + '"', t);
        this.next(); // consume (
        var args = [];
        if (this.peek() && this.peek().t === 'op' && this.peek().v === ')') {
          this.next();
        } else {
          for (;;) {
            var a = this.ternary();
            if (a.error) return a;
            args.push(a);
            var sep = this.next();
            if (!sep) return this.err('Missing ")"', t);
            if (sep.t === 'op' && sep.v === ',') continue;
            if (sep.t === 'op' && sep.v === ')') break;
            return this.err('Expected "," or ")"', sep);
          }
        }
        var arity = FUNCS[fname];
        if (args.length < arity[0] || args.length > arity[1])
          return this.err(fname + '() takes ' + (arity[1] === Infinity ? 'at least ' + arity[0] : arity[0] === arity[1] ? arity[0] : arity[0] + '–' + arity[1]) + ' argument(s)', t);
        return { k: 'func', name: fname, args: args };
      }
      // bare identifier = field
      if (this.known && this.known.indexOf(t.v) < 0)
        return this.err('Unknown field "' + t.v + '"', t);
      if (this.fields.indexOf(t.v) < 0) this.fields.push(t.v);
      return { k: 'field', name: t.v };
    }
    if (t.t === 'op' && t.v === '(') {
      var inner = this.ternary();
      if (inner.error) return inner;
      var e = this.expectOp(')');
      if (e) return e;
      return inner;
    }
    return this.err('Unexpected "' + t.v + '"', t);
  };

  function parseExpr(src, knownFields) {
    if (!src || !src.trim()) return { ok: false, error: 'Expression is empty' };
    var tk = tokenize(src);
    if (tk.error) return { ok: false, error: tk.error };
    if (tk.toks.length === 0) return { ok: false, error: 'Expression is empty' };
    var p = new Parser(tk.toks, knownFields || null);
    return p.parse();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Evaluator. Nulls propagate through arithmetic, comparisons and ?:.
  // Division by zero → null. Never throws.
  // ─────────────────────────────────────────────────────────────────────────
  var _isNull = function (v) {
    return v === null || v === undefined || (typeof v === 'number' && !isFinite(v)) ||
      (typeof v === 'string' && v.trim() === '');
  };
  var _num = function (v) {
    if (_isNull(v)) return null;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    var n = parseFloat(v);
    return isFinite(n) ? n : null;
  };

  function evalNode(n, props) {
    switch (n.k) {
      case 'num': return n.v;
      case 'str': return n.v;
      case 'bool': return n.v;
      case 'null': return null;
      case 'field': return _isNull(props[n.name]) ? null : props[n.name];
      case 'neg': { var v = _num(evalNode(n.v, props)); return v === null ? null : -v; }
      case 'not': { var b = evalNode(n.v, props); if (b === null) return null; return !b; }
      case 'arith': {
        var a = _num(evalNode(n.l, props)), b2 = _num(evalNode(n.r, props));
        if (a === null || b2 === null) return null;
        if (n.op === '+') return a + b2;
        if (n.op === '-') return a - b2;
        if (n.op === '*') return a * b2;
        if (n.op === '/') return b2 === 0 ? null : a / b2;
        if (n.op === '%') return b2 === 0 ? null : a % b2;
        return null;
      }
      case 'cmp': {
        var l = evalNode(n.l, props), r = evalNode(n.r, props);
        if (_isNull(l) || _isNull(r)) return null;
        var ln = _num(l), rn = _num(r);
        if (ln !== null && rn !== null) {
          switch (n.op) {
            case '>': return ln > rn; case '>=': return ln >= rn;
            case '<': return ln < rn; case '<=': return ln <= rn;
            case '==': return ln === rn; case '!=': return ln !== rn;
          }
        }
        // text comparison for == and !=
        var ls = String(l), rs = String(r);
        if (n.op === '==') return ls === rs;
        if (n.op === '!=') return ls !== rs;
        return false;
      }
      case 'and': {
        var x = evalNode(n.l, props); if (x === null) return null; if (!x) return false;
        var y = evalNode(n.r, props); if (y === null) return null; return !!y;
      }
      case 'or': {
        var x2 = evalNode(n.l, props); if (x2 !== null && x2) return true;
        var y2 = evalNode(n.r, props); if (y2 === null) return null; return !!y2;
      }
      case 'cond': {
        var c = evalNode(n.cond, props);
        if (c === null) return null;
        return c ? evalNode(n.a, props) : evalNode(n.b, props);
      }
      case 'func': return evalFunc(n, props);
    }
    return null;
  }

  function evalFunc(n, props) {
    var args = n.args.map(function (a) { return evalNode(a, props); });
    switch (n.name) {
      case 'abs': { var v = _num(args[0]); return v === null ? null : Math.abs(v); }
      case 'sqrt': { var s = _num(args[0]); return (s === null || s < 0) ? null : Math.sqrt(s); }
      case 'log': { var g = _num(args[0]); return (g === null || g <= 0) ? null : Math.log(g); }
      case 'exp': { var e = _num(args[0]); return e === null ? null : Math.exp(e); }
      case 'floor': { var f = _num(args[0]); return f === null ? null : Math.floor(f); }
      case 'ceil': { var c = _num(args[0]); return c === null ? null : Math.ceil(c); }
      case 'round': {
        var r = _num(args[0]); if (r === null) return null;
        var d = args.length > 1 ? (_num(args[1]) || 0) : 0;
        var m = Math.pow(10, d);
        return Math.round(r * m) / m;
      }
      case 'pow': { var p1 = _num(args[0]), p2 = _num(args[1]); return (p1 === null || p2 === null) ? null : Math.pow(p1, p2); }
      case 'min': case 'max': {
        var nums = args.map(_num).filter(function (v) { return v !== null; });
        if (nums.length === 0) return null;
        return n.name === 'min' ? Math.min.apply(null, nums) : Math.max.apply(null, nums);
      }
      case 'coalesce': {
        for (var i = 0; i < args.length; i++) if (!_isNull(args[i])) return args[i];
        return null;
      }
      case 'isnull': return _isNull(args[0]);
      case 'if': {
        var c = args[0];
        if (c === null || c === false || _isNull(c)) return args[2];
        return args[1];
      }
      case 'length': { var s2 = args[0]; return _isNull(s2) ? null : String(s2).length; }
      case 'concat': {
        var out = '';
        for (var j = 0; j < args.length; j++) { if (_isNull(args[j])) return null; out += String(args[j]); }
        return out;
      }
      case 'lower': return _isNull(args[0]) ? null : String(args[0]).toLowerCase();
      case 'upper': return _isNull(args[0]) ? null : String(args[0]).toUpperCase();
      case 'to_int': { var t = _num(args[0]); return t === null ? null : Math.round(t); }
      case 'to_num': return _num(args[0]);
      case 'to_text': return _isNull(args[0]) ? null : String(args[0]);
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UI wiring
  // ─────────────────────────────────────────────────────────────────────────
  var CF = { version: '1.2.0' };
  root.GSXCF = CF;
  var MAX_ROWS = 8;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return root.escapeHtml ? root.escapeHtml(String(s)) : String(s).replace(/&/g, '&').replace(/</g, '<'); }

  CF.currentLayerId = function () {
    var sel = $('analysis-layer-select');
    return sel ? sel.value : '';
  };

  CF.layerInfo = function () {
    var id = CF.currentLayerId();
    if (!id || id === '__all__') return null;
    // NB: uploadedLayers is a `let` global — not a window property, so it
    // must be referenced lexically, not via `root.`
    return uploadedLayers.find(function (l) { return l.id === id; }) || null;
  };

  function layerFields(numericOnly) {
    var info = CF.layerInfo();
    if (!info) return [];
    var feats = info.geojsonFeatures || [];
    var keys = [];
    feats.forEach(function (f) {
      Object.keys(f.properties || {}).forEach(function (k) {
        if (keys.indexOf(k) < 0) keys.push(k);
      });
    });
    if (!numericOnly) return keys;
    return keys.filter(function (k) {
      return feats.some(function (f) {
        var v = f.properties[k];
        return v !== null && v !== '' && isFinite(parseFloat(v));
      });
    });
  }

  // Called whenever the analysis layer select changes (also hooked from
  // refreshAnalysisLayerSelect via the delegated listener below).
  CF.refresh = function () {
    if (!$('gsx-calc-rows')) return;
    CF.populateFieldSelects();
    CF.populateInsertSelect();
    CF.validate();
  };

  CF.populateInsertSelect = function () {
    var sel = $('gsx-calc-fields');
    if (!sel) return;
    sel.innerHTML = '<option value="">— insert field —</option>';
    layerFields(false).forEach(function (f) {
      sel.innerHTML += '<option value="' + esc(f) + '">' + esc(f) + '</option>';
    });
  };

  // Re-populate the field dropdown of every weighted-condition row when the
  // analysis layer changes (keeps the current selection if still valid).
  CF.populateFieldSelects = function () {
    var host = $('gsx-calc-rows');
    if (!host) return;
    Array.prototype.forEach.call(host.children, function (row) {
      var sel = row.querySelector('.gsx-calc-f');
      if (!sel) return;
      var cur = sel.value;
      sel.innerHTML = rowFieldOptions(cur);
    });
  };

  function rowFieldOptions(selected) {
    var opts = '<option value="">— field —</option>';
    layerFields(true).forEach(function (f) {
      opts += '<option value="' + esc(f) + '"' + (f === selected ? ' selected' : '') + '>' + esc(f) + '</option>';
    });
    return opts;
  }

  CF.addRow = function (field, test, a, b, w) {
    var host = $('gsx-calc-rows');
    if (!host) return;
    if (host.children.length >= MAX_ROWS) { root.showToast('Maximum ' + MAX_ROWS + ' conditions', 'info'); return; }
    var row = document.createElement('div');
    row.className = 'gsx-calc-row';
    row.innerHTML =
      '<select class="gsx-calc-f" onchange="GSXCF.validate()">' + rowFieldOptions(field || '') + '</select>' +
      '<select class="gsx-calc-t" onchange="GSXCF.validate()">' +
      ['>=', '>', '<=', '<', '=', '!=', 'between'].map(function (t) {
        return '<option' + (t === (test || '>=') ? ' selected' : '') + '>' + t + '</option>';
      }).join('') + '</select>' +
      '<input type="number" class="gsx-calc-a" step="any" placeholder="value" value="' + (a !== undefined ? a : '') + '" oninput="GSXCF.validate()">' +
      '<input type="number" class="gsx-calc-b" step="any" placeholder="max" style="display:none" value="' + (b !== undefined ? b : '') + '" oninput="GSXCF.validate()">' +
      '<span class="gsx-calc-x" title="weight">&times;</span>' +
      '<input type="number" class="gsx-calc-w" step="any" value="' + (w !== undefined ? w : 1) + '" oninput="GSXCF.validate()">' +
      '<button class="gsx-calc-del" title="Remove condition" onclick="GSXCF.removeRow(this)">&times;</button>';
    host.appendChild(row);
    CF.syncRowTest(row);
  };

  CF.removeRow = function (btn) {
    var row = btn.closest('.gsx-calc-row');
    if (row) row.remove();
    if ($('gsx-calc-rows').children.length === 0) CF.addRow();
    CF.validate();
  };

  function syncRowTest(row) {
    var t = row.querySelector('.gsx-calc-t').value;
    var a = row.querySelector('.gsx-calc-a');
    var b = row.querySelector('.gsx-calc-b');
    var between = t === 'between';
    b.style.display = between ? '' : 'none';
    a.placeholder = between ? 'min' : 'value';
  }

  CF.syncRowTest = syncRowTest;

  CF.toggleMode = function (mode) {
    var weightedBox = $('gsx-calc-mode-weighted');
    var exprBox = $('gsx-calc-mode-expr');
    if (!weightedBox || !exprBox) return;
    if (mode === 'expr' && weightedBox.style.display !== 'none') {
      // load generated expression into the textarea so the user can edit it
      var gen = CF.buildExpression();
      if (gen) $('gsx-calc-expr').value = gen;
    }
    weightedBox.style.display = mode === 'weighted' ? '' : 'none';
    exprBox.style.display = mode === 'expr' ? '' : 'none';
    $('gsx-calc-tab-weighted').classList.toggle('active', mode === 'weighted');
    $('gsx-calc-tab-expr').classList.toggle('active', mode === 'expr');
    CF._mode = mode;
    CF.validate();
  };

  CF.insertField = function () {
    var sel = $('gsx-calc-fields');
    if (!sel || !sel.value) return;
    var ta = $('gsx-calc-expr');
    var isIdent = /^[A-Za-z_][A-Za-z0-9_]*$/.test(sel.value);
    var token = isIdent ? sel.value : '"' + sel.value + '"';
    var start = ta.selectionStart || ta.value.length;
    var end = ta.selectionEnd || ta.value.length;
    ta.value = ta.value.slice(0, start) + token + ta.value.slice(end);
    ta.focus();
    CF.validate();
  };

  CF.insertText = function (txt) {
    var ta = $('gsx-calc-expr');
    var start = ta.selectionStart || ta.value.length;
    var end = ta.selectionEnd || ta.value.length;
    ta.value = ta.value.slice(0, start) + txt + ta.value.slice(end);
    ta.focus();
    CF.validate();
  };

  // Read weighted-condition rows. Returns {rows, otherwise} or {error}
  function readRows() {
    var host = $('gsx-calc-rows');
    if (!host) return { error: 'No conditions' };
    var rows = [];
    var children = Array.prototype.slice.call(host.children);
    for (var i = 0; i < children.length; i++) {
      var row = children[i];
      var f = row.querySelector('.gsx-calc-f').value;
      var t = row.querySelector('.gsx-calc-t').value;
      var a = parseFloat(row.querySelector('.gsx-calc-a').value);
      var b = parseFloat(row.querySelector('.gsx-calc-b').value);
      var w = parseFloat(row.querySelector('.gsx-calc-w').value);
      if (!f) return { error: 'Condition ' + (i + 1) + ': select a field' };
      if (!isFinite(a)) return { error: 'Condition ' + (i + 1) + ': enter a threshold' };
      if (t === 'between' && !isFinite(b)) return { error: 'Condition ' + (i + 1) + ': enter a max for "between"' };
      if (!isFinite(w)) return { error: 'Condition ' + (i + 1) + ': weight must be a number' };
      if (t === 'between' && a > b) {
        root.showToast('Condition ' + (i + 1) + ': min > max — values swapped', 'info');
        var tmp = a; a = b; b = tmp;
      }
      rows.push({ field: f, test: t, a: a, b: b, weight: w });
    }
    if (rows.length === 0) return { error: 'Add at least one condition' };
    var ow = parseFloat(($('gsx-calc-otherwise') || {}).value);
    if (!isFinite(ow)) ow = 0;
    return { rows: rows, otherwise: ow };
  }

  // Build the expression string shown in the form (read-only) and loaded
  // into Mode A when the user switches.
  CF.buildExpression = function () {
    var r = readRows();
    if (r.error) return '';
    var parts = r.rows.map(function (row) {
      var test = row.test === 'between'
        ? row.field + ' >= ' + row.a + ' && ' + row.field + ' <= ' + row.b
        : row.field + ' ' + (row.test === '=' ? '==' : row.test) + ' ' + row.a;
      var w = row.weight;
      var o = r.otherwise;
      if (w === o) return '(' + test + ' ? ' + w + ' : ' + o + ')';
      return '(' + test + ' ? ' + w + ' : ' + o + ')';
    });
    return parts.join(' + ');
  };

  // ── Validation + live preview ────────────────────────────────────────────
  CF.validate = function () {
    var runBtn = $('gsx-calc-run');
    var msg = $('gsx-calc-msg');
    var prevHost = $('gsx-calc-preview');
    if (!runBtn) return true;
    var problems = [];
    var fieldName = ($('gsx-calc-out') || {}).value || '';
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fieldName)) {
      problems.push(fieldName ? 'Field name must start with a letter and contain only letters, digits and _' : 'Enter an output field name');
    }
    var info = CF.layerInfo();
    if (!info) problems.unshift('Select a layer');

    var parsed = null;
    var expr = '';
    if (CF._mode === 'expr') {
      expr = ($('gsx-calc-expr') || {}).value || '';
      parsed = parseExpr(expr, info ? layerFields(false) : null);
      if (!parsed.ok) problems.push('Expression: ' + parsed.error);
    } else {
      var rr = readRows();
      if (rr.error) problems.push(rr.error);
      else {
        expr = CF.buildExpression();
        $('gsx-calc-gen').textContent = expr || '—';
      }
    }

    var ok = problems.length === 0;
    runBtn.disabled = !ok;
    if (msg) {
      msg.textContent = problems.length ? problems[0] : '';
      msg.className = 'gsx-calc-msg' + (problems.length ? ' err' : '');
    }

    // live preview: first 5 features, old value → new value
    if (prevHost) {
      if (!ok || !info) {
        prevHost.innerHTML = '';
      } else {
        var feats = info.geojsonFeatures || [];
        var type = ($('gsx-calc-type') || {}).value || 'int';
        var html = '';
        var shown = 0;
        for (var i = 0; i < feats.length && shown < 5; i++) {
          var props = feats[i].properties || {};
          var val;
          if (CF._mode === 'expr' && parsed && parsed.ok) {
            val = evalNode(parsed.ast, props);
          } else if (CF._mode !== 'expr') {
            val = evalRows(readRows(), props);
          } else {
            val = null;
          }
          if (val === undefined) val = null;
          var oldV = props[fieldName];
          html += '<div class="gsx-calc-prev-row">' +
            '<span class="gsx-calc-prev-old">' + (fieldName in props ? esc(oldV === null || oldV === undefined ? 'null' : oldV) : '&mdash;') + '</span>' +
            ' &rarr; <b>' + (val === null ? 'null' : esc(coerceOut(val, type))) + '</b></div>';
          shown++;
        }
        prevHost.innerHTML = html || '<div class="gsx-calc-prev-row">No features</div>';
      }
    }
    return ok;
  };

  // Weighted-conditions evaluation: null / non-numeric field → the row's
  // otherwise value (a failed test), never a crash.
  function evalRows(r, props) {
    if (r.error) return null;
    var sum = 0;
    for (var i = 0; i < r.rows.length; i++) {
      var row = r.rows[i];
      var v = _num(props[row.field]);
      var pass = false;
      if (v !== null) {
        switch (row.test) {
          case '>=': pass = v >= row.a; break;
          case '>': pass = v > row.a; break;
          case '<=': pass = v <= row.a; break;
          case '<': pass = v < row.a; break;
          case '=': pass = v === row.a; break;
          case '!=': pass = v !== row.a; break;
          case 'between': pass = v >= row.a && v <= row.b; break;
        }
      }
      sum += pass ? row.weight : r.otherwise;
    }
    return sum;
  }

  function coerceOut(v, type) {
    if (v === null || v === undefined) return null;
    if (type === 'int') { var n = _num(v); return n === null ? null : Math.round(n); }
    if (type === 'num') { var d = _num(v); return d === null ? null : d; }
    return String(v);
  }

  // ── Run ──────────────────────────────────────────────────────────────────
  CF._last = null;

  CF.run = function () {
    if (!CF.validate()) return;
    var info = CF.layerInfo();
    if (!info) { root.showToast('Select a layer first', 'error'); return; }
    var fieldName = $('gsx-calc-out').value;
    var type = $('gsx-calc-type').value;
    var styleOn = ($('gsx-calc-style') || {}).checked;

    // existing field? overwrite in place (matches QGIS/ArcGIS behaviour
    // where Calculate Field with the same field name updates the values).
    var usedFields = [];
    (info.properties || []).forEach(function (p) {
      Object.keys(p || {}).forEach(function (k) { if (usedFields.indexOf(k) < 0) usedFields.push(k); });
    });
    var outName = fieldName;
    if (usedFields.indexOf(outName) >= 0) {
      root.showToast('Updating existing field "' + outName + '"', 'info');
    }

    var expr = CF._mode === 'expr' ? $('gsx-calc-expr').value : CF.buildExpression();
    var parsed = parseExpr(expr, layerFields(false));
    if (!parsed.ok) { root.showToast('Expression error: ' + parsed.error, 'error'); return; }

    var feats = info.geojsonFeatures || [];
    var r = CF._mode === 'expr' ? null : readRows();
    var values = [], nulls = 0;
    feats.forEach(function (f) {
      var props = f.properties || (f.properties = {});
      var v;
      if (CF._mode === 'expr') v = evalNode(parsed.ast, props);
      else v = evalRows(r, props);
      v = coerceOut(v, type);
      if (v === null) nulls++;
      values.push(v);
      props[outName] = v;
    });
    // keep the parallel attribute-table array in sync (same object if shared)
    (info.properties || []).forEach(function (p, i) {
      if (p && feats[i] && p !== feats[i].properties) p[outName] = values[i];
    });

    // stats
    var nums = values.filter(function (v) { return typeof v === 'number'; });
    var min = null, max = null, mean = null;
    if (nums.length) {
      min = Math.min.apply(null, nums);
      max = Math.max.apply(null, nums);
      mean = nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
    }

    // refresh attribute table if this layer is open, and layer-dependent selects
    try {
      var cur = $('attr-layer-select') ? $('attr-layer-select').value : '';
      if (cur === info.id && typeof root.loadAttrTable === 'function') root.loadAttrTable(info.id);
      if (typeof root.refreshAnalysisAttrSelect === 'function') root.refreshAnalysisAttrSelect();
      if (typeof root.refreshAnalysisFilter === 'function') root.refreshAnalysisFilter();
      if (typeof root.refreshExportLayerSelect === 'function') root.refreshExportLayerSelect();
      // Rebuild the symbology panel so the new field appears in the
      // Graduated/Categorized column dropdowns.
      if (typeof root.buildSymbologyControls === 'function') root.buildSymbologyControls(info);
      // Refresh the Calculate Field field dropdowns and insert-field
      // select so the new field is available for the next calculation.
      CF.populateFieldSelects();
      CF.populateInsertSelect();
    } catch (e) { /* non-fatal */ }

    // styling
    var styled = false;
    if (styleOn) {
      if (type === 'text') styled = applyCategorizedField(info.id, outName);
      else styled = applyGraduatedField(info.id, outName, 5, 'viridis');
    } else {
      // Checkbox unchecked — if the layer currently has graduated/categorized
      // styling from a previous Calculate Field run, reset to simple so the
      // map reflects the user's choice to NOT style on this field.
      // NOTE: legendState is a const global in index.html, NOT on window —
      // reference it directly, not via root.legendState.
      var prevSt = (typeof legendState !== 'undefined') ? legendState[info.id] : null;
      if (prevSt && (prevSt.mode === 'graduated' || prevSt.mode === 'categorized')) {
        if (typeof root.resetSymbology === 'function') root.resetSymbology(info.id);
      }
    }

    var version = (document.querySelector('meta[name="version"]') || {}).content || CF.version;
    var dateISO = new Date().toISOString().split('T')[0];
    var methods =
      'A new attribute "' + outName + '" was calculated in GeoSpaX [v' + version + '] on ' + dateISO +
      ' from attributes already on the layer. Expression: ' + expr + '. ' +
      'This is an attribute calculation, not a species distribution model, not a raster surface, ' +
      'and not a land-cover classification. Features: ' + feats.length + '. ' +
      'Output range: ' + (min !== null ? min + '–' + max : 'n/a') + ' (nulls: ' + nulls + ').';

    CF._last = { expr: expr, methods: methods };

    var html =
      '<b>Calculate field</b><br>' +
      'Layer: ' + esc(info.name) + '<br>' +
      'Output field: <b>' + esc(outName) + '</b>' + (usedFields.indexOf(fieldName) >= 0 ? ' <span style="color:var(--text-muted)">(updated existing)</span>' : '') + '<br>' +
      'Features written: <b>' + feats.length + '</b><br>' +
      'Null outputs: <b>' + nulls + '</b>';
    if (nums.length) {
      html += '<br>Min: ' + fmt(min) + ' · Max: ' + fmt(max) + ' · Mean: ' + fmt(mean);
    }
    if (styled) html += '<br><span style="color:var(--text-muted)">Layer styled ' + (type === 'text' ? 'categorized' : 'graduated') + ' on ' + esc(outName) + '</span>';
    html += '<br><div style="margin-top:4px;padding:4px 6px;background:var(--surface-2);border-radius:4px;font-family:monospace;font-size:10px;word-break:break-all;">' + esc(expr) + '</div>' +
      '<div style="display:flex;gap:6px;margin-top:6px;">' +
      '<button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="GSXCF.copyExpr()">Copy expression</button>' +
      '<button class="btn-secondary" style="padding:3px 10px;font-size:11px;" onclick="GSXCF.copyMethods()">Copy methods paragraph</button></div>';
    root.showResult(html);
    root.showToast('Calculated ' + outName + ' on ' + feats.length + ' features', 'success');
  };

  function fmt(v) { return (typeof v === 'number' && isFinite(v)) ? (Math.round(v * 1000) / 1000) : v; }

  CF.copyExpr = function () {
    if (!CF._last) return;
    copyText(CF._last.expr, 'Expression copied');
  };
  CF.copyMethods = function () {
    if (!CF._last) return;
    copyText(CF._last.methods, 'Methods paragraph copied');
  };
  function copyText(txt, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { root.showToast(okMsg, 'success'); },
        function () { fallbackCopy(txt, okMsg); });
    } else fallbackCopy(txt, okMsg);
  }
  function fallbackCopy(txt, okMsg) {
    var ta = document.createElement('textarea');
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); root.showToast(okMsg, 'success'); }
    catch (e) { root.showToast('Copy failed — select the text manually', 'error'); }
    ta.remove();
  }

  // ── Programmatic styling (mirrors applyGraduated / applyCategorized) ─────
  function applyGraduatedField(id, attr, numClasses, rampName) {
    var info = uploadedLayers.find(function (l) { return l.id === id; });
    if (!info || typeof root.L === 'undefined') return false;
    var numVals = (info.properties || []).map(function (p) { return parseFloat(p[attr]); })
      .filter(function (v) { return isFinite(v); });
    if (numVals.length === 0) return false;
    var minVal = Math.min.apply(null, numVals), maxVal = Math.max.apply(null, numVals);
    // COLOR_RAMPS is a const global — reference it lexically, not via root.
    var ramp = (typeof COLOR_RAMPS !== 'undefined' ? COLOR_RAMPS[rampName] : null) || COLOR_RAMPS.viridis;
    var breaks = root.computeClassificationBreaks('equal', numVals, numClasses) || [minVal, maxVal];
    var grad = root.buildClassifiedGradientCss(breaks, ramp);
    var bandColors = grad.bandColors;
    function colorFor(v) { return bandColors[root._classIndexForValue(v, breaks)]; }
    rebuildStyledLayer(info, attr, function (v) { return colorFor(v); });
    legendState[id] = { mode: 'graduated', color: info.color, geomType: root._detectGeomType(info), attr: attr, ramp: ramp, minVal: minVal, maxVal: maxVal, numClasses: numClasses, breaks: breaks, bandColors: bandColors, shape: null };
    root.refreshMapLegend();
    return true;
  }

  function applyCategorizedField(id, attr) {
    var info = uploadedLayers.find(function (l) { return l.id === id; });
    if (!info || typeof root.L === 'undefined') return false;
    var vals = [];
    (info.properties || []).forEach(function (p) {
      var v = p && p[attr];
      if (v !== null && v !== undefined && v !== '' && vals.indexOf(v) < 0) vals.push(v);
    });
    if (vals.length === 0) return false;
    var colors = (typeof CATEGORIZED_COLORS !== 'undefined' && CATEGORIZED_COLORS) || ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf'];
    var colorMap = {};
    vals.forEach(function (v, i) { colorMap[v] = colors[i % colors.length]; });
    rebuildStyledLayer(info, attr, function (v) { return colorMap[v] || '#718096'; });
    legendState[id] = { mode: 'categorized', color: info.color, geomType: root._detectGeomType(info), attr: attr, colorMap: colorMap, shape: null };
    root.refreshMapLegend();
    return true;
  }

  function rebuildStyledLayer(info, attr, colorFor) {
    // `map` is a const global — reference it lexically, not via root
    // (window.map is the <div id="map"> DOM element).
    var geojson = { type: 'FeatureCollection', features: info.geojsonFeatures || [] };
    if (geojson.features.length === 0) {
      info.layer.eachLayer(function (sub) { if (sub.toGeoJSON) geojson.features.push(sub.toGeoJSON()); });
    }
    map.removeLayer(info.layer);
    info.layer = root.L.geoJSON(geojson, {
      style: function (feature) {
        var c = colorFor(feature.properties && feature.properties[attr]);
        var gt = feature.geometry.type;
        if (gt.indexOf('Polygon') >= 0) return { color: c, weight: 2, fillColor: c, fillOpacity: 0.3 };
        if (gt.indexOf('Line') >= 0) return { color: c, weight: 2.5, opacity: 0.9 };
        return {};
      },
      pointToLayer: function (feature, latlng) {
        var c = colorFor(feature.properties && feature.properties[attr]);
        return root.L.circleMarker(latlng, { radius: 7, color: 'white', weight: 1.2, fillColor: c, fillOpacity: 0.9 });
      },
      onEachFeature: function (feature, layer) {
        var props = feature.properties || {};
        var label = props.site || props.name || props.NAME || props.Name || props.label || props.Label || props.id || '';
        if (label) layer.bindTooltip(String(label), { className: 'site-tooltip', direction: 'top', offset: [0, -8] });
        layer.on('click', function () { root.showFeatureInfo(props, info.id, layer); });
      }
    }).addTo(map);
  }

  // Expose internals for tests
  CF.parseExpr = parseExpr;
  CF.evalNode = evalNode;
  CF.layerFields = layerFields;
  CF.readRows = function () { return readRows(); };
  CF.evalRows = evalRows;

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    if ($('gsx-calc-rows')) {
      CF._mode = 'weighted';
      CF.addRow(); CF.addRow(); CF.addRow();
      CF.toggleMode('weighted');
      // respond to layer selection changes
      var sel = $('analysis-layer-select');
      if (sel) sel.addEventListener('change', function () { setTimeout(CF.refresh, 0); });
      var host = $('analysis-drawer-body') || document;
      if (host) {
        host.addEventListener('input', function () { CF.validate(); });
        host.addEventListener('change', function (e) {
          if (e.target && e.target.classList && e.target.classList.contains('gsx-calc-t')) syncRowTest(e.target.closest('.gsx-calc-row'));
          CF.validate();
        });
      }
      CF.validate();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
