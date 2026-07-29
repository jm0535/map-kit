/* ===================================================================
   gsx-select.js — replacement popup for native <select> dropdowns

   Some Linux/GTK browser builds focus a <select> on click but never
   paint its option popup, leaving the list unreachable. This module
   suppresses the native popup and draws the option list itself.

   The <select> elements are left completely untouched — they remain
   the visible, natively styled controls, and keep rendering their own
   selected-option text. Only the popup is replaced, so every existing
   stylesheet rule, id, value read and change handler keeps working,
   and dynamically created selects are covered automatically via event
   delegation (no per-element setup).

   Opt out for a single control with data-gsx-select="off".
   =================================================================== */
(function (root) {
  'use strict';

  var PANEL_CLASS = 'gsx-sel-panel';
  var MAX_PANEL_H = 280;
  var open = null; // { select, panel }

  function selectFor(node) {
    if (!node || !node.closest) return null;
    var sel = node.closest('select');
    if (!sel) return null;
    if (sel.disabled || sel.multiple || sel.size > 1) return null;
    if (sel.dataset.gsxSelect === 'off') return null;
    if (!sel.options.length) return null;
    return sel;
  }

  function optionText(opt) {
    var t = (opt.textContent || '').replace(/\s+/g, ' ').trim();
    return t || '\u00A0';
  }

  /* ---- open / close ----------------------------------------------- */

  function close() {
    if (!open) return;
    if (open.panel.parentNode) open.panel.parentNode.removeChild(open.panel);
    open.select.classList.remove('gsx-sel-active');
    open = null;
  }

  function place(panel, select) {
    var r = select.getBoundingClientRect();
    panel.style.minWidth = r.width + 'px';
    panel.style.maxWidth = Math.max(r.width, Math.min(420, window.innerWidth - 16)) + 'px';
    var w = panel.offsetWidth;
    panel.style.left = Math.max(4, Math.min(r.left, window.innerWidth - w - 4)) + 'px';
    var h = panel.offsetHeight;
    var below = window.innerHeight - r.bottom;
    if (below < h + 8 && r.top > below) {
      panel.style.top = Math.max(4, r.top - h - 2) + 'px';
    } else {
      panel.style.top = (r.bottom + 2) + 'px';
    }
  }

  function commit(select, index) {
    close();
    if (index === select.selectedIndex) return;
    select.selectedIndex = index;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function build(select) {
    var panel = document.createElement('div');
    panel.className = PANEL_CLASS;
    panel.setAttribute('role', 'listbox');
    // Match the control's type scale so the list doesn't look foreign.
    panel.style.fontSize = window.getComputedStyle(select).fontSize;
    panel.style.maxHeight = MAX_PANEL_H + 'px';

    Array.prototype.forEach.call(select.options, function (opt, i) {
      var item = document.createElement('div');
      item.className = 'gsx-sel-opt';
      if (i === select.selectedIndex) item.className += ' is-selected';
      if (opt.disabled) item.className += ' is-disabled';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', i === select.selectedIndex ? 'true' : 'false');
      item.textContent = optionText(opt);
      item.title = optionText(opt);
      if (!opt.disabled) {
        item.addEventListener('mousedown', function (e) {
          e.preventDefault();
          e.stopPropagation();
          commit(select, i);
        });
      }
      panel.appendChild(item);
    });
    return panel;
  }

  function openFor(select) {
    if (open && open.select === select) { close(); return; }
    close();
    var panel = build(select);
    document.body.appendChild(panel);
    select.classList.add('gsx-sel-active');
    open = { select: select, panel: panel };
    place(panel, select);
    var cur = panel.querySelector('.is-selected');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }

  /* ---- keyboard --------------------------------------------------- */

  function step(select, delta) {
    var n = select.options.length;
    var i = select.selectedIndex;
    while (true) {
      i += delta;
      if (i < 0 || i >= n) return;
      if (!select.options[i].disabled) { commit(select, i); return; }
    }
  }

  /* ---- wiring ----------------------------------------------------- */

  function init() {
    // Capture phase: suppress the native popup before anything else runs.
    document.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (e.target.closest && e.target.closest('.' + PANEL_CLASS)) return;
      var sel = selectFor(e.target);
      if (!sel) { close(); return; }
      e.preventDefault(); // stops the native (unpainted) dropdown
      try { sel.focus({ preventScroll: true }); } catch (err) { sel.focus(); }
      openFor(sel);
    }, true);

    document.addEventListener('keydown', function (e) {
      if (open && e.key === 'Escape') { e.preventDefault(); close(); return; }
      var sel = selectFor(e.target);
      if (!sel) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFor(sel);
      } else if (open && open.select === sel &&
                 (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        step(sel, e.key === 'ArrowDown' ? 1 : -1);
      }
    }, true);

    // Any scroll or resize invalidates the anchor position.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
  }

  root.GSXSelect = { close: close, open: openFor };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}(window));
