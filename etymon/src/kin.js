// Etymon, languages: a globe of languages, and how they cross.
// Every dot is a word. A language is a patch of the surface with its older stages underneath;
// its own words fill the middle of the patch and what it took from others fills the rim.
// This file is the controller: what is chosen, where the camera goes, the address in the bar.

import { SpaceGL } from './space-gl.js';
import { Camera } from './space-cam.js';
import { bindInput } from './space-input.js';
import { cross, dot, norm } from './space-layout.js';
import { loadKin } from './kin-data.js';
import { buildTree } from './kin-tree.js';
import { buildLayout } from './kin-layout.js';
import { buildMesh } from './kin-mesh.js';
import { relWord, relLang, relPair, relSet } from './kin-select.js';
import { slugOf, parseSlug, titleOf, warmIndex } from './kin-addr.js';
import { KinLabels } from './kin-labels.js';
import { KinUI } from './kin-ui.js';
import { drawFrame, pickAt, GROW_FROM, INTRO_TURN } from './kin-view.js';

const HUD_TOP = 58;
// The light is laid over itself a hundred times, so its cost is the number of pixels. This many to
// begin with, whatever the screen; fewer if frames come slowly.
const SCENE_PIXELS = 1.7e6;

// With nothing chosen the words carry the picture and the roads between languages are a haze:
// a line by its kind (1 inside a language, 2 handed down, 3 carried across).
const REST_NODE = 0.55, REST_SEG = [1, 0.8, 0.2, 0.12], REST_CORE = 0.7;

// brightness and heat, by how a form stands to what is chosen (0 nothing to do with it … 4 the thing itself)
const NODE_STATE = {
  word: [[0.012, 0], [0.7, 0], [1.1, 0.25], [1.6, 0.9], [2.2, 1]],
  set: [[0.012, 0], [0.7, 0], [1.0, 0.3], [1.7, 0.9], [1.7, 0.9]],
  lang: [[0.025, 0], [0.1, 0], [0.34, 0], [0.5, 0], [0.5, 0]],
  pair: [[0.03, 0], [0.1, 0], [0.5, 0], [0.8, 0], [0.8, 0]],
};
// a line takes the lesser of its two ends
const SEG_STATE = {
  word: [[0.012, 0], [3, 0], [4, 0.3], [6, 1], [6, 1]],
  set: [[0.012, 0], [3, 0], [4.5, 0.5], [4.5, 0.5], [4.5, 0.5]],
  lang: [[0.012, 0], [0.06, 0], [0.26, 0], [0.7, 0], [0.7, 0]],
  pair: [[0.015, 0], [0.05, 0], [0.55, 0], [0.55, 0], [0.55, 0]],
};

// What is lit is lit by how much of it there is: a language of thirty thousand words must not burn
// white, and one of three hundred must not be lost. n[r] counts the forms that stand at r.
const amp = (n, ref, lo, hi) => Math.min(hi, Math.max(lo, Math.sqrt(ref / Math.max(1, n))));
function levels(kind, n) {
  const nt = NODE_STATE[kind].map((p) => p.slice()), sg = SEG_STATE[kind].map((p) => p.slice());
  const mul = (t, r, k) => { t[r][0] *= k; };
  if (kind === 'lang') {
    mul(nt, 3, amp(n[3], 30000, 1, 2.2)); mul(nt, 2, amp(n[2], 20000, 1, 2.5));
    mul(sg, 3, amp(n[3], 30000, 1, 1.6)); mul(sg, 2, amp(n[2], 20000, 1, 5));
  } else if (kind === 'pair') {
    const k = amp(n[3], 8000, 0.7, 4);
    mul(nt, 3, amp(n[3], 8000, 1, 2)); mul(sg, 2, k); mul(sg, 3, k);
  } else {
    const k1 = amp(n[1], 400, 0.2, 1), k2 = amp(n[2], 250, 0.25, 1);
    mul(nt, 1, Math.sqrt(k1)); mul(sg, 1, k1); mul(nt, 2, Math.sqrt(k2)); mul(sg, 2, k2);
  }
  return [nt, sg];
}

