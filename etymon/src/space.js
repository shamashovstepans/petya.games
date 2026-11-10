// Etymon in three dimensions: the whole vocabulary as one glowing organism you can fly through.
// Distance from the core is time. This file runs the view; the pieces live beside it:
// space-layout (where things are), space-gl (how they glow), space-cam, space-labels, space-ui, space-input.

import { SpaceGL } from './space-gl.js';
import { buildSpace, hexLin } from './space-layout.js';
import { Camera } from './space-cam.js';
import { Labels } from './space-labels.js';
import { SpaceUI } from './space-ui.js';
import { bindInput } from './space-input.js';
import { rToTime, formatYear } from './langs.js';

const INTRO_SECONDS = 10;
const GROW_FROM = 0.03;
const HUD_TOP = 58;
// brightness, heat for: unrelated, same tree, descendant, on the path, the word itself
const NODE_STATE = [[0.07, 0], [0.75, 0], [1.3, 0.55], [1.6, 1], [2.2, 1]];
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Space {
  constructor(app) {
    this.app = app;
    this.g = app.g;
    this.el = document.getElementById('space');
    this.S = buildSpace(this.g);
    this.cam = new Camera();
    this.labels = new Labels(document.getElementById('sp-labels'), this.g, this.S);
    this.scr = new Float32Array(this.S.N * 3);
    this.rel = new Uint8Array(this.S.N);
    this.sel = -1;
    this.hover = -1;
    this.pointer = null;       // where the mouse is, in CSS pixels, when it is over the view
    this.dragging = false;
    this.selMix = 1;
    this.tint = 0; this.tintGoal = 0;
    this.grow = 9; this.growing = false; this.introT = 0; this.introCam = false; this.seen = false;
    this.domA = 0;
    this.time = 0;
    this.lastInput = -1e9;
    this.fit = 3.4;
    this.top = HUD_TOP;
    this.dpr = 1;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ice = new Float32Array([0.8, 0.89, 1.0]);
    this.hot = new Float32Array(hexLin('#ff5648'));
    this.domS = this.S.domains.map((d) => ({ name: d.name, pos: d.pos, s: [0, 0, 0] }));
    this.ui = new SpaceUI(this);
    try {
      this.gl = new SpaceGL(document.getElementById('sp-gl'));
      this.gl.setScene(this.S);
    } catch (err) {
      console.error(err);
      this.gl = null;
      this.ui.fail();
    }
    bindInput(this);
    this.frame = this.frame.bind(this);
    window.addEventListener('resize', () => this.active && this.resize());
  }

  // ------------------------------------------------------------------ in and out

  enter(node) {
    this.active = true;
    this.resize();
    const first = !this.seen;
    this.seen = true;
    if (first && !node && !this.reduced) this.playIntro();
    else if (first) {
      this.cam.goal.dist = this.fit;
      this.cam.snap();
    }
    if (node) this.select(this.S.index.get(node), { snap: first, remember: false });
    else this.writeHash();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  exit() {
    this.active = false;
    cancelAnimationFrame(this.raf);
  }

  resize() {
    const r = this.el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (r.width * r.height * this.dpr * this.dpr > 5.2e6) this.dpr = Math.max(1, Math.sqrt(5.2e6 / (r.width * r.height)));
    this.cam.setSize(r.width, r.height);
    this.fit = this.cam.fitDist(1.08);
    this.top = Math.max(HUD_TOP, this.ui ? this.ui.topInset() : 0);
    this.labels.resize(r.width, r.height, this.dpr);
    if (this.gl) this.gl.resize(r.width * this.dpr, r.height * this.dpr);
    if (this.sel < 0) this.cam.goal.dist = Math.min(this.cam.goal.dist, this.fit * 1.6);
    else this.cam.goal.shift = this.cardShift().shift;
  }

  playIntro() {
    this.clear({ hash: false });
    this.growing = true;
    this.introCam = true;
    this.introT = 0;
    this.grow = GROW_FROM;
    const g = this.cam.goal;
    g.target = [0, 0, 0]; g.dist = this.fit * 0.34; g.pitch = 0.3; g.shift = [0, 0];
    this.cam.snap();
    this.ui.hint(false);
  }

  home() {
    this.clear();
    const g = this.cam.goal;
    g.target = [0, 0, 0]; g.dist = this.fit; g.pitch = 0.22;
    this.introCam = false;
  }

  setTint(on) {
    this.tintGoal = on ? 1 : 0;
  }

  // ------------------------------------------------------------------ selection

  // the address of what is on screen: #3d, #3d-word, #3d-root-<id>, #3d-n<index>
  writeHash() {
    if (!this.active) return;
    const n = this.sel >= 0 ? this.g.nodes[this.sel] : null;
    this.app.writeHash(n ? `3d-${n.isRoot ? `root-${n.rootKey}` : this.app.slugFor(n) || `n${this.sel}`}`.toLowerCase() : '3d');
  }

  select(i, { snap = false, hash = true, remember = true } = {}) {
    if (i == null || i < 0) return this.clear({ hash, remember });
    if (remember && this.active && i !== this.sel) this.app.remember();
    const S = this.S, rel = this.rel;
    if (this.growing) { this.growing = false; this.grow = 9; this.ui.year(null); }
    this.introCam = false;
    this.sel = i;
    const k = S.rootIdx[i];
    for (let j = 0; j < S.N; j++) rel[j] = S.rootIdx[j] === k ? 1 : 0;
    const q = [i];
    while (q.length) {
      const j = q.pop();
      rel[j] = 2;
      for (const c of S.kids[j]) q.push(c);
    }
    for (let j = S.parent[i]; j >= 0; j = S.parent[j]) rel[j] = 3;
    rel[i] = 4;
    this.applyState(true, this.g.roots[k].domain !== 'wander');
    const node = this.g.nodes[i];
    this.ui.card(node);
    this.top = Math.max(HUD_TOP, this.ui.topInset());   // the Back button may just have appeared
    this.flyTo(snap);
    if (hash) this.writeHash();
  }

  clear({ hash = true, remember = true } = {}) {
    const had = this.sel >= 0;
    if (had && remember && this.active) this.app.remember();
    this.sel = -1;
    this.rel.fill(0);
    this.applyState(false, false);
    this.ui.card(null);
    this.cam.goal.shift = [0, 0];
    if (had && this.cam.goal.dist > this.fit) this.cam.goal.dist = this.fit;
    if (hash) this.writeHash();
  }

  // write the next brightness / heat of every node and line; the shader fades from the last one
  applyState(has, core) {
    const S = this.S, rel = this.rel, ns = S.nodeState, ss = S.segState, m = this.selMix;
    const put = (a, o, b, h) => {
      a[o] += (a[o + 2] - a[o]) * m;
      a[o + 1] += (a[o + 3] - a[o + 1]) * m;
      a[o + 2] = b;
      a[o + 3] = h;
    };
    for (let i = 0; i < S.N; i++) {
      const s = has ? NODE_STATE[rel[i]] : null;
      put(ns, i * 4, s ? s[0] : 1, s ? s[1] : 0);
    }
    put(ns, S.N * 4, has ? (core ? 0.9 : 0.4) : 1, has && core ? 0.35 : 0);
    for (let k = 0; k < S.segType.length; k++) {
      let b = 1, h = 0;
      if (has) {
        const ra = S.segSrc[k] < S.N ? rel[S.segSrc[k]] : 0, rb = rel[S.segDst[k]];
        const t = S.segType[k];
        if (t === 1) [b, h] = ra >= 2 || rb >= 2 ? [1.0, 0.5] : ra && rb ? [0.5, 0] : [0.07, 0];
        else if (rb >= 3) [b, h] = [1.8, 1];
        else if (rb === 2) [b, h] = [1.2, 0.55];
        else if (rb === 1) [b, h] = [0.8, 0];
        else [b, h] = [0.07, 0];
      }
      put(ss, k * 4, b, h);
    }
    this.selMix = this.reduced ? 1 : 0;
    if (this.gl) this.gl.setState(ns, ss);
  }

  // room the card takes: how far to slide the picture, and how much further back to stand
  cardShift() {
    const c = this.ui.cardBox();
    const w = this.cam.w, h = this.cam.h;
    if (!c) return { shift: [0, 0], scale: 1 };
    if (w > 760) return { shift: [-c.w / w, 0], scale: w / (w - c.w) };
    // on a phone the card sits below and the search box above: use the band between them
    const free = Math.max(120, h - c.h - this.top);
    return { shift: [0, (c.h - this.top) / h], scale: (1.14 * Math.min(w, h)) / Math.min(w, free) };
  }

  // stand side-on to the branch: its whole journey across the screen, everything else out of focus
  flyTo(snap) {
    const S = this.S, P = S.pos, rel = this.rel, cam = this.cam, g = cam.goal;
    const lo = [9, 9, 9], hi = [-9, -9, -9];
    for (let i = 0; i < S.N; i++) {
      if (rel[i] < 2) continue;
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], P[i * 3 + k]);
        hi[k] = Math.max(hi[k], P[i * 3 + k]);
      }
    }
    for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], 0); hi[k] = Math.max(hi[k], 0); }
    const c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    let R = 0.08;
    for (let i = 0; i < S.N; i++) {
      if (rel[i] >= 2) R = Math.max(R, Math.hypot(P[i * 3] - c[0], P[i * 3 + 1] - c[1], P[i * 3 + 2] - c[2]));
    }
    R = Math.max(R, Math.hypot(c[0], c[1], c[2]));
    const s = this.sel * 3;
    const al = Math.hypot(P[s], P[s + 1], P[s + 2]) || 1;
    const a = [P[s] / al, P[s + 1] / al, P[s + 2] / al];
    const o0 = Camera.offset(g.yaw, g.pitch);
    const d = o0[0] * a[0] + o0[1] * a[1] + o0[2] * a[2];
    let o = [o0[0] - a[0] * d, o0[1] - a[1] * d, o0[2] - a[2] * d];
    let ol = Math.hypot(o[0], o[1], o[2]);
    if (ol < 0.15) { o = [a[2], 0, -a[0]]; ol = Math.hypot(o[0], o[1], o[2]) || 1; }
    const pitch = Math.min(1.1, Math.max(-1.1, Math.asin(o[1] / ol)));
    let yaw = Math.atan2(o[0], o[2]);
    yaw += Math.PI * 2 * Math.round((g.yaw - yaw) / (Math.PI * 2));
    const { shift, scale } = this.cardShift();
    g.target = c; g.yaw = yaw; g.pitch = pitch; g.shift = shift;
    g.dist = Math.min(this.fit * scale, Math.max(0.3, cam.fitDist(R * 1.12) * scale));
    if (snap || this.reduced) cam.snap();
  }

  // ------------------------------------------------------------------ picking

  pick(x, y) {
    const li = this.labels.hit(x, y);
    if (li >= 0) return li;
    const S = this.S, scr = this.scr, rel = this.rel, nodes = this.g.nodes;
    const has = this.sel >= 0, focus = this.cam.dist;
    let best = -1, bs = 400;
    for (let i = 0; i < S.N; i++) {
      const d = scr[i * 3 + 2];
      if (d <= 0 || S.rad[i] >= this.grow) continue;
      const dx = scr[i * 3] - x, dy = scr[i * 3 + 1] - y;
      const q = dx * dx + dy * dy;
      if (q > 324) continue;
      const blur = Math.abs(1 - focus / d);
      if (blur > 0.6) continue;
      let s = q * (1 + blur * 4);
      if (has && rel[i] === 0) s *= 3;
      if (!nodes[i].isEn && !nodes[i].isRoot) s *= 1.5;
      if (s < bs) { bs = s; best = i; }
    }
    return best;
  }

  // ------------------------------------------------------------------ every frame

  frame(now) {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    const cam = this.cam, S = this.S, g = cam.goal;

    if (this.growing) {
      this.introT = Math.min(1, this.introT + dt / INTRO_SECONDS);
      const e = this.introT;
      this.grow = GROW_FROM + (S.maxRad + 0.04 - GROW_FROM) * (e * e * (3 - 2 * e) * 0.6 + e * 0.4);
      this.ui.year(formatYear(Math.round(rToTime(Math.min(1, this.grow)) / 10) * 10, { approx: this.grow < 0.4 }));
      if (this.introCam) {
        g.dist = this.fit * (0.34 + 0.66 * smooth(0, 1, e));
        g.yaw += dt * 0.11;
      }
      if (e >= 1) {
        this.growing = false;
        this.introCam = false;
        this.grow = 9;
        this.ui.year(null);
        this.ui.hint(true);
      }
    } else if (!this.reduced && !this.dragging && now - this.lastInput > 3500) {
      g.yaw += dt * (this.sel >= 0 ? 0.018 : 0.04);
    }
    if (this.sel < 0 && g.dist > this.fit * 0.8) {
      const k = Math.exp(-dt * 1.6);
      g.target[0] *= k; g.target[1] *= k; g.target[2] *= k;
    }
    cam.step(dt);
    this.selMix = Math.min(1, this.selMix + dt / 0.55);
    this.tint += (this.tintGoal - this.tint) * (1 - Math.exp(-dt * 4));

    // every node, on screen
    const m = cam.vp, w = cam.w, h = cam.h, P = S.pos, scr = this.scr;
    for (let i = 0, o = 0; i < S.N; i++, o += 3) {
      const x = P[o], y = P[o + 1], z = P[o + 2];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw < 0.02) { scr[o + 2] = 0; continue; }
      scr[o] = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw * 0.5 + 0.5) * w;
      scr[o + 1] = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw * 0.5) * h;
      scr[o + 2] = cw;
    }
    const hover = this.pointer && !this.dragging ? this.pick(this.pointer[0], this.pointer[1]) : -1;
    if (hover !== this.hover) {
      this.hover = hover;
      this.el.classList.toggle('is-hot', hover >= 0);
    }

    const zoom = this.fit / cam.dist;
    const H = h * this.dpr;
    const c = [0, 0, 0];
    const seen = cam.project(0, 0, 0, c);
    if (this.gl) {
      this.gl.render({
        vp: m, pxScale: cam.pxScale * this.dpr, focus: cam.dist,
        aperture: H * 0.011 * (0.62 + 0.38 * smooth(1.1, 2.6, zoom)), maxCoc: H * (this.sel >= 0 ? 0.036 : 0.05),
        grow: this.grow, time: this.time, tint: this.tint, selMix: this.selMix, dpr: this.dpr,
        fog: 0.85, ice: this.ice, hot: this.hot, line: 0.0011, pulse: this.reduced ? 0 : 1, dustGain: 1,
        bloom: 1.0, exposure: 1.0, tanHalf: cam.tanHalf, right: cam.right, up: cam.up, fwd: cam.fwd,
        glow: seen ? [c[0] / w, 1 - c[1] / h, (0.95 * cam.pxScale) / c[2] / h, this.growing ? smooth(0, 0.5, this.introT) : 1] : [0.5, 0.5, 1, 0],
        shift: [-cam.shift[0], -cam.shift[1]],
      });
    }

    const domGoal = (this.growing ? smooth(0.55, 0.95, this.introT) : 1) * (this.sel >= 0 ? 0 : 1) * smooth(0.5, 0.8, 1 / zoom);
    this.domA += (domGoal - this.domA) * (1 - Math.exp(-dt * 5));
    for (const d of this.domS) if (!cam.project(d.pos[0], d.pos[1], d.pos[2], d.s)) d.s[2] = 0;
    this.labels.draw({
      scr, rel: this.rel, hasSel: this.sel >= 0, hover: this.hover, selected: this.sel, grow: this.grow,
      focus: cam.dist, pxScale: cam.pxScale, fit: this.fit, top: this.top, time: this.time,
      domains: this.domS, domainAlpha: this.domA, growing: this.growing,
      ball: seen ? [c[0], c[1], cam.pxScale / c[2]] : [w / 2, h / 2, 1],
    }, dt);
  }
}
