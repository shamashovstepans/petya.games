// Etymon, languages: the names on the globe. A language is always named; a word is named when
// the eye is close enough to tell it from its neighbours, or when it has to do with what is chosen.

import { smooth, tangent } from './space-layout.js';
import { depths, fullest } from './kin-addr.js';

const SERIF = '"Gentium Book Plus", Georgia, serif';
const DISPLAY = '"Cormorant Garamond", "Gentium Book Plus", Georgia, serif';
// scripts the page's own type can set; anything else is shown in Latin letters
const PLAIN = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]*$/u;
const PAPER = [244, 241, 234];
const ink = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255].map((v, j) => Math.round(v + (PAPER[j] - v) * k)).join(',');
};
const BASE = [0, 20, 30, 500, 1000];   // what a form's standing to the chosen one is worth

export class KinLabels {
  constructor(canvas, k) {
    const { K, T } = k, N = K.N;
    Object.assign(this, { cv: canvas, ctx: canvas.getContext('2d'), k, w: 1, h: 1, dpr: 1, since: 1, rects: [], seen: null, cand: null, candSet: new Set(), tags: false });
    this.nameInk = K.branches.map((b) => ink(b.color, 0.62));
    this.wordInk = K.branches.map((b) => ink(b.color, 0.68));
    let max = 1;
    for (const s of K.stations) if (s.i) max = Math.max(max, s.count);
    this.names = K.stations.filter((s) => s.count > 0).map((s) => {
      const live = s.date >= 2000;
      return {
        s: s.i, live, b: s.branch, text: live ? [...s.name.toUpperCase()].join(' ') : s.name,
        size: 9.5 + 10.5 * Math.min(1, s.count / max) ** 0.35, pri: Math.sqrt(s.count) * (live ? 1 : 0.25),
        a: 0, to: 0, want: 0, fs: 12, w16: -1, x: 0, y: 0, score: 0,
      };
    });
    this.weight = new Float32Array(T.S).fill(1);
    this.alpha = new Float32Array(N); this.want = new Uint8Array(N); this.side = new Int8Array(N);
    this.fs = new Float32Array(N); this.lw = new Float32Array(N); this.w16 = new Float32Array(N).fill(-1);
    this.live = new Set();
    this.tagW = new Map();
    // widths measured before the type arrived are wrong
    if (document.fonts) document.fonts.ready.then(() => { this.w16.fill(-1); this.tagW.clear(); for (const o of this.names) o.w16 = -1; });
  }

  resize(w, h, dpr) {
    Object.assign(this, { w, h, dpr, since: 1 });
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
  }

  text(i) { const K = this.k.K, f = K.form[i], t = K.tr[i]; return t && !PLAIN.test(f) ? t : f; }
  font(i, size) { return `${this.k.K.form[i][0] === '*' ? 'italic ' : ''}400 ${size}px ${SERIF}`; }
  width(i, size) {
    if (this.w16[i] < 0) { this.ctx.font = this.font(i, 16); this.w16[i] = this.ctx.measureText(this.text(i)).width; }
    return (this.w16[i] * size) / 16;
  }
  nameFont(o, size) { return o.live ? `600 ${size}px ${DISPLAY}` : `italic 500 ${size * 1.08}px ${DISPLAY}`; }
  nameWidth(o, size) {
    if (o.w16 < 0) { this.ctx.font = this.nameFont(o, 16); o.w16 = this.ctx.measureText(o.text).width; }
    return (o.w16 * size) / 16;
  }
  tagWidth(s, size) {
    if (!this.tagW.has(s)) { this.ctx.font = `400 16px ${SERIF}`; this.tagW.set(s, this.ctx.measureText(this.k.K.stations[s].name).width); }
    return (this.tagW.get(s) * size * 0.72) / 16 + 7;
  }

