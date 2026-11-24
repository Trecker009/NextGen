/* NextGen Sales — interactions
   Motion follows the brand book: quiet (fade + rise 8px), amber arrives
   (slide 16px), blue pulses (live call), aqua locks (booking only).
   Review helpers: ?open=services|work|resources|about pins a mega-menu open.
                   ?story=end shows the hero story's final frame.
                   ?how=<0..1> pins the how-it-works scene at that progress. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  /* ---------------- toast ---------------- */
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('on'), 2600);
  }

  /* ---------------- theme: light / dark / system ---------------- */
  (function theme() {
    const groups = $$('[data-theme-toggle]');
    const meta = $('meta[name="theme-color"]');
    function apply(mode) {
      if (mode === 'light' || mode === 'dark') document.documentElement.setAttribute('data-theme', mode);
      else document.documentElement.removeAttribute('data-theme');
      groups.forEach(g => $$('button', g).forEach(b => b.setAttribute('aria-checked', String(b.dataset.set === mode))));
      const light = mode === 'light' || (mode === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
      meta.setAttribute('content', light ? '#f5f7fa' : '#04060c');
      document.documentElement.setAttribute('data-mode', light ? 'light' : 'dark'); // drives the alternating section tones
    }
    const saved = store.get('ng-theme');
    apply(saved === 'light' || saved === 'dark' ? saved : 'system');
    groups.forEach(g => $$('button', g).forEach(b => b.addEventListener('click', () => { store.set('ng-theme', b.dataset.set); apply(b.dataset.set); })));
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (!document.documentElement.hasAttribute('data-theme')) apply('system'); });
  })();

  /* ---------------- next free slot (Irish / UK time) ---------------- */
  (function nextSlot() {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Dublin', weekday: 'short', hour: '2-digit', hour12: false });
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const d = days.indexOf(parts.weekday), h = parseInt(parts.hour, 10);
    let label;
    if (d < 5 && h < 15) label = `Today ${String(Math.max(10, h + 2)).padStart(2, '0')}:30`;
    else { let n = (d + 1) % 7; while (n > 4) n = (n + 1) % 7; label = `${n === (d + 1) % 7 ? 'Tomorrow' : days[n]} 10:30`; }
    $$('[data-next-slot]').forEach(el => (el.textContent = label));
  })();

  /* ---------------- promo ---------------- */
  const promo = $('#promo');
  if (store.get('ng-promo') === 'x') promo.hidden = true;
  $('[data-dismiss="promo"]').addEventListener('click', () => { promo.hidden = true; store.set('ng-promo', 'x'); });

  /* =================================================================
     MEGA-MENU: one surface that morphs between panels
     ================================================================= */
  const header = $('#header');
  const nav = $('.nav');
  const mega = $('#mega');
  const scrim = $('#scrim');
  const triggers = $$('.nav-trigger');
  const order = triggers.map(t => t.dataset.menu);
  const panels = Object.fromEntries($$('.mega-panel').map(p => [p.dataset.panel, p]));
  const pinned = order.includes(params.get('open'));
  let current = null, openT, closeT, leaveT;

  Object.values(panels).forEach(p => {
    p.querySelectorAll('.mp-tier, .mp-layer, .mp-item, .mp-feature, .mp-foot').forEach((el, i) => { el.classList.add('stg'); el.style.setProperty('--i', i); });
  });
  $$('.mp-feature').forEach(f => f.addEventListener('pointermove', e => {
    const r = f.getBoundingClientRect();
    f.style.setProperty('--sx', (e.clientX - r.left) + 'px');
    f.style.setProperty('--sy', (e.clientY - r.top) + 'px');
  }));

  function place(key) {
    const t = triggers[order.indexOf(key)], p = panels[key];
    const nr = nav.getBoundingClientRect(), tr = t.getBoundingClientRect();
    const w = p.offsetWidth, h = p.offsetHeight;
    const center = tr.left - nr.left + tr.width / 2;
    let x = clamp(center - w / 2, 16, nr.width - w - 16);
    if (w > nr.width - 32) x = (nr.width - w) / 2;
    mega.style.setProperty('--mw', w + 'px');
    mega.style.setProperty('--mh', h + 'px');
    mega.style.setProperty('--mx', x + 'px');
  }
  function open(key) {
    clearTimeout(closeT); clearTimeout(openT);
    if (key === current) return;
    const next = panels[key];
    if (current !== null && mega.classList.contains('is-open')) {
      const dir = Math.sign(order.indexOf(key) - order.indexOf(current));
      const prev = panels[current];
      mega.classList.add('is-morphing');
      prev.style.setProperty('--dir', dir);
      prev.classList.remove('is-active'); prev.classList.add('is-leaving');
      clearTimeout(leaveT); leaveT = setTimeout(() => prev.classList.remove('is-leaving'), 400);
      next.classList.remove('is-leaving');
      next.style.transition = 'none'; next.style.setProperty('--dir', dir); void next.offsetWidth; next.style.transition = '';
    } else {
      mega.classList.remove('is-morphing');
      Object.values(panels).forEach(p => { p.classList.remove('is-active', 'is-leaving'); p.style.setProperty('--dir', 0); });
      mega.style.transition = 'none'; place(key); void mega.offsetWidth; mega.style.transition = '';
    }
    place(key);
    next.classList.add('is-active');
    mega.classList.add('is-open'); header.classList.add('has-open'); scrim.classList.add('is-on');
    triggers.forEach(t => t.setAttribute('aria-expanded', String(t.dataset.menu === key)));
    current = key;
  }
  function close({ focus = false } = {}) {
    if (pinned) return;
    clearTimeout(openT); clearTimeout(closeT);
    if (current === null) return;
    const t = triggers[order.indexOf(current)];
    mega.classList.remove('is-open', 'is-morphing'); header.classList.remove('has-open'); scrim.classList.remove('is-on');
    triggers.forEach(tr => tr.setAttribute('aria-expanded', 'false'));
    current = null;
    if (focus) t.focus();
  }
  const scheduleClose = () => { clearTimeout(closeT); closeT = setTimeout(close, 220); };
  triggers.forEach(t => {
    const key = t.dataset.menu;
    t.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(closeT);
      if (current !== null) open(key);
      else { clearTimeout(openT); openT = setTimeout(() => open(key), 90); }
    });
    t.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { clearTimeout(openT); scheduleClose(); } });
    t.addEventListener('click', () => (current === key ? close() : open(key)));
    t.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); open(key); requestAnimationFrame(() => panels[key].querySelector('a')?.focus()); } });
  });
  mega.addEventListener('pointerenter', () => clearTimeout(closeT));
  mega.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') scheduleClose(); });
  scrim.addEventListener('click', () => close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && current) close({ focus: true }); });
  nav.addEventListener('focusout', e => { if (current && !nav.contains(e.relatedTarget)) close(); });
  mega.addEventListener('click', e => { if (e.target.closest('a')) close(); });
  addEventListener('resize', () => { if (current) place(current); });
  if (pinned) (document.fonts?.ready || Promise.resolve()).then(() => open(params.get('open')));

  /* ---------------- mobile sheet ---------------- */
  const sheet = $('#msheet');
  const burger = $('.nav .burger');
  function setSheet(on) {
    sheet.classList.toggle('is-open', on);
    sheet.setAttribute('aria-hidden', String(!on));
    burger.setAttribute('aria-expanded', String(on));
    document.body.classList.toggle('is-locked', on);
    if (on) setTimeout(() => sheet.querySelector('.macc button')?.focus(), 50); else burger.focus();
  }
  burger.addEventListener('click', () => setSheet(true));
  $$('[data-close-sheet]', sheet).forEach(b => b.addEventListener('click', () => setSheet(false)));
  $$('.msheet-body a', sheet).forEach(a => a.addEventListener('click', () => setSheet(false)));
  $$('.macc > button', sheet).forEach(b => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-expanded') !== 'true';
    $$('.macc > button', sheet).forEach(o => o.setAttribute('aria-expanded', 'false'));
    b.setAttribute('aria-expanded', String(on));
  }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('is-open')) setSheet(false); });
  matchMedia('(min-width: 1024px)').addEventListener('change', e => { if (e.matches && sheet.classList.contains('is-open')) setSheet(false); });

  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('is-ready')));

  /* =================================================================
     HERO STORY: signal 0.0s → dialler 0.9s → connected 1.8s →
     CRM card 3.4s → aqua lock 3.6s. Plays once, rests on the last frame.
     ================================================================= */
  (function story() {
    const root = $('[data-story]');
    if (!root) return;
    const stage = $('.stage', root);
    const beats = Object.fromEntries($$('[data-beat]', root).map(b => [b.dataset.beat, b]));
    const labels = $$('[data-tl]', root);
    const head = $('[data-playhead]', root);
    const badge = $('[data-call-badge]', root);
    const timer = $('[data-call-timer]', root);
    const replay = $('[data-replay]', root);
    const wires = $$('[data-wire]', root), pkts = $$('[data-pkt]', root);
    let timers = [], raf;

    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const fmt = s => `${String((s / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    function setBadge(kind, text) { badge.className = 'badge ' + kind; badge.textContent = text; }

    function layoutWires() {
      const sr = stage.getBoundingClientRect();
      const pt = (el, side) => { const r = el.getBoundingClientRect(); return [side === 'r' ? r.right - sr.left : r.left - sr.left, r.top - sr.top + r.height / 2]; };
      const seg = (a, b) => { const mx = (a[0] + b[0]) / 2; return `M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`; };
      wires[0].setAttribute('d', seg(pt(beats.signal, 'r'), pt(beats.call, 'l')));
      wires[1].setAttribute('d', seg(pt(beats.call, 'r'), pt(beats.crm, 'l')));
    }
    function runPacket(i, dur) {
      const path = wires[i], c = pkts[i], len = path.getTotalLength(), t0 = performance.now();
      const step = now => {
        const k = clamp((now - t0) / dur);
        const p = path.getPointAtLength(easeInOut(k) * len);
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
        c.style.opacity = k < 1 ? 1 : 0;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    function playhead(dur) {
      const t0 = performance.now();
      cancelAnimationFrame(raf);
      const step = now => { const k = clamp((now - t0) / dur); head.style.setProperty('--p', k); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }

    function reset() {
      timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
      Object.values(beats).forEach(b => b.classList.remove('on', 'is-locked'));
      labels.forEach(l => l.classList.remove('on', 'lock'));
      wires.forEach(w => w.classList.remove('on')); pkts.forEach(p => (p.style.opacity = 0));
      head.style.setProperty('--p', 0);
      setBadge('neutral', 'Dialling'); timer.textContent = '00:00';
      call().classList.remove('is-live');
      replay.classList.remove('on');
    }
    const call = () => beats.call;
    function finalFrame() {
      Object.values(beats).forEach(b => b.classList.add('on'));
      beats.crm.classList.add('is-locked');
      labels.forEach(l => l.classList.add('on')); labels[2].classList.add('lock');
      wires.forEach(w => w.classList.add('on'));
      head.style.setProperty('--p', 1);
      setBadge('booked', 'Meeting booked'); timer.textContent = '06:41';
      replay.classList.add('on');
    }
    function play() {
      reset(); layoutWires();
      playhead(3600);
      at(0, () => { beats.signal.classList.add('on'); labels[0].classList.add('on'); });          // amber arrives
      at(420, () => { wires[0].classList.add('on'); runPacket(0, 480); });
      at(900, () => beats.call.classList.add('on'));                                              // dialler appears
      at(1800, () => {                                                                            // connected, timer runs
        labels[1].classList.add('on'); setBadge('connected', 'Connected'); call().classList.add('is-live');
        const t0 = performance.now();
        const tick = now => { const k = clamp((now - t0) / 1600); timer.textContent = fmt(Math.round(401 * k)); if (k < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      at(2900, () => { wires[1].classList.add('on'); runPacket(1, 480); });
      at(3400, () => beats.crm.classList.add('on'));                                              // CRM card arrives
      at(3600, () => {                                                                            // aqua lock
        beats.crm.classList.add('is-locked'); labels[2].classList.add('on', 'lock');
        call().classList.remove('is-live'); setBadge('booked', 'Meeting booked');
      });
      at(5200, () => replay.classList.add('on'));
    }
    replay.addEventListener('click', play);
    addEventListener('resize', () => layoutWires());
    if (reduced || params.get('story') === 'end') { (document.fonts?.ready || Promise.resolve()).then(() => { layoutWires(); finalFrame(); }); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); setTimeout(play, 300); } }, { threshold: 0.35 });
    io.observe(stage);
  })();

  /* ---------------- booking forms: rest → loading → booked ---------------- */
  const freeMail = /@(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|aol|proton(mail)?|gmx)\./i;
  $$('[data-book-form]').forEach(form => {
    const input = form.querySelector('input');
    const btn = form.querySelector('button');
    const lbl = btn.querySelector('.lbl');
    const err = form.parentElement.querySelector('.form-err');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim();
      err.textContent = '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { err.textContent = 'Enter your work email to see open times.'; input.focus(); return; }
      if (freeMail.test(v)) { err.textContent = 'Please use your work email so we can bring accounts from your market.'; input.focus(); return; }
      btn.setAttribute('aria-busy', 'true');
      lbl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span class="spin"></span>Opening calendar</span>';
      setTimeout(() => {
        btn.removeAttribute('aria-busy'); btn.classList.add('is-booked'); lbl.textContent = 'Call booked';
        toast('Prototype: the white-labelled scheduler opens here');
        setTimeout(() => { btn.classList.remove('is-booked'); lbl.textContent = 'Book a call'; }, 2400);
      }, 1100);
    });
  });

  /* ---------------- quiet reveals ---------------- */
  const rvIO = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rvIO.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('.rv').forEach(el => rvIO.observe(el));

  /* ---------------- problem dial (desktop scroll) ---------------- */
  (function dial() {
    const wrap = $('[data-dial]');
    if (!wrap || reduced) return;
    const rows = $$('.pa-row', wrap);
    const nOut = $('[data-dial-n]', wrap), dot = $('[data-dial-dot]', wrap);
    const mq = matchMedia('(min-width: 1024px)');
    const smooth = x => x * x * (3 - 2 * x);
    let raf = 0;
    function frame() {
      raf = 0;
      const r = wrap.getBoundingClientRect();
      const span = wrap.offsetHeight - innerHeight * 0.72;
      apply(clamp((innerHeight * 0.16 - r.top) / span));
    }
    window.__ngDial = p => apply(clamp(p)); // design-export hook
    function apply(p) {
      const raw = p * (rows.length - 1), base = Math.floor(raw), frac = raw - base;
      const eased = Math.min(rows.length - 1, base + smooth(clamp((frac - 0.3) / 0.4)));
      const active = Math.round(eased);
      rows.forEach((row, i) => {
        const o = i - eased, a = Math.abs(o);
        row.style.transform = `translateY(calc(-50% + ${o * 170}px)) rotateX(${o * -32}deg) scale(${1 - Math.min(a, 1.5) * 0.06})`;
        row.style.opacity = String(Math.max(0, 1 - a * 0.7));
        row.classList.toggle('is-on', i === active);
      });
      nOut.textContent = String(active + 1).padStart(2, '0');
      dot.style.setProperty('--dy', (eased / (rows.length - 1)) * 133 + 'px');
    }
    const req = () => { if (!raf) raf = requestAnimationFrame(frame); };
    function setMode() {
      const on = mq.matches;
      wrap.classList.toggle('dial-on', on);
      if (on) { rows.forEach(r => r.classList.add('in')); addEventListener('scroll', req, { passive: true }); frame(); }
      else { removeEventListener('scroll', req); rows.forEach(r => { r.style.transform = ''; r.style.opacity = ''; r.classList.remove('is-on'); }); }
    }
    mq.addEventListener('change', setMode);
    addEventListener('resize', req);
    setMode();
  })();

  /* =================================================================
     HOW IT WORKS: your market → signal gate → SDR calls → meetings.
     Desktop scrubs with scroll; smaller screens play it when in view.
     ================================================================= */
  (function funnel() {
    const root = $('[data-funnel]');
    if (!root) return;
    const section = root.closest('section');
    const cloud = $('[data-cloud]', root), gate = $('[data-gate]', root);
    const sigs = $$('[data-sig]', root), calls = $$('[data-call]', root);
    const booked = $('[data-booked]', root), big = $('[data-big]', root), mtgs = $$('[data-mtg]', root);
    const counts = $$('[data-c]', root), countBoxes = $$('.fn-count', root), steps = $$('[data-step]', root);
    const replayBtn = $('[data-fn-replay]', root);
    const outcomes = [['booked', 'Booked'], ['voicemail', 'Voicemail'], ['booked', 'Booked'], ['connected', 'Connected']];

    // seeded layout so the cloud looks the same every visit
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const N = 54, survivors = new Set([6, 17, 29, 38, 47]);
    const tiles = Array.from({ length: N }, (_, i) => {
      const el = document.createElement('i');
      el.className = 'fn-tile';
      cloud.appendChild(el);
      const col = i % 6, row = (i / 6) | 0;
      return { el, fx: (col + 0.15 + rnd() * 0.7) / 6.6, fy: (row + 0.15 + rnd() * 0.6) / 9.2, d: rnd(), sv: survivors.has(i) };
    });
    let W = 0, H = 0, vertical = false;
    const measure = () => { W = cloud.clientWidth; H = cloud.clientHeight; vertical = matchMedia('(max-width: 767px)').matches; };

    function render(p) {
      // phase 0 accounts · 1 signals · 2 calls · 3 meetings
      const k = p < 0.25 ? 0 : p < 0.48 ? 1 : p < 0.74 ? 2 : 3;
      const appear = clamp(p / 0.16), filt = clamp((p - 0.18) / 0.3);
      tiles.forEach((t, i) => {
        const x0 = t.fx * (W - 40) + 6, y0 = t.fy * (H - 24) + 6;
        const local = clamp((filt - t.d * 0.55) / 0.45), e = easeInOut(local);
        // survivors travel all the way through the gate; the rest drift a little and dim in place
        const reach = t.sv ? 1 : 0.3;
        let x = x0, y = y0;
        if (vertical) y = y0 + (H - 34 - y0) * e * reach; else x = x0 + (W - 44 - x0) * e * reach;
        const vis = clamp(appear * 1.6 - (i / N) * 0.6);
        const op = vis * (t.sv ? (local < 0.92 ? 1 : 1 - (local - 0.92) / 0.08) : 1 - e * 0.82);
        t.el.classList.toggle('sig', t.sv && local > 0.55);
        t.el.style.opacity = op.toFixed(3);
        t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(1 - (t.sv ? 0 : e * 0.2)).toFixed(3)})`;
      });
      root.classList.toggle('fn-scan', filt > 0 && filt < 1);
      const sweep = (Math.sin(p * 46) + 1) / 2;
      if (vertical) gate.style.setProperty('--gx', (sweep * (W - 60)).toFixed(1) + 'px');
      else gate.style.setProperty('--gy', (sweep * (H - 60)).toFixed(1) + 'px');

      sigs.forEach((s, i) => s.classList.toggle('on', p > 0.3 + i * 0.035));
      calls.forEach((c, i) => {
        const b = $('[data-badge]', c);
        c.classList.toggle('on', p > 0.49 + i * 0.025);
        let kind = 'neutral', text = 'Dialling', live = false;
        if (p > 0.56 + i * 0.03) { kind = 'connected'; text = 'Connected'; live = true; }
        if (p > 0.68 + i * 0.025 && i < 3) { [kind, text] = outcomes[i]; live = false; }
        if (b.textContent !== text) { b.className = 'badge ' + kind; b.textContent = text; }
        c.classList.toggle('is-live', live);
      });
      booked.classList.toggle('on', p > 0.74);
      booked.classList.toggle('is-locked', p > 0.9);
      let n = 0;
      mtgs.forEach((m, i) => { const on = p > 0.77 + i * 0.03; m.classList.toggle('on', on); if (on) n++; });
      big.textContent = String(n);

      const vals = [2400, Math.round(38 * clamp((p - 0.25) / 0.2)), Math.round(112 * clamp((p - 0.48) / 0.24)), n];
      counts.forEach((c, i) => { const s = vals[i].toLocaleString('en-GB'); if (c.textContent !== s) c.textContent = s; });
      countBoxes.forEach((b, i) => b.classList.toggle('on', i <= k));
      steps.forEach((s, i) => s.classList.toggle('on', i === k));
    }

    window.__ngFunnel = p => { measure(); render(clamp(p)); }; // design-export hook: render any frame
    const pinnedP = params.has('how') ? clamp(parseFloat(params.get('how')) || 0) : null;
    measure();
    section.classList.add('fn-live');
    if (reduced || pinnedP !== null) { render(pinnedP ?? 1); addEventListener('resize', () => { measure(); render(pinnedP ?? 1); }); return; }

    const desk = matchMedia('(min-width: 1024px)');
    let raf = 0, playRaf = 0, played = false;
    function scrubFrame() {
      raf = 0;
      const r = root.getBoundingClientRect();
      render(clamp(-r.top / (root.offsetHeight - innerHeight)));
    }
    const req = () => { if (!raf) raf = requestAnimationFrame(scrubFrame); };
    function playTimed() {
      cancelAnimationFrame(playRaf);
      const t0 = performance.now(), dur = 7000;
      const step = now => { const k = clamp((now - t0) / dur); render(k); if (k < 1) playRaf = requestAnimationFrame(step); };
      playRaf = requestAnimationFrame(step);
    }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !desk.matches && !played) { played = true; playTimed(); } }, { threshold: 0.3 });
    io.observe($('.fn-stage', root));
    replayBtn.addEventListener('click', playTimed);
    function setMode() {
      measure();
      root.classList.toggle('is-scrub', desk.matches);
      if (desk.matches) { cancelAnimationFrame(playRaf); addEventListener('scroll', req, { passive: true }); scrubFrame(); }
      else { removeEventListener('scroll', req); render(played ? 1 : 0); }
    }
    desk.addEventListener('change', setMode);
    addEventListener('resize', () => { measure(); if (desk.matches) req(); });
    setMode();
  })();

  /* ---------------- hub: your tools in, pipeline out ----------------
     Inputs slide in, their wires wipe toward the engine, the engine locks,
     then outputs follow. Packets travel with a short comet tail; each
     wire carries a soft gradient that brightens toward the engine. */
  (function hub() {
    const host = $('[data-hub]');
    if (!host) return;
    const ins = [['HubSpot', 'crm', 'mute'], ['Salesforce', 'crm', 'mute'], ['LinkedIn', 'intent', 'sig'], ['Clay', 'enrichment', 'sig']];
    const outs = [['Call queue', 'sdr floor', 'live'], ['Sequences', 'email · linkedin', 'mute'], ['Your calendar', 'meetings', 'ok'], ['Slack', '#wins', 'ok']];
    const TAIL = 5;
    let packets = [], raf = 0, visible = false;
    const stop = (o, a) => `<stop offset="${o}" stop-color="var(--aqua)" stop-opacity="${a}"/>`;
    const lin = (id, x1, y1, x2, y2, a, b) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stop(0, a)}${stop(1, b)}</linearGradient>`;
    const edge = `<linearGradient id="hubEdge" x1="0" y1="0" x2="1" y2="1">${stop(0, 0.9)}${stop(0.5, 0.15)}${stop(1, 0.9)}</linearGradient>`;

    function build() {
      const v = matchMedia('(max-width: 767px)').matches;
      const node = (x, y, w, h, t, s, cls, d) => {
        const core = cls === 'core';
        return `<g class="${cls}" style="--d:${d}ms">` +
          (core ? `<rect class="core-halo" x="${x + 16}" y="${y + 16}" width="${w - 32}" height="${h - 32}" rx="12"/>` : '') +
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${core ? 12 : 8}"/>` +
          (core ? `<rect class="core-glow" x="${x}" y="${y}" width="${w}" height="${h}" rx="12" stroke="url(#hubEdge)"/>` : '') +
          (s ? `<text x="${x + w / 2}" y="${y + h / 2 - 3}" text-anchor="middle" font-family="Geist" font-weight="${core ? 600 : 500}">${t}</text><text class="sub" x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle" font-family="Geist Mono" font-weight="500">${s}</text>`
             : `<text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-family="Geist" font-weight="500">${t}</text>`) + `</g>`;
      };
      let W, H, wires = [], nodes = '', grads;
      if (!v) {
        W = 1120; H = 330;
        const nw = 180, nh = 54, hx = 430, hw = 260, hh = 124, hy = (H - hh) / 2, cy = H / 2;
        ins.forEach(([t, s], i) => { const y = 14 + i * 80; nodes += node(0, y, nw, nh, t, s, 'node in-node', i * 60); wires.push({ side: 'in', d: `M${nw},${y + nh / 2} C${(nw + hx) / 2},${y + nh / 2} ${(nw + hx) / 2},${cy + (i - 1.5) * 20} ${hx},${cy + (i - 1.5) * 20}`, c: ins[i][2] }); });
        outs.forEach(([t, s], i) => { const y = 14 + i * 80, x = W - nw; nodes += node(x, y, nw, nh, t, s, 'node out-node', 1120 + i * 60); wires.push({ side: 'out', d: `M${hx + hw},${cy + (i - 1.5) * 20} C${(hx + hw + x) / 2},${cy + (i - 1.5) * 20} ${(hx + hw + x) / 2},${y + nh / 2} ${x},${y + nh / 2}`, c: outs[i][2] }); });
        nodes += node(hx, hy, hw, hh, 'NextGen engine', 'signals → sdrs → crm', 'core', 760);
        grads = lin('hubIn', nw, 0, hx, 0, 0, 0.9) + lin('hubOut', hx + hw, 0, W - nw, 0, 0.9, 0) + edge;
      } else {
        W = 358; H = 560;
        const nw = 82, nh = 46, hx = 49, hw = 260, hh = 96, hy = (H - hh) / 2, cx = W / 2;
        const short = { 'Your calendar': 'Calendar', 'Call queue': 'Calls', 'Sequences': 'Email' };
        ins.forEach(([t], i) => { const x = i * 92; nodes += node(x, 0, nw, nh, t, '', 'node in-node', i * 60); wires.push({ side: 'in', d: `M${x + nw / 2},${nh} C${x + nw / 2},${(nh + hy) / 2} ${cx + (i - 1.5) * 24},${(nh + hy) / 2} ${cx + (i - 1.5) * 24},${hy}`, c: ins[i][2] }); });
        outs.forEach(([t], i) => { const x = i * 92, y = H - nh; nodes += node(x, y, nw, nh, short[t] || t, '', 'node out-node', 1120 + i * 60); wires.push({ side: 'out', d: `M${cx + (i - 1.5) * 24},${hy + hh} C${cx + (i - 1.5) * 24},${(hy + hh + y) / 2} ${x + nw / 2},${(hy + hh + y) / 2} ${x + nw / 2},${y}`, c: outs[i][2] }); });
        nodes += node(hx, hy, hw, hh, 'NextGen engine', 'signals → sdrs → crm', 'core', 760);
        grads = lin('hubIn', 0, nh, 0, hy, 0, 0.9) + lin('hubOut', 0, hy + hh, 0, H - nh, 0.9, 0) + edge;
      }
      const group = side => wires.map((w, i) => w.side !== side ? '' :
        `<path class="wire" id="hw${i}" d="${w.d}"/><path class="flow" d="${w.d}" stroke="url(#${side === 'in' ? 'hubIn' : 'hubOut'})"/>`).join('');
      const dots = wires.map((w, i) => Array.from({ length: TAIL }, (_, k) =>
        `<circle class="${k ? 'trail' : 'pkt'} ${w.c}" r="${(3.5 - k * 0.5).toFixed(1)}" data-w="${i}" opacity="0"/>`).join('')).join('');
      host.innerHTML = `<svg class="hub-svg${v ? ' is-v' : ''}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${grads}</defs>` +
        `<g class="wires-in" style="--d:240ms">${group('in')}</g><g class="wires-out" style="--d:1000ms">${group('out')}</g>` +
        nodes + dots + `</svg>`;
      const svg = $('svg', host);
      packets = wires.map((w, i) => {
        const path = $('#hw' + i, svg);
        return { path, len: path.getTotalLength(), dots: $$(`circle[data-w="${i}"]`, svg), off: (i % 4) * 0.25 + (i >= 4 ? 0.12 : 0), speed: 2600 + (i % 3) * 400 };
      });
      if (reduced) packets.forEach(p => { const pt = p.path.getPointAtLength(p.len * 0.6), c = p.dots[0]; c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('opacity', 1); });
    }
    function loop(now) {
      packets.forEach(p => p.dots.forEach((c, k) => {
        const kk = (((now - k * 34) / p.speed + p.off) % 1 + 1) % 1;
        const pt = p.path.getPointAtLength(easeInOut(kk) * p.len);
        const fade = kk < 0.08 ? kk / 0.08 : kk > 0.92 ? (1 - kk) / 0.08 : 1;
        c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1));
        c.setAttribute('opacity', (fade * (1 - k / TAIL) * (k ? 0.7 : 1)).toFixed(2));
      }));
      if (visible) raf = requestAnimationFrame(loop);
    }
    build();
    matchMedia('(max-width: 767px)').addEventListener('change', build);
    if (reduced) { host.classList.add('in'); return; }
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { host.classList.add('in'); o.disconnect(); } }, { threshold: 0.3 }).observe(host);
    const run = on => { visible = on; cancelAnimationFrame(raf); if (visible) raf = requestAnimationFrame(loop); };
    let onScreen = false;
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(onScreen && !document.hidden); }).observe(host);
    document.addEventListener('visibilitychange', () => run(onScreen && !document.hidden));
  })();

  /* ---------------- light fields: hero beams + closing horizon ----------------
     Canvas light in signal aqua, read from --fx-ray / --fx-ray-hi so they
     follow the theme. Ambient loop on a 7s-ish cycle, ~30fps, only while on
     screen and the tab is visible. Reduced motion draws one still frame. */
  (function fields() {
    const cvs = $$('canvas[data-fx]');
    if (!cvs.length) return;
    const DPR = Math.min(devicePixelRatio || 1, 1.5);
    const TAU = Math.PI * 2;
    const hexA = (hex, a) => {
      const h = hex.trim().replace('#', ''), f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
      const n = parseInt(f, 16);
      return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
    };

    const fields = cvs.map(canvas => {
      const ctx = canvas.getContext('2d');
      const kind = canvas.dataset.fx;
      const f = { canvas, ctx, kind, w: 0, h: 0, col: {}, mask: null, on: false };

      f.colours = () => {
        const cs = getComputedStyle(canvas);
        f.col = { ray: cs.getPropertyValue('--fx-ray') || '#19e3c1', hi: cs.getPropertyValue('--fx-ray-hi') || '#7df0dc', k: parseFloat(cs.getPropertyValue('--fx-strength')) || 1,
                  light: document.documentElement.getAttribute('data-mode') === 'light' };
      };
      f.size = () => {
        const r = canvas.getBoundingClientRect();
        f.w = Math.max(1, Math.round(r.width)); f.h = Math.max(1, Math.round(r.height));
        canvas.width = Math.round(f.w * DPR); canvas.height = Math.round(f.h * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        if (kind === 'beams') {
          // mask = the headline area, cut out after drawing so the copy stays calm
          const m = document.createElement('canvas'); m.width = canvas.width; m.height = canvas.height;
          const mc = m.getContext('2d'); mc.setTransform(DPR, 0, 0, DPR, 0, 0);
          const cx = f.w / 2, rx = Math.min(f.w * 0.3, 520), ry = f.h * 0.42;
          mc.save(); mc.translate(cx, f.h * 0.33); mc.scale(rx / ry, 1);
          const g = mc.createRadialGradient(0, 0, 0, 0, 0, ry);
          g.addColorStop(0, 'rgba(0,0,0,.92)'); g.addColorStop(0.45, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          mc.fillStyle = g; mc.fillRect(-ry, -ry, ry * 2, ry * 2); mc.restore();
          f.mask = m;
        }
      };
      f.draw = t => {
        const { w, h, col } = f;
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = col.light ? 'source-over' : 'lighter';
        if (kind === 'beams') drawBeams(f, t); else drawHorizon(f, t);
        ctx.globalCompositeOperation = 'source-over';
      };
      return f;
    });

    /* Converging beams: light streaks in from both sides toward a vanishing
       point behind the call to action, over layered diamonds that drift
       outward like a tunnel. Beams draw in once on load (~1.6s), then
       pulses keep travelling inward. */
    const rand = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
    function drawBeams(f, t) {
      const { ctx, w, h, col } = f;
      const small = w < 768;
      const vx = w / 2, vy = h * (small ? 0.6 : 0.57);
      const k = col.k;

      // side blooms where the beams are brightest
      [-1, 1].forEach(s => {
        const bx = s < 0 ? w * 0.04 : w * 0.96, by = vy - h * 0.06;
        ctx.save(); ctx.translate(bx, by); ctx.scale(1, 0.55);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.32);
        g.addColorStop(0, hexA(col.ray, 0.34 * k)); g.addColorStop(1, hexA(col.ray, 0));
        ctx.fillStyle = g; ctx.fillRect(-w * 0.32, -w * 0.32, w * 0.64, w * 0.64); ctx.restore();
      });

      // layered diamonds around the vanishing point, drifting outward
      const D = 6;
      for (let i = 0; i < D; i++) {
        const p = reduced ? (i + 0.5) / D : ((i + t * 0.07) % D) / D;  // 0 → 1 as it grows
        const r = (0.08 + p * 0.95) * Math.max(w * 0.5, h * 0.9);
        const a = Math.sin(p * Math.PI) * 0.16 * k;
        ctx.save(); ctx.translate(vx, vy); ctx.scale(1.25, 0.72); ctx.rotate(Math.PI / 4);
        const g = ctx.createLinearGradient(-r, 0, r, 0);
        g.addColorStop(0, hexA(col.ray, a * 0.55)); g.addColorStop(0.5, hexA(col.ray, 0)); g.addColorStop(1, hexA(col.ray, a * 0.55));
        ctx.fillStyle = g; ctx.fillRect(-r / Math.SQRT2, -r / Math.SQRT2, r * Math.SQRT2, r * Math.SQRT2);
        ctx.strokeStyle = hexA(col.hi, a * 0.6); ctx.lineWidth = 1;
        ctx.strokeRect(-r / Math.SQRT2, -r / Math.SQRT2, r * Math.SQRT2, r * Math.SQRT2);
        ctx.restore();
      }

      // the beams
      const N = small ? 14 : 26;
      ctx.lineCap = 'round';
      for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i < N; i++) {
          const j = i + (s > 0 ? 100 : 0);
          const ex = s < 0 ? -20 : w + 20;
          const ey = vy + (i / (N - 1) - 0.5) * h * 1.25 + (rand(j, 1) - 0.5) * h * 0.08;
          const stop = 0.5 + rand(j, 2) * 0.32;                 // beams fade before the centre
          const ix = ex + (vx - ex) * stop, iy = ey + (vy - ey) * stop;
          const weight = Math.exp(-Math.pow((ey - vy) / (h * 0.42), 2));
          const hero = rand(j, 3) > 0.78;                        // a few bright, thick beams
          const intro = reduced ? 1 : easeOut(clamp((t - 0.15 - rand(j, 4) * 0.6) / 1.1));
          if (intro <= 0) continue;
          const tx = ex + (ix - ex) * intro, ty = ey + (iy - ey) * intro;
          const base = (0.12 + 0.6 * weight) * (hero ? 1.5 : 1) * k;
          const g = ctx.createLinearGradient(ex, ey, ix, iy);
          g.addColorStop(0, hexA(col.ray, 0)); g.addColorStop(0.18, hexA(col.hi, clamp(base))); g.addColorStop(1, hexA(col.ray, 0));
          ctx.strokeStyle = g;
          if (hero) { ctx.globalAlpha = 0.25; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke(); }
          ctx.globalAlpha = 1; ctx.lineWidth = hero ? 2.2 : 1;
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
          // a pulse of light travelling inward along the beam
          if (intro >= 1 && weight > 0.15) {
            const sp = 0.16 + rand(j, 5) * 0.14;
            const q = reduced ? 0.45 : (t * sp + rand(j, 6)) % 1;
            const q0 = Math.max(0, q - 0.14);
            const ax = ex + (ix - ex) * q0, ay = ey + (iy - ey) * q0, bx = ex + (ix - ex) * q, by = ey + (iy - ey) * q;
            const pg = ctx.createLinearGradient(ax, ay, bx, by);
            const pa = clamp(Math.sin(q * Math.PI) * weight * 0.9 * k);
            pg.addColorStop(0, hexA(col.hi, 0)); pg.addColorStop(1, hexA(col.hi, pa));
            ctx.strokeStyle = pg; ctx.lineWidth = hero ? 3 : 1.6;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      // keep the headline area calm
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(f.mask, 0, 0, w, h);
    }

    function drawHorizon(f, t) {
      const { ctx, w, h, col } = f;
      const step = w < 768 ? 7 : 6, bw = step * 0.55, base = h * 0.78, cx = w / 2;
      for (let x = step / 2; x < w; x += step) {
        const u = (x - cx) / (w / 2);                            // -1 … 1
        const bell = Math.exp(-u * u * 2.2);
        const wave = 0.62 + 0.38 * Math.sin(x * 0.034 - t * 0.9 + Math.sin(x * 0.007 + t * 0.35) * 2);
        const bh = h * 0.6 * (0.16 + 0.82 * bell) * wave;
        const g = ctx.createLinearGradient(0, base - bh, 0, base);
        g.addColorStop(0, hexA(col.ray, 0)); g.addColorStop(0.7, hexA(col.ray, 0.35 * col.k)); g.addColorStop(1, hexA(col.hi, 0.95 * col.k));
        ctx.globalAlpha = 0.35 + 0.65 * bell;
        ctx.fillStyle = g; ctx.fillRect(x - bw / 2, base - bh, bw, bh);
        // short reflection under the horizon line
        const rg = ctx.createLinearGradient(0, base, 0, base + bh * 0.22);
        rg.addColorStop(0, hexA(col.hi, 0.5 * col.k)); rg.addColorStop(1, hexA(col.ray, 0));
        ctx.fillStyle = rg; ctx.fillRect(x - bw / 2, base, bw, bh * 0.22);
      }
      ctx.globalAlpha = 1;
      // the horizon itself: a bright line and an elliptical bloom
      ctx.save(); ctx.translate(cx, base); ctx.scale(1, 0.16);
      const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.5);
      bloom.addColorStop(0, hexA(col.hi, 0.55 * col.k)); bloom.addColorStop(1, hexA(col.ray, 0));
      ctx.fillStyle = bloom; ctx.fillRect(-w / 2, -w / 2, w, w); ctx.restore();
      const line = ctx.createLinearGradient(0, 0, w, 0);
      line.addColorStop(0, hexA(col.hi, 0)); line.addColorStop(0.5, hexA(col.hi, 0.9 * col.k)); line.addColorStop(1, hexA(col.hi, 0));
      ctx.fillStyle = line; ctx.fillRect(0, base - 0.5, w, 1);
    }

    fields.forEach(f => { f.colours(); f.size(); f.draw(reduced ? 2 : 0); });
    requestAnimationFrame(() => fields.forEach(f => f.canvas.classList.add('is-on')));

    let ro;
    const redrawAll = () => fields.forEach(f => { f.colours(); f.size(); f.draw(f.t ?? (reduced ? 2 : 0)); });
    if ('ResizeObserver' in window) { ro = new ResizeObserver(redrawAll); fields.forEach(f => ro.observe(f.canvas)); }
    new MutationObserver(() => fields.forEach(f => { f.colours(); f.draw(f.t ?? (reduced ? 2 : 0)); })).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode', 'data-theme'] });
    (document.fonts?.ready || Promise.resolve()).then(redrawAll);
    if (reduced) return;

    let raf = 0, last = 0;
    const t0 = performance.now();
    function tick(now) {
      raf = 0;
      if (now - last >= 33) { // ~30fps is plenty for a slow ambient field
        last = now;
        const t = (now - t0) / 1000 * (TAU / 7) * 1.1; // one full drift every ~7s
        fields.forEach(f => { if (f.on) { f.t = t; f.draw(t); } });
      }
      schedule();
    }
    function schedule() { if (!raf && !document.hidden && fields.some(f => f.on)) raf = requestAnimationFrame(tick); }
    const io = new IntersectionObserver(es => { es.forEach(e => { const f = fields.find(x => x.canvas === e.target); if (f) f.on = e.isIntersecting; }); schedule(); });
    fields.forEach(f => io.observe(f.canvas));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else schedule(); });
  })();

  /* ---------------- staggered groups: children reveal 60ms apart (max 8) ---------------- */
  $$('[data-stagger]').forEach(g => [...g.children].forEach((c, i) => {
    c.classList.add('rv'); c.style.setProperty('--d', Math.min(i, 7) * 60 + 'ms'); rvIO.observe(c);
  }));

  /* ---------------- layer tabs ---------------- */
  (function layers() {
    const tabs = $$('.layer-tab'), ind = $('.layer-ind');
    if (!tabs.length) return;
    const moveInd = t => { ind.style.transform = `translateY(${t.offsetTop}px)`; ind.style.height = t.offsetHeight + 'px'; };
    function select(t, focus) {
      tabs.forEach(o => { const on = o === t; o.setAttribute('aria-selected', String(on)); o.tabIndex = on ? 0 : -1; $('#' + o.getAttribute('aria-controls')).classList.toggle('is-active', on); });
      moveInd(t);
      if (focus) t.focus();
      if (matchMedia('(max-width: 1023px)').matches) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', e => {
        if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
        e.preventDefault();
        const d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
        select(tabs[(i + d + tabs.length) % tabs.length], true);
      });
    });
    (document.fonts?.ready || Promise.resolve()).then(() => moveInd(tabs[0]));
    addEventListener('resize', () => moveInd(tabs.find(t => t.getAttribute('aria-selected') === 'true')));
  })();

  /* ---------------- SDR cost calculator ---------------- */
  (function calc() {
    const presets = {
      dub: { cur: '€', base: 50000, onCost: 0.112, label: 'Dublin' },
      lon: { cur: '£', base: 40000, onCost: 0.138, label: 'London' },
      uk:  { cur: '£', base: 31000, onCost: 0.138, label: 'the rest of the UK' },
    };
    let market = 'dub', shown = 0, raf;
    const range = $('#sdr-n'), nOut = $('[data-sdr-n]'), val = $('[data-calc-val]'), sub = $('[data-calc-sub]');
    const segBtns = $$('.seg button'), segInd = $('.seg-ind');
    if (!range) return;
    function cost() {
      const p = presets[market], n = +range.value;
      const perSdr = p.base * 1.2 * (1 + p.onCost) + 6000;
      const recruit = p.base * 0.15 * n;
      const lead = (n / 6) * p.base * 1.7 * (1 + p.onCost);
      return { total: perSdr * n + recruit + lead, per: perSdr, p };
    }
    function render() {
      const { total, per, p } = cost();
      nOut.textContent = range.value;
      range.style.setProperty('--p', ((range.value - 1) / 9) * 100 + '%');
      sub.textContent = `About ${p.cur}${Math.round(per / 1000)}k per SDR in ${p.label}, plus a share of a team lead and 6–9 months to ramp.`;
      const from = shown, to = total, t0 = performance.now(), dur = (reduced || !shown) ? 0 : 320;
      cancelAnimationFrame(raf);
      const step = now => {
        const k = dur ? clamp((now - t0) / dur) : 1;
        shown = from + (to - from) * easeOut(k);
        val.textContent = p.cur + Math.round(shown).toLocaleString('en-GB');
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    segBtns.forEach((b, i) => b.addEventListener('click', () => {
      market = b.dataset.market;
      segBtns.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      segInd.style.transform = `translateX(${i * 100}%)`;
      render();
    }));
    range.addEventListener('input', render);
    render();
  })();

  /* ---------------- tool cards ---------------- */
  (function tools() {
    const grid = $('[data-tool-grid]');
    if (!grid) return;
    const list = [
      ['Clay', 'data', 'Contact enrichment', 'Pulls data from 100+ providers into one table and runs enrichment waterfalls.', 'Credits', 1],
      ['Cognism', 'data', 'Contact data', 'Phone-verified mobile numbers across Europe. Strong for the UK and Ireland.', 'Annual', 1],
      ['Instantly', 'send', 'Cold email', 'Sends at volume with inbox rotation and warm-up built in.', 'Per seat', 1],
      ['HubSpot', 'crm', 'CRM', 'Where every call, note and booked meeting lands for most clients.', 'Tiered', 1],
      ['Aircall', 'call', 'Cloud phone', 'The phone system our SDR floor dials from, with recordings.', 'Per seat', 1],
      ['Claude Code', 'ai', 'Agent building', 'Where we build the research, reply and meeting-prep agents.', 'Usage', 1],
      ['Smartlead', 'send', 'Cold email', 'Multi-inbox sending with a clean API for custom flows.', 'Per seat', 0],
      ['Orum', 'call', 'Parallel dialler', 'More live conversations an hour by dialling in parallel.', 'Per seat', 0],
      ['Salesforce', 'crm', 'CRM', 'Enterprise CRM; we work inside your instance and fields.', 'Per seat', 0],
    ];
    grid.innerHTML = list.map(([n, c, cat, d, price, pick]) => `
      <article class="tool-card" data-c="${c}">
        <div class="top"><span class="logo-tile">${n[0]}</span><div><b>${n}</b><span class="cat">${cat}</span></div></div>
        <p>${d}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="chip">${price}</span>${pick ? '<span class="pick">NextGen pick</span>' : ''}</div>
      </article>`).join('');
    const btns = $$('.cat-chips button');
    btns.forEach(b => b.addEventListener('click', () => {
      btns.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      $$('.tool-card', grid).forEach(t => t.classList.toggle('dim', b.dataset.cat !== 'all' && t.dataset.c !== b.dataset.cat));
    }));
  })();

  /* ---------------- headings that reveal word by word ---------------- */
  (function split() {
    const heads = $$('.split');
    heads.forEach(h => {
      let i = 0;
      const walk = node => {
        [...node.childNodes].forEach(n => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(part => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
              const w = document.createElement('span'); w.className = 'w';
              const inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
              w.appendChild(inner); frag.appendChild(w);
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1) walk(n);
        });
      };
      h.setAttribute('aria-label', h.textContent.trim());
      walk(h);
    });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
    heads.forEach(h => io.observe(h));
  })();

  /* ---------------- reading progress under the header ---------------- */
  (function progress() {
    const bar = $('.read-progress');
    if (!bar) return;
    let raf = 0;
    const set = () => { raf = 0; const max = document.documentElement.scrollHeight - innerHeight; bar.style.setProperty('--rp', max > 0 ? (scrollY / max).toFixed(4) : 0); };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(set); }, { passive: true });
    set();
  })();

  /* ---------------- client results: logo tabs rotate the case studies ---------------- */
  (function cases() {
    const root = $('[data-cases]');
    if (!root) return;
    const tabs = $$('.case-tab', root), panels = $$('.case-panel', root), pauseBtn = $('[data-pause]', root);
    const DUR = 8000;
    let idx = 0, t0 = 0, elapsed = 0, raf = 0, paused = reduced, hover = false, visible = false;
    $$('.bars i', root).forEach((b, i) => b.style.setProperty('--n', i));
    function show(i, focus) {
      idx = (i + tabs.length) % tabs.length; elapsed = 0; t0 = performance.now();
      tabs.forEach((t, k) => { const on = k === idx; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; t.style.setProperty('--p', 0); });
      panels.forEach((p, k) => p.classList.toggle('is-active', k === idx));
      if (focus) tabs[idx].focus();
    }
    function tick(now) {
      const running = !paused && !hover && visible;
      if (running) elapsed += now - t0;
      t0 = now;
      tabs[idx].style.setProperty('--p', clamp(elapsed / DUR).toFixed(4));
      if (elapsed >= DUR) show(idx + 1);
      raf = requestAnimationFrame(tick);
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => show(i));
      t.addEventListener('keydown', e => { if (e.key === 'ArrowRight') show(idx + 1, true); if (e.key === 'ArrowLeft') show(idx - 1, true); });
    });
    root.addEventListener('pointerenter', () => (hover = true));
    root.addEventListener('pointerleave', () => (hover = false));
    root.addEventListener('focusin', () => (hover = true));
    root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) hover = false; });
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.setAttribute('aria-label', paused ? 'Play the case study rotation' : 'Pause the case study rotation');
      $('use', pauseBtn).setAttribute('href', paused ? '#i-play' : '#i-pause');
    });
    if (reduced) { pauseBtn.hidden = true; }
    new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.3 }).observe(root);
    show(0);
    raf = requestAnimationFrame(tick);
  })();

  /* ---------------- call recording (prototype player) ---------------- */
  (function recording() {
    $$('[data-rec]').forEach(rec => {
      const wave = $('[data-wave]', rec), btn = $('.rec-play', rec), tOut = $('[data-rec-t]', rec);
      const N = 64, TOTAL = 401;
      let s = 3; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      wave.innerHTML = Array.from({ length: N }, (_, i) => `<i style="--h:${(18 + 80 * Math.abs(Math.sin(i * 0.45) * (0.4 + r() * 0.6))).toFixed(0)}%"></i>`).join('');
      const bars = [...wave.children];
      let playing = false, raf = 0, pos = 0, last = 0;
      const fmt = x => `${String((x / 60) | 0).padStart(2, '0')}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
      function paint() { const k = pos / TOTAL; bars.forEach((b, i) => b.classList.toggle('on', i / N < k)); tOut.textContent = fmt(pos); }
      function loop(now) { if (!playing) return; pos = Math.min(TOTAL, pos + (now - last) / 1000 * 12); last = now; paint(); if (pos >= TOTAL) { playing = false; setIcon(); return; } raf = requestAnimationFrame(loop); }
      const setIcon = () => { $('use', btn).setAttribute('href', playing ? '#i-pause' : '#i-play'); btn.setAttribute('aria-label', playing ? 'Pause the call recording' : 'Play the call recording'); };
      btn.addEventListener('click', () => { playing = !playing; if (pos >= TOTAL) pos = 0; last = performance.now(); setIcon(); if (playing) raf = requestAnimationFrame(loop); else toast('Prototype: the real recording plays here, with consent'); });
      paint();
    });
  })();

  /* ---------------- client quotes marquee ---------------- */
  (function marquee() {
    $$('[data-marquee] .marquee-row').forEach((row, i) => {
      [...row.children].forEach(c => { const d = c.cloneNode(true); d.setAttribute('aria-hidden', 'true'); row.appendChild(d); });
      row.style.setProperty('--mq', (64 + i * 10) + 's');
    });
    const mq = $('[data-marquee]');
    if (mq && !reduced) new IntersectionObserver(([e]) => mq.classList.toggle('is-running', e.isIntersecting)).observe(mq);
  })();

  /* ---------------- FAQ: one open at a time ---------------- */
  $$('[data-faq] .faq-q').forEach((q, _, all) => q.addEventListener('click', () => {
    const on = q.getAttribute('aria-expanded') !== 'true';
    all.forEach(o => o.setAttribute('aria-expanded', 'false'));
    q.setAttribute('aria-expanded', String(on));
  }));
})();
