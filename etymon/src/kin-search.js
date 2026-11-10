// Etymon, languages: what the typed text may mean. A language, two languages, or a word.

import { fullest } from './kin-addr.js';

// lower case, no accents, no star, no raised letters: "*bʰer-" and "bher" are typed alike
const PLAIN = { 'ʰ': 'h', 'ʷ': 'w', '₁': '1', '₂': '2', '₃': '3', 'ₓ': 'x' };
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[ʰʷ₁₂₃ₓ]/g, (c) => PLAIN[c]).replace(/^[*\s-]+/, '');

export function searchKeys(K) {
  if (K.keys) return K.keys;
  const N = K.N, form = new Array(N), tr = new Array(N);
  for (let i = 0; i < N; i++) { form[i] = fold(K.form[i]); tr[i] = K.tr[i] ? fold(K.tr[i]) : ''; }
  const names = K.stations.map((s) => ({ all: fold(s.name), words: fold(s.name).split(/[\s-]+/), id: s.id.toLowerCase() }));
  return (K.keys = { form, tr, names });
}

// the languages a text may name, the likeliest first
function langs(K, q) {
  const { names } = searchKeys(K);
  const score = (s) => {
    const n = names[s.i];
    if (n.all === q || n.id === q) return 3;
    if (n.all.startsWith(q)) return 2;
    return n.words.some((w) => w.startsWith(q)) ? 1 : 0;
  };
  return K.stations.filter((s) => s.count > 0 && score(s))
    .sort((a, b) => score(b) - score(a) || b.count - a.count);
}

// Items to offer: { kind: 'lang', s } | { kind: 'pair', a, b } | { kind: 'word', i }.
// chosen: the language on screen, if one is; typing another offers the two side by side.
export function search(K, text, chosen = -1, most = 9) {
  const out = [];
  const two = text.split(/\s*(?:[×+&]|\bx\b|\band\b|\bvs\.?)\s*/i).map(fold).filter(Boolean);
  if (two.length === 2) {
    const a = langs(K, two[0])[0], b = langs(K, two[1])[0];
    if (a && b && a !== b) out.push({ kind: 'pair', a: a.i, b: b.i });
  }
  const q = fold(text.trim());
  if (!q) return out;
  const ls = langs(K, q).slice(0, 3);
  for (const s of ls) out.push({ kind: 'lang', s: s.i });
  if (chosen >= 0 && ls.length && ls[0].i !== chosen) out.splice(1, 0, { kind: 'pair', a: chosen, b: ls[0].i });

  // a star asks for a reconstructed word
  const starred = /^\s*\*/.test(text), proto = (K.protoSt ||= K.stations.map((s) => s.name.startsWith('Proto-')));
  const { form, tr } = searchKeys(K), rank = K.rank, st = K.st, hits = [];
  for (let i = 0; i < K.N; i++) {
    const f = form[i];
    let s;
    if (f.startsWith(q)) s = f.length === q.length ? 40 : 0;
    else if (!starred && tr[i] && tr[i].startsWith(q)) s = tr[i].length === q.length ? 30 : -6;
    else continue;
    if (starred && !proto[st[i]]) continue;
    // the well known first; of those, the short; a living language before a dead one.
    // A reconstructed word stands in no dictionary: a root is as well known as its family is large.
    const known = K.par[i] < 0 ? Math.min(9, Math.log2(K.start[K.fam[i] + 1] - K.start[K.fam[i]])) : rank.charCodeAt(i) - 48;
    hits.push([s + known * 12 - Math.min(f.length, 30) + (K.stations[st[i]].date >= 2000 ? 6 : 0), i]);
  }
  hits.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of hits) {
    if (out.length >= most) break;
    if (fullest(K, i) === i) out.push({ kind: 'word', i });
  }
  return out;
}
