import { parseAll } from './parse.js';
import sources from '../data/index.js';
import { computeLayout, setSwirl, bendEdges, SWIRL } from './layout.js';
import { analyze, lineageFocus, wordsFocus, lawFocus, familyFocus } from './analysis.js';
import { View } from './view.js';
import { Renderer, flowClass } from './render.js';
import { UI } from './ui.js';
import { Explore } from './explore.js';
import { Imported } from './imported.js';
import { Space } from './space.js';
import { Kin } from './kin.js';
import { bindAbout } from './about.js';
import { T_MIN, T_MAX, timeToR, rToTime } from './langs.js';
import { EVENTS, STORIES, RINGS } from './content.js';

const HISTORY_SECONDS = 54; // one full growth, centre to rim

class App {
  constructor() {
    this.g = parseAll(sources);
    if (this.g.errors.length) console.error('data errors', this.g.errors);
    analyze(this.g);
    this.L = computeLayout(this.g);
    for (const e of this.g.edges) e.flow = flowClass(e.target.enDesc.size);
    this.state = {
      time: T_MAX, tR: 1, playing: false,
      focus: null, hover: null, selected: null,
      lens: null, lensFocus: null, minZipf: 0, pulse: null,
    };
    this.view = new View();
    this.base = document.getElementById('base');
    this.fxCanvas = document.getElementById('fx');
    this.r = new Renderer({ base: this.base, fx: this.fxCanvas, g: this.g, L: this.L, view: this.view, state: this.state });
    this.r.ringRadii = RINGS.map((x) => ({ ...x, r: timeToR(x.year) }));
    this.ui = new UI(this);
    this.backStack = [];
    this.restoring = false;
    this.dirty = true;
    this.userMoved = false;
    this.applyAlive();
    this.resize(true);
    this.ui.init();
    // the Wiktionary import: its index loads in the background, roots on demand
    this.imp = new Imported(this.g);
    this.explore = new Explore(this);
    document.getElementById('to-explore').addEventListener('click', () => this.go(() => this.setMode('explore')));
    document.getElementById('map-back').addEventListener('click', () => this.back());
    document.getElementById('sp-back').addEventListener('click', () => this.back());
    document.getElementById('kn-back').addEventListener('click', () => this.back());
    for (const id of ['to-kin', 'ex-landing-kin', 'sp-kin', 'map-kin']) {
      document.getElementById(id)?.addEventListener('click', () => this.go(() => this.setMode('kin', '')));
    }
    document.getElementById('map-3d').addEventListener('click', () => this.go(() => this.setMode('space')));
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        this.back();
      }
    });
    this.bindPointer();
    window.addEventListener('resize', () => this.resize());
    if (document.fonts) {
      Promise.all([
        document.fonts.load('12px "Gentium Book Plus"'),
        document.fonts.load('italic 12px "Gentium Book Plus"'),
        document.fonts.load('italic 15px "Cormorant Garamond"'),
      ]).finally(() => {
        this.r.rimKey = '';
        this.dirty = true;
      });
    }
    this.boot();
    requestAnimationFrame((t) => this.loop(t));
  }

  // Shareable views live in the hash (#pedigree, #law-grimm, #story-cow, #family-norse):
  // a plain #name is what survives inside an Artifact link.
  slugFor(n) {
    if (n && n.imported && (n.lang === 'En' || n.lang === 'Ru')) return `w:${n.form}${n.h ? '~' + n.h : ''}`;
    if (!n || !n.isEn) return '';
    const s = n.key.toLowerCase().replace(/#/g, '-').replace(/\s+/g, '-');
    return /^[a-z0-9-]+$/.test(s) ? s : '';
  }

  routeFromHash() {
    const h = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    if (!h) return false;
    if (h === 'map') {
      this.setMode('map');
      return true;
    }
    if (h === 'explore') {
      this.setMode('explore');
      this.explore.landing();
      return true;
    }
    // the languages: #languages, #languages-en, #languages-en+ru, #languages-en:water
    const kn = h.match(/^languages(?:-(.+))?$/);
    if (kn) {
      this.setMode('kin', kn[1] || '');
      return true;
    }
    // the 3D view: #3d, #3d-word, #3d-root-<id>, #3d-n<index>
    const sp = h.match(/^3d(?:-(.+))?$/);
    if (sp) {
      const k = sp[1] || '';
      const r3 = k.match(/^root-(.+)$/);
      const n3 = k.match(/^n(\d+)$/);
      let node = null;
      if (r3) {
        const id = Object.keys(this.g.rootById).find((x) => x.toLowerCase() === r3[1]);
        node = id ? this.g.rootById[id].node : null;
      } else if (n3) node = this.g.nodes[+n3[1]] || null;
      else if (k) node = this.g.byKey.get(k.replace(/-/g, '#')) || this.g.byKey.get(k) || this.g.byDisplay.get(k.replace(/-/g, ' ')) || this.g.byDisplay.get(k) || null;
      this.setMode('space', node);
      if (!k && this.space.sel >= 0) this.space.clear();
      return true;
    }
    const wm = h.match(/^w:(.+?)(?:~([\w.]+))?$/);
    if (wm) {
      this.setMode('explore');
      this.explore.openImported(wm[1], wm[2] || '').then((ok) => ok || this.explore.landing());
      return true;
    }
    const rm = h.match(/^root-(.+)$/);
    if (rm && /^w\d+$/.test(rm[1])) {
      this.setMode('explore');
      this.explore.openImportedRoot(+rm[1].slice(1)).then((ok) => ok || this.explore.landing());
      return true;
    }
    const rid = rm && Object.keys(this.g.rootById).find((k) => k.toLowerCase() === rm[1]);
    if (rid) {
      this.setMode('explore');
      this.explore.openRoot(this.g.rootById[rid]);
      return true;
    }
    const law = h.match(/^law-([a-z0-9-]+)$/);
    if (law) {
      const id = Object.keys(this.g.law).find((k) => k.replace(/\./g, '-') === law[1]);
      if (id) {
        this.setLens({ type: 'law', id });
        return true;
      }
    }
    const story = h.match(/^story-([a-z0-9-]+)$/);
    if (story && STORIES.some((x) => x.id === story[1])) {
      this.ui.showTab('stories');
      this.setLens({ type: 'story', id: story[1] });
      return true;
    }
    const fam = h.match(/^family-([a-z]+)$/);
    if (fam && this.g.words.some((w) => w.family === fam[1])) {
      this.ui.showTab('families');
      this.setLens({ type: 'family', id: fam[1] });
      return true;
    }
    const w = this.g.byKey.get(h.replace(/-/g, '#')) || this.g.byKey.get(h) || this.g.byDisplay.get(h.replace(/-/g, ' ')) || this.g.byDisplay.get(h);
    if (w) {
      this.select(w, true);
      return true;
    }
    // a plain #word that is not curated may still be an imported one
    if (this.imp && !this.imp.failed && /^[\p{L}'-]+$/u.test(h)) {
      this.setMode('explore');
      this.explore.openImported(h).then((ok) => ok || this.explore.landing());
      return true;
    }
    return false;
  }

  writeHash(slug) {
    try {
      const url = slug ? `#${slug}` : location.pathname + location.search;
      if ((location.hash || '') !== (slug ? `#${slug}` : '')) history.replaceState(null, '', url);
    } catch {
      /* some frames refuse history changes; the view still works */
    }
  }

  boot() {
    window.addEventListener('hashchange', () => this.routeFromHash());
    const q = new URLSearchParams(location.search);
    if (location.hash.length > 1 && this.routeFromHash()) return;
    if (q.has('lens')) {
      const [type, id] = q.get('lens').split(':');
      this.setLens({ type, id });
      return;
    }
    if (q.has('t')) {
      this.setTime(q.get('t') === 'now' ? T_MAX : parseFloat(q.get('t')));
      this.setMode('map');
      return;
    }
    if (q.has('word')) {
      const w = this.g.byKey.get(q.get('word')) || this.g.byDisplay.get(q.get('word').toLowerCase());
      if (w) {
        this.select(w);
        return;
      }
    }
    if (q.has('map')) {
      this.setMode('map');
      return;
    }
    this.setMode('explore');
  }

  // Explore (one word at a time) is the front door; the whole map is a second view.
  setMode(mode, node = null) {
    const prev = this.mode;
    this.mode = mode;
    document.body.dataset.mode = mode;
    if (prev === 'space' && mode !== 'space' && this.space) this.space.exit();
    if (prev === 'kin' && mode !== 'kin' && this.kin) this.kin.exit();
    if (mode === 'kin') {
      // the languages as one globe; built the first time it is opened. node: an address, or null to stay
      this.ui.tooltip(null);
      this.state.hover = null;
      if (this.state.playing) this.pause();
      this.kin ||= new Kin(this);
      const at = typeof node === 'string' ? node : null;
      if (prev !== 'kin') this.kin.enter(at);
      else if (at != null) this.kin.open(at);
      return;
    }
    if (mode === 'space') {
      // the whole vocabulary in three dimensions; built the first time it is opened
      this.ui.tooltip(null);
      this.state.hover = null;
      if (this.state.playing) this.pause();
      this.space ||= new Space(this);
      const at = node && this.space.S.index.has(node) ? node : null;
      if (prev !== 'space') this.space.enter(at);
      else if (at) this.space.select(this.space.S.index.get(at), { remember: false });
      return;
    }
    if (mode === 'map') {
      if (prev !== 'map') {
        this.resize();
        this.r.rimKey = '';
        this.dirty = true;
        this.last = performance.now();
      }
      this.writeHash(this.lensSlug() || 'map');
    } else {
      this.ui.tooltip(null);
      this.state.hover = null;
      if (this.state.playing) this.pause();
      const sel = this.explore && this.explore.sel;
      this.writeHash(sel ? (sel.isRoot ? `root-${sel.rootKey}` : this.slugFor(sel)) : '');
    }
  }

  // ------------------------------------------------------------------ layout & loop
  insets() {
    const W = window.innerWidth;
    const narrow = W < 820;
    const railOpen = !narrow && !document.body.classList.contains('rail-closed');
    const journey = document.body.classList.contains('journey-open');
    return {
      l: railOpen ? 330 : 12,
      r: journey && !narrow ? 380 : 12,
      t: narrow ? 92 : 70,
      // on phones the journey is a bottom sheet over the lower 60%
      b: narrow ? (journey ? window.innerHeight * 0.6 + 8 : 104) : 104,
    };
  }

  homeInsets() {
    const i = this.insets();
    // while history plays, leave room under the disc for the captions
    const b = this.state.playing ? i.b + (window.innerWidth < 820 ? 70 : 118) : i.b;
    return { ...i, b, r: Math.max(12, Math.min(i.r, 30)) };
  }

  resize(first = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.r.resize(w, h);
    const home = this.view.home(w, h, this.homeInsets());
    if (first || !this.userMoved) this.view.set(home);
    this.dirty = true;
  }

  goHome() {
    this.userMoved = false;
    const home = this.view.home(window.innerWidth, window.innerHeight, this.homeInsets());
    this.view.flyTo(home, 900);
  }

  loop(now) {
    const raw = (now - (this.last || now)) / 1000;
    const dt = Math.min(0.05, raw);
    this.last = now;
    if (this.mode !== 'map') {
      // the map sleeps while you explore a single word
      requestAnimationFrame((t) => this.loop(t));
      return;
    }
    // history follows the wall clock even when frames are dropped
    if (this.state.playing) this.advance(Math.min(0.5, raw), now);
    if (this.view.update(now)) {
      this.dirty = true;
    }
    if (this.dirty) {
      this.r.draw();
      this.dirty = false;
    }
    this.r.drawFx(dt, now);
    requestAnimationFrame((t) => this.loop(t));
  }

  // ------------------------------------------------------------------ time
  advance(dt, now) {
    const st = this.state;
    const r0 = timeToR(T_MIN);
    const prevR = st.tR;
    const prevT = st.time;
    st.tR = Math.min(1, st.tR + (dt * (1 - r0)) / HISTORY_SECONDS);
    st.time = st.tR >= 1 ? T_MAX : rToTime(st.tR);
    this.r.noteBirths(prevR, st.tR, now);
    this.bendFor(st.tR);
    this.followGrowth();
    for (const ev of EVENTS) {
      if (ev.year > prevT && ev.year <= st.time) {
        this.ui.caption(ev);
        if (ev.law) st.pulse = { law: ev.law, t0: now };
      }
    }
    if (st.tR >= 1) {
      this.pause();
      if (!this.userMoved) this.goHome();
      this.ui.caption({ year: T_MAX, title: 'Every word is a journey', text: 'Hover the rim to follow any word home. Open Laws to see the rules that shaped them, or Stories for guided tours.' }, true);
    }
    this.ui.updateTime(st.time);
    this.dirty = true;
  }

  // While history plays, the camera starts close on the young core and pulls
  // back as the disc grows.
  followGrowth(f = 0.08) {
    if (this.userMoved) return;
    const v = this.view;
    const home = v.home(window.innerWidth, window.innerHeight, this.homeInsets());
    const k = Math.min(3.6, Math.max(1, 0.95 / (this.state.tR + 0.14)));
    const target = home.s * k;
    v.anim = null;
    v.s += (target - v.s) * f;
    v.cx += (home.cx - v.cx) * f;
    v.cy += (home.cy - v.cy) * f;
  }

  // The spiral tightens as history unfolds: straight spokes at the start,
  // a full vortex by now.
  bendFor(tR) {
    const r0 = timeToR(T_MIN);
    const p = Math.max(0, Math.min(1, (tR - r0) / (1 - r0)));
    const e = p * p * (3 - 2 * p);
    const sw = SWIRL * (0.3 + 0.7 * e);
    if (Math.abs(sw - (this._sw ?? -1)) > 0.004) {
      bendEdges(this.g, sw);
      this._sw = sw;
      this.dirty = true;
    }
  }

  setTime(year) {
    const st = this.state;
    st.time = Math.max(T_MIN, Math.min(T_MAX, year));
    st.tR = st.time >= T_MAX ? 1 : timeToR(st.time);
    this.bendFor(st.tR);
    this.ui.updateTime(st.time);
    this.r.rimKey = '';
    this.dirty = true;
  }

  play() {
    const st = this.state;
    if (st.time >= T_MAX - 0.5) this.setTime(T_MIN);
    if (st.selected) this.select(null);
    if (st.time <= T_MIN + 1) this.ui.caption(EVENTS[0]);
    st.playing = true;
    this.ui.setPlaying(true);
  }

  pause() {
    this.state.playing = false;
    this.ui.setPlaying(false);
  }

  togglePlay() {
    clearTimeout(this.introTimer);
    if (this.state.playing) this.pause();
    else this.play();
  }

  skipToNow() {
    clearTimeout(this.introTimer);
    this.pause();
    this.setTime(T_MAX);
    if (!this.userMoved) this.goHome();
    this.ui.caption({ year: T_MAX, title: 'Every word is a journey', text: 'Hover the rim to follow any word home. Open Laws to see the rules that shaped them, or Stories for guided tours.' }, true);
  }

  // ------------------------------------------------------------------ focus
  applyAlive() {
    const z = this.state.minZipf;
    for (const n of this.g.nodes) {
      if (n.isEn) n.alive = n.zipf >= z;
      else if (!n.enDesc.size) n.alive = z <= 0;
      else {
        let a = false;
        for (const w of n.enDesc) if (w.zipf >= z) { a = true; break; }
        n.alive = a;
      }
    }
  }

  setMinZipf(z) {
    this.state.minZipf = z;
    this.applyAlive();
    this.r.aliveEdges = this.g.edges.filter((e) => e.primary && e.target.alive).length;
    this.r.rimKey = '';
    this.dirty = true;
  }

  refocus() {
    const st = this.state;
    let F = null;
    if (st.selected) F = lineageFocus(this.g, st.selected);
    else if (st.hover) F = lineageFocus(this.g, st.hover);
    else if (st.lensFocus) F = st.lensFocus;
    if (F && !F.startEdges) {
      F.startEdges = [...F.edges].filter((e) => e.primary && !e.source.inEdges.some((ie) => F.edges.has(ie)));
      if (!F.startEdges.length) F.startEdges = [...F.edges].filter((e) => e.primary);
    }
    const changed = st.focus !== F;
    st.focus = F;
    if (changed) {
      for (const p of this.r.particles) this.r.spawn(p);
      this.r.rimKey = '';
      this.dirty = true;
    }
  }

  setHover(n) {
    if (this.state.hover === n) return;
    this.state.hover = n;
    this.refocus();
    this.dirty = true;
  }

  // ------------------------------------------------------------------ back
  // Where you were: the mode, and in Explore the word and the root it was opened in.
  snapshot() {
    if (this.mode === 'map') return { mode: 'map', lens: this.state.lens ? { ...this.state.lens } : null };
    if (this.mode === 'space') return { mode: 'space', node: this.space && this.space.sel >= 0 ? this.g.nodes[this.space.sel] : null, root: null };
    if (this.mode === 'kin') return { mode: 'kin', slug: this.kin ? this.kin.slug() : '', title: this.kin ? this.kin.title() : '', node: null, root: null };
    const ex = this.explore;
    // object references, so words from the Wiktionary import come back too
    return { mode: 'explore', node: ex && ex.sel ? ex.sel : null, root: ex && ex.root ? ex.root : null };
  }

  remember() {
    if (this.restoring || !this.mode) return;
    const s = this.snapshot();
    const last = this.backStack[this.backStack.length - 1];
    const same = (a, b) => a.mode === b.mode && a.node === b.node && a.root === b.root && (a.slug || '') === (b.slug || '') && JSON.stringify(a.lens || null) === JSON.stringify(b.lens || null);
    if (last && same(last, s)) return;
    this.backStack.push(s);
    if (this.backStack.length > 80) this.backStack.shift();
    this.updateBack();
  }

  // run one user navigation: remember where we were, once
  go(fn) {
    this.remember();
    const prev = this.restoring;
    this.restoring = true;
    try {
      fn();
    } finally {
      this.restoring = prev;
    }
    this.updateBack();
  }

  back() {
    const s = this.backStack.pop();
    if (!s) return;
    this.restoring = true;
    try {
      if (s.mode === 'map') {
        this.setMode('map');
        const cur = JSON.stringify(this.state.lens || null);
        if (cur !== JSON.stringify(s.lens || null)) this.setLens(s.lens);
      } else if (s.mode === 'kin') {
        this.setMode('kin', s.slug || '');
      } else if (s.mode === 'space') {
        this.setMode('space', s.node);
        if (!s.node) this.space.clear();
      } else {
        this.setMode('explore');
        if (s.node) this.explore.open(s.node, { animate: false, root: s.root });
        else this.explore.landing();
      }
    } finally {
      this.restoring = false;
    }
    this.updateBack();
  }

  describe(s) {
    if (!s) return '';
    if (s.mode === 'map') return 'Map';
    if (s.mode === 'kin') return s.slug && s.title ? s.title : 'Languages';
    if (s.mode === 'space') return s.node ? `${s.node.display} in 3D` : '3D';
    return s.node ? s.node.display : 'Start';
  }

  updateBack() {
    const top = this.backStack[this.backStack.length - 1];
    const label = this.describe(top);
    for (const id of ['ex-back', 'map-back', 'sp-back', 'kn-back']) {
      const b = document.getElementById(id);
      if (!b) continue;
      b.hidden = !top;
      b.title = top ? `Back to ${label}` : '';
      b.setAttribute('aria-label', top ? `Back to ${label}` : 'Back');
      const t = b.querySelector('.bk-t');
      if (t) t.textContent = label;
    }
  }

  select(n) {
    if (n) {
      this.go(() => {
        this.setMode('explore');
        this.explore.open(n);
      });
      return;
    }
    const st = this.state;
    st.selected = null;
    st.hover = null;
    this.refocus();
    this.ui.showJourney(null);
    this.dirty = true;
  }

  lensSlug() {
    const l = this.state.lens;
    if (!l) return '';
    return `${l.type}-${String(l.id).replace(/\./g, '-')}`;
  }

  frameFocus() {
    const F = this.state.focus;
    if (!F) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    };
    for (const n of F.nodes) {
      if (n.isEn) add(n.rimX, n.rimY);
      else add(n.x, n.y);
    }
    for (const w of F.words) add(w.rimX * 1.12, w.rimY * 1.12);
    if (!isFinite(x0)) return;
    const pad = 0.06;
    this.userMoved = true;
    this.view.flyTo(this.view.fitBox([x0 - pad, y0 - pad, x1 + pad, y1 + pad], window.innerWidth, window.innerHeight, this.insets(), 7), 1100);
  }

  setLens(lens) {
    if (this.mode) this.remember();
    const st = this.state;
    if (st.lens && st.lens.type === 'story') {
      const old = STORIES.find((s) => s.id === st.lens.id);
      if (old && old.minZipf) this.setMinZipf(0);
    }
    st.lens = lens;
    if (lens) this.setMode('map');
    st.selected = null;
    this.ui.showJourney(null);
    let F = null;
    if (lens) {
      if (lens.type === 'law') F = lawFocus(this.g, lens.id);
      if (lens.type === 'family') F = familyFocus(this.g, lens.id);
      if (lens.type === 'story') {
        const s = STORIES.find((x) => x.id === lens.id);
        if (s.law) F = lawFocus(this.g, s.law);
        else if (s.family) F = familyFocus(this.g, s.family);
        else if (s.words) F = wordsFocus(s.words.map((k) => this.g.byKey.get(k)).filter(Boolean), 'story');
        if (s.minZipf) this.setMinZipf(s.minZipf);
        if (st.time < T_MAX - 0.5) this.setTime(T_MAX);
      }
    }
    st.lensFocus = F;
    this.refocus();
    this.ui.refreshRail();
    this.writeHash(this.lensSlug());
    if (F && F.kind === 'story' && F.words.size < 40) this.frameFocus();
    else this.goHome();
  }

  openLaw(tag) {
    this.ui.showTab('laws');
    document.body.classList.add('rail-open');
    this.setLens({ type: 'law', id: tag });
  }

  escape() {
    const st = this.state;
    if (st.selected) this.select(null);
    else if (st.lens) this.setLens(null);
    else if (st.playing) this.pause();
  }

  // ------------------------------------------------------------------ pointer
  bindPointer() {
    const el = this.fxCanvas;
    const pointers = new Map();
    let down = null;
    let moved = false;
    let pinch = null;
    let raf = 0;
    let lastMove = null;

    const hoverAt = () => {
      raf = 0;
      if (!lastMove || down) return;
      const n = this.r.pick(lastMove.x, lastMove.y);
      el.style.cursor = n ? 'pointer' : 'grab';
      if (!this.state.selected) this.setHover(n);
      else this.dirty = true;
      this.ui.tooltip(n, lastMove.x, lastMove.y);
      this.hovering = n;
    };

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        down = { x: e.clientX, y: e.clientY };
        moved = false;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      }
    });
    el.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (prev) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        this.view.zoomAt(mx, my, d / pinch.d);
        this.view.pan(mx - pinch.mx, my - pinch.my);
        pinch = { d, mx, my };
        this.userMoved = true;
        this.dirty = true;
        return;
      }
      if (down && prev) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4) moved = true;
        if (moved) {
          this.view.pan(dx, dy);
          this.userMoved = true;
          this.dirty = true;
          el.style.cursor = 'grabbing';
          this.ui.tooltip(null);
        }
        return;
      }
      lastMove = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(hoverAt);
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0 && down) {
        if (!moved) {
          const n = this.r.pick(e.clientX, e.clientY);
          if (n) this.select(n, true);
          else if (this.state.selected) this.select(null);
        }
        down = null;
        el.style.cursor = 'grab';
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', () => {
      lastMove = null;
      this.ui.tooltip(null);
      if (!this.state.selected) this.setHover(null);
    });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      this.view.zoomAt(e.clientX, e.clientY, f);
      this.userMoved = true;
      this.dirty = true;
      this.r.rimKey = '';
    }, { passive: false });
    el.addEventListener('dblclick', (e) => {
      const t = this.view;
      const s = t.s * 2.2;
      const cx = e.clientX - (e.clientX - t.cx) * 2.2;
      const cy = e.clientY - (e.clientY - t.cy) * 2.2;
      this.userMoved = true;
      t.flyTo({ s: Math.min(s, t.base * t.maxK), cx, cy }, 500);
    });
  }
}

window.app = new App();
bindAbout();
// dev hook: try a different swirl
window.__swirl = (v) => {
  setSwirl(v);
  app.L = computeLayout(app.g);
  app.r.L = app.L;
  app.dirty = true;
};
