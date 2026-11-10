// Etymon, languages: what lights up when something is chosen.
// Each function fills rel (one byte for every form: 0 nothing to do with it … 4 the thing itself)
// and returns where to look from: { dir, target, R, tilt }.

const unit = (x, y, z) => {
  const l = Math.hypot(x, y, z);
  return l > 1e-6 ? [x / l, y / l, z / l] : null;
};

// the middle of a set of forms, as a direction; null when they lie all round
const lean = (pos, list) => {
  let x = 0, y = 0, z = 0;
  for (const i of list) { x += pos[i * 3]; y += pos[i * 3 + 1]; z += pos[i * 3 + 2]; }
  const n = list.length || 1, l = Math.hypot(x, y, z) / n;
  return l > 0.12 ? unit(x, y, z) : null;
};

// a word: its family 1, what was made from it 2, the way back to its root 3, the word 4
export function relWord(K, L, i, rel) {
  const { par, fam, start } = K, pos = L.pos;
  rel.fill(0);
  const a = start[fam[i]], b = start[fam[i] + 1];
  for (let j = a; j < b; j++) rel[j] = 1;
  rel[i] = 4;
  for (let j = i + 1; j < b; j++) if (rel[par[j]] === 4 || rel[par[j]] === 2) rel[j] = 2;
  for (let p = par[i]; p >= 0; p = par[p]) rel[p] = 3;
  const r = Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  if (r < 0.14) {   // a root at the heart: stand back and see where it went
    const all = [];
    for (let j = a; j < b; j++) all.push(j);
    return { dir: lean(pos, all), target: [0, 0, 0], R: 1.12, tilt: 0 };
  }
  const d = unit(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  return { dir: d, target: [d[0] * r * 0.55, d[1] * r * 0.55, d[2] * r * 0.55], R: Math.max(0.42, r * 0.66), tilt: 0.55 };
}

// a language: its forms 3; where they came from and where they went 2; further back and on 1
export function relLang(K, T, L, s, rel) {
  const { N, par, st } = K;
  rel.fill(0);
  for (let i = 0; i < N; i++) if (st[i] === s) rel[i] = 3;
  // downstream first (5: taken straight from here, 6: taken on from there), parents before children
  for (let i = 0; i < N; i++) {
    const p = par[i];
    if (p < 0 || rel[i] === 3) continue;
    if (rel[p] === 3) rel[i] = 5;
    else if (rel[p] >= 5) rel[i] = 6;
  }
  for (let i = 0; i < N; i++) if (rel[i] >= 5) rel[i] = rel[i] === 5 ? 2 : 1;
  const up = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (st[i] !== s) continue;
    let p = par[i];
    if (p < 0 || st[p] === s) continue;
    if (rel[p] < 2) rel[p] = 2;
    for (p = par[p]; p >= 0 && !up[p]; p = par[p]) {
      up[p] = 1;
      if (!rel[p]) rel[p] = 1;
    }
  }
  if (!s) return { dir: null, target: [0, 0, 0], R: 1.12, tilt: 0 };
  const d = [T.dir[s * 3], T.dir[s * 3 + 1], T.dir[s * 3 + 2]], r = T.rad[s];
  return {
    dir: d, target: [d[0] * r * 0.96, d[1] * r * 0.96, d[2] * r * 0.96],
    R: Math.max(0.07, T.disc[s] * r * 1.4 + 0.03), tilt: 0.3,
  };
}

// two languages: the forms of each that have kin in the other 3, the line that joins them 2,
// the rest of both 1. Returns the families they share as well.
export function relPair(K, T, L, a, b, rel) {
  const { N, F, par, st, start } = K;
  rel.fill(0);
  const flag = new Uint8Array(N), kids = new Uint16Array(N), shared = [];
  for (let f = 0; f < F; f++) {
    const i0 = start[f], i1 = start[f + 1];
    let got = 0;
    for (let i = i0; i < i1; i++) {
      if (st[i] === a) { flag[i] = 1; got |= 1; } else if (st[i] === b) { flag[i] = 2; got |= 2; }
    }
    if (got !== 3) {
      if (got) for (let i = i0; i < i1; i++) if (flag[i]) rel[i] = 1;
      continue;
    }
    shared.push(f);
    for (let i = i1 - 1; i > i0; i--) if (flag[i]) { flag[par[i]] |= flag[i]; kids[par[i]]++; }
    // the join starts at the lowest form both lines pass through
    for (let i = i0; i < i1; i++) {
      if (!flag[i]) continue;
      const own = st[i] === a || st[i] === b, p = par[i];
      if (p >= 0 && rel[p] >= 2) rel[i] = own ? 3 : 2;
      else if (flag[i] === 3 && (own || kids[i] > 1)) rel[i] = own ? 3 : 2;
      else if (own) rel[i] = 1;
    }
  }
  const pa = T.rad[a], pb = T.rad[b];
  const A = [T.dir[a * 3] * pa, T.dir[a * 3 + 1] * pa, T.dir[a * 3 + 2] * pa];
  const B = [T.dir[b * 3] * pb, T.dir[b * 3 + 1] * pb, T.dir[b * 3 + 2] * pb];
  const gap = Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
  const view = {
    dir: unit(A[0] + B[0], A[1] + B[1], A[2] + B[2]),
    target: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2],
    R: gap / 2 + Math.max(T.disc[a] * pa, T.disc[b] * pb) * 1.15 + 0.04,
    tilt: gap < 0.3 ? 0.6 : 0.15,
  };
  if (!a || !b) Object.assign(view, { dir: null, target: [0, 0, 0], R: 1.12, tilt: 0 });
  return { view, shared };
}

// any handful of forms (a finding): the forms 3, their way back to the root 2
export function relSet(K, L, list, rel, paths = true) {
  rel.fill(0);
  for (const i of list) {
    rel[i] = 3;
    if (!paths) continue;
    for (let p = K.par[i]; p >= 0 && !rel[p]; p = K.par[p]) rel[p] = 2;
  }
  for (const i of list) rel[i] = 3;
  return { dir: lean(L.pos, list), target: [0, 0, 0], R: 1.12, tilt: 0 };
}