  // Is this point inside the globe seen through the patch of a language that lies above it?
  // Then its name would read as a name on that patch.
  covered(s, x, y, z) {
    const { T, cam } = this.k, e = cam.eye, grow = this.k.grow, low = T.rad[s] + 0.04;
    const dx = x - e[0], dy = y - e[1], dz = z - e[2];   // the line of sight: e + u d, u from 0 to 1
    const a = dx * dx + dy * dy + dz * dz, b = e[0] * dx + e[1] * dy + e[2] * dz, ee = e[0] * e[0] + e[1] * e[1] + e[2] * e[2];
    for (const o of this.names) {
      const t = o.s, R = T.rad[t];
      if (!t || R < low || R > grow) continue;
      const q = b * b - a * (ee - R * R);
      if (q <= 0) continue;
      const u = (-b - Math.sqrt(q)) / a;                 // where the line enters the shell that language lies on
      if (u <= 0 || u >= 1) continue;
      const px = e[0] + dx * u, py = e[1] + dy * u, pz = e[2] + dz * u;
      if ((px * T.dir[t * 3] + py * T.dir[t * 3 + 1] + pz * T.dir[t * 3 + 2]) / R > Math.cos(T.disc[t])) return true;
    }
    return false;
  }

  // the root's name hangs under the seed, not on it: the seed is the brightest thing there is
  drop(o, depth) {
    const k = this.k;
    return o.s ? 0 : (Math.max(0.095, k.growing ? Math.min(0.3, k.grow) : 0) * k.cam.pxScale) / depth + o.fs * 0.9;
  }

  // the n best-known forms that pass: by how common the word is, then by the size of its family
  top(test, n) {
    const K = this.k.K, by = Array.from({ length: 10 }, () => []), out = [];
    for (let i = 0; i < K.N; i++) {
      if (!test(i)) continue;
      const b = by[K.rank.charCodeAt(i) - 48];
      if (b.length < n && fullest(K, i) === i) b.push(i);
    }
    for (let r = 9; r >= 0; r--) for (const i of by[r]) if (out.length < n) out.push(i);
    return out;
  }

  // a chosen word: itself, its line back to the root, what was made straight from it, and from
  // each language the best-known form of the rest
  kin(i) {
    const k = this.k, K = k.K, rel = k.rel, d = depths(K), out = [], best = new Map();
    for (let j = K.start[K.fam[i]], e = K.start[K.fam[i] + 1]; j < e; j++) {
      if (rel[j] >= 3 || K.par[j] === i) { out.push(j); continue; }
      const key = K.st[j] * 2 + rel[j], v = (K.rank.charCodeAt(j) - 48) * 1000 - d[j], o = best.get(key);
      if (!o || v > o[0]) best.set(key, [v, j]);
    }
    for (const [, j] of best.values()) out.push(j);
    return out;
  }

  // what is chosen decides which languages keep their names, and which forms are worth naming
  retarget() {
    const k = this.k, { K, T } = k, what = k.what, S = T.S, w = this.weight, rel = k.rel;
    this.cand = null; this.tags = false;
    if (!what) w.fill(1);
    else {
      w.fill(what.kind === 'set' ? 0.3 : 0);
      if (what.kind === 'lang') {
        const s = what.s, fl = [];
        for (let a = 1; a < S; a++) { const f = T.flow[a * S + s] + T.flow[s * S + a]; if (f && a !== s) fl.push([f, a]); }
        fl.sort((p, q) => q[0] - p[0]).slice(0, 14).forEach(([, a], j) => { w[a] = 20 - j; });
        for (let a = K.stations[s].parent; a > 0; a = K.stations[a].parent) w[a] = Math.max(w[a], 2);
        w[s] = 100;
        this.cand = this.top((i) => K.st[i] === s, 48);
      } else if (what.kind === 'pair') {
        w[what.a] = w[what.b] = 100;
        const of = (s) => this.top((i) => rel[i] === 3 && K.st[i] === s, 30);
        this.cand = of(what.a).concat(of(what.b));
      } else if (what.kind === 'word') { this.cand = this.kin(what.i); this.tags = true; }
      else { this.cand = what.list.slice(0, 400); this.tags = true; }
    }
    this.candSet = new Set(this.cand || []);
  }

