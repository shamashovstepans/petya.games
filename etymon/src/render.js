// Canvas renderer: a static-ish base layer (rings, branches, nodes, labels)
// and an always-animating fx layer (sap particles, births, the time front).

import { FAMILIES, T_MAX, formatYear, timeToR } from './langs.js';
import { LAWS } from './laws.js';
import { RINGS } from './content.js';
import { bez, bezHead } from './layout.js';

const TAU = Math.PI * 2;
const BG = '#07080d';
const GOLD = [232, 199, 122];
const VELLUM = [236, 232, 223];

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// flow classes: how many English words pass through an edge
const FLOW_W = [0.7, 1.0, 1.6, 2.4, 3.4];
const FLOW_A = [0.4, 0.46, 0.5, 0.52, 0.55];
export const flowClass = (n) => (n <= 1 ? 0 : n <= 3 ? 1 : n <= 8 ? 2 : n <= 18 ? 3 : 4);

export const FONT_FORM = '"Gentium Book Plus", "Gentium Plus", Georgia, serif';
export const FONT_DISPLAY = '"Cormorant Garamond", "Gentium Book Plus", Georgia, serif';

export class Renderer {
  constructor({ base, fx, g, L, view, state }) {
    Object.assign(this, { base, fx, g, L, view, state });
    this.b = base.getContext('2d');
    this.f = fx.getContext('2d');
    this.dpr = 1;
    this.w = 0;
    this.h = 0;
    this.col = {};
    this.bright = {};
    for (const [k, v] of Object.entries(FAMILIES)) {
      this.col[k] = hexToRgb(v.color);
      this.bright[k] = mix(hexToRgb(v.color), [255, 255, 255], 0.38);
    }
    this.sprites = {};
    for (const k of Object.keys(FAMILIES)) this.sprites[k] = this.makeSprite(this.bright[k]);
    this.sprites.gold = this.makeSprite(GOLD);
    this.particles = [];
    this.births = [];
    this.tips = [];
    this.rimLabels = [];
    this.rimKey = '';
    this.rootEdges = g.edges.filter((e) => e.source.isRoot && e.primary);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.innerNodes = g.nodes.filter((n) => !n.isEn);
  }

