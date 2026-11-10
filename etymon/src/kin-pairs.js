// Etymon, languages: where two languages meet.
// A meeting is the last form that a word of one and a word of the other both come from: a common
// ancestor's word, a word one of them took from the other, or a third language's word both took.

import { depths, fullest } from './kin-addr.js';

// how the two stand in the family tree
export function relation(K, T, a, b) {
  const S = T.S, st = K.stations;
  if (T.anc[a * S + b]) return { kind: 'stage', old: a, young: b };
  if (T.anc[b * S + a]) return { kind: 'stage', old: b, young: a };
  for (let x = st[a].parent; x >= 0; x = st[x].parent) if (T.anc[x * S + b]) return { kind: 'kin', at: x };
  return { kind: 'none' };
}

// How well each road is told, counted from the root down.
//   home   the words made from other words at home on the way
//   gap    the stages of its own line the road is silent about
//   loose  a late word hung straight on a far ancestor, three stages or more skipped: it does come
//          from there, but by what road is not recorded (often through another language). Or a
//          step the dictionary itself marks as unsure. Or a gap the page leaves between the last
//          word of its chain and the root it names.
function roads(K, L) {
  if (L.roads) return L.roads;
  const { N, par, st, stations, rel } = K, et = L.etype;
  const home = new Uint16Array(N), gap = new Uint16Array(N), loose = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const p = par[i];
    if (p < 0) continue;
    let n = 0;
    if (et[i] === 2) for (let x = stations[st[i]].parent; x >= 0 && x !== st[p]; x = stations[x].parent) n++;
    home[i] = home[p] + (et[i] === 1 ? 1 : 0);
    gap[i] = gap[p] + n;
    const r = rel.charCodeAt(i);
    if (n >= 3 || (r >= 65 && r <= 90) || r === 115) loose[i] = 1;
  }
  return (L.roads = { home, gap, loose });
}

// when one pair of words is found twice, the plainer tie is the one to keep
const ORDER = { downA: 0, downB: 0, kin: 1, fromA: 2, fromB: 2, via: 3, root: 4 };