  choose() {
    const k = this.k, { K, T, M, cam } = k, scr = k.scr, W = this.w, H = this.h, top = k.top, N = K.N;
    const boxes = k.ui.keepClear(), out = [0, 0, 0], eye = cam.eye;
    const clear = (x, y, w, h) => {
      for (const b of boxes) if (x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]) return false;
      return true;
    };
    // languages: the near side only, the larger first
    const zs = Math.min(1.5, Math.max(0.85, 0.85 + 0.25 * Math.log2(Math.max(0.5, k.fit / cam.dist))));
    const list = [];
    for (const o of this.names) {
      const s = o.s, hot = k.hover === N + s, wgt = hot ? Math.max(1, this.weight[s]) : this.weight[s], r = T.rad[s];
      o.want = 0;
      if (!wgt || (s && r > k.grow)) continue;
      const x = T.dir[s * 3] * r, y = T.dir[s * 3 + 1] * r, z = T.dir[s * 3 + 2] * r;
      if (!cam.project(x, y, z, out) || out[0] < 8 || out[0] > W - 8 || out[1] < top || out[1] > H - 8) continue;
      let face = 1;
      if (s) {
        const ex = eye[0] - x, ey = eye[1] - y, ez = eye[2] - z;
        face = Math.min(1, Math.max(0, ((x * ex + y * ey + z * ez) / (r * Math.hypot(ex, ey, ez)) - 0.05) / 0.25));
      } else if (k.grow > 0.6 && wgt < 100 && !hot) face = 0;
      const fill = (T.disc[s] * r * cam.pxScale) / out[2] / Math.min(W, H);
      o.to = Math.min(1, wgt) * face * (hot ? 1 : (1 - smooth(0.45, 0.9, fill)) * (0.55 + 0.45 * r));
      if (o.to < 0.05 || (s && r < 0.97 && wgt < 100 && !hot && this.covered(s, x, y, z))) continue;
      o.fs = Math.round(o.size * zs * 2) / 2; o.x = out[0]; o.y = out[1] + this.drop(o, out[2]);
      o.score = hot ? 1e9 : o.pri * wgt * (0.3 + face) * (o.a > 0.05 ? 1.5 : 1);
      list.push(o);
    }
    list.sort((p, q) => q.score - p.score);
    let n = 0;
    const max = Math.min(60, Math.max(14, Math.round((W * H) / 30000)));
    for (const o of list) {
      const w = this.nameWidth(o, o.fs) + 10, h = o.fs * 1.2 + 6;
      if (n >= max || !clear(o.x - w / 2, o.y - h / 2, w, h)) continue;
      boxes.push([o.x - w / 2, o.y - h / 2, w, h]);
      o.want = 1; n++;
    }

