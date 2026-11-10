// Words floating beside their nodes in the 3D view: a 2D canvas laid over the WebGL one.
// A few labels at a time, the most telling first, none overlapping, each fading in and out.

import { LANGS } from './langs.js';

const SERIF = '"Gentium Book Plus", Georgia, serif';
const DISPLAY = '"Cormorant Garamond", "Gentium Book Plus", Georgia, serif';
const INK = { en: '244,241,234', root: '240,213,144', other: '201,196,184' };

export class Labels {
  constructor(canvas, g, S) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.g = g;
    this.S = S;
    const N = S.N;
    this.alpha = new Float32Array(N);
    this.want = new Uint8Array(N);
    this.side = new Int8Array(N);
    this.fs = new Float32Array(N);    // font size
    this.lw = new Float32Array(N);    // text width at that size
    this.tag = new Uint8Array(N);     // 1: also name the language
    this.live = new Set();
    this.rects = [];
    this.w16 = new Float32Array(N).fill(-1);
    this.tagW = new Map();
    this.since = 1;
    this.w = 1; this.h = 1; this.dpr = 1;
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.c.width = Math.round(w * dpr);
    this.c.height = Math.round(h * dpr);
  }

  font(i, size) {
    const n = this.g.nodes[i];
    return `${n.isEn ? '600' : n.isRoot ? 'italic 600' : 'italic 400'} ${size}px ${SERIF}`;
  }

  width(i, size) {
    if (this.w16[i] < 0) {
      this.ctx.font = this.font(i, 16);
      this.w16[i] = this.ctx.measureText(this.g.nodes[i].display).width;
    }
    return (this.w16[i] * size) / 16;
  }

  langName(i) {
    const n = this.g.nodes[i];
    return n.isRoot ? (LANGS[n.lang]?.name || '') : LANGS[n.lang]?.name || n.lang;
  }

  tagWidth(i, size) {
    const s = this.langName(i);
    if (!this.tagW.has(s)) {
      this.ctx.font = `400 16px ${SERIF}`;
      this.tagW.set(s, this.ctx.measureText(s).width);
    }
    return (this.tagW.get(s) * size) / 16;
  }

  // decide which labels deserve to be on screen (a few times a second)
  choose(f) {
    const { scr, rel, hasSel, hover, grow, focus, pxScale } = f;
    const S = this.S, nodes = this.g.nodes, W = this.w, H = this.h;
    const zoom = f.fit / focus;
    const floor = (hasSel ? 2.2 : 4.4) - 2.4 * Math.log2(Math.max(0.5, zoom));
    const cand = [];
    for (let i = 0; i < S.N; i++) {
      const d = scr[i * 3 + 2];
      if (d <= 0 || S.rad[i] >= grow) continue;
      const x = scr[i * 3], y = scr[i * 3 + 1];
      if (x < 4 || x > W - 4 || y < f.top || y > H - 6) continue;
      const r = rel[i];
      const near = focus / d;
      let s;
      if (i === hover) s = 1000;
      else if (hasSel && r === 0) continue;
      else {
        const blur = Math.abs(1 - near);
        if (blur > 0.42 && r < 3) continue;
        const n = nodes[i];
        s = (n.isEn ? n.zipf : n.isRoot ? 5.0 : 1.4) + 2.2 * Math.log2(near) - blur * 3 + this.alpha[i] * 1.3;
        if (r === 4) s += 500;
        else if (r === 3) s += 200;
        else if (r === 2) s += 3;
        if (s < floor) continue;
      }
      cand.push({ i, s, x, y, d, near, r });
    }
    cand.sort((a, b) => b.s - a.s);

    const max = Math.min(84, Math.max(16, Math.round((W * H) / 24000)));
    const boxes = [];
    for (const k of this.live) this.want[k] = 0;
    // from far off, a few roots are enough: the words people know come first
    const rootMax = hasSel ? max : zoom < 1.5 ? Math.round(max * 0.2) : f.growing ? Math.round(max * 0.36) : max;
    let count = 0, roots = 0;
    for (const c of cand) {
      if (count >= max && c.s < 100) break;
      const i = c.i, n = nodes[i];
      if (n.isRoot && c.s < 100 && roots >= rootMax) continue;
      let size = n.isEn ? Math.min(16, Math.max(12, 12 + (n.zipf - 3) * 0.9)) : n.isRoot ? 14 : 12.5;
      size *= Math.min(1.3, Math.max(0.82, 0.86 + (c.near - 1) * 0.9));
      if (c.r === 4) size = Math.max(size * 1.3, 19);
      else if (c.r === 3) size *= 1.12;
      size = Math.round(size * 2) / 2;
      const tag = !n.isEn && (c.r >= 3 || i === hover) ? 1 : 0;
      const tw = this.width(i, size);
      const w = tw + (tag ? 7 + this.tagWidth(i, size * 0.72) : 0);
      const h = size * 1.18;
      const pr = Math.max(2.5, (S.size[i] * pxScale) / c.d) + 5;
      const opts = [
        [c.x + pr, c.y - h / 2], [c.x - pr - w, c.y - h / 2], [c.x - w / 2, c.y - pr - h], [c.x - w / 2, c.y + pr],
      ];
      const first = this.alpha[i] > 0.05 ? this.side[i] : 0;
      let ok = -1;
      for (let o = 0; o < 4 && ok < 0; o++) {
        const sd = (first + o) % 4;
        const bx = opts[sd][0] - 4, by = opts[sd][1] - 2, bw = w + 8, bh = h + 4;
        if (bx < 2 || bx + bw > W - 2 || by < f.top || by + bh > H - 2) continue;
        let hit = false;
        for (const b of boxes) {
          if (bx < b[0] + b[2] && bx + bw > b[0] && by < b[1] + b[3] && by + bh > b[1]) { hit = true; break; }
        }
        if (!hit) { ok = sd; boxes.push([bx, by, bw, bh]); }
      }
      if (ok < 0) continue;
      this.want[i] = 1;
      this.side[i] = ok;
      this.fs[i] = size;
      this.lw[i] = tw;
      this.tag[i] = tag;
      this.live.add(i);
      count++;
      if (n.isRoot) roots++;
    }
  }

  draw(f, dt) {
    this.since += dt;
    if (this.since > 0.12) { this.since = 0; this.choose(f); }
    const { scr, rel, hasSel, hover, focus, pxScale } = f;
    const ctx = this.ctx, S = this.S, nodes = this.g.nodes;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    // the nine domains, written large and faint around the whole
    if (f.domainAlpha > 0.01) {
      ctx.textAlign = 'center';
      ctx.font = `italic 500 ${this.w < 700 ? 15 : 21}px ${DISPLAY}`;
      for (const d of f.domains) {
        if (d.s[2] <= 0) continue;
        // a title that would sit on top of the organism steps aside
        const off = Math.hypot(d.s[0] - f.ball[0], d.s[1] - f.ball[1]) / f.ball[2];
        const a = f.domainAlpha * Math.min(1, Math.max(0.25, 1.5 - d.s[2] / focus)) * Math.min(1, Math.max(0, (off - 0.8) / 0.22));
        if (a < 0.01) continue;
        const half = ctx.measureText(d.name).width / 2 + 14;
        const x = Math.min(this.w - half, Math.max(half, d.s[0]));
        const y = Math.min(this.h - 66, Math.max(f.top + 22, d.s[1]));
        ctx.fillStyle = `rgba(214,222,244,${(a * 0.62).toFixed(3)})`;
        ctx.fillText(d.name, x, y);
      }
    }

    ctx.textAlign = 'left';
    const k = 1 - Math.exp(-dt * 9);
    this.rects.length = 0;
    for (const i of this.live) {
      const a = (this.alpha[i] += (this.want[i] - this.alpha[i]) * k);
      if (a < 0.02 && !this.want[i]) { this.alpha[i] = 0; this.live.delete(i); continue; }
      const d = scr[i * 3 + 2];
      if (d <= 0) continue;
      const x = scr[i * 3], y = scr[i * 3 + 1];
      const n = nodes[i], size = this.fs[i], tw = this.lw[i], h = size * 1.18;
      const w = tw + (this.tag[i] ? 7 + this.tagWidth(i, size * 0.72) : 0);
      const pr = Math.max(2.5, (S.size[i] * pxScale) / d) + 5;
      const sd = this.side[i];
      const lx = sd === 0 ? x + pr : sd === 1 ? x - pr - w : x - w / 2;
      const ly = sd === 2 ? y - pr - h / 2 : sd === 3 ? y + pr + h / 2 : y;
      const r = rel[i];
      const lit = i === hover || r >= 3 ? 1 : hasSel ? (r === 2 ? 0.85 : 0.5) : Math.min(1, Math.max(0.45, 1.25 - Math.abs(1 - focus / d) * 2));
      ctx.globalAlpha = a * lit;
      ctx.font = this.font(i, size);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = 'rgba(5,7,14,0.5)';
      ctx.strokeText(n.display, lx, ly);
      ctx.fillStyle = `rgb(${n.isEn ? INK.en : n.isRoot ? INK.root : INK.other})`;
      ctx.fillText(n.display, lx, ly);
      if (this.tag[i]) {
        ctx.font = `400 ${size * 0.72}px ${SERIF}`;
        ctx.fillStyle = 'rgba(170,178,200,0.95)';
        ctx.fillText(this.langName(i), lx + tw + 7, ly + 1);
      }
      if (this.want[i]) this.rects.push([lx - 4, ly - h / 2 - 3, w + 8, h + 6, i]);
    }
    ctx.globalAlpha = 1;

    // rings: what the pointer is on, and what is selected
    const ring = (i, color, grow) => {
      if (i < 0) return;
      const d = scr[i * 3 + 2];
      if (d <= 0) return;
      const pr = Math.max(3, (S.size[i] * pxScale) / d) + grow;
      ctx.beginPath();
      ctx.arc(scr[i * 3], scr[i * 3 + 1], pr, 0, Math.PI * 2);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    if (f.selected >= 0) ring(f.selected, 'rgba(255,150,136,0.9)', 6 + Math.sin(f.time * 2.4) * 1.2);
    if (hover >= 0 && hover !== f.selected) ring(hover, 'rgba(236,240,255,0.85)', 5);
  }

  // which label, if any, is under this point
  hit(x, y) {
    for (const r of this.rects) {
      if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return r[4];
    }
    return -1;
  }
}
