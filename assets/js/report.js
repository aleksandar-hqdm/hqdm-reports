/* HQDM report + strategy interactions: tabs, charts, sound, reveal.
   Shared across every client report and strategy page. No build step.
   Each report page sets window.CHART_FACTORIES = { canvasId: fn(canvas) } before
   this file loads, then calls showTab(1). Chart helpers live on window.RPT. */
(function () {
  'use strict';

  /* ---------- charts ---------- */
  var built = {};
  if (typeof Chart !== 'undefined') {
    var C = { ink: '#15171C', muted: '#5C636E', grid: 'rgba(20,24,33,0.10)',
      mint: '#079A6B', mintBright: '#18C089', violet: '#5B4BD0', violetBright: '#7C6CF0',
      amber: '#C77B05', rose: '#D6456A', grey: '#9AA0A8' };
    Chart.defaults.font.family = "'JetBrains Mono', 'Space Mono', monospace";
    Chart.defaults.font.size = 11.5;
    Chart.defaults.color = C.muted;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = '#FFFFFF';
    Chart.defaults.plugins.tooltip.borderColor = '#8A9099';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleColor = C.ink;
    Chart.defaults.plugins.tooltip.bodyColor = C.muted;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 0;
    Chart.defaults.plugins.tooltip.displayColors = false;
    Chart.defaults.plugins.tooltip.titleFont = { weight: '700', size: 12, family: "'Space Mono', monospace" };
    Chart.defaults.maintainAspectRatio = false;

    function grad(ctx, area, c1, c2) {
      if (!area) return c1;
      var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, c1); g.addColorStop(1, c2); return g;
    }
    function rgba(hex, a) {
      var n = parseInt(hex.slice(1), 16);
      return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    var axis = function (extra) {
      return Object.assign({ grid: { color: C.grid, drawBorder: false }, border: { display: false },
        ticks: { color: C.muted, padding: 7, font: { family: "'JetBrains Mono', monospace", size: 10 } } }, extra || {});
    };

    /* helpers each page uses: RPT.line / RPT.bar / RPT.barH */
    window.RPT = {
      C: C,
      // series: [{ label, data, color, fill }]
      line: function (cv, labels, series, yTitle) {
        return new Chart(cv, { type: 'line',
          data: { labels: labels, datasets: series.map(function (s) {
            return { label: s.label, data: s.data, borderColor: s.color, borderWidth: 2.5, tension: 0.25,
              pointRadius: 2.2, pointHoverRadius: 5, pointBackgroundColor: s.color, fill: !!s.fill,
              backgroundColor: function (c) { return grad(c.chart.ctx, c.chart.chartArea, rgba(s.color, 0.20), rgba(s.color, 0)); } }; }) },
          options: { interaction: { mode: 'index', intersect: false },
            scales: { x: axis({ grid: { display: false } }), y: axis({ beginAtZero: true, title: yTitle ? { display: true, text: yTitle, color: C.muted, font: { size: 9 } } : undefined }) },
            plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (c.parsed.y != null ? c.parsed.y.toLocaleString() : '-'); } } } } } });
      },
      bar: function (cv, labels, data, colors, tip) {
        return new Chart(cv, { type: 'bar',
          data: { labels: labels, datasets: [{ data: data, borderRadius: 0, borderSkipped: false, borderColor: '#15171C', borderWidth: 1, maxBarThickness: 56,
            backgroundColor: function (c) { return Array.isArray(colors) ? colors[c.dataIndex] : grad(c.chart.ctx, c.chart.chartArea, C.mintBright, C.violet); } }] },
          options: { scales: { x: axis({ grid: { display: false } }), y: axis({ beginAtZero: true }) },
            plugins: { tooltip: { callbacks: { label: tip || function (c) { return c.parsed.y.toLocaleString(); } } } } } });
      },
      barH: function (cv, labels, data, colors, tip, xmax) {
        return new Chart(cv, { type: 'bar',
          data: { labels: labels, datasets: [{ data: data, borderRadius: 0, borderSkipped: false, borderColor: '#15171C', borderWidth: 1, maxBarThickness: 26,
            backgroundColor: function (c) { return Array.isArray(colors) ? colors[c.dataIndex] : C.mint; } }] },
          options: { indexAxis: 'y', scales: { x: axis({ beginAtZero: true, max: xmax }), y: axis({ grid: { display: false } }) },
            plugins: { tooltip: { callbacks: { label: tip || function (c) { return c.parsed.x.toLocaleString(); } } } } } });
      }
    };

    function build(cv) {
      var id = cv.id, F = window.CHART_FACTORIES || {};
      if (built[id] || !F[id]) return; built[id] = true;
      try { F[id](cv); } catch (e) {}
    }
    function isVisible(cv) { return cv.offsetWidth > 0 && cv.offsetHeight > 0 && cv.offsetParent !== null; }
    function buildAll() { document.querySelectorAll('canvas[id]').forEach(function (cv) { if (isVisible(cv)) build(cv); }); }

    window.rebuildCharts = function (root) {
      (root || document).querySelectorAll('canvas[id]').forEach(function (cv) {
        var ch = Chart.getChart && Chart.getChart(cv);
        if (ch) { try { ch.destroy(); } catch (e) {} }
        built[cv.id] = false; build(cv);
      });
    };

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { build(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.15, rootMargin: '0px 0px 90px 0px' });
      document.querySelectorAll('canvas[id]').forEach(function (cv) { io.observe(cv); });
      (function (cb) {
        try {
          var probe = document.createElement('div'); probe.setAttribute('aria-hidden', 'true');
          probe.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;pointer-events:none';
          document.body.appendChild(probe);
          var done = false;
          var pio = new IntersectionObserver(function () { if (done) return; done = true; pio.disconnect(); probe.remove(); cb(true); });
          pio.observe(probe);
          setTimeout(function () { if (done) return; done = true; try { pio.disconnect(); probe.remove(); } catch (e) {} cb(false); }, 400);
        } catch (e) { cb(false); }
      })(function (ok) { if (!ok) buildAll(); });
    } else { buildAll(); }
  } else {
    window.rebuildCharts = function () {};
    window.RPT = {};
  }

  /* ---------- tabs ---------- */
  window.showTab = function (n) {
    document.querySelectorAll('[data-panel]').forEach(function (p) {
      p.style.display = (p.getAttribute('data-panel') === String(n)) ? '' : 'none';
    });
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === String(n));
    });
    var panel = document.querySelector('[data-panel="' + n + '"]');
    if (panel) window.rebuildCharts(panel);
  };

  /* ---------- copy the draft client email ---------- */
  window.copyEmail = function (btn) {
    var win = btn.closest('.win');
    var box = win ? win.querySelector('.emailcopy') : null;
    if (!box) return;
    var out = [];
    var sub = box.querySelector('.emailsub');
    if (sub) out.push(sub.innerText.trim());
    var body = box.querySelector('.emailbody');
    if (body) {
      Array.prototype.forEach.call(body.children, function (el) {
        if (el.tagName === 'UL') {
          out.push(Array.prototype.map.call(el.querySelectorAll('li'), function (li) { return '- ' + li.innerText.trim(); }).join('\n'));
        } else { out.push(el.innerText.trim()); }
      });
    }
    var text = out.join('\n\n');
    var restore = function (msg) {
      if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
      btn.textContent = msg;
      setTimeout(function () { btn.textContent = btn.getAttribute('data-label'); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { restore('Copied to clipboard'); }, function () { restore('Press Ctrl + C'); });
    } else { restore('Select the text and copy'); }
  };

  /* ---------- nav scroll state + year ---------- */
  var nav = document.querySelector('.nav');
  if (nav) { var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 10); }; onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); }
  var y = document.querySelector('[data-year]'); if (y) y.textContent = new Date().getFullYear();

  /* ---------- QA actions: task column, issue + request, notify relay ---------- */
  (function () {
    var NOTIFY_URL = window.NOTIFY_URL || '/api/notify';
    function clientName() {
      var h = document.querySelector('h1.display');
      if (h) return h.textContent.trim();
      return (document.title || '').replace(/Custom Strategy.*/i, '').replace(/[·|].*/, '').trim();
    }
    function notify(payload) {
      return fetch(NOTIFY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return true; });
    }
    function toast(msg) {
      var t = document.querySelector('.rpttoast');
      if (!t) { t = document.createElement('div'); t.className = 'rpttoast no-print'; document.body.appendChild(t); }
      t.textContent = msg; t.classList.add('is-in');
      clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('is-in'); }, 2400);
    }

    var modal;
    function buildModal() {
      if (modal) return modal;
      modal = document.createElement('div'); modal.className = 'modal no-print'; modal.hidden = true;
      modal.innerHTML =
        '<div class="modal__scrim" data-close></div>' +
        '<div class="modal__panel win"><div class="win__bar"><span class="ic">&#9635;</span><span class="ttl" data-title></span>' +
        '<span class="win__controls"><b data-close>&times;</b></span></div>' +
        '<div class="win__body"><div class="modal__ctx" data-ctx hidden></div>' +
        '<label data-namewrap hidden><span>Your name</span><input type="text" data-name placeholder="Your name" autocomplete="name"></label>' +
        '<label><span data-label>Message</span><textarea data-text rows="4" placeholder="Write your message"></textarea></label>' +
        '<div class="modal__status" data-status></div>' +
        '<div class="modal__actions"><button class="btn" type="button" data-close>Cancel</button>' +
        '<button class="btn btn--primary" type="button" data-send>Send</button></div></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) closeModal(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal && !modal.hidden) closeModal(); });
      return modal;
    }
    function closeModal() { if (modal) modal.hidden = true; }
    function openModal(opts) {
      buildModal();
      modal.querySelector('[data-title]').textContent = opts.title;
      var ctx = modal.querySelector('[data-ctx]');
      if (opts.ctx) { ctx.textContent = opts.ctx; ctx.hidden = false; } else { ctx.hidden = true; }
      modal.querySelector('[data-namewrap]').hidden = !opts.askName;
      modal.querySelector('[data-label]').textContent = opts.label || 'Message';
      var nameI = modal.querySelector('[data-name]'); nameI.value = '';
      var textI = modal.querySelector('[data-text]'); textI.value = ''; textI.placeholder = opts.placeholder || 'Write your message';
      var status = modal.querySelector('[data-status]'); status.textContent = ''; status.className = 'modal__status';
      var send = modal.querySelector('[data-send]'); send.disabled = false; send.textContent = opts.sendLabel || 'Send';
      modal.hidden = false;
      setTimeout(function () { (opts.askName ? nameI : textI).focus(); }, 30);
      send.onclick = function () {
        var text = textI.value.trim(), name = nameI.value.trim();
        if (!text) { status.textContent = 'Please write a message first.'; status.className = 'modal__status err'; return; }
        if (opts.askName && !name) { status.textContent = 'Please add your name.'; status.className = 'modal__status err'; return; }
        send.disabled = true; send.textContent = 'Sending...'; status.textContent = ''; status.className = 'modal__status';
        notify(opts.payload(name, text)).then(function () {
          status.textContent = 'Sent, thank you.'; status.className = 'modal__status ok'; send.textContent = 'Sent';
          setTimeout(closeModal, 1100);
        }).catch(function () {
          status.textContent = 'Could not send. The notifier is not set up yet.'; status.className = 'modal__status err';
          send.disabled = false; send.textContent = opts.sendLabel || 'Send';
        });
      };
    }
    function openIssue(client, task) {
      openModal({ title: 'Raise an issue', ctx: client + '   ' + task, askName: true, label: 'What is the issue?',
        placeholder: 'Describe the issue with this task', sendLabel: 'Send',
        payload: function (name, text) { return { type: 'issue', person: name, client: client, taskTitle: task, comment: text }; } });
    }
    function openRequest(client) {
      openModal({ title: 'Request', askName: true, label: 'Your message', placeholder: 'What do you need?', sendLabel: 'Submit',
        payload: function (name, text) { return { type: 'request', person: name, client: client, message: text }; } });
    }

    // add the Action column to the strategy tasks table (the one with priority
    // pills). Cancel state is saved to /api/cancels so it is shared: a Cancel
    // (or Revert) shows for everyone who opens the link, not just this browser.
    (function initTasks() {
      var tables = [].slice.call(document.querySelectorAll('table.dt')), table = null;
      for (var i = 0; i < tables.length; i++) { if (tables[i].querySelector('.pri')) { table = tables[i]; break; } }
      if (!table) return;
      var client = clientName();
      var slug = (location.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
      function keyOf(text) { var h = 5381, i = text.length; while (i) { h = (h * 33) ^ text.charCodeAt(--i); } return (h >>> 0).toString(16); }
      function persist(key, cancelled) {
        fetch('/api/cancels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: slug, task: key, cancelled: cancelled }) })
          .then(function (r) { if (!r.ok) throw new Error(r.status); })
          .catch(function () { toast('Saved on this screen only, could not reach the server.'); });
      }
      var headRow = table.querySelector('thead tr');
      if (headRow && !headRow.querySelector('.actcol')) {
        var th = document.createElement('th'); th.className = 'actcol'; th.textContent = 'Action'; headRow.appendChild(th);
      }
      function buildRow(tr, cancelledSet) {
        if (tr.querySelector('.task-action')) return;
        var task = (tr.children[1] ? tr.children[1].textContent : '').trim();
        var key = keyOf(task);
        var td = document.createElement('td'); td.className = 'task-action no-print'; tr.appendChild(td);
        function render(cancelled, save) {
          tr.classList.toggle('task-cancelled', cancelled);
          if (cancelled) {
            td.innerHTML = '<button class="tact tact--revert" type="button">Revert</button>';
            td.querySelector('.tact--revert').onclick = function () { render(false, true); };
          } else {
            td.innerHTML = '<button class="tact tact--push" type="button" title="Pushes this task to the client Asana board (coming soon)">Push</button>' +
              '<button class="tact tact--issue" type="button">Issue</button>' +
              '<button class="tact tact--cancel" type="button">Cancel</button>';
            td.querySelector('.tact--push').onclick = function () { toast('Asana push is coming soon.'); };
            td.querySelector('.tact--issue').onclick = function () { openIssue(client, task); };
            td.querySelector('.tact--cancel').onclick = function () { render(true, true); };
          }
          if (save) persist(key, cancelled);
        }
        render(cancelledSet[key] === true, false);
      }
      function buildAll(cancelledSet) {
        [].slice.call(table.querySelectorAll('tbody tr')).forEach(function (tr) { buildRow(tr, cancelledSet); });
      }
      // load the shared cancel state first, then render rows in the right state
      fetch('/api/cancels?slug=' + encodeURIComponent(slug), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : { cancelled: [] }; })
        .catch(function () { return { cancelled: [] }; })
        .then(function (data) {
          var set = {}; (((data && data.cancelled)) || []).forEach(function (k) { set[k] = true; });
          buildAll(set);
        });
    })();

    // add the Request button to the bottom bar
    (function initRequest() {
      var inner = document.querySelector('.reportbar__inner');
      if (!inner || inner.querySelector('.reportbar__req')) return;
      var client = clientName();
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn reportbar__req'; b.textContent = 'Request';
      b.onclick = function () { openRequest(client); };
      var link = inner.querySelector('a.btn');
      if (link) inner.insertBefore(b, link); else inner.appendChild(b);
    })();
  })();

  /* ---------- task table filter (Area + Priority) ---------- */
  (function initTaskFilter() {
    var tables = [].slice.call(document.querySelectorAll('table.dt')), table = null;
    for (var i = 0; i < tables.length; i++) {
      if (tables[i].querySelector('td.area') && tables[i].querySelector('.pri')) { table = tables[i]; break; }
    }
    if (!table) return;
    var rows = [].slice.call(table.querySelectorAll('tbody tr'));
    if (rows.length < 3) return;

    function areaOf(tr) { var a = tr.querySelector('td.area'); return a ? a.textContent.replace(/\s*[·•]\s*rec\s*$/i, '').trim() : ''; }
    function prioOf(tr) { var p = tr.querySelector('.pri'); return p ? p.textContent.trim() : ''; }

    var areas = [], aseen = {};
    rows.forEach(function (tr) { var v = areaOf(tr); if (v && !aseen[v]) { aseen[v] = 1; areas.push(v); } });
    if (areas.length < 2) return;
    var rank = { High: 0, Medium: 1, Low: 2, Ongoing: 3 }, prios = [], pseen = {};
    rows.forEach(function (tr) { var v = prioOf(tr); if (v && !pseen[v]) { pseen[v] = 1; prios.push(v); } });
    prios.sort(function (a, b) { return (rank[a] == null ? 9 : rank[a]) - (rank[b] == null ? 9 : rank[b]); });

    function field(label, opts) {
      var wrap = document.createElement('label'); wrap.className = 'tfilter__field';
      var cap = document.createElement('span'); cap.className = 'tfilter__cap'; cap.textContent = label;
      var sel = document.createElement('select'); sel.className = 'tfilter__sel'; sel.setAttribute('aria-label', 'Filter by ' + label.toLowerCase());
      var all = document.createElement('option'); all.value = ''; all.textContent = 'All ' + label.toLowerCase(); sel.appendChild(all);
      opts.forEach(function (o) { var op = document.createElement('option'); op.value = o; op.textContent = o; sel.appendChild(op); });
      wrap.appendChild(cap); wrap.appendChild(sel); return { wrap: wrap, sel: sel };
    }

    var bar = document.createElement('div'); bar.className = 'tfilter no-print';
    var aF = field('Area', areas), pF = field('Priority', prios);
    var reset = document.createElement('button'); reset.type = 'button'; reset.className = 'tfilter__reset'; reset.textContent = 'Reset';
    var count = document.createElement('span'); count.className = 'tfilter__count';
    bar.appendChild(aF.wrap); bar.appendChild(pF.wrap); bar.appendChild(reset); bar.appendChild(count);
    table.parentNode.insertBefore(bar, table);

    function apply() {
      var av = aF.sel.value, pv = pF.sel.value, shown = 0;
      rows.forEach(function (tr) {
        var ok = (!av || areaOf(tr) === av) && (!pv || prioOf(tr) === pv);
        tr.style.display = ok ? '' : 'none'; if (ok) shown++;
      });
      var active = !!(av || pv);
      count.textContent = active ? (shown + ' of ' + rows.length + ' shown') : '';
      reset.style.visibility = active ? 'visible' : 'hidden';
    }
    aF.sel.addEventListener('change', apply);
    pF.sel.addEventListener('change', apply);
    reset.addEventListener('click', function () { aF.sel.value = ''; pF.sel.value = ''; apply(); });
    window.addEventListener('beforeprint', function () { aF.sel.value = ''; pF.sel.value = ''; apply(); });
    apply();
  })();

  /* ---------- reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    if ('IntersectionObserver' in window) {
      var rio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } }); }, { threshold: 0.1 });
      reveals.forEach(function (el) { rio.observe(el); });
      setTimeout(function () { reveals.forEach(function (el) { el.classList.add('is-in'); }); }, 500);
    } else { reveals.forEach(function (el) { el.classList.add('is-in'); }); }
  }

  /* ---------- retro sound (default OFF on client reports) ---------- */
  (function () {
    var KEY = 'hqdm-sound';
    var enabled = (localStorage.getItem(KEY) || 'on') === 'on';
    var unlocked = false, ctx = null, master = null;
    function ensureCtx() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination); return ctx;
    }
    function tone(f, start, dur, type, vol) {
      if (!ctx) return; var t0 = ctx.currentTime + start;
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'square'; o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function slide(f1, f2, dur, vol) {
      if (!ctx) return; var t0 = ctx.currentTime;
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
    }
    var S = {
      click: function () { tone(880, 0, 0.05, 'square', 0.06); tone(640, 0.018, 0.04, 'square', 0.045); },
      nav: function () { tone(740, 0, 0.05, 'square', 0.06); tone(988, 0.05, 0.07, 'square', 0.055); },
      open: function () { tone(523, 0, 0.06, 'square', 0.06); tone(784, 0.06, 0.09, 'square', 0.06); },
      close: function () { tone(660, 0, 0.06, 'square', 0.055); tone(440, 0.06, 0.09, 'square', 0.055); },
      tab: function () { tone(700, 0, 0.04, 'square', 0.055); tone(1040, 0.04, 0.05, 'square', 0.05); },
      on: function () { slide(380, 1200, 0.18, 0.06); }, off: function () { slide(1100, 320, 0.18, 0.06); }
    };
    function play(name, force) {
      if ((!enabled && !force) || !unlocked) return;
      if (!ensureCtx()) return; if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      var fn = S[name]; if (fn) { try { fn(); } catch (e) {} }
    }
    window.addEventListener('pointerdown', function () { unlocked = true; }, { capture: true, passive: true });
    window.addEventListener('keydown', function () { unlocked = true; }, { capture: true });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.sndtoggle, .tab-btn, summary, .win__controls b, .nav a, .footer a, .btn, a, button');
      if (!t) return;
      if (t.matches('.sndtoggle') || t.matches('summary')) return;
      if (t.matches('.tab-btn')) return play('tab');
      if (t.matches('.win__controls b')) return play(t.textContent.indexOf('×') > -1 ? 'close' : 'click');
      if (t.matches('.nav a, .footer a')) return play('nav');
      play('click');
    }, true);
    document.addEventListener('toggle', function (e) { if (e.target && e.target.tagName === 'DETAILS') play(e.target.open ? 'open' : 'close'); }, true);

    function icon(on) {
      return on
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a3 3 0 0 1 0 6M18.5 7a6 6 0 0 1 0 10"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
    }
    function render(b) { b.innerHTML = icon(enabled) + '<span class="sndtoggle__t">' + (enabled ? 'SND ON' : 'SND OFF') + '</span>'; }
    function inject() {
      if (document.querySelector('.sndtoggle')) return;
      var b = document.createElement('button');
      b.className = 'sndtoggle no-print' + (enabled ? '' : ' is-off'); b.type = 'button';
      b.setAttribute('aria-label', 'Toggle retro sound effects'); b.setAttribute('aria-pressed', String(enabled));
      render(b);
      b.addEventListener('click', function () {
        unlocked = true;
        if (enabled) { play('off', true); enabled = false; } else { enabled = true; play('on'); }
        localStorage.setItem(KEY, enabled ? 'on' : 'off');
        b.classList.toggle('is-off', !enabled); b.setAttribute('aria-pressed', String(enabled)); render(b);
      });
      document.body.appendChild(b);
    }
    if (document.body) inject(); else document.addEventListener('DOMContentLoaded', inject);
  })();

  /* ---------- save any chart / map / graphic as a PNG (every report, no per-page work) ----------
     Injects a small "PNG" button onto each chart card and each map/graphic card, lazy-loads
     html2canvas from the same /assets/js/ folder on first click, and downloads a white-background
     PNG of that card (with a small client + period + HQDM footer added only to the saved image). */
  (function initPng() {
    var DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="M7.5 10l4.5 4.5 4.5-4.5"/><path d="M5 20h14"/></svg>';

    // lazy-load html2canvas from wherever report.js itself was loaded from
    var h2cP = null;
    function assetBase() {
      var s = document.querySelector('script[src*="report.js"]');
      var src = s ? s.getAttribute('src') : '';
      return src ? src.replace(/report\.js(?:\?.*)?$/, '') : '../assets/js/';
    }
    function loadH2C() {
      if (window.html2canvas) return Promise.resolve(window.html2canvas);
      if (h2cP) return h2cP;
      h2cP = new Promise(function (resolve, reject) {
        var sc = document.createElement('script');
        sc.src = assetBase() + 'html2canvas.min.js';
        sc.onload = function () { window.html2canvas ? resolve(window.html2canvas) : reject(new Error('html2canvas missing')); };
        sc.onerror = function () { reject(new Error('html2canvas failed to load')); };
        document.head.appendChild(sc);
      });
      return h2cP;
    }

    function slugify(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'graphic'; }
    function clientSlug() { return (location.pathname.split('/').filter(Boolean)[0] || 'report').toLowerCase(); }
    function titleOf(card) {
      var t = card.querySelector('.chart-head h3, .cardhd, .hmsub, h3');
      var s = t ? t.textContent.trim() : 'graphic';
      return s.split('·')[0].trim() || s; // drop trailing " · subtitle/stat" so filenames stay clean
    }
    function pageMeta() {
      var h = document.querySelector('h1.display');
      var pill = document.querySelector('.pill');
      return { name: h ? h.textContent.trim() : '', period: pill ? pill.textContent.replace(/\s+/g, ' ').trim() : '' };
    }
    function downloadCanvas(canvas, fname) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a'); a.href = url; a.download = fname;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        }, 'image/png');
      } else {
        var a2 = document.createElement('a'); a2.href = canvas.toDataURL('image/png'); a2.download = fname;
        document.body.appendChild(a2); a2.click(); a2.remove();
      }
    }

    function setLabel(btn, text, restore) {
      if (!btn._lbl) btn._lbl = btn.innerHTML;
      btn.innerHTML = DL + '<span>' + text + '</span>';
      if (restore) setTimeout(function () { btn.innerHTML = btn._lbl; btn.disabled = false; }, restore);
    }

    function capture(btn) {
      var card = btn.closest('.chart-card, .card');
      if (!card || btn.disabled) return;
      btn.disabled = true; setLabel(btn, 'Saving');
      var fname = clientSlug() + '-' + slugify(titleOf(card)) + '.png';
      var m = pageMeta();
      var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      Promise.all([loadH2C(), fontsReady]).then(function (res) {
        var html2canvas = res[0];
        card.setAttribute('data-png-target', '1');
        return html2canvas(card, {
          backgroundColor: '#ffffff',
          scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
          useCORS: true, logging: false,
          ignoreElements: function (el) { return !!(el.classList && el.classList.contains('no-print')); },
          onclone: function (doc) {
            try {
              var c = doc.querySelector('[data-png-target="1"]');
              if (c && (m.name || m.period)) {
                var f = doc.createElement('div');
                f.style.cssText = 'margin-top:14px;padding-top:10px;border-top:1px solid #B7BCC4;' +
                  "font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.03em;color:#5C636E;";
                f.textContent = [m.name, m.period, 'HQDM Search Intelligence'].filter(Boolean).join('   ·   ');
                c.appendChild(f);
              }
            } catch (e) {}
          }
        });
      }).then(function (canvas) {
        card.removeAttribute('data-png-target');
        downloadCanvas(canvas, fname);
        btn.disabled = false; setLabel(btn, 'Saved', 1600);
      }).catch(function () {
        card.removeAttribute('data-png-target');
        btn.disabled = false; setLabel(btn, 'Retry', 2200);
      });
    }

    function makeBtn() {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pngbtn no-print';
      b.title = 'Save this as a PNG image'; b.setAttribute('aria-label', 'Save as PNG');
      b.innerHTML = DL + '<span>PNG</span>';
      b.addEventListener('click', function () { capture(b); });
      return b;
    }
    function addBar(card) {
      var bar = document.createElement('div'); bar.className = 'pngbar no-print';
      bar.appendChild(makeBtn()); card.insertBefore(bar, card.firstChild);
    }

    function inject() {
      // chart cards: drop the button into the existing title row when there is one
      [].forEach.call(document.querySelectorAll('.chart-card'), function (card) {
        if (card.querySelector('.pngbtn')) return;
        var head = card.querySelector('.chart-head');
        if (head) head.appendChild(makeBtn()); else addBar(card);
      });
      // map / graphic cards: any card holding a heatmap grid that is not already a chart card
      [].forEach.call(document.querySelectorAll('.card'), function (card) {
        if (card.classList.contains('chart-card') || card.querySelector('.pngbtn')) return;
        if (!card.querySelector('.hm')) return;
        addBar(card);
      });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject); else inject();
  })();
})();
