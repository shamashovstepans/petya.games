// Etymon, languages: where each language sits on the globe.
// Radius is date. Direction comes from nested caps: a language's daughters are packed inside
// its own cap, so a branch is one continent and its older stages lie underneath it.

import { tangent, norm, dot } from './space-layout.js';

const SCALE = [[-4500, 0.1], [-2500, 0.24], [-1000, 0.36], [0, 0.48], [500, 0.56], [1000, 0.66], [1500, 0.8], [2000, 1]];
const PAD = 5;          // room around a language's disc, in dot spacings
const MAX_CAP = 1.05;   // the largest branch may not take more than this (radians)
const FILL = 0.56;      // share of the sphere the branches cover together

// where the branches start out (longitude, latitude), loosely as on a map of Eurasia
const PLACE = {
  PGmc: [-14, 46], PCel: [-86, 34], PIt: [-54, -24], PHel: [14, -46], PBSl: [66, 38], PAlb: [20, -8], PArm: [58, -12],
  PAna: [52, -46], Phry: [30, -68], PIIr: [114, -14], PToch: [150, 34],
  Uralic: [104, 72], Turkic: [120, 28], Caucasus: [86, 8], Basque: [-94, -6], Semitic: [72, -70], Africa: [-24, -80],
  'East Asia': [176, 2], Austronesian: [170, -44], Dravidian: [136, -52], 'English creoles': [-138, 14],
};

export function dateR(y) {
  if (y <= SCALE[0][0]) return SCALE[0][1];
  for (let i = 1; i < SCALE.length; i++) {
    const [a, ra] = SCALE[i - 1], [b, rb] = SCALE[i];
    if (y <= b) return ra + ((y - a) / (b - a)) * (rb - ra);
  }
  return 1;
}
export function rDate(r) {
  if (r <= SCALE[0][1]) return SCALE[0][0];
  for (let i = 1; i < SCALE.length; i++) {
    const [a, ra] = SCALE[i - 1], [b, rb] = SCALE[i];
    if (r <= rb) return a + ((r - ra) / (rb - ra)) * (b - a);
  }
  return 2000;
}

// circles in the plane, largest first: each new one touches two already placed, as near the middle as it can
function pack(rs) {
  const n = rs.length, xs = new Float64Array(n), ys = new Float64Array(n);
  if (n > 1) xs[1] = rs[0] + rs[1];
  for (let k = 2; k < n; k++) {
    let best = Infinity, bx = 0, by = 0;
    for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
      const a = rs[i] + rs[k], b = rs[j] + rs[k];
      const dx = xs[j] - xs[i], dy = ys[j] - ys[i], d = Math.hypot(dx, dy);
      if (d > a + b || d < 1e-9) continue;
      const t = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - t * t));
      for (let sg = -1; sg <= 1; sg += 2) {
        const x = xs[i] + (dx * t - sg * dy * h) / d, y = ys[i] + (dy * t + sg * dx * h) / d;
        const q = x * x + y * y;
        if (q >= best) continue;
        let ok = true;
        for (let m = 0; m < k && ok; m++) {
          if (m !== i && m !== j && Math.hypot(x - xs[m], y - ys[m]) < rs[m] + rs[k] - 1e-6) ok = false;
        }
        if (ok) { best = q; bx = x; by = y; }
      }
    }
    if (best === Infinity) { for (let m = 0; m < k; m++) bx = Math.max(bx, xs[m] + rs[m]); bx += rs[k]; by = 0; }
    xs[k] = bx; ys[k] = by;
  }
  // the smallest circle around them all, near enough
  let cx = 0, cy = 0;
  for (let it = 1; it <= 400; it++) {
    let far = 0, fd = -1;
    for (let k = 0; k < n; k++) { const d = Math.hypot(xs[k] - cx, ys[k] - cy) + rs[k]; if (d > fd) { fd = d; far = k; } }
    const d = Math.hypot(xs[far] - cx, ys[far] - cy) || 1;
    const px = xs[far] + ((xs[far] - cx) / d) * rs[far], py = ys[far] + ((ys[far] - cy) / d) * rs[far];
    cx += (px - cx) / (it + 1); cy += (py - cy) / (it + 1);
  }
  let R = 0;
  for (let k = 0; k < n; k++) { xs[k] -= cx; ys[k] -= cy; R = Math.max(R, Math.hypot(xs[k], ys[k]) + rs[k]); }
  return { xs, ys, R };
}