  makeSprite(c) {
    const S = 32;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const x = cv.getContext('2d');
    const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, rgba(mix(c, [255, 255, 255], 0.5), 1));
    gr.addColorStop(0.18, rgba(c, 0.85));
    gr.addColorStop(0.45, rgba(c, 0.22));
    gr.addColorStop(1, rgba(c, 0));
    x.fillStyle = gr;
    x.fillRect(0, 0, S, S);
    return cv;
  }

  resize(w, h) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    for (const c of [this.base, this.fx]) {
      c.width = Math.round(w * this.dpr);
      c.height = Math.round(h * this.dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
    this.rimKey = '';
  }

  // ------------------------------------------------------------------ base
  draw() {
    const { b: ctx, view: v, state: st, g } = this;
    const dpr = this.dpr;
    const s = v.s;
    const k = v.k;
    const px = 1 / s;
    const tR = st.tR;
    const F = st.focus;
    const grown = st.time >= T_MAX - 0.5;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.base.width, this.base.height);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * v.cx, dpr * v.cy);

    this.drawRings(ctx, px, tR);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // spokes from the PIE core to each root
    const spokes = new Path2D();
    for (const r of g.roots) {
      const n = r.node;
      if (n.lang !== 'PIE' || n.r > tR) continue;
      spokes.moveTo(0, 0);
      spokes.lineTo(n.x, n.y);
    }
    ctx.strokeStyle = rgba(GOLD, F ? 0.035 : 0.07);
    ctx.lineWidth = 0.6 * px;
    ctx.stroke(spokes);

    // branches, batched by family and by how many words flow through them:
    // trunks are thick, twigs thin, like the veins of a leaf
    const dim = F ? 0.26 : 1;
    const wBranch = Math.min(1.5, 0.75 + 0.12 * Math.log2(k + 1)) * px;
    const paths = {};
    const ghosts = new Path2D();
    for (const e of g.edges) {
      if (!e.primary) continue;
      if (e.ra >= tR) continue;
      let gm = e.g;
      if (e.rc > tR) gm = bezHead(gm, Math.max(0, Math.min(1, (tR - e.ra) / (e.rc - e.ra))));
      let p;
      if (!e.target.alive) p = ghosts;
      else {
        const key = `${e.target.family}|${e.flow}`;
        p = paths[key] ||= new Path2D();
      }
      p.moveTo(gm[0], gm[1]);
      p.bezierCurveTo(gm[2], gm[3], gm[4], gm[5], gm[6], gm[7]);
    }
    for (const [key, p] of Object.entries(paths)) {
      const [fam, fl] = key.split('|');
      const f = +fl;
      ctx.lineWidth = wBranch * FLOW_W[f];
      ctx.strokeStyle = rgba(this.col[fam], FLOW_A[f] * dim);
      ctx.stroke(p);
    }
    ctx.lineWidth = wBranch;
    ctx.strokeStyle = rgba(VELLUM, 0.025);
    ctx.stroke(ghosts);

    // English life-lines: from the year a word entered English out to the rim
    const lines = {};
    const rNow = Math.min(tR, 1);
    for (const w of g.words) {
      if (!w.alive || w.rEntry >= rNow) continue;
      const c = Math.cos(w.theta);
      const sn = Math.sin(w.theta);
      const p = (lines[w.family] ||= new Path2D());
      p.moveTo(w.rEntry * c, w.rEntry * sn);
      p.lineTo(rNow * c, rNow * sn);
    }
    ctx.lineWidth = Math.max(0.5, wBranch * s * 0.7) * px;
    for (const [fam, p] of Object.entries(lines)) {
      const c = mix(this.col[fam], VELLUM, 0.2);
      const gr = ctx.createRadialGradient(0, 0, 0.36, 0, 0, 1);
      gr.addColorStop(0, rgba(c, 0.2 * dim));
      gr.addColorStop(0.55, rgba(c, 0.1 * dim));
      gr.addColorStop(1, rgba(c, 0.05 * dim));
      ctx.strokeStyle = gr;
      ctx.stroke(p);
    }

    // bridges: one word reached from two roots
    const bridges = new Path2D();
    for (const e of g.edges) {
      if (e.primary || e.rc > tR) continue;
      if (!e.target.alive) continue;
      const gm = e.g;
      bridges.moveTo(gm[0], gm[1]);
      bridges.bezierCurveTo(gm[2], gm[3], gm[4], gm[5], gm[6], gm[7]);
    }
    ctx.strokeStyle = rgba(GOLD, F ? 0.03 : 0.085);
    ctx.lineWidth = 0.7 * px;
    ctx.stroke(bridges);

    // focus overlay
    if (F) this.drawFocus(ctx, px, tR, wBranch, k);

    // nodes
    ctx.globalCompositeOperation = 'source-over';
    this.drawNodes(ctx, px, tR, k, F);

    // labels (screen space)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawRingLabels(ctx, tR);
    const spread = F && F.words.size <= 64;
    if (!spread && (!F || F.kind !== 'lineage')) this.drawDomainLabels(ctx, k);
    if (grown || st.time > 1990) this.drawRimLabels(ctx, k, F);
    this.drawInnerLabels(ctx, k, tR, F);
  }

  drawRings(ctx, px, tR) {
    ctx.lineWidth = px;
    for (const ring of this.ringRadii) {
      if (ring.r > tR + 1e-6) continue;
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, TAU);
      ctx.strokeStyle = 'rgba(236,232,223,0.055)';
      ctx.stroke();
    }
    if (tR >= 1) {
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, TAU);
      ctx.strokeStyle = 'rgba(232,199,122,0.16)';
      ctx.stroke();
    }
    // the core: the reconstructed past
    const gr = this.b.createRadialGradient(0, 0, 0, 0, 0, 0.13);
    gr.addColorStop(0, 'rgba(243,230,196,0.10)');
    gr.addColorStop(0.5, 'rgba(243,230,196,0.03)');
    gr.addColorStop(1, 'rgba(243,230,196,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(0, 0, 0.13, 0, TAU);
    ctx.fill();
  }

  drawFocus(ctx, px, tR, wBranch, k) {
    const { g, state: st } = this;
    const F = st.focus;
    const paths = {};
    const lawP = new Path2D();
    for (const e of F.edges) {
      if (e.ra >= tR || !e.target.alive) continue;
      let gm = e.g;
      if (e.rc > tR) gm = bezHead(gm, Math.max(0, Math.min(1, (tR - e.ra) / (e.rc - e.ra))));
      const isBridge = !e.primary;
      const key = isBridge ? '__bridge' : e.uncertain ? `?${e.target.family}` : e.target.family;
      const p = (paths[key] ||= new Path2D());
      p.moveTo(gm[0], gm[1]);
      p.bezierCurveTo(gm[2], gm[3], gm[4], gm[5], gm[6], gm[7]);
      if (F.lawEdges && F.lawEdges.has(e)) {
        lawP.moveTo(gm[0], gm[1]);
        lawP.bezierCurveTo(gm[2], gm[3], gm[4], gm[5], gm[6], gm[7]);
      }
    }
    for (const [key, p] of Object.entries(paths)) {
      if (key === '__bridge') {
        ctx.strokeStyle = rgba(GOLD, 0.55);
        ctx.lineWidth = 1.1 * px;
      } else {
        const fam = key.replace('?', '');
        ctx.strokeStyle = rgba(this.bright[fam], 0.85);
        ctx.lineWidth = wBranch * 1.7;
        // debated steps are dashed
        if (key[0] === '?') ctx.setLineDash([4 * px, 3 * px]);
      }
      ctx.stroke(p);
      ctx.setLineDash([]);
    }
    if (F.lawEdges) {
      ctx.strokeStyle = rgba(GOLD, 0.95);
      ctx.lineWidth = wBranch * 2.6;
      ctx.stroke(lawP);
      // laws that ran inside English light up the years they ran, on each word's life-line
      const band = this.lawBand(F.law, tR);
      if (band) {
        ctx.strokeStyle = rgba(GOLD, 0.9);
        ctx.lineWidth = wBranch * 2.4;
        ctx.stroke(band);
      }
    }
    // life-lines of focus words
    const lines = {};
    const rNow = Math.min(tR, 1);
    for (const w of F.words) {
      if (!w.alive || w.rEntry >= rNow) continue;
      const c = Math.cos(w.theta);
      const sn = Math.sin(w.theta);
      const p = (lines[w.family] ||= new Path2D());
      p.moveTo(w.rEntry * c, w.rEntry * sn);
      p.lineTo(rNow * c, rNow * sn);
    }
    for (const [fam, p] of Object.entries(lines)) {
      ctx.strokeStyle = rgba(this.bright[fam], 0.55);
      ctx.lineWidth = 1.1 * px;
      ctx.stroke(p);
    }
  }

  // Path of life-line segments inside a law's era, for words the law changed after
  // they were already English (vowel shift, silent letters, respellings...).
  lawBand(id, tR) {
    const law = LAWS[id]?.parent ? LAWS[LAWS[id].parent] : LAWS[id];
    if (!law || !law.era) return null;
    const r0 = timeToR(law.era[0]);
    const r1 = Math.min(timeToR(law.era[1]), tR);
    if (r1 <= r0) return null;
    const p = new Path2D();
    let any = false;
    for (const e of this.g.law[id].edges) {
      const w = e.target;
      if (!w.isEn) continue;
      const a = Math.max(r0, w.rEntry);
      if (a >= r1) continue;
      const c = Math.cos(w.theta);
      const sn = Math.sin(w.theta);
      p.moveTo(a * c, a * sn);
      p.lineTo(r1 * c, r1 * sn);
      any = true;
    }
    return any ? p : null;
  }

  drawNodes(ctx, px, tR, k, F) {
    const { g } = this;
    const nk = Math.pow(k, 0.38);
    // inner nodes
    const byFam = {};
    const rIn = 1.15 * nk * px;
    for (const n of this.innerNodes) {
      if (n.isRoot || n.r > tR) continue;
      if (F && !F.nodes.has(n)) continue;
      const p = (byFam[n.alive ? n.family : '__ghost'] ||= new Path2D());
      const rr = F ? rIn * 1.5 : rIn;
      p.moveTo(n.x + rr, n.y);
      p.arc(n.x, n.y, rr, 0, TAU);
    }
    for (const [fam, p] of Object.entries(byFam)) {
      ctx.fillStyle = fam === '__ghost' ? 'rgba(236,232,223,0.06)' : rgba(this.bright[fam], F ? 1 : 0.8);
      ctx.fill(p);
    }
    // arrivals: the moment each word entered English
    {
      const byF = {};
      const rr = (F ? 1.25 : 0.95) * nk * px;
      for (const w of g.words) {
        if (!w.alive || w.rEntry > tR) continue;
        if (F && !F.words.has(w)) continue;
        const x = w.rEntry * Math.cos(w.theta);
        const y = w.rEntry * Math.sin(w.theta);
        const p = (byF[w.family] ||= new Path2D());
        p.moveTo(x + rr, y);
        p.arc(x, y, rr, 0, TAU);
      }
      for (const [fam, p] of Object.entries(byF)) {
        ctx.fillStyle = rgba(mix(this.bright[fam], VELLUM, 0.3), F ? 0.95 : 0.6);
        ctx.fill(p);
      }
    }
    // rim dots: every living English word, sized by how often it is used
    if (tR >= 0.999) {
      const byF = {};
      for (const w of g.words) {
        if (!w.alive) continue;
        const inF = F && F.words.has(w);
        if (F && !inF) continue;
        const rr = (0.45 + Math.max(0, w.zipf - 1) * 0.42) * Math.min(nk, 2.2) * px * (inF ? 1.25 : 1);
        const p = (byF[w.family] ||= new Path2D());
        p.moveTo(w.rimX + rr, w.rimY);
        p.arc(w.rimX, w.rimY, rr, 0, TAU);
      }
      for (const [fam, p] of Object.entries(byF)) {
        ctx.fillStyle = rgba(this.bright[fam], 0.95);
        ctx.fill(p);
      }
      if (F) {
        // the rest of the rim, faint
        const rest = new Path2D();
        const rr = 0.5 * px;
        for (const w of g.words) {
          if (!w.alive || F.words.has(w)) continue;
          rest.moveTo(w.rimX + rr, w.rimY);
          rest.arc(w.rimX, w.rimY, rr, 0, TAU);
        }
        ctx.fillStyle = 'rgba(236,232,223,0.12)';
        ctx.fill(rest);
      }
    }
    // roots: small warm seeds (PIE) and hollow rings (roots from beyond the family)
    ctx.globalCompositeOperation = 'lighter';
    for (const r of g.roots) {
      const n = r.node;
      if (n.r > tR) continue;
      const on = !F || F.nodes.has(n);
      if (n.lang === 'PIE') {
        const S = (on && F ? 13 : 7.5) * Math.min(nk, 2) * px;
        ctx.globalAlpha = on ? (F ? 1 : 0.55) : 0.18;
        ctx.drawImage(this.sprites.root, n.x - S / 2, n.y - S / 2, S, S);
      } else {
        ctx.globalAlpha = on ? 0.9 : 0.25;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.6 * Math.min(nk, 2) * px, 0, TAU);
        ctx.strokeStyle = rgba(this.bright[n.family], 1);
        ctx.lineWidth = 1.1 * px;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ------------------------------------------------------------------ labels
  text(ctx, str, x, y, color, halo = true) {
    if (halo) {
      ctx.strokeStyle = 'rgba(7,8,13,0.85)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  drawRingLabels(ctx, tR) {
    const v = this.view;
    // the core: what nobody wrote down
    if (v.s * 0.1 > 34) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const f = Math.min(15, Math.round(v.s * 0.014));
      ctx.font = `italic ${f}px ${FONT_FORM}`;
      this.text(ctx, 'Proto-Indo-European', v.cx, v.cy - f * 0.55, 'rgba(243,230,196,0.7)', false);
      ctx.font = `${Math.round(f * 0.8)}px ${FONT_FORM}`;
      this.text(ctx, 'never written down', v.cx, v.cy + f * 0.75, 'rgba(185,180,168,0.5)', false);
    }
    ctx.font = `11px ${FONT_FORM}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ring of this.ringRadii) {
      if (ring.r > tR) continue;
      const y = v.cy - ring.r * v.s;
      if (y < -20 || y > this.h + 20) continue;
      this.text(ctx, ring.label, v.cx, y, 'rgba(185,180,168,0.75)');
    }
    if (tR >= 1) this.text(ctx, 'now', v.cx, v.cy - v.s, 'rgba(232,199,122,0.9)');
  }

  drawDomainLabels(ctx, k) {
    const v = this.view;
    if (k > 4) return;
    const R = v.s * (1 + this.rimMax()) + 16;
    ctx.font = `italic 15px ${FONT_DISPLAY}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    let alpha = k > 2.5 ? Math.max(0, (4 - k) / 1.5) : 1;
    // the sectors are named once the disc has grown
    alpha *= Math.max(0, Math.min(1, (this.state.tR - 0.9) / 0.1));
    if (alpha <= 0.01) return;
    for (const d of this.L.domains) {
      const mid = (d.a0 + d.a1) / 2;
      this.arcText(ctx, d.name, v.cx, v.cy, R, mid, `rgba(232,199,122,${0.78 * alpha})`);
      // a hairline bracket for the domain's span
      ctx.beginPath();
      ctx.arc(v.cx, v.cy, R - 14, d.a0, d.a1);
      ctx.strokeStyle = `rgba(232,199,122,${0.18 * alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  arcText(ctx, str, cx, cy, R, mid, color) {
    // lay text along an arc, upright on both halves of the circle
    const bottom = Math.sin(mid) > 0.15;
    const widths = [...str].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) * 1.06;
    let a = mid + ((bottom ? 1 : -1) * total) / 2 / R;
    ctx.fillStyle = color;
    [...str].forEach((ch, i) => {
      const w = widths[i] * 1.06;
      const step = w / R;
      const ac = bottom ? a - step / 2 : a + step / 2;
      ctx.save();
      ctx.translate(cx + R * Math.cos(ac), cy + R * Math.sin(ac));
      ctx.rotate(bottom ? ac - Math.PI / 2 : ac + Math.PI / 2);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      a = bottom ? a - step : a + step;
    });
  }

  // how far rim labels may reach beyond the rim at overview zoom (fraction of radius)
  rimMax() {
    return this.w < 820 ? 0.115 : 0.165;
  }

  rimFont(k) {
    return Math.round(Math.min(15, 10 + 2.2 * Math.log2(Math.max(1, k))));
  }

  // choose which rim words get a label at this zoom (greedy by frequency)
  pickRimLabels(k, F) {
    const key = `${k.toFixed(2)}|${this.state.minZipf}|${F ? F.kind + (F.anchor?.id ?? F.law ?? F.family ?? '') : ''}`;
    if (key === this.rimKey) return this.rimLabels;
    this.rimKey = key;
    const v = this.view;
    const font = this.rimFont(k);
    const gap = (font * 1.18) / v.s;
    const nb = Math.max(8, Math.ceil(TAU / gap));
    const occ = new Uint8Array(nb);
    const out = [];
    const take = (w) => {
      const a = ((w.theta % TAU) + TAU) % TAU;
      const b = Math.floor(a / gap) % nb;
      if (occ[b] || occ[(b + 1) % nb] || occ[(b - 1 + nb) % nb]) return false;
      occ[b] = 1;
      out.push(w);
      return true;
    };
    const maxLen = k < 1.6 ? this.rimMax() * v.s : Infinity;
    const ctx = this.b;
    ctx.font = `${font}px ${FONT_FORM}`;
    if (F) for (const w of [...F.words].sort((a, b) => (F.strong.has(b) - F.strong.has(a)) || b.zipf - a.zipf)) if (w.alive) take(w);
    if (!F) {
      for (const w of this.g.wordsByZipf) {
        if (!w.alive) continue;
        if (maxLen < Infinity && ctx.measureText(w.display).width > maxLen) continue;
        take(w);
      }
    }
    this.rimLabels = out;
    return out;
  }

  // For a small focus set, fan the labels out with leader lines so all are readable.
  drawSpreadLabels(ctx, k, F) {
    const v = this.view;
    const font = this.rimFont(Math.max(k, 1.6));
    const words = [...F.words].filter((w) => w.alive).sort((a, b) => a.theta - b.theta);
    if (!words.length) return;
    // unwrap angles around the set's centre so the sort is continuous
    const mid = Math.atan2(words.reduce((a, w) => a + w.rimY, 0), words.reduce((a, w) => a + w.rimX, 0));
    const un = (t) => {
      let d = t - mid;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      return mid + d;
    };
    const items = words.map((w) => ({ w, a: un(w.theta), p: un(w.theta) })).sort((x, y) => x.a - y.a);
    const R0 = v.s + 16;
    const gap = (font * 1.22) / R0;
    for (let it = 0; it < 6; it++) {
      for (let i = 1; i < items.length; i++) items[i].p = Math.max(items[i].p, items[i - 1].p + gap);
      const shift = items.reduce((a, x) => a + (x.p - x.a), 0) / items.length;
      for (const x of items) x.p -= shift;
      for (let i = items.length - 2; i >= 0; i--) items[i].p = Math.min(items[i].p, items[i + 1].p - gap);
    }
    ctx.font = `${font}px ${FONT_FORM}`;
    ctx.textBaseline = 'middle';
    const sel = this.state.selected;
    const hov = this.state.hover;
    this.rimLabels = items.map((x) => x.w);
    this.spreadAt = new Map(items.map((x) => [x.w, x.p]));
    for (const { w, a, p } of items) {
      const x0 = v.cx + Math.cos(a) * (v.s + 3);
      const y0 = v.cy + Math.sin(a) * (v.s + 3);
      const x1 = v.cx + Math.cos(a) * (v.s + 9);
      const y1 = v.cy + Math.sin(a) * (v.s + 9);
      const x2 = v.cx + Math.cos(p) * R0;
      const y2 = v.cy + Math.sin(p) * R0;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = rgba(this.bright[w.family], 0.5);
      ctx.lineWidth = 1;
      ctx.stroke();
      const flip = Math.cos(p) < 0;
      ctx.save();
      ctx.translate(x2, y2);
      ctx.rotate(flip ? p + Math.PI : p);
      ctx.textAlign = flip ? 'right' : 'left';
      const strong = F.strong.has(w);
      const isSel = w === sel || w === hov;
      this.text(ctx, w.display, flip ? -4 : 4, 0, isSel ? 'rgba(232,199,122,1)' : `rgba(236,232,223,${strong ? 1 : 0.7})`);
      ctx.restore();
    }
  }

  drawRimLabels(ctx, k, F) {
    const v = this.view;
    this.spreadAt = null;
    if (F && F.words.size <= 64) return this.drawSpreadLabels(ctx, k, F);
    const labels = this.pickRimLabels(k, F);
    const font = this.rimFont(k);
    ctx.font = `${font}px ${FONT_FORM}`;
    ctx.textBaseline = 'middle';
    const sel = this.state.selected;
    const hov = this.state.hover;
    const nk = Math.pow(k, 0.38);
    for (const w of labels) {
      const x = v.cx + w.rimX * v.s;
      const y = v.cy + w.rimY * v.s;
      if (x < -200 || x > this.w + 200 || y < -200 || y > this.h + 200) continue;
      const flip = w.rimX < 0;
      const off = 5 + (0.45 + Math.max(0, w.zipf - 1) * 0.42) * Math.min(nk, 2.2);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(flip ? w.theta + Math.PI : w.theta);
      ctx.textAlign = flip ? 'right' : 'left';
      const strong = F ? F.strong.has(w) : true;
      const a = F ? (strong ? 1 : 0.62) : 0.42 + 0.58 * Math.min(1, Math.max(0, (w.zipf - 1.5) / 4.5));
      const isSel = w === sel || w === hov;
      const color = isSel ? 'rgba(232,199,122,1)' : `rgba(236,232,223,${a})`;
      this.text(ctx, w.display, flip ? -off : off, 0, color);
      ctx.restore();
    }
  }

  drawInnerLabels(ctx, k, tR, F) {
    const v = this.view;
    const occupied = [];
    const hit = (x0, y0, x1, y1) => {
      for (const o of occupied) if (x0 < o[2] && x1 > o[0] && y0 < o[3] && y1 > o[1]) return true;
      return false;
    };
    const place = (n, str, font, color, prio) => {
      const x = v.cx + (n.isEn ? n.rEntry * Math.cos(n.theta) : n.x) * v.s;
      const y = v.cy + (n.isEn ? n.rEntry * Math.sin(n.theta) : n.y) * v.s;
      if (x < -50 || x > this.w + 50 || y < -20 || y > this.h + 20) return;
      ctx.font = font;
      const w = ctx.measureText(str).width;
      const right = Math.cos(n.theta) >= -0.2;
      const x0 = right ? x + 5 : x - 5 - w;
      const box = [x0 - 2, y - 7, x0 + w + 2, y + 7];
      if (!prio && hit(...box)) return;
      occupied.push(box);
      ctx.textAlign = 'left';
      this.text(ctx, str, x0, y, color);
    };
    ctx.textBaseline = 'middle';
    const sel = this.state.selected;
    const hov = this.state.hover;

    // focus lineage: every form, always
    if (F && F.kind === 'lineage') {
      const nodes = [...F.nodes].filter((n) => !n.isEn && n.r <= tR).sort((a, b) => a.depth - b.depth);
      for (const n of nodes) {
        place(n, n.display, `${n.isRoot ? 'italic ' : ''}12px ${FONT_FORM}`, n.isRoot ? 'rgba(243,230,196,1)' : rgba(this.bright[n.family], 1), true);
      }
      return;
    }
    // hovered node
    for (const n of [hov, sel]) if (n && !n.isEn && n.r <= tR) place(n, n.display, `12px ${FONT_FORM}`, 'rgba(232,199,122,1)', true);

    // roots
    if (k >= 1.25 || F) {
      const font = `italic ${Math.round(Math.min(14, 10 + k))}px ${FONT_FORM}`;
      const roots = [...this.g.roots].sort((a, b) => b.node.enDesc.size - a.node.enDesc.size);
      for (const r of roots) {
        const n = r.node;
        if (n.r > tR) continue;
        if (F && !F.nodes.has(n)) continue;
        place(n, n.display, font, F ? 'rgba(243,230,196,1)' : 'rgba(243,230,196,0.85)', false);
      }
    }
    // intermediate forms when zoomed in
    if (k >= 2.6) {
      const font = `${Math.round(Math.min(13, 9 + k * 0.5))}px ${FONT_FORM}`;
      const nodes = this.innerNodes.filter((n) => !n.isRoot && n.r <= tR && (!F || F.nodes.has(n)));
      nodes.sort((a, b) => a.depth - b.depth || b.enDesc.size - a.enDesc.size);
      for (const n of nodes) place(n, n.display, font, F ? rgba(this.bright[n.family], 0.95) : 'rgba(185,180,168,0.85)', false);
    }
  }

  // ------------------------------------------------------------------ fx
  ensureParticles() {
    const F = this.state.focus;
    let want = this.reduced ? 0 : Math.round(Math.min(520, 200 + (this.w * this.h) / 5000));
    if (F) want = Math.min(want, 18 + F.edges.size * 2);
    want = Math.min(want, Math.round((this.aliveEdges ?? 4000) * 0.45));
    while (this.particles.length < want) this.particles.push(this.spawn({}));
    this.particles.length = want;
  }

  spawn(p) {
    const st = this.state;
    const F = st.focus;
    let pool = this.rootEdges;
    if (F && F.startEdges && F.startEdges.length) pool = F.startEdges;
    const e = pool[(Math.random() * pool.length) | 0];
    p.e = e;
    p.t = Math.random() * 0.3;
    p.mode = 'edge';
    p.speed = 0.06 + Math.random() * 0.07;
    p.w = null;
    p.age = 0;
    return p;
  }

  stepParticle(p, dt) {
    const st = this.state;
    const F = st.focus;
    const tR = st.tR;
    p.age += dt;
    if (p.mode === 'edge') {
      if (!p.e || p.e.rc > tR || !p.e.target.alive) return this.spawn(p);
      p.t += (dt * p.speed) / Math.max(p.e.len, 0.03);
      if (p.t >= 1) {
        const n = p.e.target;
        if (n.isEn) {
          p.mode = 'life';
          p.w = n;
          p.r = n.rEntry;
          return p;
        }
        let outs = n.outEdges.filter((e) => e.primary && e.target.alive && e.rc <= tR);
        if (F) outs = outs.filter((e) => F.edges.has(e));
        if (!outs.length) return this.spawn(p);
        p.e = outs[(Math.random() * outs.length) | 0];
        p.t = 0;
      }
    } else {
      p.r += dt * p.speed * 0.9;
      if (p.r >= Math.min(1, tR)) return this.spawn(p);
    }
    return p;
  }

  drawFx(dt, now) {
    const { f: ctx, view: v, state: st } = this;
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.fx.width, this.fx.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    // time front
    if (st.time < T_MAX - 0.5) {
      const R = st.tR * v.s;
      ctx.beginPath();
      ctx.arc(v.cx, v.cy, R, 0, TAU);
      ctx.strokeStyle = 'rgba(232,199,122,0.07)';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(232,199,122,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // law pulse: the edges a law touched flare up as time crosses it
    if (st.pulse) {
      const age = (now - st.pulse.t0) / 1000;
      const a = age < 0.4 ? age / 0.4 : Math.max(0, 1 - (age - 0.4) / 3.2);
      if (a <= 0) st.pulse = null;
      else {
        ctx.save();
        ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, dpr * v.cx, dpr * v.cy);
        const p = new Path2D();
        for (const e of this.g.law[st.pulse.law].edges) {
          if (e.ra > st.tR) continue;
          const gm = e.g;
          p.moveTo(gm[0], gm[1]);
          p.bezierCurveTo(gm[2], gm[3], gm[4], gm[5], gm[6], gm[7]);
        }
        const band = this.lawBand(st.pulse.law, st.tR);
        if (band) p.addPath(band);
        ctx.strokeStyle = rgba(GOLD, 0.16 * a);
        ctx.lineWidth = 7 / v.s;
        ctx.stroke(p);
        ctx.strokeStyle = rgba(GOLD, 0.85 * a);
        ctx.lineWidth = 1.6 / v.s;
        ctx.stroke(p);
        ctx.restore();
      }
    }

    // sap: particles flowing from the roots outward
    this.ensureParticles();
    const pt = [0, 0];
    const k = v.k;
    const size = Math.min(14, 7 + k * 0.8);
    for (const p of this.particles) {
      this.stepParticle(p, dt);
      let x, y, fam;
      if (p.mode === 'edge') {
        if (!p.e || p.e.ra > st.tR) continue;
        bez(p.e.g, Math.min(1, p.t), pt);
        x = pt[0];
        y = pt[1];
        fam = p.e.target.family;
      } else {
        x = p.r * Math.cos(p.w.theta);
        y = p.r * Math.sin(p.w.theta);
        fam = p.w.family;
      }
      const sx = v.cx + x * v.s;
      const sy = v.cy + y * v.s;
      if (sx < -10 || sy < -10 || sx > this.w + 10 || sy > this.h + 10) continue;
      const fade = Math.min(1, p.age * 2);
      ctx.globalAlpha = (st.focus ? 0.85 : 0.4) * fade;
      ctx.drawImage(this.sprites[fam] || this.sprites.gold, sx - size / 2, sy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;

    // births: a ring blooms where a form appears
    const keep = [];
    for (const bth of this.births) {
      const age = (now - bth.t0) / 1000;
      if (age > 1.1) continue;
      keep.push(bth);
      const sx = v.cx + bth.x * v.s;
      const sy = v.cy + bth.y * v.s;
      const r = 2 + age * 14;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TAU);
      ctx.strokeStyle = rgba(this.bright[bth.fam] || GOLD, 0.55 * (1 - age / 1.1));
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    this.births = keep;

    // tips: forms named as they are born
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `12px ${FONT_FORM}`;
    ctx.textBaseline = 'middle';
    const tipsKeep = [];
    for (const t of this.tips) {
      const age = (now - t.t0) / 1000;
      if (age > 2.6) continue;
      tipsKeep.push(t);
      const a = age < 0.25 ? age / 0.25 : Math.max(0, 1 - (age - 1.4) / 1.2);
      const sx = v.cx + t.x * v.s;
      const sy = v.cy + t.y * v.s;
      const right = t.x >= 0;
      ctx.textAlign = right ? 'left' : 'right';
      this.text(ctx, t.text, sx + (right ? 7 : -7), sy, rgba(t.color, Math.min(1, a)));
    }
    this.tips = tipsKeep;

    // hover & selection rings
    for (const [n, c] of [[st.hover, [236, 232, 223]], [st.selected, GOLD]]) {
      if (!n) continue;
      const x = n.isEn ? n.rimX : n.x;
      const y = n.isEn ? n.rimY : n.y;
      const sx = v.cx + x * v.s;
      const sy = v.cy + y * v.s;
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, TAU);
      ctx.strokeStyle = rgba(c, 0.9);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // called while time advances: record forms crossing the time front
  noteBirths(prevR, tR, now) {
    if (tR <= prevR) return;
    let n = 0;
    for (const node of this.g.nodes) {
      const r = node.isEn ? node.rEntry : node.r;
      if (r > prevR && r <= tR) {
        if (this.births.length < 260) this.births.push({ x: node.isEn ? node.rEntry * Math.cos(node.theta) : node.x, y: node.isEn ? node.rEntry * Math.sin(node.theta) : node.y, t0: now, fam: node.family });
        if ((node.star || node.isRoot) && n < 3 && this.tips.length < 12 && Math.random() < 0.55) {
          const x = node.isEn ? node.rEntry * Math.cos(node.theta) : node.x;
          const y = node.isEn ? node.rEntry * Math.sin(node.theta) : node.y;
          this.tips.push({ x, y, t0: now, text: node.display, color: node.isRoot ? [243, 230, 196] : this.bright[node.family] });
          n++;
        }
      }
    }
  }

  // ------------------------------------------------------------------ picking
  pick(px, py) {
    const v = this.view;
    const st = this.state;
    const [ux, uy] = v.toUnit(px, py);
    const r = Math.hypot(ux, uy);
    const th = Math.atan2(uy, ux);
    const angDist = (a, b) => {
      let d = Math.abs(a - b) % TAU;
      return d > Math.PI ? TAU - d : d;
    };
    if (st.tR >= 0.999 && r > 0.975 && r < 1 + 190 / v.s) {
      const font = this.rimFont(v.k);
      const onLabels = r > 1.004;
      const cands = onLabels ? this.rimLabels : this.g.words;
      const angOf = (w) => (onLabels && this.spreadAt ? this.spreadAt.get(w) ?? w.theta : w.theta);
      const tol = onLabels ? (font * 0.62) / (r * v.s) : Math.max(this.L.slotAngle * 0.7, 6 / v.s);
      let best = null;
      let bd = tol;
      for (const w of cands) {
        if (!w.alive) continue;
        const d = angDist(angOf(w), th);
        if (d < bd) {
          bd = d;
          best = w;
        }
      }
      if (best) return best;
    }
    let best = null;
    let bd = (10 / v.s) ** 2;
    for (const n of this.g.nodes) {
      const rr = n.isEn ? n.rEntry : n.r;
      if (rr > st.tR) continue;
      if (st.focus && !st.focus.nodes.has(n) && !st.focus.words.has(n)) continue;
      const x = n.isEn ? n.rEntry * Math.cos(n.theta) : n.x;
      const y = n.isEn ? n.rEntry * Math.sin(n.theta) : n.y;
      const d = (x - ux) ** 2 + (y - uy) ** 2;
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }
}
