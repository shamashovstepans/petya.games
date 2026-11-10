// Etymon, languages: what the words say when they are counted.
// How alike two languages still sound, measured on the words both had from one ancestor by plain
// descent. Nothing here knows the family tree: it falls out of the spelling of the words.

import { depths } from './kin-addr.js';

const SPECIAL = {
  þ: 'th', ð: 'dh', æ: 'ae', ø: 'o', ß: 'ss', ł: 'l', đ: 'd', œ: 'oe', ħ: 'h', ı: 'i', ƕ: 'hw', ȝ: 'g', ƿ: 'w',
  ʰ: 'h', ʷ: 'w', ə: 'e', ŋ: 'n', ɣ: 'g', χ: 'kh', θ: 'th', β: 'b', δ: 'd', ɸ: 'f', ʒ: 'z', ʃ: 's', ɛ: 'e', ɔ: 'o',
};

// every form in plain letters a–z, to compare how two words sound ('' where there is no reading)
export function roman(K) {
  if (K.rom) return K.rom;
  const out = (K.rom = new Array(K.N));
  for (let i = 0; i < K.N; i++) {
    let s = '';
    for (const ch of (K.tr[i] || K.form[i]).toLowerCase().normalize('NFD')) {
      const c = SPECIAL[ch] ?? ch;
      if (c >= 'a' && c <= 'z') s += c;
    }
    out[i] = s;
  }
  return out;
}

// the step down to this form was plain descent: handed down the line, and nothing unsure about it
export function clean(K, L) {
  if (L.clean) return L.clean;
  const c = (L.clean = new Uint8Array(K.N)), et = L.etype, rel = K.rel;
  for (let i = 0; i < K.N; i++) {
    const r = rel.charCodeAt(i);
    c[i] = et[i] === 2 && (r === 105 || r === 100) ? 1 : 0;   // i inherited, d derived from an older stage
  }
  return c;
}

const row = new Int32Array(64);
// edit distance, as a share of the longer word: 0 the same, 1 nothing alike
export function apart(a, b) {
  if (a === b) return 0;
  const n = a.length, m = b.length;
  if (!n || !m) return 1;
  if (m > 62 || n > 62) return 1;
  for (let j = 0; j <= m; j++) row[j] = j;
  for (let i = 1; i <= n; i++) {
    let diag = row[0];
    row[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const up = row[j], v = Math.min(up + 1, row[j - 1] + 1, diag + (ca === b.charCodeAt(j - 1) ? 0 : 1));
      diag = up;
      row[j] = v;
    }
  }
  return row[m] / Math.max(n, m);
}

// Every pair of cognates among the languages `langs` (station numbers): two words that came down
// by plain descent from one form, each the best-known word of its language on its branch. A word
// is set against its nearest match only: month meets Dutch maand where their branch begins, and
// so does not go on to meet maan, which has moon.
// onPair(x, y, i, j, c): slots x and y of langs, the two forms, and the form they part at.
export function cognates(K, L, langs, onPair) {
  const { F, start, par, st, rank, form } = K, cl = clean(K, L), d = depths(K), n = langs.length;
  const slot = new Int8Array(K.stations.length).fill(-1);
  langs.forEach((s, x) => { slot[s] = x; });
  let big = 0;
  for (let f = 0; f < F; f++) big = Math.max(big, start[f + 1] - start[f]);
  // for each form of the family in hand: the languages met below it, and the best word of each
  const cnt = new Uint8Array(big), list = new Uint8Array(big * n), rep = new Int32Array(big * n);
  const better = (i, j) => {
    const ri = rank.charCodeAt(i), rj = rank.charCodeAt(j);
    if (ri !== rj) return ri > rj ? i : j;
    // two, not between: what was made from a word is longer than the word
    if (form[i].length !== form[j].length) return form[i].length < form[j].length ? i : j;
    if (d[i] !== d[j]) return d[i] < d[j] ? i : j;
    return i < j ? i : j;
  };
  const word = (i) => { const w = form[i]; return w.charCodeAt(0) !== 45 && w.charCodeAt(w.length - 1) !== 45; };
  for (let f = 0; f < F; f++) {
    const i0 = start[f], i1 = start[f + 1];
    let one = -1, two = false;
    for (let i = i0; i < i1 && !two; i++) { const x = slot[st[i]]; if (x >= 0) { if (one < 0) one = x; else if (x !== one) two = true; } }
    if (!two) continue;
    cnt.fill(0, 0, i1 - i0);
    rep.fill(-1, 0, (i1 - i0) * n);
    for (let i = i1 - 1; i >= i0; i--) {
      const u = i - i0, x = slot[st[i]], o = u * n;
      if (x >= 0 && word(i)) {
        // a word of one of the languages meets every word that came down from it, and stands for its own
        for (let k = 0; k < cnt[u]; k++) { const y = list[o + k]; if (y !== x) onPair(x, y, i, rep[o + y], i); }
        if (rep[o + x] < 0) list[o + cnt[u]++] = x;
        rep[o + x] = i;
      }
      if (i === i0 || !cnt[u] || !cl[i]) continue;
      // hand up: what this branch holds meets what the branches before it brought, unless the two
      // languages have met already on either side
      const p = par[i] - i0, q = p * n, pc = cnt[p];
      for (let k = 0; k < cnt[u]; k++) {
        const a = list[o + k];
        if (rep[q + a] >= 0) continue;
        for (let e = 0; e < pc; e++) { const b = list[q + e]; if (rep[o + b] < 0) onPair(a, b, rep[o + a], rep[q + b], par[i]); }
      }
      for (let k = 0; k < cnt[u]; k++) {
        const a = list[o + k];
        if (rep[q + a] >= 0) rep[q + a] = better(rep[o + a], rep[q + a]);
        else { list[q + cnt[p]++] = a; rep[q + a] = rep[o + a]; }
      }
    }
  }
}

