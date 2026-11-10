// Etymon, languages: the scene buffers space-gl.js draws.
// Dots are forms, coloured by the branch they started in. Three kinds of line: a short one
// between a form and what was made from it inside a language, a fibre handed down a line of
// descent, and an arc for a word taken across: it leaves the globe and comes down elsewhere.

import { NODE_FLOATS, SEG_FLOATS, glowLin, hash, rng } from './space-layout.js';

const one = (count) => {
  const s = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { s[i * 4] = 1; s[i * 4 + 2] = 1; }
  return s;
};

export function buildMesh(K, T, L) {
  const { N, par, st, fam } = K, { pos, tg, etype, orig } = L;
  const cols = K.branches.map((b) => glowLin(b.color));
  const SEED = 0.3;

  const nodes = new Float32Array((N + 1) * NODE_FLOATS);
  const size = new Float32Array(N + 1);
  for (let i = 0; i < N; i++) {
    const s = st[i], col = cols[orig[i]], rk = K.rank.charCodeAt(i) - 48;
    let sz, inten;
    if (!s) { sz = par[i] < 0 ? 0.0025 : 0.0017; inten = par[i] < 0 ? 0.5 : 0.3; }
    else { sz = 0.0019 + 0.00021 * rk; inten = (T.rad[s] > 0.9 ? 0.5 : 0.34) + 0.035 * rk; }
    size[i] = sz;
    nodes.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], sz, tg[i], hash(i + 7), 2, col[0], col[1], col[2], inten], i * NODE_FLOATS);
  }
  size[N] = 0.009;   // the core: where it all starts
  nodes.set([0, 0, 0, 0.009, 0.001, 0.5, 3, 1.0, 0.93, 0.8, 1.0], N * NODE_FLOATS);

  // how many pieces each line takes
  const cnt = new Uint8Array(N), ang = new Float32Array(N);
  let total = 0;
  for (let i = 0; i < N; i++) {
    const p = par[i];
    if (p < 0) continue;
    const ax = pos[p * 3], ay = pos[p * 3 + 1], az = pos[p * 3 + 2], bx = pos[i * 3], by = pos[i * 3 + 1], bz = pos[i * 3 + 2];
    const w = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz) || 1))));
    ang[i] = w;
    // out of the seed at the centre a line runs straight: down there a direction means nothing
    if (Math.hypot(ax, ay, az) < SEED) { cnt[i] = 1; total++; continue; }
    cnt[i] = etype[i] === 3 ? Math.max(3, Math.min(8, Math.round(w / 0.17) + 2)) : etype[i] === 2 && w > 0.22 ? 3 : 1;
    total += cnt[i];
  }

  const segs = new Float32Array(total * SEG_FLOATS), segNode = new Int32Array(total);
  let k = 0;
  // kind 2 (its own colour), and behind the point a number of the line's own, the same for every piece
  // of it: when faint lines are thinned out, a line stays or goes whole
  const put = (a, b, ta, tb, ph, col, inten, i) => {
    segs.set([a[0], a[1], a[2], b[0], b[1], b[2], ta, tb, ph, 2 + 0.49 * hash(i + 11), col[0], col[1], col[2], inten], k * SEG_FLOATS);
    segNode[k++] = i;
  };
  const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0], P = [0, 0, 0], Q = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const p = par[i], n = cnt[i];
    if (p < 0) continue;
    for (let x = 0; x < 3; x++) { A[x] = pos[p * 3 + x]; B[x] = pos[i * 3 + x]; }
    const col = cols[orig[i]], ph = hash(fam[i] + 31), ta = tg[p], tb = tg[i], e = etype[i];
    if (n === 1) { put(A, B, ta, tb, ph, col, e === 1 ? 0.1 : 0.05, i); continue; }
    // a curve through a point above the middle: the bisector, raised
    const ra = Math.hypot(A[0], A[1], A[2]) || 1e-6, rb = Math.hypot(B[0], B[1], B[2]) || 1e-6;
    for (let x = 0; x < 3; x++) C[x] = A[x] / ra + B[x] / rb;
    let cl = Math.hypot(C[0], C[1], C[2]);
    if (cl < 0.05) {   // straight across the globe: any way round will do
      const h = Math.abs(A[1]) < 0.9 * ra ? [0, 1, 0] : [1, 0, 0];
      C[0] = A[1] * h[2] - A[2] * h[1]; C[1] = A[2] * h[0] - A[0] * h[2]; C[2] = A[0] * h[1] - A[1] * h[0];
      cl = Math.hypot(C[0], C[1], C[2]);
    }
    const mid = ((A[0] + B[0]) * C[0] + (A[1] + B[1]) * C[1] + (A[2] + B[2]) * C[2]) / (2 * cl);
    const lift = e === 3 ? Math.min(0.3, 0.05 + 0.15 * ang[i]) * (0.8 + 0.4 * hash(i + 3)) : 0;
    const top = e === 3 ? Math.max(ra, rb) * (1 + lift) : (ra + rb) / 2;
    const cr = (2 * top - mid) / cl;
    for (let x = 0; x < 3; x++) { C[x] *= cr; P[x] = A[x]; }
    const inten = e === 3 ? 0.045 : 0.04;
    // a line grows with the globe: each point of it comes when the growing shell reaches its height
    let tp = ta;
    for (let s = 1; s <= n; s++) {
      const t = s / n, u = 1 - t;
      for (let x = 0; x < 3; x++) Q[x] = u * u * A[x] + 2 * u * t * C[x] + t * t * B[x];
      const tq = s === n || tb <= ta ? ta + (tb - ta) * t : Math.max(tp, Math.min(tb, Math.hypot(Q[0], Q[1], Q[2])));
      put(P, Q, tp, tq, ph, col, inten, i);
      tp = tq;
      P[0] = Q[0]; P[1] = Q[1]; P[2] = Q[2];
    }
  }

  // stars far off, and a little dust between here and them
  const rand = rng(20261110);
  const NEAR = 360, FAR = 1700;
  const dust = new Float32Array((NEAR + FAR) * NODE_FLOATS);
  for (let i = 0; i < NEAR + FAR; i++) {
    const far = i >= NEAR;
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const r = far ? 6 + rand() * 8 : 1.35 + rand() * 1.7;
    const tone = rand();
    const col = far ? [0.75 + 0.25 * tone, 0.82 + 0.1 * tone, 1.0] : [0.62, 0.74, 1.0];
    dust.set([
      s * Math.cos(a) * r, u * r, s * Math.sin(a) * r,
      far ? r * (0.00045 + 0.0011 * rand() ** 3) : 0.0012 + 0.0016 * rand(), 0, rand(), far ? 5 : 4,
      col[0], col[1], col[2], far ? 0.1 + 0.8 * rand() ** 3 : 0.06 + 0.12 * rand(),
    ], i * NODE_FLOATS);
  }

  return { N, pos, size, tg, maxRad: L.maxRad, nodes, nodeState: one(N + 1), segs, segState: one(total), segNode, dust };
}