// Every meeting of a and b: { c the form they meet at, x its language, ai and bi the word of each
// side, kind, f the family }.
//   kin    handed down to both from a common ancestor, every step of both roads on record
//   downA  c is a's own word, and b had it by descent (a is an older stage of b); downB likewise
//   fromA  c is a's own word, and b took it; fromB likewise
//   via    c belongs to a third language, and at least one of them borrowed it
//   root   one root, but the road of one of the two (or both) is unsure or not recorded
// A word stands for the words its own language made from it, so water meets вода and waterfall
// does not. A loan does not use its source up: Russian took ватер from water, and water still goes
// on up to meet вода.
export function meetings(K, T, L, a, b) {
  const memo = (K.meetMemo ||= new Map()), key = a * 1000 + b;
  if (memo.has(key)) return memo.get(key);
  const { N, F, par, st, start, rank } = K, et = L.etype, d = depths(K), { home, gap, loose } = roads(K, L);
  const own = new Uint8Array(N);
  // for each form, the best word below it that has not met its match: side a then side b, and for
  // each side the road so far clean (0), loose (1), or across a border (2)
  const un = new Int32Array(N * 6).fill(-1);
  // of two words of one side: the better known; then the shorter (two, not between: what was made
  // from a word is longer than the word); then the road told in full; then the plainer word
  const better = (i, j) => {
    if (j < 0) return i;
    if (i < 0) return j;
    const ri = rank.charCodeAt(i), rj = rank.charCodeAt(j);
    if (ri !== rj) return ri > rj ? i : j;
    const li = K.form[i].length, lj = K.form[j].length;
    if (li !== lj) return li < lj ? i : j;
    if (gap[i] !== gap[j]) return gap[i] < gap[j] ? i : j;
    if (home[i] !== home[j]) return home[i] < home[j] ? i : j;
    return i < j ? i : j;
  };
  const seen = new Map();
  const add = (kind, c, ai, bi, f) => {
    const k2 = fullest(K, ai) * N + fullest(K, bi), old = seen.get(k2);
    if (old && ORDER[old.kind] <= ORDER[kind]) return;
    seen.set(k2, { c, x: st[c], ai, bi, kind, f, fame: rank.charCodeAt(ai) + rank.charCodeAt(bi) - 96 });
  };

  for (let f = 0; f < F; f++) {
    const i0 = start[f], i1 = start[f + 1];
    let got = 0;
    for (let i = i0; i < i1; i++) {
      const o = st[i] === a ? 1 : st[i] === b ? 2 : 0;
      if (!o) continue;
      // a prefix or an ending is no word: it meets nothing, and what hangs on it passes through
      const w = K.form[i];
      if (w.charCodeAt(0) === 45 || w.charCodeAt(w.length - 1) === 45) own[i] = 4;
      // a word told in full elsewhere and only hung on this root takes no part here
      else if (!(d[i] === 1 && fullest(K, i) !== i)) { own[i] = o; got |= o; }
    }
    if (got !== 3) continue;
    // from the leaves up
    for (let i = i1 - 1; i >= i0; i--) {
      const u = i * 6, o = own[i];
      if (o === 4) {
        // nothing meets here
      } else if (o) {
        // a word of one of the two: it meets what the other has from it, and stands for its own
        const x = u + (o === 1 ? 0 : 3), y = u + (o === 1 ? 3 : 0);
        const meet = (kind, j) => { if (j >= 0) add(kind, i, o === 1 ? i : j, o === 1 ? j : i, f); };
        meet(o === 1 ? 'downA' : 'downB', un[y]);
        meet('root', un[y + 1]);
        meet(o === 1 ? 'fromA' : 'fromB', un[y + 2]);
        un[y] = un[y + 1] = un[y + 2] = un[x + 1] = un[x + 2] = -1;
        un[x] = i;
      } else {
        // a third language's word. Two clean roads make kin, and only kin uses a clean word up.
        const a0 = un[u], b0 = un[u + 3];
        if (a0 >= 0 && b0 >= 0) { add('kin', i, a0, b0, f); un[u] = un[u + 3] = -1; }
        // then the words that crossed a border, or whose road is not told: with each other, or
        // failing that with the clean word of the other side
        const qa = un[u + 2] >= 0 ? 2 : un[u + 1] >= 0 ? 1 : 0, qb = un[u + 5] >= 0 ? 2 : un[u + 4] >= 0 ? 1 : 0;
        const a1 = qa ? un[u + qa] : -1, b1 = qb ? un[u + 3 + qb] : -1;
        const kind = qa === 2 || qb === 2 ? 'via' : 'root';
        if (a1 >= 0 && b1 >= 0) { add(kind, i, a1, b1, f); un[u + qa] = un[u + 3 + qb] = -1; }
        else if (a1 >= 0 && b0 >= 0) { add(kind, i, a1, b0, f); un[u + qa] = -1; }
        else if (b1 >= 0 && a0 >= 0) { add(kind, i, a0, b1, f); un[u + 3 + qb] = -1; }
      }
      if (i === i0) continue;
      // hand what has not met up to the parent; the step itself may cross a border or be loose
      const p = par[i] * 6, sh = et[i] === 3 ? 2 : loose[i];
      for (let s = 0; s < 6; s++) {
        const v = un[u + s];
        if (v < 0) continue;
        const q = s % 3, t = p + s - q + (q > sh ? q : sh);
        un[t] = better(v, un[t]);
      }
    }
  }
  const list = [...seen.values()].sort((p, q) => q.fame - p.fame || p.f - q.f || p.c - q.c);

  const by = { kin: [], downA: [], downB: [], fromA: [], fromB: [], via: [], root: [] };
  for (const m of list) by[m.kind].push(m);
  // the third languages, each with the meetings it holds; the ones that hold most first
  const group = (ms) => {
    const g = new Map();
    for (const m of ms) { if (!g.has(m.x)) g.set(m.x, []); g.get(m.x).push(m); }
    return [...g.entries()].map(([x, l]) => ({ x, list: l })).sort((p, q) => q.list.length - p.list.length);
  };
  const out = { a, b, list, by, viaBy: group(by.via), kinBy: group(by.kin), rel: relation(K, T, a, b) };
  if (memo.size > 24) memo.clear();
  memo.set(key, out);
  return out;
}