// the languages of the kinship table: the living ones best told here, and a few of the old ones
export const TABLE = ['hit', 'gk', 'mgk', 'lat', 'it', 'sp', 'pt', 'fr', 'oir', 'ir', 'w', 'goth', 'ice', 'no', 'sw', 'da',
  'en', 'sc', 'fris', 'du', 'g', 'lith', 'latv', 'ocs', 'ru', 'uk', 'pol', 'cz', 'serbocroatian', 'bul', 'skt', 'av', 'per',
  'oarm', 'alb'];

// too few shared words, and a square of the table says nothing
export const ENOUGH = 12;

// The family tree as the table alone would draw it: join the two nearest, then the next two, and
// so on, a group standing as far from another as their members do on average. A pair with too few
// words is left out of the averages. -> { leaves: [slot, …], h: how far apart its halves are, kids }
function cluster(n, dist, count) {
  const far = (a, b) => {
    let s = 0, c = 0;
    for (const x of a.leaves) for (const y of b.leaves) if (count[x * n + y] >= ENOUGH) { s += dist[x * n + y]; c++; }
    return c ? s / c : 0.8;
  };
  let live = Array.from({ length: n }, (_, x) => ({ leaves: [x], h: 0, kids: null }));
  while (live.length > 1) {
    let best = Infinity, bi = 0, bj = 1;
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) { const v = far(live[i], live[j]); if (v < best) { best = v; bi = i; bj = j; } }
    }
    const a = live[bi], b = live[bj];
    live = live.filter((_, k) => k !== bi && k !== bj);
    live.push({ leaves: [...a.leaves, ...b.leaves], h: Math.max(best, a.h, b.h), kids: [a, b] });
  }
  return live[0];
}

// The table: for each two languages, how far apart their cognates are on average, and over how many.
// langs: the stations, slot by slot; tree: the family tree the numbers draw; order: its leaves.
export function kinship(K, T, L, ids = TABLE) {
  if (K.kinship) return K.kinship;
  const langs = [...new Set(ids.map((id) => K.byId.get(id)).filter((s) => s !== undefined))].sort((a, b) => a - b);
  const n = langs.length, rom = roman(K);
  const sum = new Float64Array(n * n), count = new Int32Array(n * n);
  cognates(K, L, langs, (x, y, i, j) => {
    const a = rom[i], b = rom[j];
    if (!a || !b) return;
    const k = x < y ? x * n + y : y * n + x;
    sum[k] += apart(a, b);
    count[k]++;
  });
  const dist = new Float32Array(n * n).fill(NaN);
  for (let x = 0; x < n; x++) {
    for (let y = x + 1; y < n; y++) {
      const k = x * n + y;
      dist[k] = dist[y * n + x] = count[k] ? sum[k] / count[k] : NaN;
      count[y * n + x] = count[k];
    }
  }
  const tree = cluster(n, dist, count);
  return (K.kinship = { langs, n, dist, count, tree, order: tree.leaves });
}

// the cognate pairs of two languages, the most alike first
export function pairsOf(K, L, a, b) {
  const rom = roman(K), out = [], seen = new Set();
  cognates(K, L, [a, b], (x, y, i, j, c) => {
    const [p, q] = x === 0 ? [i, j] : [j, i];
    if (!rom[p] || !rom[q] || seen.has(p * K.N + q)) return;
    seen.add(p * K.N + q);
    out.push({ ai: p, bi: q, c, d: apart(rom[p], rom[q]) });
  });
  return out.sort((p, q) => p.d - q.d || K.rank.charCodeAt(q.ai) - K.rank.charCodeAt(p.ai) || p.ai - q.ai);
}
