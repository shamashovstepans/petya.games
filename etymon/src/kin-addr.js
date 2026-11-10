// Etymon, languages: the address of what is on screen, and the way back from an address.
//   #languages               the whole globe
//   #languages-en            one language
//   #languages-en-ru         two languages, and what they share
//   #languages-en-water      one word, in its fullest telling (ru:вода where the word is not in plain letters)
//   #languages-n1234         a form with no address of its own
//   #languages-kinship       a leaf of the panel (findings, kinship, sounds, about)
//   #languages-law-0-en      a finding: a sound law, one group of doublets (twice-…), two words (two-…)
// Plain letters, digits and hyphens wherever the thing allows it: only such an address travels
// with a link to the published page.

// lower case, and one spelling for one letter. Below U+0300 there is nothing to compose, and most
// forms are all below it: they are spared the second pass (this runs for every form at the start).
const MARKS = /[\u0300-\uffff]/;
const low = (s) => { const t = String(s).toLowerCase(); return MARKS.test(t) ? t.normalize('NFC') : t; };

// how many steps a form is from its root
export function depths(K) {
  if (!K.depth) {
    const d = (K.depth = new Uint8Array(K.N));
    for (let i = 0; i < K.N; i++) if (K.par[i] >= 0) d[i] = Math.min(255, d[K.par[i]] + 1);
  }
  return K.depth;
}

// language and spelling -> one form. Two words can be spelt alike (bear the animal, bear "to
// carry"): the better known wins. And one word can be told twice: in full under one root, and as a
// bare stub under another root its page names: the fullest telling wins.
export function formIndex(K) {
  if (K.at) return K.at;
  const job = (K.atJob ||= { at: new Map(), i: 0 });
  fill(K, job, K.N);
  K.atJob = null;
  return (K.at = job.at);
}

function fill(K, job, upto) {
  const at = job.at, d = depths(K), { st, form, rank } = K;
  for (let i = job.i; i < upto; i++) {
    const k = st[i] + ':' + low(form[i]);
    const j = at.get(k);
    if (j === undefined) { at.set(k, i); continue; }
    const ri = rank.charCodeAt(i), rj = rank.charCodeAt(j);
    if (ri > rj || (ri === rj && d[i] > d[j])) at.set(k, i);
  }
  job.i = upto;
}

// The index is not needed for the first picture: it is made a part at a time while the picture is
// already on show, and whoever needs it sooner (formIndex) finishes it there and then.
export function warmIndex(K, step = 12000) {
  if (K.at) return;
  const job = (K.atJob ||= { at: new Map(), i: 0 });
  fill(K, job, Math.min(K.N, job.i + step));
  if (job.i >= K.N) { K.at = job.at; K.atJob = null; } else setTimeout(() => warmIndex(K, step), 40);
}

export function findForm(K, s, form) {
  const at = formIndex(K), f = low(form);
  return at.get(s + ':' + f) ?? at.get(s + ':' + f.replace(/_/g, ' ')) ?? -1;
}

// the fullest telling of the word this form spells
export function fullest(K, i) {
  return formIndex(K).get(K.st[i] + ':' + low(K.form[i])) ?? i;
}

// every telling of the same word in the same language, fullest first
export function tellings(K, i) {
  const s = K.st[i], f = low(K.form[i]), d = depths(K), out = [];
  for (let j = 0; j < K.N; j++) if (K.st[j] === s && low(K.form[j]) === f) out.push(j);
  return out.sort((a, b) => d[b] - d[a] || a - b);
}

export function slugOf(K, what) {
  if (!what || !K) return '';
  const id = (s) => K.stations[s].slug;
  if (what.kind === 'lang') return id(what.s);
  if (what.kind === 'pair') return `${id(what.a)}-${id(what.b)}`;
  if (what.kind === 'set') return what.key || '';
  const i = what.i, f = low(K.form[i]);
  if (/[\s#%?&]/.test(f) || formIndex(K).get(K.st[i] + ':' + f) !== i) return `n${i}`;
  // in plain letters where the word allows it: en-water. A word spelt like a language's short
  // name (it, no) would read as two languages, so it goes by its number.
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f)) return K.byId.has(f) ? `n${i}` : `${id(K.st[i])}-${f}`;
  return `${id(K.st[i])}:${f}`;
}

// the leaves of the panel and the findings: counted things, not languages
const FOUND = /^!?(findings|kinship|sounds|about|law-\d+-[a-z0-9]+|twice-\d+|two-\d+-\d+)$/;

// finding: (key) -> a set to show (or null, having opened a leaf of the panel)
// The older spellings still open: en+ru, en:water, !kinship.
export function parseSlug(K, slug, finding) {
  if (!slug || !K) return null;
  const s = low(slug);
  const f = s.match(FOUND);
  if (f) return (finding && finding(f[1])) || null;
  const m = s.match(/^n(\d+)$/);
  if (m) return +m[1] < K.N ? { kind: 'word', i: +m[1] } : null;
  // a language, and what follows it: nothing, a second language, or a word of its own
  const cut = s.search(/[:+-]/);
  const a = K.byId.get(cut < 0 ? s : s.slice(0, cut));
  if (a === undefined) return null;
  if (cut < 0) return { kind: 'lang', s: a };
  const rest = s.slice(cut + 1), b = s[cut] === ':' ? undefined : K.byId.get(rest);
  if (b !== undefined) return b === a ? { kind: 'lang', s: a } : { kind: 'pair', a, b };
  const i = s[cut] === '+' ? -1 : findForm(K, a, rest);
  return i < 0 ? { kind: 'lang', s: a } : { kind: 'word', i };
}

export function titleOf(K, what) {
  if (!what || !K) return 'Languages';
  if (what.kind === 'word') return K.form[what.i];
  if (what.kind === 'lang') return K.stations[what.s].name;
  if (what.kind === 'pair') return `${K.stations[what.a].name} × ${K.stations[what.b].name}`;
  return what.title || 'Languages';
}
