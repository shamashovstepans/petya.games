// Etymon, languages: where every form sits.
// A language is a disc on the globe. Its own words fill the middle; the words it took from
// elsewhere fill the rim, each on the side that faces the language they came from. Colour
// (kin-mesh.js) is the branch a word started in, so a green dot in a pink petal is a Germanic
// word that came back through French.

import { GOLDEN, hash, tangent, norm, cross, dot } from './space-layout.js';

const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);
const LIFT = 0.011;     // forms made inside a language rise this much per step
const JITTER = 0.006;   // so a language is a thin cloud, not a shell
const ISLE = 90;        // a handful of loans from far away is an island off the coast, not a sliver

export function buildLayout(K, T) {
  const { N, par, st, fam, rel } = K, S = T.S, stn = K.stations, c = T.c;
  const orig = new Uint8Array(N), etype = new Uint8Array(N), gen = new Uint8Array(N);
  const donor = new Int16Array(N).fill(-1), lobe = new Int16Array(N).fill(-1);

  // 1. how each form reached its language: 0 a root, 1 made inside it, 2 handed down, 3 taken across.
  //    donor: the language of the last crossing on the way; orig: the first branch outside the root.
  for (let i = 0; i < N; i++) {
    const p = par[i], s = st[i];
    if (p < 0) { orig[i] = s ? stn[s].branch : 0; continue; }
    const ps = st[p], r = rel[i];
    orig[i] = orig[p] || (s ? stn[s].branch : 0);
    if (ps === s) { etype[i] = 1; donor[i] = donor[p]; gen[i] = Math.min(200, gen[p] + 1); }
    else if (T.anc[ps * S + s] && r !== 'b' && r !== 'l' && r !== 'B' && r !== 'L') { etype[i] = 2; donor[i] = donor[p]; }
    else { etype[i] = 3; donor[i] = ps; }
  }

  // 2. the forms that came into each language, by the language they came from (-1: its own).
  //    lobe: the limb that language belongs to; it decides which side of the disc they sit on.
  const lists = Array.from({ length: S }, () => new Map());
  for (let i = 0; i < N; i++) {
    const s = st[i];
    if (!s || etype[i] === 1) continue;
    const k = (lobe[i] = T.lobeKey(donor[i], s)) < 0 ? -1 : donor[i];
    if (!lists[s].has(k)) lists[s].set(k, []);
    lists[s].get(k).push(i);
  }

  // 3. their places on the language's own plane
  const tx = new Float32Array(N), ty = new Float32Array(N);
  // one list into a ring (R0..R1) and an arc (from a0, w wide; w = 0: all round, each family at
  // its own bearing, the same in every language). A family's forms stay together.
  const fill = (list, R0, R1, a0, w) => {
    const n = list.length;
    for (let j = 0; j < n;) {
      const f = fam[list[j]];
      let e = j + 1;
      while (e < n && fam[list[e]] === f) e++;
      const q = (j + e) / (2 * n), r = Math.sqrt(R0 * R0 + q * (R1 * R1 - R0 * R0));
      const u = frac((f * GOLDEN) / TAU);
      const a = w ? a0 + (w < 6.2 ? 0.04 + 0.92 * u : u) * w : f * GOLDEN;
      const x = r * Math.cos(a), y = r * Math.sin(a), turn = hash(f) * TAU;
      for (let m = 0; j < e; j++, m++) {
        const o = c * 0.95 * Math.sqrt(m), b = m * GOLDEN + turn;
        tx[list[j]] = x + o * Math.cos(b);
        ty[list[j]] = y + o * Math.sin(b);
      }
    }
  };
  const petals = new Array(S).fill(null);
  for (let s = 1; s < S; s++) {
    const L = lists[s];
    if (!L.size) continue;
    const d = [T.dir[s * 3], T.dir[s * 3 + 1], T.dir[s * 3 + 2]], A = T.disc[s];
    const h = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], t1 = norm(cross(h, d)), t2 = cross(d, t1);
    const bearing = (m) => {
      const v = [T.dir[m * 3] - d[0], T.dir[m * 3 + 1] - d[1], T.dir[m * 3 + 2] - d[2]];
      return Math.atan2(dot(v, t2), dot(v, t1));
    };
    const own = L.get(-1) || [];
    const limbs = new Map();
    let nOut = 0;
    for (const [dn, list] of L) {
      if (dn < 0) continue;
      const k = T.lobeKey(dn, s);
      if (!limbs.has(k)) limbs.set(k, { k, n: 0, b: bearing(k), parts: [], w: 0, r: 0 });
      const o = limbs.get(k);
      o.parts.push({ d: dn, list, n: list.length, b: bearing(dn), e: 0 });
      o.n += list.length;
      nOut += list.length;
    }
    const all = [...limbs.values()].sort((p, q) => q.n - p.n);
    const secs = [], isles = [];
    all.forEach((o, j) => {
      const thin = o.n < 6 || ((TAU * o.n) / nOut) * A < 5 * c;
      if (o.n <= ISLE && thin && (j || own.length)) isles.push(o); else secs.push(o);
    });
    let nSec = 0;
    for (const o of secs) nSec += o.n;
    for (const o of secs) o.w = (TAU * o.n) / nSec;
    const A0 = A * Math.sqrt(own.length / (own.length + nSec || 1));

    // limbs go round in the order of their bearings; turn the ring until they face their donors
    secs.sort((p, q) => p.b - q.b);
    let best = Infinity, off = 0;
    for (let t = 0; t < 72 && secs.length; t++) {
      let a = (t / 72) * TAU, cost = 0;
      for (const o of secs) {
        let e = a + o.w / 2 - o.b;
        e -= TAU * Math.round(e / TAU);
        cost += o.n * e * e;
        a += o.w;
      }
      if (cost < best) { best = cost; off = (t / 72) * TAU; }
    }
    fill(own, 0, A0, 0, 0);
    // inside a limb's share, one petal for each language that gave enough to see
    const subs = [];
    for (const o of secs) {
      const keep = [], rest = [];
      for (const p of o.parts) {
        if (p.n >= 12 && ((o.w * p.n) / o.n) * A >= 4 * c) keep.push(p); else rest.push(...p.list);
        p.e = p.b - o.b;
        p.e -= TAU * Math.round(p.e / TAU);
      }
      keep.sort((p, q) => p.e - q.e);
      if (keep.length && ((o.w * rest.length) / o.n) * A < 4 * c) {   // too few to stand alone
        const big = keep.reduce((p, q) => (q.n > p.n ? q : p));
        big.list = big.list.concat(rest).sort((x, y) => x - y);
        big.n = big.list.length;
      } else if (rest.length) keep.push({ d: -1, list: rest.sort((x, y) => x - y), n: rest.length });
      for (const p of keep) {
        const w = (o.w * p.n) / o.n;
        fill(p.list, A0, A, off, w);
        subs.push({ k: o.k, d: p.d, n: p.n, a: off, w });
        off += w;
      }
    }

    // islands: off the coast on the side they came from, pushed apart where they would touch
    isles.sort((p, q) => p.b - q.b);
    for (const o of isles) o.r = c * (0.95 * Math.sqrt(o.n) + 0.6);
    for (let it = 0; it < 30 && isles.length > 1; it++) {
      for (let j = 0; j < isles.length; j++) {
        const p = isles[j], q = isles[(j + 1) % isles.length];
        let gap = q.b - p.b;
        gap -= TAU * Math.floor(gap / TAU);
        const need = (p.r + q.r) / (A + Math.max(p.r, q.r));
        if (gap < need) { p.b -= (need - gap) / 2; q.b += (need - gap) / 2; }
      }
    }
    for (const o of isles) {
      const R = A + o.r + c * 0.4, x = R * Math.cos(o.b), y = R * Math.sin(o.b);
      let m = 0;
      for (const p of o.parts) for (const i of p.list) {
        const q = c * 0.95 * Math.sqrt(m + 0.5), b = m++ * GOLDEN;
        tx[i] = x + q * Math.cos(b);
        ty[i] = y + q * Math.sin(b);
      }
    }
    petals[s] = {
      A, A0, own: own.length, secs: subs,
      isles: isles.map(({ k, n, b, r }) => ({ k, n, b, r })),
    };
  }

  // forms made inside a language sit beside the form they were made from
  const nth = new Uint16Array(N);
  for (let i = 0; i < N; i++) {
    if (etype[i] !== 1 || !st[i]) continue;
    const p = par[i], k = nth[p]++, o = c * 0.75 * Math.sqrt(k + 1), a = k * GOLDEN + hash(p) * TAU;
    tx[i] = tx[p] + o * Math.cos(a);
    ty[i] = ty[p] + o * Math.sin(a);
    lobe[i] = lobe[p];
  }

  // 4. onto the globe: direction from the language, radius from its date
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const s = st[i];
    if (!s) continue;
    const v = tangent([T.dir[s * 3], T.dir[s * 3 + 1], T.dir[s * 3 + 2]], tx[i], ty[i]);
    const r = T.rad[s] * (1 + LIFT * gen[i] + (hash(i) - 0.5) * JITTER);
    pos[i * 3] = v[0] * r; pos[i * 3 + 1] = v[1] * r; pos[i * 3 + 2] = v[2] * r;
  }

  // 5. Proto-Indo-European: a seed at the middle. A root leans toward the branches that kept it,
  //    so the roots every branch shares sit at the heart.
  const rdir = (i) => {
    const u = hash(i + 0.5) * 2 - 1, a = hash(i * 1.37 + 9.1) * TAU, q = Math.sqrt(1 - u * u);
    return [q * Math.cos(a), u, q * Math.sin(a)];
  };
  const top = new Int16Array(S), seen = new Int32Array(T.M);
  for (let s = 1; s < S; s++) { let m = s; while (T.up[m] >= 0 && T.up[m] !== T.ROOT) m = T.up[m]; top[s] = m; }
  for (let f = 0; f < K.F; f++) {
    const i0 = K.start[f];
    if (st[i0]) continue;
    let x = 0, y = 0, z = 0, n = 0;
    for (let i = i0 + 1; i < K.start[f + 1]; i++) {
      const m = top[st[i]];
      if (!st[i] || seen[m] === f + 1) continue;
      seen[m] = f + 1;
      x += T.dir[m * 3]; y += T.dir[m * 3 + 1]; z += T.dir[m * 3 + 2]; n++;
    }
    const v = rdir(f), rr = 0.04 * Math.cbrt(0.1 + 0.9 * hash(f + 0.25)), k = n ? 0.05 / n : 0;
    pos[i0 * 3] = v[0] * rr + x * k; pos[i0 * 3 + 1] = v[1] * rr + y * k; pos[i0 * 3 + 2] = v[2] * rr + z * k;
  }
  for (let i = 0; i < N; i++) {
    const p = par[i];
    if (st[i] || p < 0) continue;
    const v = rdir(i);
    let x = pos[p * 3], y = pos[p * 3 + 1], z = pos[p * 3 + 2];
    if (st[p]) { x = v[0] * 0.07; y = v[1] * 0.07; z = v[2] * 0.07; }   // listed under a later form: rare
    const l = Math.hypot(x, y, z) || 1;
    pos[i * 3] = x + ((x / l) * 0.5 + v[0] * 0.85) * 0.014;
    pos[i * 3 + 1] = y + ((y / l) * 0.5 + v[1] * 0.85) * 0.014;
    pos[i * 3 + 2] = z + ((z / l) * 0.5 + v[2] * 0.85) * 0.014;
  }

  // 6. when each form appears as the tree grows: at its date, and never before the form it came from
  const tg = new Float32Array(N);
  let maxRad = 0;
  for (let i = 0; i < N; i++) {
    const p = par[i], x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], r = Math.hypot(x, y, z);
    let t = st[i] ? r : 0.035 + r * 0.5;
    if (p >= 0) {
      let dl = 0.004;
      if (etype[i] === 2) dl = 0.01;
      else if (etype[i] === 3) {
        const px = pos[p * 3], py = pos[p * 3 + 1], pz = pos[p * 3 + 2];
        const cs = (x * px + y * py + z * pz) / (r * Math.hypot(px, py, pz) || 1);
        dl = 0.03 + 0.05 * Math.acos(Math.max(-1, Math.min(1, cs)));
      }
      t = Math.max(t, tg[p] + dl);
    }
    tg[i] = t;
  }
  // a long chain of loans would run far past today: ease whatever lies beyond it into a short tail
  for (let i = 0; i < N; i++) {
    if (tg[i] > 1) tg[i] = 1 + 0.3 * (1 - Math.exp(-(tg[i] - 1) / 0.3));
    if (tg[i] > maxRad) maxRad = tg[i];
  }
  return { pos, tg, orig, etype, donor, lobe, gen, petals, maxRad };
}
