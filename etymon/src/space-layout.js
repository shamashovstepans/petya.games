// Etymon in three dimensions: where every word sits in space.
// Distance from the centre is time (the same scale as the flat map). Direction comes from
// nested caps on a sphere: nine domains, roots inside a domain, children inside their parent.

import { timeToR, DOMAINS, FAMILIES } from './langs.js';

export const GOLDEN = 2.399963229728653;
const STEP = 0.02;     // a child sits at least this far out from its parent
const PACK = 0.82;     // how tightly child discs fill their parent's cap
const SPREAD = 1.18;   // how much wider a child's own cap is than its packed disc
const WARP = 0.16;     // organic bend
const SWIRL = 0.6;     // slow twist around the vertical axis, per unit radius
const HOLE = 0.22;     // the first roots stand this far off the core, on a shell of their own

export const NODE_FLOATS = 11;
export const SEG_FLOATS = 14;

// ---------- small maths ----------

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function hexLin(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [lin(((v >> 16) & 255) / 255), lin(((v >> 8) & 255) / 255), lin((v & 255) / 255)];
}
// family colours, lifted so they glow rather than smoulder
export function glowLin(hex) {
  const c = hexLin(hex);
  const m = Math.max(c[0], c[1], c[2], 1e-4);
  return c.map((x) => (x / m) * 0.86 + 0.14);
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= l; v[1] /= l; v[2] /= l;
  return v;
};
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// a point (x, y), in radians, on the tangent plane at d -> a direction
export function tangent(d, x, y) {
  const th = Math.hypot(x, y);
  if (th < 1e-6) return d.slice();
  const h = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = norm(cross(h, d));
  const t2 = cross(d, t1);
  const c = Math.cos(th), s = Math.sin(th) / th;
  return norm([
    d[0] * c + (t1[0] * x + t2[0] * y) * s,
    d[1] * c + (t1[1] * x + t2[1] * y) * s,
    d[2] * c + (t1[2] * x + t2[2] * y) * s,
  ]);
}

export function slerp(a, b, t) {
  const c = Math.min(1, Math.max(-1, dot(a, b)));
  const om = Math.acos(c);
  if (om < 1e-4) return a.slice();
  const s = Math.sin(om);
  const ka = Math.sin((1 - t) * om) / s, kb = Math.sin(t * om) / s;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}

// time radius -> distance from the core: everything is pushed out to leave the centre hollow
const shell = (r) => r + HOLE * (1 - r) * smooth(0, 0.04, r);

// direction + radius -> a place in the world, bent a little so nothing looks ruled
export function warp(d, r, out, o = 0) {
  const R = shell(r);
  const A = WARP * smooth(0.03, 0.55, r);
  const px = d[0] * 2.3 + r * 1.7, py = d[1] * 2.3 - r * 1.3, pz = d[2] * 2.3 + r * 0.9;
  let x = d[0] + A * (Math.sin(py * 1.9 + 1.3) + 0.5 * Math.sin(pz * 3.1 + px));
  let y = d[1] + A * (Math.sin(pz * 1.7 + 4.1) + 0.5 * Math.sin(px * 2.9 + py));
  let z = d[2] + A * (Math.sin(px * 2.1 + 2.2) + 0.5 * Math.sin(py * 3.3 + pz));
  const l = Math.hypot(x, y, z) || 1;
  x /= l; y /= l; z /= l;
  const a = SWIRL * r, ca = Math.cos(a), sa = Math.sin(a);
  out[o] = (x * ca + z * sa) * R;
  out[o + 1] = y * R;
  out[o + 2] = (-x * sa + z * ca) * R;
  return out;
}

// discs in a disc: weights (largest first) -> centres and radii, in radians
function packCap(ws, alpha, seed) {
  const n = ws.length;
  const rot = seed * Math.PI * 2;
  if (n === 1) return [{ x: Math.cos(rot) * 0.18 * alpha, y: Math.sin(rot) * 0.18 * alpha, r: 0.9 * alpha }];
  let W = 0;
  for (const w of ws) W += w;
  const out = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const f = (acc + ws[i] / 2) / W;
    acc += ws[i];
    const rr = alpha * Math.sqrt(f) * 0.92;
    const a = rot + i * GOLDEN;
    out.push({ x: rr * Math.cos(a), y: rr * Math.sin(a), r: alpha * Math.sqrt(ws[i] / W) * PACK });
  }
  for (let it = 0; it < 40; it++) {
    for (let i = 0; i < n; i++) {
      const a = out[i];
      for (let j = i + 1; j < n; j++) {
        const b = out[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const over = a.r + b.r - d;
        if (over <= 0) continue;
        dx /= d; dy /= d;
        const ka = (b.r / (a.r + b.r)) * over * 0.5, kb = (a.r / (a.r + b.r)) * over * 0.5;
        a.x -= dx * ka; a.y -= dy * ka;
        b.x += dx * kb; b.y += dy * kb;
      }
    }
    for (const a of out) {
      const d = Math.hypot(a.x, a.y);
      const max = Math.max(0, alpha - a.r * 0.6);
      if (d > max) { a.x *= max / d; a.y *= max / d; }
    }
  }
  return out;
}

