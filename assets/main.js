/* NextGen Sales — interactions
   Motion follows the brand book: quiet (fade + rise 8px), amber arrives
   (slide 16px), blue pulses (live call), aqua locks (booking only).
   Review helpers: ?open=services|work|resources|about pins a mega-menu open.
                   ?story=end shows the hero story's final frame, ?story=<0..3.6> any frame.
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

  /* ---------------- GSAP: scroll scenes and loops share one clock ----------------
     ScrollTrigger only reads the scroll (no pinning, no scroll-jacking); scrub
     gives each scene a short catch-up so wheel clicks don't show as jumps.
     Without GSAP, or with reduced motion, the scenes show their final frame. */
  const G = window.gsap, ST = window.ScrollTrigger, FLIP = window.Flip;
  const still = reduced || !G || !ST;
  if (G && ST) {
    G.registerPlugin(ST); if (FLIP) G.registerPlugin(FLIP);
    ST.config({ ignoreMobileResize: true }); // a collapsing address bar is not a resize
    document.documentElement.classList.add('has-gsap');
  }
  const DESK = '(min-width: 1024px)', SMALL = '(max-width: 1023px)';
  // run fn(progress) as the scroll moves between start and end
  function scrub(trigger, start, end, lag, fn) {
    const s = { p: 0 };
    return G.to(s, { p: 1, ease: 'none', onUpdate: () => fn(s.p), scrollTrigger: { trigger, start, end, scrub: lag, invalidateOnRefresh: true, onRefresh: self => { if (!self.isActive) fn(self.progress); } } });
  }
  // a loop on GSAP's ticker that only runs while asked to
  function ticker(fn) {
    let on = false;
    const step = time => fn(time * 1000);
    return want => { if (want === on) return; on = want; if (G) G.ticker[want ? 'add' : 'remove'](step); };
  }
  if (!still) addEventListener('load', () => ST.refresh());

  /* ---------------- tool logos: files in assets/logos ---------------- */
  const PNG_LOGOS = ['clay', 'cognism', 'instantly', 'aircall', 'smartlead', 'orum'];
  const logoSrc = n => `assets/logos/${n}.${PNG_LOGOS.includes(n) ? 'png' : 'svg'}`;

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
    function apply(mode) {
      if (mode === 'light' || mode === 'dark') document.documentElement.setAttribute('data-theme', mode);
      else document.documentElement.removeAttribute('data-theme');
      groups.forEach(g => $$('button', g).forEach(b => b.setAttribute('aria-checked', String(b.dataset.set === mode))));
      const light = mode === 'light' || (mode === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
      document.documentElement.setAttribute('data-mode', light ? 'light' : 'dark'); // drives section tones and the .hl highlight
    }
    const saved = store.get('ng-theme');
    apply(saved === 'light' || saved === 'dark' ? saved : 'system');
    groups.forEach(g => $$('button', g).forEach(b => b.addEventListener('click', () => {
      store.set('ng-theme', b.dataset.set);
      const run = () => apply(b.dataset.set);
      if (document.startViewTransition && !reduced) document.startViewTransition(run); else run();
    })));
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

  /* ---------------- squeeze the header into a pill once the page scrolls ---------------- */
  (function squeeze() {
    const wide = matchMedia('(min-width: 1024px)');
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const logo = $('.logo', nav), list = $('.nav-list', nav), actions = $('.nav-actions', nav);
    const movers = () => [logo, list, ...[...actions.children].filter(k => !k.classList.contains('nav-slot'))];
    const hs = () => getComputedStyle(header), v = n => parseFloat(hs().getPropertyValue(n)) || 0;
    // Width the pill needs: logo + links + visible CTAs, two equal gaps, and the pill's own padding.
    function fit() {
      const aGap = parseFloat(getComputedStyle(actions).columnGap) || 0;
      const kids = [...actions.children].filter(k => !k.classList.contains('nav-slot') && getComputedStyle(k).display !== 'none');
      const aW = kids.reduce((w, k) => w + k.offsetWidth, 0) + aGap * Math.max(0, kids.length - 1);
      const w = logo.offsetWidth + list.scrollWidth + aW + v('--sq-gap') * 2 + v('--sq-pl') + v('--sq-pr');
      nav.style.setProperty('--nav-fit', Math.ceil(w) + 'px');
    }
    // Pill edges follow the nav's laid-out box (nav itself never carries a transform).
    function pill() {
      const h = header.getBoundingClientRect(), n = nav.getBoundingClientRect();
      header.style.setProperty('--pill-l', (n.left - h.left) + 'px');
      header.style.setProperty('--pill-r', (h.right - n.right) + 'px');
    }
    let on = null;
    function set(next) {
      if (next === on) return;
      const first = on !== null && !still.matches;
      const els = movers();
      const before = first ? els.map(e => e.getBoundingClientRect().left) : null;   // includes any in-flight transform
      els.forEach(e => { e.style.transition = 'none'; e.style.transform = ''; });
      on = next;
      if (on) fit();
      header.classList.toggle('is-squeezed', on);
      if (on) pill();
      if (current) place(current);
      if (!first) return;
      els.forEach((e, i) => { const dx = before[i] - e.getBoundingClientRect().left; if (Math.abs(dx) > .5) e.style.transform = `translateX(${dx}px)`; });
      void nav.offsetWidth;
      els.forEach(e => { e.style.transition = 'transform var(--dur-lock) var(--ease-out)'; e.style.transform = ''; });
    }
    // Hysteresis so a scroll hovering near the top can't flicker between states.
    const update = () => set(wide.matches && (on ? scrollY > 0 : scrollY > 8));
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', () => { if (on) { fit(); pill(); } });
    wide.addEventListener('change', () => { on = null; header.classList.remove('is-squeezed'); update(); });
    (document.fonts?.ready || Promise.resolve()).then(() => { if (on) { fit(); pill(); } });
    update();
  })();

  /* ---------------- mark the section the current page belongs to ---------------- */
  (function current() {
    const file = location.pathname.split('/').pop() || 'index.html';
    const group = /^(service|claude-code)/.test(file) ? 'services' : /^case/.test(file) ? 'results' : /^pricing/.test(file) ? 'pricing'
      : /^(about|uk-ireland|gdpr|tools|playbook|blog|post|newsletter|careers|contact)/.test(file) ? 'about' : null;
    if (group && order.includes(group)) triggers[order.indexOf(group)].classList.add('is-here');
    $$('.foot-col a, .msheet-body a').forEach(a => { if (a.getAttribute('href') === file) a.setAttribute('aria-current', 'page'); });
  })();

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
     HERO STORY: one signal becomes one meeting. A single clock in "story
     seconds" (the times printed on the timeline) drives everything, so any
     frame can be rendered. The scroll drives that clock: the stage holds in
     view on desktop and scrubs as it passes on smaller screens, forwards and
     back. It rests with a quiet comet on the wires; replay plays it timed.
     ?story=end and ?story=<s> pin.
     ================================================================= */
  (function story() {
    const root = $('[data-story]');
    if (!root) return;
    const stage = $('.stage', root);
    const { signal, call, crm } = Object.fromEntries($$('[data-beat]', root).map(b => [b.dataset.beat, b]));
    const labels = $$('[data-tl]', root), marks = $$('[data-mk]', root);
    const head = $('[data-playhead]', root), knob = $('[data-knob]', root), bar = $('.stage-time', root);
    const badge = $('[data-call-badge]', root), timer = $('[data-call-timer]', root);
    const roles = $$('.roles i', signal), voice = $('[data-voice]', root), replay = $('[data-replay]', root);
    const svg = $('.stage-wires', root), wires = $$('[data-wire]', root);
    const END = 3.6, SPEED = 0.62, TAIL = 7;             // 3.6 story seconds play in about 5.8 real ones
    const seg = (t, a, b) => clamp((t - a) / (b - a));
    const fmt = s => `${String((s / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    const ns = (tag, cls, r) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); e.setAttribute('class', cls); e.setAttribute('r', r); return svg.appendChild(e); };

    wires.forEach((w, i) => w.classList.add('w' + i));
    const ports = wires.map(() => [ns('circle', 'port', 4), ns('circle', 'port', 4)]);
    const comets = wires.map((_, i) => Array.from({ length: TAIL }, (_, k) => ns('circle', `comet c${i}${k ? '' : ' lead'}`, (5 - k * 0.6).toFixed(1))));
    const lens = [0, 0];
    const N = 34;
    voice.innerHTML = '<i></i>'.repeat(N);
    const bars = [...voice.children];
    // a fixed speech-like envelope: the resting shape of the call
    const shape = bars.map((_, i) => 0.18 + 0.82 * Math.abs(Math.sin(i * 0.62) * Math.cos(i * 0.21 + 0.6)));

    // offset* ignores the settle tilt, so wires stay true while the panel moves
    const box = el => ({ l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
    function layout() {
      const a = box(signal), b = box(call), c = box(crm);
      const stacked = c.t > b.t + b.h - 1 && Math.abs(c.l - b.l) < 4;
      let p;
      if (stacked) p = [[[a.l + a.w / 2, a.t + a.h], [b.l + b.w / 2, b.t]], [[b.l + b.w / 2, b.t + b.h], [c.l + c.w / 2, c.t]]];
      else p = [[[a.l + a.w * 0.5, a.t + a.h], [b.l, b.t + b.h * 0.5]], [[b.l + b.w, b.t + b.h * 0.5], [c.l, c.t + c.h * 0.5]]];
      const d = stacked
        ? p.map(([m, n]) => `M${m} L${n}`)
        : [`M${p[0][0]} C${p[0][0][0]},${p[0][1][1]} ${p[0][0][0] + 20},${p[0][1][1]} ${p[0][1]}`, (([m, n]) => { const x = (m[0] + n[0]) / 2; return `M${m} C${x},${m[1]} ${x},${n[1]} ${n}`; })(p[1])];
      wires.forEach((w, i) => {
        w.setAttribute('d', d[i]); lens[i] = w.getTotalLength();
        ports[i].forEach((o, k) => { o.setAttribute('cx', p[i][k][0]); o.setAttribute('cy', p[i][k][1]); });
      });
    }
    function comet(i, q, dim = 1) {
      comets[i].forEach((c, k) => {
        const kk = q - k * 0.045, on = q > 0 && q < 1 && kk > 0;
        c.style.opacity = on ? ((k ? 0.75 * (1 - k / TAIL) : 1) * Math.min(1, (1 - q) / 0.08) * dim).toFixed(2) : 0;
        if (on) { const pt = wires[i].getPointAtLength(easeInOut(kk) * lens[i]); c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1)); }
      });
    }
    const burst = el => { if (!reduced) $('.burst', el).animate([{ opacity: 0.9, transform: 'none' }, { opacity: 0, transform: 'scale(1.08, 1.16)' }], { duration: 900, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }); };
    const set = (el, cls, on, fn) => { if (el.classList.contains(cls) !== on) { el.classList.toggle(cls, on); if (on && fn) fn(); } };
    let width = 0;

    function render(t, now = 0) {
      const p = clamp(t / END);
      head.style.transform = `scaleX(${p.toFixed(4)})`;
      knob.style.transform = `translateX(${(p * width).toFixed(1)}px)`;
      knob.classList.toggle('on', t > 0 && t < END);
      [0, 1.8, 3.6].forEach((at, i) => { const on = t >= at && t > 0; labels[i].classList.toggle('on', on); marks[i].classList.toggle('on', on); });
      labels[2].classList.toggle('lock', t >= END);

      // signal: the card lands, three open roles light up
      set(signal, 'on', t > 0.02, () => burst(signal));
      signal.classList.toggle('hl', t > 0.02 && t < 1.25);
      roles.forEach((r, i) => r.classList.toggle('on', t > 0.28 + i * 0.16));

      // the signal travels to the dialler
      const q0 = seg(t, 0.78, 1.28);
      wires[0].classList.toggle('on', q0 > 0); ports[0][0].classList.toggle('on', q0 > 0); ports[0][1].classList.toggle('on', q0 >= 1);
      if (t < END) comet(0, q0);

      // call: dialling, connected, talking
      const live = t >= 1.8 && t < END;
      set(call, 'on', t > 1.25, () => burst(call));
      call.classList.toggle('hl', t > 1.25 && t < 3.22);
      call.classList.toggle('is-live', t > 1.25 && t < END);
      call.classList.toggle('is-done', t >= END);
      const [kind, text] = t >= END ? ['booked', 'Meeting booked'] : t >= 1.8 ? ['connected', 'Connected'] : ['neutral', 'Dialling'];
      if (badge.textContent !== text) { badge.className = 'badge ' + kind; badge.textContent = text; }
      const clock = fmt(Math.round(401 * seg(t, 1.8, 3.4)));
      if (timer.textContent !== clock) timer.textContent = clock;
      bars.forEach((b, i) => {
        let y = 0.06;
        if (t >= END) y = shape[i];
        else if (live) y = 0.1 + 0.9 * shape[i] * (0.35 + 0.65 * Math.abs(Math.sin(now / 130 + i * 0.9) * Math.sin(now / 310 + i * 0.35)));
        else if (t > 1.25) y = 0.06 + 0.5 * Math.max(0, Math.sin(t * 11)) * Math.exp(-Math.pow((i - N / 2) / 5, 2)); // ring, ring
        b.style.transform = `scaleY(${y.toFixed(3)})`;
      });

      // the booking travels to the CRM and locks
      const q1 = seg(t, 2.72, 3.2);
      wires[1].classList.toggle('on', q1 > 0); ports[1][0].classList.toggle('on', q1 > 0); ports[1][1].classList.toggle('on', q1 >= 1);
      if (t < END) comet(1, q1);
      set(crm, 'on', t > 3.18);
      crm.classList.toggle('hl', t > 3.18);
      crm.classList.toggle('is-filled', t > 3.24);
      set(crm, 'is-locked', t >= END, () => burst(crm));
    }

    const track = $('[data-story-scroll]');
    const clock = { scroll: 0, timed: 0 };   // story seconds from the scroll, and from replay
    let t = 0, last = 0, rest = 0, replaying = null;

    function frame(now) {
      const dt = Math.min(50, now - last); last = now;
      const was = t;
      t = replaying ? clock.timed : clock.scroll;
      // redraw while it moves, and while the call is talking
      if (t !== was || (t > 1.25 && t < END)) render(t, now);
      replay.classList.toggle('on', t >= END);
      if (t >= END) {
        // at rest: every 7 seconds one comet crosses both wires
        rest += dt;
        const c = (rest % 7000) / 1000;
        comet(0, seg(c, 4.6, 5.5), 0.8); comet(1, seg(c, 5.6, 6.5), 0.8);
      } else rest = 0;
    }
    const loop = ticker(frame);
    let seen = false;
    const run = () => { last = performance.now(); loop(seen && !document.hidden); };
    const stopReplay = () => { if (replaying) { replaying.kill(); replaying = null; } };
    function play() {
      stopReplay(); clock.timed = 0;
      replaying = G.to(clock, { timed: END, duration: END / SPEED, ease: 'none', onComplete: () => { if (clock.scroll >= END) replaying = null; } });
    }
    const refresh = () => { root.style.setProperty('--stage-h', root.offsetHeight + 'px'); layout(); width = bar.clientWidth; render(t); };
    const pin = params.get('story');
    replay.addEventListener('click', () => { if (G) play(); });
    addEventListener('resize', refresh);
    if (still || pin) {
      track.classList.add('is-still');
      t = pin && pin !== 'end' ? clamp(parseFloat(pin) || 0, 0, END) : END;
      stage.classList.add('is-live'); replay.classList.toggle('on', t >= END && !still);
      (document.fonts?.ready || Promise.resolve()).then(refresh);
      return;
    }
    const set01 = p => { clock.scroll = END * p; };
    refresh();
    const mm = G.matchMedia();
    // desktop: starts as the stage settles, and holds the last frame for a moment before letting go
    mm.add(DESK, () => {
      const pin = () => parseFloat(getComputedStyle(root).top) || 0;
      scrub(track, () => `top ${pin() + innerHeight * 0.22}px`, () => `bottom ${pin() + root.offsetHeight + innerHeight * 0.16}px`, 0.6, set01);
    });
    // smaller screens: as the stage passes through
    mm.add(SMALL, () => { scrub(stage, 'top 74%', () => `bottom ${innerHeight * 0.74 + stage.offsetHeight * 0.14}px`, 0.35, set01); });
    addEventListener('scroll', stopReplay, { passive: true });
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) stage.classList.add('is-live'); run(); }).observe(stage);
    document.addEventListener('visibilitychange', run);
    (document.fonts?.ready || Promise.resolve()).then(() => { refresh(); ST.refresh(); });
  })();

  /* ---------------- booking forms: check the email, then open the calendar ---------------- */
  const BOOKING_URL = 'https://calendly.com/luke-nextgenoutreach/30min';
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
      // the calendar opens in a new tab; nothing is booked until a time is picked there
      const rest = lbl.textContent;
      window.open(BOOKING_URL, '_blank', 'noopener');
      btn.classList.add('is-booked'); lbl.textContent = 'Calendar opened';
      toast('Pick a time in the calendar that just opened');
      setTimeout(() => { btn.classList.remove('is-booked'); lbl.textContent = rest; }, 3200);
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
    if (!wrap || still) return;
    const rows = $$('.pa-row', wrap);
    const nOut = $('[data-dial-n]', wrap), dot = $('[data-dial-dot]', wrap);
    const smooth = x => x * x * (3 - 2 * x);
    function apply(p) {
      const raw = p * (rows.length - 1), base = Math.floor(raw), frac = raw - base;
      const eased = Math.min(rows.length - 1, base + smooth(clamp((frac - 0.3) / 0.4)));
      const active = Math.round(eased);
      rows.forEach((row, i) => {
        const o = i - eased, a = Math.abs(o);
        row.style.transform = `translateY(calc(-50% + ${(o * 170).toFixed(2)}px)) rotateX(${(o * -32).toFixed(2)}deg) scale(${(1 - Math.min(a, 1.5) * 0.06).toFixed(4)})`;
        row.style.opacity = Math.max(0, 1 - a * 0.7).toFixed(3);
        row.classList.toggle('is-on', i === active);
      });
      const n = String(active + 1).padStart(2, '0');
      if (nOut.textContent !== n) nOut.textContent = n;
      dot.style.transform = `translateY(${((eased / (rows.length - 1)) * 133).toFixed(1)}px)`;
    }
    window.__ngDial = p => { if (matchMedia(DESK).matches) apply(clamp(p)); }; // design-export hook
    // phones never enter here, so nothing can move the stacked rows
    G.matchMedia().add(DESK, () => {
      wrap.classList.add('dial-on');
      rows.forEach(r => r.classList.add('in'));
      apply(0);
      scrub(wrap, 'top 16%', 'bottom 88%', 0.5, apply);
      return () => { wrap.classList.remove('dial-on'); rows.forEach(r => { r.style.transform = ''; r.style.opacity = ''; r.classList.remove('is-on'); }); dot.style.transform = ''; };
    });
  })();

  /* =================================================================
     HOW IT WORKS. A beam scans the market and matches light up white; they
     fly into the signal list; each signal travels a wire to a call; calls
     travel to the booked card, which locks in aqua. White (.hl) marks what
     is happening now. Desktop scrubs with a pinned scroll; smaller screens
     scrub as the scene passes through the viewport.
     ================================================================= */
  (function funnel() {
    const root = $('[data-funnel]');
    if (!root) return;
    const section = root.closest('section');
    const stage = $('.fn-stage', root), zones = $$('.fn-zone', root);
    const cloud = $('[data-cloud]', root), beam = $('[data-beam]', root);
    const sigs = $$('[data-sig]', root), calls = $$('[data-call]', root);
    const booked = $('[data-booked]', root), big = $('[data-big]', root), mtgs = $$('[data-mtg]', root);
    const counts = $$('[data-c]', root), countBoxes = $$('.fn-count', root), steps = $$('[data-step]', root);
    const wiresSvg = $('[data-fn-wires]', root), flyLayer = $('[data-fly-layer]', root);
    const replayBtn = $('[data-fn-replay]', root);
    const outcomes = [['booked', 'Booked'], ['voicemail', 'Voicemail'], ['booked', 'Booked'], ['connected', 'Connected']];
    const seg = (p, a, b) => clamp((p - a) / (b - a));
    // where each phase starts: scan, fly to signals, calls, meetings, done
    const PH = [0, 0.26, 0.44, 0.74, 0.95];

    // seeded layout so the market looks the same every visit
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const N = 54, survivors = [6, 17, 29, 38, 47];
    const tiles = Array.from({ length: N }, (_, i) => {
      const el = document.createElement('i');
      el.className = 'fn-tile';
      cloud.appendChild(el);
      const col = i % 6, row = (i / 6) | 0;
      return { el, fx: (col + 0.15 + rnd() * 0.7) / 6.2, fy: (row + 0.15 + rnd() * 0.6) / 9, x: 0, y: 0, sv: survivors.indexOf(i) };
    });
    const flyers = survivors.map(() => { const el = document.createElement('i'); el.className = 'fn-fly'; flyLayer.appendChild(el); return { el, a: [0, 0], b: [0, 0] }; });
    countBoxes.forEach(b => { const f = document.createElement('i'); f.className = 'fill'; b.appendChild(f); });
    const fills = countBoxes.map(b => $('.fill', b));
    // wires: signal → call, then call → booked card
    const mk = tag => wiresSvg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', tag));
    const wires = [...calls.map((_, i) => ({ from: 'sig', i })), ...calls.map((_, i) => ({ from: 'call', i }))].map(w => ({ ...w, path: mk('path'), dot: mk('circle'), len: 0 }));
    wires.forEach(w => w.dot.setAttribute('r', 4));

    let W = 0, H = 0;
    function measure() {
      W = cloud.clientWidth; H = cloud.clientHeight;
      const sr = stage.getBoundingClientRect(), cr = cloud.getBoundingClientRect();
      const rel = el => { const r = el.getBoundingClientRect(); return { l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top, h: r.height, m: r.top - sr.top + r.height / 2 }; };
      tiles.forEach(t => {
        t.x = t.fx * (W - 38) + 4; t.y = t.fy * (H - 20) + 4;
        t.el.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px)`;
        if (t.sv < 0) return;
        const f = flyers[t.sv], s = rel(sigs[t.sv]);
        f.a = [cr.left - sr.left + t.x, cr.top - sr.top + t.y];
        f.b = [s.l + 12, s.m - 8];
      });
      const bk = rel(booked);
      wires.forEach(w => {
        const a = rel(w.from === 'sig' ? sigs[w.i] : calls[w.i]);
        const x0 = a.r, y0 = a.m;
        const c = w.from === 'sig' ? rel(calls[w.i]) : null;
        const x1 = c ? c.l : bk.l, y1 = c ? c.m : bk.t + bk.h * (0.2 + 0.2 * w.i);
        const mx = (x0 + x1) / 2;
        w.path.setAttribute('d', `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`);
        w.len = w.path.getTotalLength();
      });
    }

    function render(p) {
      let k = 0;
      while (k < 3 && p >= PH[k + 1]) k++;
      const done = p >= PH[4];

      // 0 · the beam crosses the market: misses dim behind it, matches light up
      const s = seg(p, 0.03, 0.24), bx = s * (W + 130);
      beam.style.transform = `translateX(${bx.toFixed(1)}px)`;
      beam.style.opacity = s > 0 && s < 1 ? 1 : 0;
      tiles.forEach(t => {
        const passed = s > 0 && bx > t.x + 30;
        const f = t.sv < 0 ? 0 : seg(p, 0.25 + t.sv * 0.026, 0.35 + t.sv * 0.026);
        t.el.classList.toggle('miss', passed && t.sv < 0);
        t.el.classList.toggle('lit', passed && t.sv >= 0 && f === 0);
        t.el.classList.toggle('sent', f > 0);
      });

      // 1 · matches fly into the signal list
      flyers.forEach((f, i) => {
        const q = seg(p, 0.25 + i * 0.026, 0.35 + i * 0.026), e = easeInOut(q);
        const x = f.a[0] + (f.b[0] - f.a[0]) * e, y = f.a[1] + (f.b[1] - f.a[1]) * e - Math.sin(q * Math.PI) * 14;
        f.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        f.el.style.opacity = q > 0 && q < 1 ? (q > 0.86 ? (1 - q) / 0.14 : 1).toFixed(2) : 0;
        const on = q > 0.88;
        sigs[i].classList.toggle('on', on);
        // white while it is the news, quiet again once the call has picked it up
        sigs[i].classList.toggle('hl', on && p < (i < calls.length ? 0.5 + i * 0.035 : 0.52));
      });

      // 2 and 3 · packets travel the wires
      wires.forEach(w => {
        const [a, b] = w.from === 'sig' ? [0.44 + w.i * 0.035, 0.5 + w.i * 0.035] : [0.73 + w.i * 0.024, 0.78 + w.i * 0.024];
        const q = seg(p, a, b), run = q > 0 && q < 1;
        w.path.classList.toggle('on', q > 0);
        w.path.classList.toggle('run', run);
        w.dot.style.opacity = run ? 1 : 0;
        if (run && w.len) { const pt = w.path.getPointAtLength(easeInOut(q) * w.len); w.dot.setAttribute('cx', pt.x); w.dot.setAttribute('cy', pt.y); }
      });
      calls.forEach((c, i) => {
        const b = $('[data-badge]', c);
        c.classList.toggle('on', p > 0.495 + i * 0.035);
        let kind = 'neutral', text = 'Dialling', live = false;
        if (p > 0.53 + i * 0.035) { kind = 'connected'; text = 'Connected'; live = true; }
        if (p > 0.68 + i * 0.02 && i < 3) { [kind, text] = outcomes[i]; live = false; }
        if (b.textContent !== text) { b.className = 'badge ' + kind; b.textContent = text; }
        c.classList.toggle('is-live', live);
        c.classList.toggle('hl', p > 0.495 + i * 0.035 && p < 0.76 + i * 0.02);
      });

      const bOn = p > 0.77;
      booked.classList.toggle('on', bOn); booked.classList.toggle('hl', bOn);
      booked.classList.toggle('is-locked', p > 0.93);
      let n = 0;
      mtgs.forEach((m, i) => { const on = p > 0.79 + i * 0.03; m.classList.toggle('on', on); if (on) n++; });
      if (big.textContent !== String(n)) big.textContent = String(n);

      const vals = [2400, Math.round(38 * seg(p, 0.25, 0.43)), Math.round(112 * seg(p, 0.46, 0.73)), n];
      counts.forEach((c, i) => { const v = vals[i].toLocaleString('en-GB'); if (c.textContent !== v) c.textContent = v; });
      fills.forEach((f, i) => (f.style.transform = `scaleX(${seg(p, PH[i], PH[i + 1]).toFixed(4)})`));
      countBoxes.forEach((b, i) => { b.classList.toggle('on', i <= k); b.classList.toggle('is-now', i === k && p > 0 && !done); });
      zones.forEach((z, i) => { z.classList.toggle('is-now', i === k); z.classList.toggle('is-done', i < k); });
      steps.forEach((st, i) => st.classList.toggle('on', i === k));
    }

    window.__ngFunnel = p => { measure(); render(clamp(p)); }; // design-export hook: render any frame
    const pinnedP = params.has('how') ? clamp(parseFloat(params.get('how')) || 0) : null;
    measure();
    section.classList.add('fn-live');
    if (still || pinnedP !== null) {
      const draw = () => { measure(); render(pinnedP ?? 1); };
      draw(); addEventListener('resize', draw); (document.fonts?.ready || Promise.resolve()).then(draw);
      return;
    }

    let replaying = null, p = 0;
    const show = v => { p = v; if (!replaying) render(v); };
    const stopReplay = () => { if (replaying) { replaying.kill(); replaying = null; render(p); } };
    replayBtn.addEventListener('click', () => {
      if (replaying) replaying.kill();
      stage.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      const s = { v: 0 };
      // start listening for a scroll only once the jump above has settled
      replaying = G.to(s, { v: 1, duration: 7, ease: 'none', onUpdate: () => render(s.v), onComplete: () => { replaying = null; } });
      G.delayedCall(0.25, () => addEventListener('scroll', stopReplay, { passive: true, once: true }));
    });
    const mm = G.matchMedia();
    mm.add(DESK, () => {
      root.classList.add('is-scrub'); measure();
      scrub(root, 'top top', 'bottom bottom', 0.5, show);
      return () => root.classList.remove('is-scrub');
    });
    mm.add(SMALL, () => { measure(); scrub(stage, 'top 72%', 'bottom 72%', 0.35, show); });
    ST.addEventListener('refresh', () => { measure(); render(p); });
    (document.fonts?.ready || Promise.resolve()).then(() => ST.refresh());
  })();

  /* ---------------- hub: your tools in, pipeline out ----------------
     Inputs slide in, their wires wipe toward the engine, the engine locks,
     then outputs follow. Packets travel with a short comet tail; each
     wire carries a soft gradient that brightens toward the engine. */
  (function hub() {
    const host = $('[data-hub]');
    if (!host) return;
    const ins = [['HubSpot', 'crm', 'mute', 'hubspot'], ['Salesforce', 'crm', 'mute', 'salesforce'], ['LinkedIn', 'intent', 'sig', 'linkedin'], ['Clay', 'enrichment', 'sig', 'clay']];
    const outs = [['Call queue', 'sdr floor', 'live', '#i-headset'], ['Sequences', 'email · linkedin', 'mute', '#i-mail'], ['Your calendar', 'meetings', 'ok', '#i-cal'], ['Slack', '#wins', 'ok', 'slack']]; // '#' = line icon, else a logo file
    const TAIL = 5;
    let packets = [], coreHit = null;
    const stop = (o, a) => `<stop offset="${o}" stop-color="var(--aqua)" stop-opacity="${a}"/>`;
    const lin = (id, x1, y1, x2, y2, a, b) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stop(0, a)}${stop(1, b)}</linearGradient>`;
    const edge = `<radialGradient id="hubHalo">${stop(0, 0.9)}${stop(0.45, 0.5)}${stop(1, 0)}</radialGradient>` + `<linearGradient id="hubEdge" x1="0" y1="0" x2="1" y2="1">${stop(0, 0.9)}${stop(0.5, 0.15)}${stop(1, 0.9)}</linearGradient>`;

    function build() {
      const v = matchMedia('(max-width: 767px)').matches;
      // a node is a white logo tile plus label: tile left on desktop, above the label on phones
      const mark = (x, y, size, ic) => ic[0] === '#'
        ? `<use class="ic" href="${ic}" x="${x}" y="${y}" width="${size}" height="${size}"/>`
        : `<image href="${logoSrc(ic)}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
      const node = (x, y, w, h, [t, s, kind, ic], cls, d) =>
        `<g class="node ${cls}" style="--d:${d}ms"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>` + (v
          ? `<rect class="tile" x="${x + w / 2 - 15}" y="${y + 9}" width="30" height="30" rx="8"/>${mark(x + w / 2 - 9, y + 15, 18, ic)}<text x="${x + w / 2}" y="${y + h - 10}" text-anchor="middle" font-family="Geist" font-weight="500">${t}</text>`
          : `<rect class="tile" x="${x + 11}" y="${y + (h - 40) / 2}" width="40" height="40" rx="10"/>${mark(x + 19, y + (h - 24) / 2, 24, ic)}<text x="${x + 64}" y="${y + h / 2 - 3}" font-family="Geist" font-weight="500">${t}</text><text class="sub" x="${x + 64}" y="${y + h / 2 + 15}" font-family="Geist Mono" font-weight="500">${s}</text>`)
        + `<rect class="hit ${kind}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/></g>`;
      const core = (x, y, w, h) =>
        `<g class="core" style="--d:760ms"><ellipse class="core-halo" cx="${x + w / 2}" cy="${y + h / 2}" rx="${w * 0.72}" ry="${h * 0.95}" fill="url(#hubHalo)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><rect class="core-glow" x="${x}" y="${y}" width="${w}" height="${h}" rx="12" stroke="url(#hubEdge)"/><rect class="hit" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/><text x="${x + w / 2}" y="${y + h / 2 - 3}" text-anchor="middle" font-family="Geist" font-weight="600">NextGen engine</text><text class="sub" x="${x + w / 2}" y="${y + h / 2 + 15}" text-anchor="middle" font-family="Geist Mono" font-weight="500">signals → sdrs → crm</text></g>`;
      let W, H, wires = [], nodes = '', grads;
      if (!v) {
        W = 1120; H = 352;
        const nw = 212, nh = 64, hx = 430, hw = 260, hh = 124, hy = (H - hh) / 2, cy = H / 2;
        ins.forEach((n, i) => { const y = 12 + i * 88; nodes += node(0, y, nw, nh, n, 'in-node', i * 60); wires.push({ side: 'in', d: `M${nw},${y + nh / 2} C${(nw + hx) / 2},${y + nh / 2} ${(nw + hx) / 2},${cy + (i - 1.5) * 20} ${hx},${cy + (i - 1.5) * 20}`, c: ins[i][2] }); });
        outs.forEach((n, i) => { const y = 12 + i * 88, x = W - nw; nodes += node(x, y, nw, nh, n, 'out-node', 1120 + i * 60); wires.push({ side: 'out', d: `M${hx + hw},${cy + (i - 1.5) * 20} C${(hx + hw + x) / 2},${cy + (i - 1.5) * 20} ${(hx + hw + x) / 2},${y + nh / 2} ${x},${y + nh / 2}`, c: outs[i][2] }); });
        nodes += core(hx, hy, hw, hh);
        grads = lin('hubIn', nw, 0, hx, 0, 0, 0.9) + lin('hubOut', hx + hw, 0, W - nw, 0, 0.9, 0) + edge;
      } else {
        W = 358; H = 560;
        const nw = 82, nh = 70, hx = 49, hw = 260, hh = 96, hy = (H - hh) / 2, cx = W / 2;
        const short = { 'Your calendar': 'Calendar', 'Call queue': 'Calls', 'Sequences': 'Email' };
        ins.forEach((n, i) => { const x = i * 92; nodes += node(x, 0, nw, nh, n, 'in-node', i * 60); wires.push({ side: 'in', d: `M${x + nw / 2},${nh} C${x + nw / 2},${(nh + hy) / 2} ${cx + (i - 1.5) * 24},${(nh + hy) / 2} ${cx + (i - 1.5) * 24},${hy}`, c: ins[i][2] }); });
        outs.forEach((n, i) => { const x = i * 92, y = H - nh; nodes += node(x, y, nw, nh, [short[n[0]] || n[0], ...n.slice(1)], 'out-node', 1120 + i * 60); wires.push({ side: 'out', d: `M${cx + (i - 1.5) * 24},${hy + hh} C${cx + (i - 1.5) * 24},${(hy + hh + y) / 2} ${x + nw / 2},${(hy + hh + y) / 2} ${x + nw / 2},${y}`, c: outs[i][2] }); });
        nodes += core(hx, hy, hw, hh);
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
      const hits = $$('.node .hit', svg); // same order as the wires: four in, four out
      coreHit = $('.core .hit', svg);
      packets = wires.map((w, i) => {
        const path = $('#hw' + i, svg);
        const len = path.getTotalLength(), pts = Array.from({ length: 161 }, (_, k) => path.getPointAtLength(len * k / 160));
        return { path, side: w.side, hit: hits[i], len, pts, dots: $$(`circle[data-w="${i}"]`, svg), off: (i % 4) * 0.25 + (i >= 4 ? 0.12 : 0), speed: 2600 + (i % 3) * 400 };
      });
      if (still) packets.forEach(p => { const pt = p.path.getPointAtLength(p.len * 0.6), c = p.dots[0]; c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('opacity', 1); });
    }
    function loop(now) {
      // a node flashes as its packet leaves or lands; the engine flashes on each arrival
      let coreOn = 0;
      packets.forEach(p => {
        const kk = ((now / p.speed + p.off) % 1 + 1) % 1, near = clamp(1 - (kk > 0.5 ? 1 - kk : kk) / 0.14);
        p.hit.style.opacity = near.toFixed(2);
        if (p.side === 'in' && kk > 0.8) coreOn = Math.max(coreOn, clamp((kk - 0.86) / 0.14));
      });
      coreHit.style.opacity = (coreOn * 0.9).toFixed(2);
      packets.forEach(p => p.dots.forEach((c, k) => {
        const kk = (((now - k * 34) / p.speed + p.off) % 1 + 1) % 1;
        const u = easeInOut(kk) * 160, n = Math.min(159, u | 0), m = u - n, A = p.pts[n], B = p.pts[n + 1];
        const pt = { x: A.x + (B.x - A.x) * m, y: A.y + (B.y - A.y) * m };
        const fade = kk < 0.08 ? kk / 0.08 : kk > 0.92 ? (1 - kk) / 0.08 : 1;
        c.setAttribute('cx', pt.x.toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1));
        c.setAttribute('opacity', (fade * (1 - k / TAIL) * (k ? 0.7 : 1)).toFixed(2));
      }));
    }
    build();
    matchMedia('(max-width: 767px)').addEventListener('change', build);
    if (still) { host.classList.add('in'); return; }
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { host.classList.add('in'); o.disconnect(); } }, { threshold: 0.3 }).observe(host);
    const run = ticker(loop);
    let onScreen = false;
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(onScreen && !document.hidden); }).observe(host);
    document.addEventListener('visibilitychange', () => run(onScreen && !document.hidden));
  })();

  /* ---------------- light fields: hero beams + closing beams ----------------
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
                  light: parseFloat(cs.getPropertyValue('--fx-light')) === 1 }; // the hero is locked dark, so read the canvas's own tokens
      };
      f.size = () => {
        const r = canvas.getBoundingClientRect();
        f.w = Math.max(1, Math.round(r.width)); f.h = Math.max(1, Math.round(r.height));
        canvas.width = Math.round(f.w * DPR); canvas.height = Math.round(f.h * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        if (kind === 'converge') {
          // aim at the closing form; keep the copy above it calm
          const form = canvas.closest('.closing-panel').querySelector('.capture'), fr = form.getBoundingClientRect();
          f.vx = fr.left - r.left + fr.width / 2; f.vy = fr.top - r.top + fr.height / 2; f.hw = fr.width / 2;
          const m = document.createElement('canvas'); m.width = canvas.width; m.height = canvas.height;
          const mc = m.getContext('2d'); mc.setTransform(DPR, 0, 0, DPR, 0, 0);
          const g = mc.createLinearGradient(0, f.vy - 150, 0, f.vy + 30);
          g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          mc.fillStyle = g; mc.fillRect(0, 0, f.w, f.vy + 30);
          mc.save(); mc.translate(f.vx, f.vy + 20); mc.scale(Math.min(f.w * 0.42, 400) / 120, 1);
          const e = mc.createRadialGradient(0, 0, 40, 0, 0, 120);
          e.addColorStop(0, 'rgba(0,0,0,.9)'); e.addColorStop(1, 'rgba(0,0,0,0)');
          mc.fillStyle = e; mc.fillRect(-120, -120, 240, 240); mc.restore();
          f.mask = m;
        }
        if (kind === 'beams') {
          // mask = the headline area, cut out after drawing so the copy stays calm
          const m = document.createElement('canvas'); m.width = canvas.width; m.height = canvas.height;
          const mc = m.getContext('2d'); mc.setTransform(DPR, 0, 0, DPR, 0, 0);
          f.aim = f.w >= 1024 && parseFloat(canvas.dataset.vx) || 0.5; // subpage heroes aim right, so the copy sits left
          const side = f.aim !== 0.5;
          const cx = side ? f.w * 0.27 : f.w / 2, rx = side ? f.w * 0.36 : Math.min(f.w * 0.3, 520), ry = side ? f.h * 0.72 : f.h * 0.42;
          mc.save(); mc.translate(cx, f.h * (side ? 0.5 : 0.33)); mc.scale(rx / ry, 1);
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
        if (kind === 'beams') drawBeams(f, t); else drawConverge(f, t);
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
      const vx = w * (f.aim || 0.5), vy = h * (f.aim !== 0.5 ? 0.5 : small ? 0.6 : 0.57);
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
        const p = still ? (i + 0.5) / D : ((i + t * 0.07) % D) / D;  // 0 → 1 as it grows
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
          const intro = still ? 1 : easeOut(clamp((t - 0.15 - rand(j, 4) * 0.6) / 1.1));
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
            const q = still ? 0.45 : (t * sp + rand(j, 6)) % 1;
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

    /* Closing: the hero's beams again, now rising from the floor of the panel
       and converging on the form. Pulses run inward; each one that lands adds
       to a soft ring of light around the button row. */
    function drawConverge(f, t) {
      const { ctx, w, h, col, vx, vy } = f, k = col.k, small = w < 768;
      // floor bloom
      ctx.save(); ctx.translate(vx, h); ctx.scale(1, 0.34);
      const fb = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.55);
      fb.addColorStop(0, hexA(col.ray, 0.42 * k)); fb.addColorStop(1, hexA(col.ray, 0));
      ctx.fillStyle = fb; ctx.fillRect(-w * 0.55, -w * 0.55, w * 1.1, w * 1.1); ctx.restore();

      const N = small ? 26 : 58, R = Math.hypot(w / 2, h - vy) * 1.08;
      let landed = 0;
      ctx.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        const j = i + 400;
        const th = Math.PI * (0.035 + 0.93 * ((i + 0.5 + (rand(j, 1) - 0.5) * 0.9) / N)); // fan across the floor, left to right
        const dx = Math.cos(th), dy = Math.sin(th);
        // start where the ray leaves the panel, so the light always comes from the edge
        const out = Math.min(R, dx ? (w / 2 + 12) / Math.abs(dx) : R, dy ? (h - vy + 12) / dy : R);
        const ex = vx + dx * out, ey = vy + dy * out;
        const reach = 0.46 + rand(j, 2) * 0.34;
        const ix = ex + (vx - ex) * reach, iy = ey + (vy - ey) * reach;
        const hot = rand(j, 3) > 0.8, weight = 0.42 + 0.58 * Math.abs(dx);
        const intro = still ? 1 : easeOut(clamp((t - rand(j, 4) * 0.6) / 1.1));
        if (intro <= 0) continue;
        const base = clamp((hot ? 0.85 : 0.4) * weight * k);
        const g = ctx.createLinearGradient(ex, ey, ix, iy);
        g.addColorStop(0, hexA(col.hi, base)); g.addColorStop(0.35, hexA(col.ray, base * 0.55)); g.addColorStop(1, hexA(col.ray, 0));
        const tx = ex + (ix - ex) * intro, ty = ey + (iy - ey) * intro;
        ctx.strokeStyle = g;
        if (hot) { ctx.globalAlpha = 0.22; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke(); ctx.globalAlpha = 1; }
        ctx.lineWidth = hot ? 2.2 : 1;
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
        if (intro < 1) continue;
        const q = still ? 0.45 : (t * (0.12 + rand(j, 5) * 0.12) + rand(j, 6)) % 1, q0 = Math.max(0, q - 0.16);
        const ax = ex + (ix - ex) * q0, ay = ey + (iy - ey) * q0, bx = ex + (ix - ex) * q, by = ey + (iy - ey) * q;
        const pg = ctx.createLinearGradient(ax, ay, bx, by), pa = clamp(Math.sin(q * Math.PI) * weight * k);
        pg.addColorStop(0, hexA(col.hi, 0)); pg.addColorStop(1, hexA(col.hi, pa));
        ctx.strokeStyle = pg; ctx.lineWidth = hot ? 3 : 1.7;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        if (hot && q > 0.82) landed += (1 - q) / 0.18 * 0.5;
      }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(f.mask, 0, 0, w, h);
      ctx.globalCompositeOperation = col.light ? 'source-over' : 'lighter';
      // ring of light around the form
      ctx.save(); ctx.translate(vx, vy); ctx.scale(1, 0.3);
      const rr = f.hw * 1.35, rg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr), ra = (0.14 + Math.min(0.16, landed * 0.06)) * k;
      rg.addColorStop(0, hexA(col.ray, ra)); rg.addColorStop(1, hexA(col.ray, 0));
      ctx.fillStyle = rg; ctx.fillRect(-rr, -rr, rr * 2, rr * 2); ctx.restore();
    }

    fields.forEach(f => { f.colours(); f.size(); f.draw(still ? 2 : 0); });
    requestAnimationFrame(() => fields.forEach(f => f.canvas.classList.add('is-on')));

    let ro;
    const redrawAll = () => fields.forEach(f => { f.colours(); f.size(); f.draw(f.t ?? (still ? 2 : 0)); });
    if ('ResizeObserver' in window) { ro = new ResizeObserver(redrawAll); fields.forEach(f => ro.observe(f.canvas)); } // the observer also re-aims the closing beams when the form moves
    new MutationObserver(() => fields.forEach(f => { f.colours(); f.draw(f.t ?? (still ? 2 : 0)); })).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode', 'data-theme'] });
    (document.fonts?.ready || Promise.resolve()).then(redrawAll);
    if (still) return;

    const gap = matchMedia('(pointer: coarse)').matches ? 30 : 11; // 30fps on touch to save battery, every frame on desktop (every other above 90Hz)
    let last = 0;
    const t0 = performance.now();
    const tick = now => {
      if (now - last < gap) return;
      last = now;
      const t = (performance.now() - t0) / 1000 * (TAU / 7) * 1.1; // one full drift every ~7s
      fields.forEach(f => { if (f.on) { f.t0 ??= t; f.t = t - f.t0; f.draw(f.t); } });
    };
    const loop = ticker(tick);
    const schedule = () => loop(!document.hidden && fields.some(f => f.on));
    const io = new IntersectionObserver(es => { es.forEach(e => { const f = fields.find(x => x.canvas === e.target); if (f) f.on = e.isIntersecting; }); schedule(); });
    fields.forEach(f => io.observe(f.canvas));
    document.addEventListener('visibilitychange', schedule);
  })();

  /* ---------------- staggered groups: children reveal 60ms apart (max 8) ---------------- */
  $$('[data-stagger]').forEach(g => [...g.children].forEach((c, i) => {
    c.classList.add('rv'); c.style.setProperty('--d', Math.min(i, 7) * 60 + 'ms'); rvIO.observe(c);
  }));

  /* ---------------- layer tabs ---------------- */
  (function layers() {
    const tabs = $$('.layer-tab'), ind = $('.layer-ind');
    if (!tabs.length) return;
    const moveInd = t => { ind.style.transform = `translateY(${t.offsetTop}px)`; ind.style.height = t.offsetHeight + 'px'; }; // equal tab heights, so only the transform animates
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
        <div class="top"><span class="logo-tile"><img class="lg" src="${logoSrc(n.toLowerCase().replace(' ', '-'))}" alt="" width="28" height="28" loading="lazy"></span><div><b>${n}</b><span class="cat">${cat}</span></div></div>
        <p>${d}</p>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="chip">${price}</span>${pick ? '<span class="pick">NextGen pick</span>' : ''}</div>
      </article>`).join('');
    const btns = $$('.cat-chips button');
    btns.forEach(b => b.addEventListener('click', () => {
      btns.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      $$('.tool-card', grid).forEach(t => t.classList.toggle('dim', b.dataset.cat !== 'all' && t.dataset.c !== b.dataset.cat));
    }));
  })();

  /* ---------------- tool directory page: category filter and search ---------------- */
  (function directory() {
    const grid = $('[data-directory]');
    if (!grid) return;
    const cards = $$('.tool-card', grid), chips = $$('[data-dir-cat]'), input = $('[data-dir-search]'), out = $('[data-dir-count]');
    let cat = 'all';
    function apply() {
      const q = input.value.trim().toLowerCase();
      let n = 0;
      cards.forEach(c => { const on = (cat === 'all' || c.dataset.c === cat) && (!q || c.textContent.toLowerCase().includes(q)); c.hidden = !on; if (on) n++; });
      out.textContent = `${n} ${n === 1 ? 'tool' : 'tools'}`;
    }
    chips.forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.dirCat; chips.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
      const near = !still && FLIP ? cards.filter(c => c.offsetParent && c.getBoundingClientRect().top < innerHeight * 1.5) : [];
      const state = near.length ? FLIP.getState(cards) : null;
      apply();
      if (state) FLIP.from(state, { duration: 0.28, ease: 'power3.out', simple: true, onEnter: els => G.fromTo(els, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.24, ease: 'power3.out', clearProps: 'opacity,transform' }) });
    }));
    input.addEventListener('input', apply);
    document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); input.select(); } });
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
      raf = visible ? requestAnimationFrame(tick) : 0;
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
    show(0);
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) { t0 = performance.now(); raf = requestAnimationFrame(tick); }
    }, { threshold: 0.3 }).observe(root);
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
      btn.addEventListener('click', () => { playing = !playing; if (pos >= TOTAL) pos = 0; last = performance.now(); setIcon(); if (playing) raf = requestAnimationFrame(loop); else toast('Sample waveform. Real recordings are shared on a call, with consent'); });
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
    if (mq && !reduced) {
      new IntersectionObserver(([e]) => mq.classList.toggle('is-running', e.isIntersecting)).observe(mq);
      if (G && matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const speed = { v: 1 };
        const to = v => G.to(speed, { v, duration: 0.6, ease: 'power3.out', overwrite: true, onUpdate: () => $$('.marquee-row', mq).forEach(r => r.getAnimations().forEach(a => (a.playbackRate = speed.v))) });
        mq.addEventListener('pointerenter', () => to(0));
        mq.addEventListener('pointerleave', () => to(1));
      }
    }
  })();

  /* ---------------- ambient CSS loops run only while their block is on screen ---------------- */
  (function idleLoops() {
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-idle', !e.isIntersecting)));
    $$('.hero-pill, .stage, .fn-stage, .hub-frame, .term-win, .floor').forEach(el => io.observe(el));
  })();

  /* ---------------- footer wordmark: rises once; the glint pauses off screen and resumes where it was ---------------- */
  (function footMark() {
    const m = $('[data-foot-mark]');
    if (!m) return;
    new IntersectionObserver(([e]) => { if (e.isIntersecting) m.classList.add('in'); m.classList.toggle('is-running', e.isIntersecting && !reduced); }, { threshold: 0.15 }).observe(m);
  })();

  /* ---------------- FAQ: one open at a time ---------------- */
  $$('[data-faq] .faq-q').forEach((q, _, all) => q.addEventListener('click', () => {
    const on = q.getAttribute('aria-expanded') !== 'true';
    all.forEach(o => o.setAttribute('aria-expanded', 'false'));
    q.setAttribute('aria-expanded', String(on));
  }));
})();