export class Kin {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('kin');
    this.cam = new Camera();
    this.sel = -1;        // what the pointer code sees: a form, N + a language, or N + S for anything wider
    this.what = null;     // { kind: 'word', i } | { kind: 'lang', s } | { kind: 'pair', a, b } | { kind: 'set', list, title }
    this.at = null;       // the points the eye rests on
    this.hover = -1;
    this.pointer = null;
    this.dragging = false;
    this.selMix = 1;
    this.grow = 9;
    this.growing = false;
    this.introT = 0;
    this.introCam = false;
    this.seen = false;
    this.want = null;
    this.time = 0;
    this.lastInput = -1e9;
    this.fit = 3.7;
    this.focus = 2.7;
    this.top = HUD_TOP;
    this.dpr = 1;         // device pixels per CSS pixel for the words: as sharp as the screen, up to 2
    this.rs = 0;          // and for the light behind them: what this machine keeps up with (kin-view.js paces it)
    this.rsMax = 1;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ice = new Float32Array([0.8, 0.89, 1.0]);
    this.hot = new Float32Array([1.0, 0.93, 0.8]);
    this.ui = new KinUI(this);
    try { this.gl = new SpaceGL(document.getElementById('kn-gl')); } catch { this.gl = null; this.ui.fail(); }
    bindInput(this, document.getElementById('kn-gl'));
    this.frame = this.frame.bind(this);
    window.addEventListener('resize', () => { if (this.active) this.resize(); });
    this.ready = loadKin().then((K) => this.build(K)).catch((e) => {
      console.error(e);
      this.ui.fail('The language data did not load.');
    });
  }

  // The data is here: every word gets its place, and the places go to the renderer. In steps, with a
  // breath between, so that the page does not stand still for the whole of it.
  async build(K) {
    const breath = () => new Promise((r) => setTimeout(r, 0));
    const T = buildTree(K);
    await breath();
    const L = buildLayout(K, T);
    await breath();
    const M = buildMesh(K, T, L), et = L.etype;
    for (let i = 0; i < K.N; i++) M.nodeState[i * 4] = M.nodeState[i * 4 + 2] = REST_NODE;
    M.nodeState[K.N * 4] = M.nodeState[K.N * 4 + 2] = REST_CORE;
    for (let q = 0; q < M.segNode.length; q++) M.segState[q * 4] = M.segState[q * 4 + 2] = REST_SEG[et[M.segNode[q]]];
    await breath();
    Object.assign(this, { K, T, L });
    this.scr = new Float32Array(K.N * 3);
    this.rel = new Uint8Array(K.N);
    this.labels = new KinLabels(document.getElementById('kn-labels'), this);
    try { if (this.gl) this.gl.setScene(M); } catch (e) { console.error(e); this.gl = null; this.ui.fail(); }
    this.M = M;   // from here on the view counts as built
    this.ui.ready();
    if (this.active) this.start();
    setTimeout(() => warmIndex(K), 300);
  }

  // slug: an address to open ('' the plain view), or null to stay with whatever was here before
  enter(slug = null) {
    this.active = true;
    this.want = slug;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
    if (this.M) this.start();
  }

  exit() {
    this.active = false;
    cancelAnimationFrame(this.raf);
  }

  // the data is here and the view is on screen
  start() {
    this.resize();
    const first = !this.seen, what = this.parse(this.want), panel = this.ui.panel.open;
    this.seen = true;
    if (first && !what && !panel && !this.reduced) this.playIntro();
    else if (first) { Object.assign(this.cam.goal, this.homeView(), { dist: this.fit }); this.rest(false); this.cam.snap(); }
    if (what) this.show(what, { snap: first, remember: false });
    else if (this.want === '' && this.sel >= 0) this.clear({ remember: false });
    else this.writeHash();
    this.want = null;
  }

  // go to an address while already here (Back, or a link)
  open(slug, opts = { remember: false }) {
    if (!this.M) { this.want = slug || ''; return; }
    const what = this.parse(slug);
    if (what) this.show(what, opts);
    else this.clear(opts);
  }

  resize() {
    const r = this.el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.rsMax = Math.min(this.dpr, Math.max(0.6, Math.sqrt(SCENE_PIXELS / (r.width * r.height))));
    this.rs = Math.min(this.rs || this.rsMax, this.rsMax);
    this.cam.setSize(r.width, r.height);
    this.fit = this.cam.fitDist(1.2);
    this.top = Math.max(HUD_TOP, this.ui.topInset());
    if (this.labels) this.labels.resize(r.width, r.height, this.dpr);
    this.rescale();
    if (this.sel < 0 && !this.ui.panel.open) this.cam.goal.dist = Math.min(this.cam.goal.dist, this.fit * 1.6);
    else this.cam.goal.shift = this.cardShift().shift;
  }

  // the light is drawn at rs pixels to the CSS pixel and stretched over the screen
  rescale() {
    if (this.gl) this.gl.resize(this.cam.w * this.rs, this.cam.h * this.rs);
  }

  playIntro() {
    this.clear();
    this.growing = true;
    this.introCam = true;
    this.introT = 0;
    this.grow = GROW_FROM;
    const g = this.cam.goal;
    g.target = [0, 0, 0]; g.dist = this.fit * 0.42; g.pitch = 0.3; g.shift = [0, 0];
    // the turn of the growth ends on the resting view
    this.homeAt = this.homeView();
    g.yaw = this.homeAt.yaw - INTRO_TURN;
    this.cam.snap();
    this.ui.hint(false);
  }

  // The resting view: English in front, turned a little toward French, so that the Romance rim of
  // English and the Romance languages it came from are in one picture.
  homeView() {
    const { K, T } = this, a = K.byId.get('en'), b = K.byId.get('fr'), d = [0, 0, 0];
    if (a == null) return { yaw: 0, pitch: 0.22 };
    for (let x = 0; x < 3; x++) d[x] = T.dir[a * 3 + x] * 0.7 + (b == null ? 0 : T.dir[b * 3 + x] * 0.3);
    return { yaw: Math.atan2(d[0], d[2]), pitch: Math.asin(d[1] / Math.hypot(d[0], d[1], d[2])) };
  }

  home() {
    this.ui.panel.shut();
    this.clear();
    const g = this.cam.goal, h = this.homeView();
    g.target = [0, 0, 0]; g.dist = this.fit; g.pitch = h.pitch;
    g.yaw = h.yaw + Math.PI * 2 * Math.round((g.yaw - h.yaw) / (Math.PI * 2));   // the short way round
    this.introCam = false;
  }

  // ------------------------------------------------------------------ addresses

  slug(what = this.what) { return slugOf(this.K, what); }
  title(what = this.what) { return titleOf(this.K, what); }
  parse(slug) { return parseSlug(this.K, slug, (key) => this.ui.finding(key)); }

  writeHash() {
    if (!this.active) return;
    const s = this.slug() || this.ui.panel.slug();
    this.app.writeHash(s ? `languages-${s}` : 'languages');
  }

  // ------------------------------------------------------------------ selection

  // from the pointer: a form, or N + a language
  select(i, opts) {
    if (i == null || i < 0) return this.clear(opts);
    const N = this.K.N, w = this.what;
    // a second language while one is chosen: the two side by side
    if (i >= N && w?.kind === 'lang' && w.s !== i - N) return this.show({ kind: 'pair', a: w.s, b: i - N }, opts);
    return this.show(i < N ? { kind: 'word', i } : { kind: 'lang', s: i - N }, opts);
  }

  show(what, { snap = false, hash = true, remember = true } = {}) {
    const { K, T, L } = this, P = L.pos;
    if (remember && this.active && this.slug(what) !== this.slug()) this.app.remember();
    if (this.growing) { this.growing = false; this.grow = 9; this.ui.year(null); }
    this.introCam = false;
    const centre = (s) => [T.dir[s * 3] * T.rad[s], T.dir[s * 3 + 1] * T.rad[s], T.dir[s * 3 + 2] * T.rad[s]];
    let view;
    this.at = null;
    if (what.kind === 'word') {
      view = relWord(K, L, what.i, this.rel);
      if (view.tilt) this.at = [[P[what.i * 3], P[what.i * 3 + 1], P[what.i * 3 + 2]]];
    } else if (what.kind === 'lang') {
      view = relLang(K, T, L, what.s, this.rel);
      if (what.s) this.at = [centre(what.s)];
    } else if (what.kind === 'pair') {
      const r = relPair(K, T, L, what.a, what.b, this.rel);
      view = r.view;
      what.shared = r.shared;
      if (what.a && what.b) this.at = [centre(what.a), centre(what.b)];
    } else view = relSet(K, L, what.list, this.rel, what.paths !== false);
    this.what = what;
    this.sel = what.kind === 'word' ? what.i : what.kind === 'lang' ? K.N + what.s : K.N + T.S;
    this.applyState(what.kind);
    this.ui.card(what);
    this.top = Math.max(HUD_TOP, this.ui.topInset());
    this.flyTo(view, snap);
    if (hash) this.writeHash();
  }

  clear({ hash = true, remember = true } = {}) {
    const had = this.sel >= 0;
    if (had && remember && this.active) this.app.remember();
    this.sel = -1;
    this.what = null;
    this.at = null;
    if (this.M) { this.rel.fill(0); this.applyState(null); }
    this.ui.card(null);
    this.rest(had);
    if (hash) this.writeHash();
  }

  // the picture with nothing chosen: whole, and clear of the panel if that is open
  rest(pull = true) {
    const { shift, scale } = this.cardShift(), g = this.cam.goal;
    g.shift = shift;
    if (scale > 1) g.dist = this.fit * scale;
    else if (pull && g.dist > this.fit) g.dist = this.fit;
  }

  // the panel came or went: make room for it, or take the room back
  reframe() {
    if (!this.M) return;
    if (this.what) this.show(this.what, { remember: false });
    else { this.ui.card(null); this.rest(); this.writeHash(); }
  }

  applyState(kind) {
    const M = this.M, rel = this.rel, par = this.K.par, ns = M.nodeState, ss = M.segState, m = this.selMix, et = this.L.etype;
    let nt = null, sg = null;
    if (kind) {
      const n = [0, 0, 0, 0, 0];
      for (let i = 0; i < M.N; i++) n[rel[i]]++;
      [nt, sg] = levels(NODE_STATE[kind] ? kind : 'word', n);
    }
    const put = (a, o, b, h) => {
      a[o] += (a[o + 2] - a[o]) * m; a[o + 1] += (a[o + 3] - a[o + 1]) * m;
      a[o + 2] = b; a[o + 3] = h;
    };
    for (let i = 0; i < M.N; i++) { const s = nt ? nt[rel[i]] : null; put(ns, i * 4, s ? s[0] : REST_NODE, s ? s[1] : 0); }
    put(ns, M.N * 4, nt ? 0.4 : REST_CORE, 0);
    const seg = M.segNode;
    for (let k = 0; k < seg.length; k++) {
      const i = seg[k], s = sg ? sg[Math.min(rel[i], rel[par[i]])] : null;
      put(ss, k * 4, s ? s[0] : REST_SEG[et[i]], s ? s[1] : 0);
    }
    this.selMix = this.reduced ? 1 : 0;
    if (this.gl) this.gl.setState(ns, ss);
  }

  // room the card takes: how far to slide the picture, and how much further back to stand
  cardShift() {
    const c = this.ui.cardBox(), w = this.cam.w, h = this.cam.h;
    if (!c) return { shift: [0, 0], scale: 1 };
    if (w > 760) return { shift: [-c.w / w, 0], scale: w / (w - c.w) };
    const free = Math.max(120, h - c.h - this.top);
    return { shift: [0, (c.h - this.top) / h], scale: (1.14 * Math.min(w, h)) / Math.min(w, free) };
  }

  // look at v.target from v.dir, held v.tilt short of it on the side the camera is on now
  flyTo(v, snap) {
    const cam = this.cam, g = cam.goal;
    let o = Camera.offset(g.yaw, g.pitch);
    if (v.dir) {
      const d = v.dir, k = dot(o, d);
      let t = [o[0] - d[0] * k, o[1] - d[1] * k, o[2] - d[2] * k];
      t = Math.hypot(t[0], t[1], t[2]) > 1e-3 ? norm(t) : norm(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
      const c = Math.cos(v.tilt), s = Math.sin(v.tilt);
      o = [d[0] * c + t[0] * s, d[1] * c + t[1] * s, d[2] * c + t[2] * s];
    }
    let yaw = Math.atan2(o[0], o[2]);
    yaw += Math.PI * 2 * Math.round((g.yaw - yaw) / (Math.PI * 2));
    const { shift, scale } = this.cardShift();
    g.target = v.target.slice();
    g.yaw = yaw;
    g.pitch = Math.min(1.2, Math.max(-1.2, Math.asin(Math.max(-1, Math.min(1, o[1])))));
    g.shift = shift;
    g.dist = Math.min(this.fit * scale, Math.max(0.28, cam.fitDist(v.R) * scale));
    if (snap || this.reduced) cam.snap();
  }

  pick(x, y) { return pickAt(this, x, y); }

  frame(now) {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.frame);
    // Nothing asked for and nothing in flight: for a slow turn every other frame is enough.
    if (this.pointer !== this.ptrSeen) { this.ptrSeen = this.pointer; this.ptrAt = now; }
    this.calm = !this.growing && !this.dragging && this.selMix >= 1 && now - this.lastInput > 5000 && now - (this.ptrAt || 0) > 1500;
    if (this.calm && (this.odd = !this.odd)) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    if (this.M) drawFrame(this, dt, now);
  }
}