export function buildTree(K) {
  const st = K.stations, S = st.length;
  const anc = new Uint8Array(S * S);   // anc[a * S + b]: a is b or one of b's ancestors
  for (let b = 0; b < S; b++) for (let a = b; a >= 0; a = st[a].parent) anc[a * S + b] = 1;

  // entry nodes: forms that came into a language from outside it; they share out its disc
  const entry = new Int32Array(S);
  for (let i = 0; i < K.N; i++) { const p = K.par[i]; if (p < 0 || K.st[p] !== K.st[i]) entry[K.st[i]]++; }

  // flow[a * S + b]: forms that crossed from language a into language b (not down a's own line)
  const flow = new Int32Array(S * S);
  for (let i = 0; i < K.N; i++) {
    const p = K.par[i];
    if (p < 0 || K.st[p] === K.st[i]) continue;
    const a = K.st[p], b = K.st[i], r = K.rel[i];
    if (!anc[a * S + b] || r === 'b' || r === 'l' || r === 'B' || r === 'L') flow[a * S + b]++;
  }

  // the layout tree: languages, then one limb per group beyond Indo-European, then the whole
  const groups = [...new Set(st.filter((s) => s.i && s.parent < 0).map((s) => s.group || 'Other'))];
  const M = S + groups.length + 1, ROOT = M - 1;
  const up = new Int16Array(M).fill(-1);
  for (const s of st) if (s.i) up[s.i] = s.parent > 0 ? s.parent : s.parent === 0 ? ROOT : S + groups.indexOf(s.group || 'Other');
  for (let g = 0; g < groups.length; g++) up[S + g] = ROOT;
  const used = new Uint8Array(M);
  for (const s of st) if (s.i && s.count > 0) for (let m = s.i; m >= 0 && !used[m]; m = up[m]) used[m] = 1;
  const kids = Array.from({ length: M }, () => []);
  for (let m = 0; m < ROOT; m++) if (used[m] && up[m] >= 0) kids[up[m]].push(m);

  // caps, in dot spacings, from the leaves up
  const disc = new Float64Array(M), cap = new Float64Array(M), px = new Float64Array(M), py = new Float64Array(M);
  const size = (m) => {
    if (m < S && st[m].count > 0) disc[m] = Math.sqrt(Math.max(1, entry[m]));
    let R = 0;
    if (kids[m].length && m !== ROOT) {
      for (const k of kids[m]) size(k);
      kids[m].sort((a, b) => cap[b] - cap[a]);
      const p = pack(kids[m].map((k) => cap[k]));
      kids[m].forEach((k, j) => { px[k] = p.xs[j]; py[k] = p.ys[j]; });
      R = p.R;
    }
    cap[m] = Math.max(disc[m] + PAD, R);
  };
  for (const k of kids[ROOT]) size(k);
  const tops = kids[ROOT];
  let sum = 0, big = 0;
  for (const k of tops) { sum += cap[k] * cap[k]; big = Math.max(big, cap[k]); }
  const c = Math.min(MAX_CAP / big, Math.sqrt((4 * FILL) / sum));   // radians per dot spacing
  for (let m = 0; m < M; m++) { disc[m] *= c; cap[m] *= c; }

  // the branches: start from the map, then push apart whatever overlaps
  const dir = new Float64Array(M * 3);
  const name = (m) => (m < S ? st[m].id : groups[m - S]);
  const D = tops.map((m, j) => {
    const p = PLACE[name(m)] || [(j * 137.5) % 360 - 180, ((j * 61) % 120) - 60];
    const lo = (p[0] * Math.PI) / 180, la = (p[1] * Math.PI) / 180;
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  });
  const home = D.map((d) => d.slice());
  const GAP = 0.035;
  for (let it = 0; it < 500; it++) {
    for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++) {
      const a = D[i], b = D[j], cs = Math.min(1, Math.max(-1, dot(a, b)));
      const need = cap[tops[i]] + cap[tops[j]] + GAP, over = need - Math.acos(cs);
      if (over <= 0) continue;
      // the smaller cap gives way more
      const wi = cap[tops[j]] / (cap[tops[i]] + cap[tops[j]]), k = over * 0.5;
      const ta = [b[0] - cs * a[0], b[1] - cs * a[1], b[2] - cs * a[2]], tb = [a[0] - cs * b[0], a[1] - cs * b[1], a[2] - cs * b[2]];
      const la = Math.hypot(ta[0], ta[1], ta[2]) || 1, lb = Math.hypot(tb[0], tb[1], tb[2]) || 1;
      for (let x = 0; x < 3; x++) { a[x] -= (ta[x] / la) * k * wi; b[x] -= (tb[x] / lb) * k * (1 - wi); }
      norm(a); norm(b);
    }
    const pull = 0.012 * (1 - it / 500);
    D.forEach((d, i) => { for (let x = 0; x < 3; x++) d[x] += (home[i][x] - d[x]) * pull; norm(d); });
  }
  // which side of a language's disc a borrowed form sits on: the limb its donor belongs to,
  // counted from where the two lines part. -1 is the core (inherited, or taken from an ancestor).
  const keys = new Int16Array(S * S).fill(-2);
  const onPath = new Uint8Array(M);
  const lobeKey = (d, s) => {
    if (d <= 0 || anc[d * S + s] || anc[s * S + d]) return -1;
    let k = keys[d * S + s];
    if (k > -2) return k;
    for (let m = s; m >= 0; m = up[m]) onPath[m] = 1;
    k = d;
    while (up[k] >= 0 && !onPath[up[k]]) k = up[k];
    for (let m = s; m >= 0; m = up[m]) onPath[m] = 0;
    return (keys[d * S + s] = k);
  };
  tops.forEach((m, j) => dir.set(D[j], m * 3));

  // what pulls each limb: the limbs its languages trade with, seen from where the two lines part
  const links = Array.from({ length: M }, () => new Map());
  for (let a = 1; a < S; a++) for (let b = 1; b < S; b++) {
    const w = flow[a * S + b] + flow[b * S + a];
    if (!w || a === b || anc[a * S + b]) continue;
    const key = lobeKey(b, a);
    if (key < 0) continue;
    for (let k = a; up[k] >= 0 && up[k] !== up[key]; k = up[k]) links[k].set(key, (links[k].get(key) || 0) + w);
  }
  // daughters are packed as one piece; turn the piece until each faces the languages it trades with
  const place = (m) => {
    const d = [dir[m * 3], dir[m * 3 + 1], dir[m * 3 + 2]], ks = kids[m];
    if (!ks.length) return;
    const tv = ks.map((k) => {
      const v = [0, 0, 0];
      for (const [key, w] of links[k]) for (let x = 0; x < 3; x++) v[x] += w * dir[key * 3 + x];
      return v;
    });
    let best = -Infinity, ca = 1, sa = 0, mir = 1;
    for (let mi = 1; mi >= -1; mi -= 2) for (let t = 0; t < 72; t++) {
      const a = (t / 72) * Math.PI * 2, c1 = Math.cos(a), s1 = Math.sin(a);
      let sc = 0;
      ks.forEach((k, j) => {
        const x = px[k] * c, y = py[k] * c * mi;
        sc += dot(tangent(d, x * c1 - y * s1, x * s1 + y * c1), tv[j]);
      });
      if (sc > best + 1e-9) { best = sc; ca = c1; sa = s1; mir = mi; }
    }
    for (const k of ks) {
      const x = px[k] * c, y = py[k] * c * mir;
      dir.set(tangent(d, x * ca - y * sa, x * sa + y * ca), k * 3);
      place(k);
    }
  };
  for (const m of tops) place(m);

  const rad = Float64Array.from(st, (s) => dateR(s.date));
  return { S, M, ROOT, up, kids, tops, anc, entry, flow, used, dir, cap, disc, rad, c, groups, lobeKey, name };
}