    // words
    for (const i of this.live) this.want[i] = 0;
    const cands = [], fog = k.fog ?? 1.4, focus = k.focus, tg = M.tg, rel = k.rel, lit = !!k.what;
    const kind = lit ? k.what.kind : '';
    const add = (i, base) => {
      const d = scr[i * 3 + 2], x = scr[i * 3], y = scr[i * 3 + 1];
      if (d <= 0 || tg[i] >= k.grow || x < 4 || x > W - 4 || y < top || y > H - 6) return;
      const vis = Math.exp(-Math.max(d - focus, 0) * fog);
      if (vis < 0.3 && base < 500) return;
      cands.push({ i, x, y, d, s: base + (K.rank.charCodeAt(i) - 48) * 1.5 + vis * 12 + this.alpha[i] * 6 });
    };
    if (this.cand) for (const i of this.cand) add(i, 40 + BASE[rel[i]]);
    // close in, a form can be told from its neighbours: name the ones in front
    const near = (T.c * cam.pxScale) / 9;
    if (focus < near * 1.6) {
      for (let i = 0, o = 2; i < N; i++, o += 3) {
        if (scr[o] > 0 && scr[o] <= near && !(lit && !rel[i]) && !this.candSet.has(i)) add(i, 0);
      }
    }
    if (k.hover >= 0 && k.hover < N) add(k.hover, 5000);
    cands.sort((a, b) => b.s - a.s);
    const cap = Math.min(90, Math.max(16, Math.round((W * H) / 22000)));
    let m = 0;
    for (const c of cands) {
      const i = c.i;
      if (m >= cap || this.want[i]) continue;
      let size = 12.5;
      if (kind === 'word') size = rel[i] === 4 ? 20 : rel[i] === 3 ? 14.5 : 12.5;
      else if (c.d < near) size = Math.min(14.5, Math.round(25 * Math.sqrt(near / c.d)) / 2);
      const w = this.width(i, size), full = w + (this.tags ? this.tagWidth(K.st[i], size) : 0), h = size * 1.2;
      const pr = Math.max(2.5, (M.size[i] * cam.pxScale) / c.d) + 5;
      const opts = [[c.x + pr, c.y - h / 2], [c.x - pr - full, c.y - h / 2], [c.x - full / 2, c.y - pr - h], [c.x - full / 2, c.y + pr]];
      const first = this.alpha[i] > 0.05 ? this.side[i] : 0;
      for (let t = 0; t < 4; t++) {
        const sd = (first + t) % 4, [x, y] = opts[sd];
        if (x < 2 || x + full > W - 2 || y < top || !clear(x - 4, y - 2, full + 8, h + 4)) continue;
        boxes.push([x - 4, y - 2, full + 8, h + 4]);
        this.side[i] = sd; this.fs[i] = size; this.lw[i] = w; this.want[i] = 1; this.live.add(i); m++;
        break;
      }
    }
  }

  // the edge of a language's patch
  outline(s) {
    const { T, cam } = this.k, ctx = this.ctx, out = [0, 0, 0];
    ctx.beginPath();
    if (!s) {
      if (!cam.project(0, 0, 0, out)) return;
      ctx.arc(out[0], out[1], (0.095 * cam.pxScale) / out[2], 0, 7);
    } else {
      const d = [T.dir[s * 3], T.dir[s * 3 + 1], T.dir[s * 3 + 2]], A = T.disc[s] + T.c * 1.5, r = T.rad[s];
      for (let j = 0; j <= 64; j++) {
        const a = (j / 64) * Math.PI * 2, p = tangent(d, A * Math.cos(a), A * Math.sin(a));
        if (!cam.project(p[0] * r, p[1] * r, p[2] * r, out)) return;
        if (j) ctx.lineTo(out[0], out[1]); else ctx.moveTo(out[0], out[1]);
      }
    }
    ctx.stroke();
  }

  // Letters on a dark halo of their own shape, soft at the edge: a bright flower lies under many of them.
  lay(t, x, y, fill, a) {
    const ctx = this.ctx;
    ctx.shadowColor = `rgba(3,5,11,${a})`;
    ctx.strokeStyle = `rgba(3,5,11,${0.5 * a})`;
    ctx.strokeText(t, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(t, x, y);
  }

  draw(dt) {
    const k = this.k, ctx = this.ctx, { K, T, L, M, cam } = k, N = K.N, scr = k.scr;
    if (k.what !== this.seen) { this.seen = k.what; this.retarget(); this.since = 1; }
    if ((this.since += dt) > 0.12) { this.since = 0; this.choose(); }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.textAlign = 'center';
    const e = 1 - Math.exp(-dt * 9), rects = (this.rects = []), out = [0, 0, 0];
    ctx.shadowBlur = 5 * this.dpr; ctx.lineWidth = 3;
    for (const o of this.names) {
      o.a += ((o.want ? o.to : 0) - o.a) * e;
      const s = o.s, r = T.rad[s];
      if (o.a < 0.02 || !cam.project(T.dir[s * 3] * r, T.dir[s * 3 + 1] * r, T.dir[s * 3 + 2] * r, out)) continue;
      const hot = k.hover === N + s;
      out[1] += this.drop(o, out[2]);
      ctx.font = this.nameFont(o, o.fs);
      this.lay(o.text, out[0], out[1], `rgba(${hot ? '255,252,244' : this.nameInk[o.b]},${o.a})`, o.a);
      const w = this.nameWidth(o, o.fs) + 10, h = o.fs * 1.2 + 6;
      if (o.want) rects.push([out[0] - w / 2, out[1] - h / 2, w, h, N + s]);
    }
    ctx.textAlign = 'left';
    const lit = !!k.what, rel = k.rel, fog = k.fog ?? 1.4;
    const rdot = (i, d) => Math.max(2.5, (M.size[i] * cam.pxScale) / d);
    for (const i of this.live) {
      const want = this.want[i], d = scr[i * 3 + 2];
      const a = (this.alpha[i] += ((want && d > 0 ? 1 : 0) - this.alpha[i]) * e);
      if (a < 0.02 && !want) { this.live.delete(i); this.alpha[i] = 0; continue; }
      if (d <= 0 || a < 0.02) continue;
      const x = scr[i * 3], y = scr[i * 3 + 1], fs = this.fs[i], w = this.lw[i], h = fs * 1.2, sd = this.side[i];
      const tw = this.tags ? this.tagWidth(K.st[i], fs) : 0, full = w + tw, pr = rdot(i, d) + 5;
      const lx = sd === 0 ? x + pr : sd === 1 ? x - pr - full : x - full / 2;
      const ly = sd === 2 ? y - pr - h / 2 : sd === 3 ? y + pr + h / 2 : y;
      const hot = i === k.hover, r = lit ? rel[i] : 2, t = this.text(i);
      const al = a * (hot ? 1 : Math.min(1, 0.35 + Math.exp(-Math.max(d - k.focus, 0) * fog)) * (r >= 2 ? 1 : 0.82));
      ctx.font = this.font(i, fs);
      this.lay(t, lx, ly, `rgba(${hot || (r === 4 && this.tags) ? '255,250,240' : this.wordInk[L.orig[i]]},${al})`, al);
      if (tw) {
        ctx.font = `400 ${fs * 0.72}px ${SERIF}`; ctx.fillStyle = `rgba(170,178,200,${0.9 * al})`;
        ctx.fillText(K.stations[K.st[i]].name, lx + w + 6, ly + 1);
      }
      if (want) rects.push([lx - 4, ly - h / 2 - 3, full + 8, h + 6, i]);
    }
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    // rings: the chosen word, then whatever is under the pointer
    ctx.lineWidth = 1.2;
    const ring = (i, more, style) => {
      const d = scr[i * 3 + 2];
      if (d <= 0) return;
      ctx.strokeStyle = style; ctx.beginPath(); ctx.arc(scr[i * 3], scr[i * 3 + 1], rdot(i, d) + more, 0, 7); ctx.stroke();
    };
    const w = k.what;
    if (w && w.kind === 'word') ring(w.i, 6 + Math.sin(k.time * 2.4) * 1.2, 'rgba(255,236,200,0.9)');
    ctx.strokeStyle = 'rgba(255,236,200,0.26)';
    if (w && w.kind === 'lang') this.outline(w.s);
    if (w && w.kind === 'pair') { this.outline(w.a); this.outline(w.b); }
    if (k.hover >= N) { ctx.strokeStyle = 'rgba(236,240,255,0.5)'; this.outline(k.hover - N); }
    else if (k.hover >= 0) ring(k.hover, 5, 'rgba(236,240,255,0.85)');
  }

  hit(x, y) {
    for (let j = this.rects.length - 1; j >= 0; j--) {
      const r = this.rects[j];
      if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return r[4];
    }
    return -1;
  }
}