// ---------- the layout ----------

export function buildSpace(g) {
  const N = g.nodes.length;
  const idx = new Map(g.nodes.map((n, i) => [n, i]));
  const parent = new Int32Array(N).fill(-1);
  const kids = g.nodes.map(() => []);
  for (const e of g.edges) {
    if (!e.primary) continue;
    const a = idx.get(e.source), b = idx.get(e.target);
    parent[b] = a;
    kids[a].push(b);
  }
  const byDepth = g.nodes.map((_, i) => i).sort((a, b) => g.nodes[a].depth - g.nodes[b].depth);

  const rad = new Float32Array(N);
  for (const i of byDepth) {
    const n = g.nodes[i];
    const t = timeToR(n.date);
    rad[i] = parent[i] < 0 ? t : Math.max(t, rad[parent[i]] + STEP);
  }
  const wt = new Float32Array(N);
  for (let k = N - 1; k >= 0; k--) {
    const i = byDepth[k];
    let w = 1;
    for (const c of kids[i]) w += wt[c];
    wt[i] = w;
  }

  // nine domain caps, pushed apart on the sphere until they stop overlapping
  const rootIdx = new Int32Array(N).fill(-1);
  const rootNode = g.roots.map((r) => idx.get(r.node));
  const doms = DOMAINS.map((d) => ({ ...d, roots: [], w: 0, dir: null, alpha: 0 }));
  const domOf = Object.fromEntries(doms.map((d) => [d.id, d]));
  g.roots.forEach((r, k) => {
    const d = domOf[r.domain] || doms[doms.length - 1];
    d.roots.push(k);
    d.w += wt[rootNode[k]];
  });
  let W = 0;
  for (const d of doms) W += d.w;
  doms.forEach((d, i) => {
    d.alpha = Math.acos(1 - 2 * (d.w / W)) * 0.74;
    const y = 1 - (2 * (i + 0.5)) / doms.length;
    const rr = Math.sqrt(1 - y * y);
    d.dir = [Math.cos(i * GOLDEN) * rr, y, Math.sin(i * GOLDEN) * rr];
  });
  for (let it = 0; it < 300; it++) {
    for (let i = 0; i < doms.length; i++) {
      for (let j = i + 1; j < doms.length; j++) {
        const a = doms[i], b = doms[j];
        const th = Math.acos(Math.min(1, Math.max(-1, dot(a.dir, b.dir))));
        const push = Math.max(0, a.alpha + b.alpha - th) * 0.25 + 0.0015 / (th * th + 0.05);
        const ax = cross(a.dir, b.dir);
        if (Math.hypot(ax[0], ax[1], ax[2]) < 1e-6) continue;
        norm(ax);
        const ta = cross(a.dir, ax), tb = cross(ax, b.dir); // away from each other
        for (let k = 0; k < 3; k++) { a.dir[k] += ta[k] * push; b.dir[k] += tb[k] * push; }
        norm(a.dir); norm(b.dir);
      }
    }
  }

  // children inside their parent's cap, all the way down
  const dir = new Array(N);
  const place = (list, d, alpha, seed) => {
    if (!list.length) return;
    list.sort((a, b) => wt[b] - wt[a]);
    const eff = Math.max(alpha, 0.035 * Math.sqrt(list.length));
    const spots = packCap(list.map((i) => wt[i]), eff, seed);
    list.forEach((i, k) => {
      const s = spots[k];
      dir[i] = tangent(d, s.x, s.y);
      place(kids[i], dir[i], s.r * SPREAD, hash(i + 1));
    });
  };
  doms.forEach((d, k) => {
    const list = d.roots.map((r) => rootNode[r]);
    place(list, d.dir, d.alpha, hash(900 + k));
  });
  g.roots.forEach((r, k) => {
    const q = [rootNode[k]];
    while (q.length) {
      const i = q.pop();
      rootIdx[i] = k;
      for (const c of kids[i]) q.push(c);
    }
  });

  // ---------- buffers ----------

  const pos = new Float32Array((N + 1) * 3);
  const size = new Float32Array(N + 1);
  const nodes = new Float32Array((N + 1) * NODE_FLOATS);
  const famLin = Object.fromEntries(Object.entries(FAMILIES).map(([k, f]) => [k, glowLin(f.color)]));
  const warm = hexLin('#f3e6c4');
  let maxRad = 0;
  for (let i = 0; i < N; i++) {
    const n = g.nodes[i];
    warp(dir[i], rad[i], pos, i * 3);
    maxRad = Math.max(maxRad, rad[i]);
    const z = n.zipf ?? 2.5;
    let kind = 0, sz = 0.0017, inten = 0.42, col = famLin[n.family] || famLin.other;
    if (n.isRoot) { kind = 2; sz = 0.0044; inten = 0.95; col = warm; }
    else if (n.isEn) { kind = 1; sz = 0.0016 + 0.00046 * z; inten = 0.72 + 0.07 * z; }
    size[i] = sz;
    nodes.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], sz, rad[i], hash(i + 7), kind, col[0], col[1], col[2], inten], i * NODE_FLOATS);
  }
  size[N] = 0.011; // the core: where it all starts
  nodes.set([0, 0, 0, 0.011, 0.001, 0.5, 3, 1.0, 0.93, 0.8, 1.3], N * NODE_FLOATS);

  const segs = [];
  const segSrc = [], segDst = [], segType = []; // type: 0 primary, 1 cross, 2 spoke
  const A = [0, 0, 0], B = [0, 0, 0];
  const strand = (da, ra, db, rb, ease, count, phase, kind, col, inten, src, dst, type) => {
    warp(da, ra, A);
    let pr = ra;
    for (let s = 1; s <= count; s++) {
      const t = s / count;
      const r = ra + (rb - ra) * t;
      warp(norm(slerp(da, db, ease ? 1 - (1 - t) ** 2.2 : t)), r, B);
      segs.push(A[0], A[1], A[2], B[0], B[1], B[2], pr, r, phase, kind, col[0], col[1], col[2], inten);
      segSrc.push(src); segDst.push(dst); segType.push(type);
      A[0] = B[0]; A[1] = B[1]; A[2] = B[2];
      pr = r;
    }
  };
  for (const e of g.edges) {
    const a = idx.get(e.source), b = idx.get(e.target);
    const ang = Math.acos(Math.min(1, Math.max(-1, dot(dir[a], dir[b]))));
    const col = famLin[e.target.family] || famLin.other;
    const phase = hash(rootIdx[b] + 31);
    if (e.primary) {
      const count = Math.min(12, Math.max(2, Math.ceil(ang / 0.1 + (rad[b] - rad[a]) / 0.05)));
      const flow = Math.min(1, Math.log2(1 + e.target.enDesc.size) / 6);
      strand(dir[a], rad[a], dir[b], rad[b], true, count, phase, 0, col, 0.17 + 0.17 * flow, a, b, 0);
    } else {
      const count = Math.min(10, Math.max(3, Math.ceil(ang / 0.12)));
      strand(dir[a], rad[a], dir[b], rad[b], false, count, phase, 1, col, 0.06, a, b, 1);
    }
  }
  g.roots.forEach((r, k) => {
    if (r.domain === 'wander') return; // the wanderers did not grow from this centre
    const i = rootNode[k];
    strand(dir[i], 0.0005, dir[i], rad[i], false, 4, hash(k + 31), 2, warm, 0.13, N, i, 2);
  });

  const rand = rng(20261109);
  const DUST_NEAR = 520, DUST_FAR = 1700;
  const dust = new Float32Array((DUST_NEAR + DUST_FAR) * NODE_FLOATS);
  for (let i = 0; i < DUST_NEAR + DUST_FAR; i++) {
    const far = i >= DUST_NEAR;
    const u = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const r = far ? 6 + rand() * 8 : 0.3 + Math.cbrt(rand()) * 1.9;
    const tone = rand();
    const col = far ? [0.75 + 0.25 * tone, 0.82 + 0.1 * tone, 1.0] : [0.62, 0.74, 1.0];
    dust.set([
      s * Math.cos(a) * r, u * r, s * Math.sin(a) * r,
      far ? r * (0.00045 + 0.0011 * rand() ** 3) : 0.0012 + 0.0016 * rand(), 0, rand(), far ? 5 : 4,
      col[0], col[1], col[2], far ? 0.1 + 0.8 * rand() ** 3 : 0.07 + 0.16 * rand(),
    ], i * NODE_FLOATS);
  }

  const one = (count) => {
    const s = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { s[i * 4] = 1; s[i * 4 + 2] = 1; }
    return s;
  };
  const segData = new Float32Array(segs);
  return {
    N, pos, size, rad, parent, rootIdx, kids, maxRad,
    nodes, nodeState: one(N + 1),
    segs: segData, segState: one(segData.length / SEG_FLOATS),
    segSrc: Int32Array.from(segSrc), segDst: Int32Array.from(segDst), segType: Uint8Array.from(segType),
    dust,
    domains: doms.map((d) => ({ id: d.id, name: d.name, pos: warp(d.dir, 1.12, [0, 0, 0]) })),
    index: idx,
  };
}
