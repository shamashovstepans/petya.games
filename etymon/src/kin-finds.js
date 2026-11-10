// Etymon, languages: things worth pointing at, found by going through all the words once.

import { depths } from './kin-addr.js';

const upper = (r) => r >= 65 && r <= 90;   // a step the dictionary is not sure of
const affix = (w) => w.charCodeAt(0) === 45 || w.charCodeAt(w.length - 1) === 45;

// One word, taken twice: words of the language s that were one word once and came down by different
// roads (shirt from Old English, skirt from Old Norse, and both were Proto-Germanic *skurtijǭ).
// The dictionary names them itself ("doublet of"); here they are gathered into groups, each with
// the form where the roads part.
// -> [{ c, list: the words, best known first }], the best known groups first
export function doublets(K, s) {
  const { st, par, rank, form, dbl } = K, d = depths(K), top = new Map();
  const find = (i) => { let r = i; while (top.has(r) && top.get(r) !== r) r = top.get(r); return r; };
  for (let k = 0; k < dbl.length; k += 2) {
    const a = dbl[k], b = dbl[k + 1];
    if (st[a] !== s || st[b] !== s) continue;
    const ra = find(a), rb = find(b);
    top.set(ra, ra);
    top.set(rb, ra);
  }
  const groups = new Map();
  for (const i of top.keys()) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  const out = [];
  for (const g of groups.values()) {
    const list = [...new Map(g.map((j) => [form[j].toLowerCase(), j])).values()]
      .sort((a, b) => rank.charCodeAt(b) - rank.charCodeAt(a) || a - b);
    if (list.length < 2) continue;
    // where the roads part: the last form all of them come from
    let c = list[0];
    for (const j of list) {
      let x = c, y = j;
      while (x !== y) { if (d[x] >= d[y]) x = par[x]; else y = par[y]; }
      c = x;
    }
    if (list.includes(c)) continue;      // one of them is told as made from the other
    out.push({ c, list, root: affix(form[c]) });
  }
  const fame = (g) => rank.charCodeAt(g.list[0]) + rank.charCodeAt(g.list[1]);
  return out.sort((a, b) => a.root - b.root || fame(b) - fame(a) || b.list.length - a.list.length || a.c - b.c);
}

// The road of a form from its root: [root, …, the form]
export function roadOf(K, i) {
  const p = [];
  for (let j = i; j >= 0; j = K.par[j]) p.push(j);
  return p.reverse();
}

// Furthest travelled: the words of s that crossed the most borders on the way, each with the
// languages it was taken from, one after another. One word a family, the best known.
export function travelled(K, L, s, most = 40, known = 4) {
  const { N, par, st, rank, rel, fam, form } = K, et = L.etype;
  const hops = new Uint8Array(N), sure = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const p = par[i];
    if (p < 0) { sure[i] = 1; continue; }
    const r = rel.charCodeAt(i);
    sure[i] = sure[p] && !upper(r) && r !== 115 ? 1 : 0;
    hops[i] = hops[p] + (et[i] === 3 ? 1 : 0);
  }
  const top = new Map();
  for (let i = 0; i < N; i++) {
    if (st[i] !== s || !sure[i] || hops[i] < 3 || affix(form[i]) || rank.charCodeAt(i) - 48 < known) continue;
    const j = top.get(fam[i]);
    if (j === undefined || hops[i] > hops[j] || (hops[i] === hops[j] && rank.charCodeAt(i) > rank.charCodeAt(j))) top.set(fam[i], i);
  }
  return [...top.values()].sort((a, b) => hops[b] - hops[a] || rank.charCodeAt(b) - rank.charCodeAt(a) || a - b)
    .slice(0, most).map((i) => ({ i, hops: hops[i], via: roadOf(K, i).filter((j) => et[j] === 3).map((j) => st[par[j]]) }));
}

// Who took from whom: [{ a the giver, b the taker, n }], the biggest first
export function flows(K, L, most = 30) {
  const { N, st, par } = K, et = L.etype, S = K.stations.length, n = new Int32Array(S * S);
  for (let i = 0; i < N; i++) if (et[i] === 3) n[st[par[i]] * S + st[i]]++;
  const out = [];
  for (let k = 0; k < n.length; k++) if (n[k] > 0) out.push({ a: (k / S) | 0, b: k % S, n: n[k] });
  return out.sort((p, q) => q.n - p.n).slice(0, most);
}

// The widest families (their root, and in how many living languages it has a word), and the roots
// the language s made the most words from.
export function families(K, s, most = 14) {
  const { F, start, st, stations } = K, wide = [], rich = [];
  for (let f = 0; f < F; f++) {
    const seen = new Set();
    let own = 0;
    for (let i = start[f]; i < start[f + 1]; i++) {
      if (stations[st[i]].date >= 1900) seen.add(st[i]);
      if (st[i] === s) own++;
    }
    wide.push({ i: start[f], n: seen.size });
    rich.push({ i: start[f], n: own });
  }
  const top = (a) => a.sort((p, q) => q.n - p.n || p.i - q.i).slice(0, most);
  return { wide: top(wide), rich: top(rich) };
}

// The words that went furthest out: a word, and the languages that took it (straight from it)
export function givers(K, L, s, most = 14) {
  const { N, st, par } = K, et = L.etype, takers = new Map();
  for (let i = 0; i < N; i++) {
    const p = par[i];
    if (p < 0 || et[i] !== 3 || st[p] !== s) continue;
    if (!takers.has(p)) takers.set(p, new Set());
    takers.get(p).add(st[i]);
  }
  return [...takers.entries()].map(([i, t]) => ({ i, n: t.size })).sort((p, q) => q.n - p.n || p.i - q.i).slice(0, most);
}

