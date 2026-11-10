// Etymon, languages: the sound laws, counted. Take every word that came down from a Proto-Indo-European
// form by plain descent, and ask: the old word began with p; what does its heir begin with?
// Nobody tells this file that p became f in the Germanic languages. The count says so.

import { clean } from './kin-stats.js';

// the stops of Proto-Indo-European, as the handbooks set them out
export const SERIES = [
  { name: 'Voiceless', keys: ['p', 't', 'ḱ', 'k', 'kʷ'] },
  { name: 'Voiced', keys: ['b', 'd', 'ǵ', 'g', 'gʷ'] },
  { name: 'Breathy', keys: ['bʰ', 'dʰ', 'ǵʰ', 'gʰ', 'gʷʰ'] },
];
export const KEYS = SERIES.flatMap((s) => s.keys);

// the languages of the table, east to west
export const COLS = ['skt', 'gk', 'lat', 'oir', 'goth', 'en', 'g', 'lith', 'ru', 'oarm'];

const STOP = new Set(['p', 't', 'k', 'b', 'd', 'g', 'ḱ', 'ǵ']);

// the stop a Proto-Indo-European form begins with ('' if it begins with anything else, or the
// beginning is in doubt: *(s)teg- may or may not have had its s)
export function onset(pie) {
  const s = pie.normalize('NFC').replace(/^\*/, '');
  if (!STOP.has(s[0])) return '';
  let k = s[0], j = 1;
  if (s[j] === 'ʷ' && (k === 'k' || k === 'g')) k += s[j++];
  if (s[j] === 'ʰ' && k !== 'p' && k !== 't' && k[0] !== 'k' && k !== 'ḱ') k += s[j++];
  return k;
}

const VOWEL = /^[aeiouæøœəɛɔ]$/;
const H = new Set(['b', 'd', 'g', 'p', 't', 'k', 'c', 's', 'z', 'w', 'j', 'č']);

// what a word begins with, in the letters of its own spelling (or of its transliteration):
// one consonant, with the h that goes with it (th, wh, bh, ph); '' for a vowel
export function reflex(text) {
  const s = text.toLowerCase().normalize('NFC').replace(/^[*\-'’‘ʼ(]+/, '');
  if (!s) return null;
  const c = s[0], base = c.normalize('NFD')[0];
  if (VOWEL.test(base)) return '';
  if (!/\p{Script=Latin}/u.test(c)) return null;   // no reading in Latin letters: nothing to compare
  const n = s[1] || '';
  if (c === 's' && n === 'c' && s[2] === 'h') return 'sch';
  if (H.has(c) && (n === 'h' || n === 'ʰ' || n === 'ʻ' || n === '‘')) return c + 'h';
  if (c === 'q' && n === 'u') return 'qu';
  if (c === 'p' && n === 'f') return 'pf';
  if (c === 'h' && (n === 'w' || n === 'v')) return 'hw';
  if (c === 'ƕ') return 'hw';
  return c;
}

// The table. cell(r, c) = { n, tops: [[letters, how many], …] most first, list: [form, …] best known first }
export function sounds(K, L, cols = COLS) {
  if (K.sounds) return K.sounds;
  const { N, par, st, rank } = K, cl = clean(K, L);
  const langs = cols.map((id) => K.byId.get(id)).filter((s) => s !== undefined);
  const col = new Int8Array(K.stations.length).fill(-1);
  langs.forEach((s, x) => { col[s] = x; });
  const rowOf = new Map(KEYS.map((k, r) => [k, r]));
  // for each form, the Proto-Indo-European form it continues by plain descent (-1 if none)
  const src = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    if (st[i] === 0) src[i] = i;
    else if (cl[i] && par[i] >= 0) src[i] = src[par[i]];
  }
  const cells = KEYS.map(() => langs.map(() => ({ n: 0, by: new Map(), list: [] })));
  const seen = new Set();
  for (let i = 0; i < N; i++) {
    const x = col[st[i]], t = src[i];
    if (x < 0 || t < 0 || t === i) continue;
    const r = rowOf.get(onset(K.form[t]));
    if (r === undefined) continue;
    const text = K.tr[i] || K.form[i], f = reflex(text);
    if (f == null) continue;
    // one word of a language counts once, however many roots it is told under
    const key = st[i] + ':' + text + ':' + r;
    if (seen.has(key)) continue;
    seen.add(key);
    const c = cells[r][x];
    c.n++;
    c.by.set(f, (c.by.get(f) || 0) + 1);
    c.list.push(i);
  }
  for (const rw of cells) {
    for (const c of rw) {
      c.tops = [...c.by.entries()].sort((a, b) => b[1] - a[1]);
      c.list.sort((a, b) => rank.charCodeAt(b) - rank.charCodeAt(a) || a - b);
    }
  }
  return (K.sounds = { langs, cells, src });
}

// the words of one cell that begin with the letters f, best known first
export function witnesses(K, S, r, x, f) {
  const c = S.cells[r][x];
  return f == null ? c.list : c.list.filter((i) => reflex(K.tr[i] || K.form[i]) === f);
}
