// Words imported from Wiktionary (kaikki.org extracts, built by tools/import/).
// The search index arrives at boot; a root's tree is fetched the first time one of
// its words is opened, from a relative URL so it also works inside a published
// Artifact. None of it is hand-checked: every node and edge made here carries
// `imported: true`, and curated data wins wherever both exist.

import { LANGS, ENGLISH_STAGES } from './langs.js';

const BASE = new URL('../data/import/', import.meta.url);

// edge codes written by tools/import/output.py → [kind, how it happened]
const REL = {
  i: ['inherit', 'inherited'],
  b: ['borrow', 'borrowed'],
  l: ['borrow', 'learned borrowing'],
  c: ['borrow', 'calque'],
  m: ['borrow', 'semantic loan'],
  p: ['borrow', 'phono-semantic matching'],
  d: ['derive', 'derived'],
  f: ['derive', 'formed from it'],
  s: ['derive', 'steps not recorded'],
};

const GREEK = Object.fromEntries([...'αβγδεζηθικλμνξοπρσςτυφχψω'].map((c, i) => [c, ['a', 'b', 'g', 'd', 'e', 'z', 'e', 'th', 'i', 'k', 'l', 'm', 'n', 'x', 'o', 'p', 'r', 's', 's', 't', 'u', 'ph', 'kh', 'ps', 'o'][i]]));
const CYR = Object.fromEntries([...'абвгдеёжзийклмнопрстуфхцчшщъыьэюяѣ'].map((c, i) => [c, ['a', 'b', 'v', 'g', 'd', 'e', 'e', 'zh', 'z', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f', 'kh', 'ts', 'ch', 'sh', 'shch', '', 'y', '', 'e', 'yu', 'ya', 'e'][i]]));

// the importer's `flat` (tools/import/build.py): a rough romanized skeleton used to match forms
export function flat(s) {
  let t = String(s || '').split(',')[0].replace(/^\*/, '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  t = [...t].map((ch) => GREEK[ch] ?? CYR[ch] ?? ch).join('');
  return t.replace(/[^a-z]/g, '');
}

export const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const LATIN = /[A-Za-zÀ-ɏḀ-ỿ]/;

export class Imported {
  constructor(g) {
    this.g = g;
    this.ready = false;
    this.failed = false;
    this.roots = new Map(); // root number → root record
    this.chunks = new Map(); // chunk number → promise of its JSON
    this.byCurated = new Map(); // curated root id → number of the imported root that extends it
    this.loading = this.load();
  }

  async load() {
    try {
      const res = await fetch(new URL('index.json', BASE));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ix = await res.json();
      for (const [code, [name, family, date]] of Object.entries(ix.langs || {})) {
        if (!LANGS[code]) LANGS[code] = { code, name, family, date, imported: true };
      }
      this.meta = ix.roots;
      this.buildId = ix.build || '';
      this.counts = ix.counts || {};
      this.source = ix.source;
      ix.roots.forEach((r, num) => {
        if (r[4]) this.byCurated.set(r[4], num);
      });
      this.decode(ix.words);
      this.ready = true;
    } catch (err) {
      this.failed = true;
      console.warn('Etymon: the Wiktionary import is not available', err);
    }
    return this.ready;
  }

  // "<shared prefix length, base 36><rest of the key>[\x01display]\t<refs>", one line per key, sorted
  decode(text) {
    const keys = [];
    const disp = [];
    const refs = [];
    let prev = '';
    let i = 0;
    while (i < text.length) {
      let j = text.indexOf('\n', i);
      if (j < 0) j = text.length;
      const tab = text.indexOf('\t', i);
      let head = text.slice(i + 1, tab);
      const so = head.indexOf('\x01');
      let d = null;
      if (so >= 0) {
        d = head.slice(so + 1);
        head = head.slice(0, so);
      }
      const key = prev.slice(0, parseInt(text[i], 36)) + head;
      keys.push(key);
      disp.push(d);
      refs.push(text.slice(tab + 1, j));
      prev = key;
      i = j + 1;
    }
    this.keys = keys;
    this.disp = disp;
    this.refs = refs;
  }

  lower(k) {
    let lo = 0;
    let hi = this.keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.keys[mid] < k) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // every entry for one search key: [{display, nums: [root numbers, primary first], h, i}]
  entries(i) {
    const base = this.disp[i] || this.keys[i];
    return this.refs[i].split(',').map((part) => {
      let s = part;
      let word = base;
      const caret = s.indexOf('^');
      if (caret >= 0) {
        word = s.slice(caret + 1);
        s = s.slice(0, caret);
      }
      let h = '';
      const tilde = s.indexOf('~');
      if (tilde >= 0) {
        h = s.slice(tilde + 1);
        s = s.slice(0, tilde);
      }
      return { display: word, nums: s.split('.').map((x) => parseInt(x, 36)), h, i };
    });
  }

  lookup(k) {
    if (!this.ready) return [];
    const i = this.lower(k);
    return this.keys[i] === k ? this.entries(i) : [];
  }

  // keys starting with k, shortest first, then keys containing k (only for longer queries)
  search(k, limit = 8) {
    if (!this.ready || !k) return [];
    const out = [];
    let i = this.lower(k);
    const pre = [];
    while (i < this.keys.length && this.keys[i].startsWith(k) && pre.length < 400) pre.push(i++);
    pre.sort((a, b) => this.keys[a].length - this.keys[b].length || a - b);
    for (const j of pre) {
      out.push(j);
      if (out.length >= limit) return out;
    }
    if (k.length >= 4) {
      for (let j = 0; j < this.keys.length && out.length < limit; j++) {
        if (!this.keys[j].startsWith(k) && this.keys[j].includes(k)) out.push(j);
      }
    }
    return out;
  }

  async reload() {
    this.ready = false;
    this.chunks.clear();
    this.roots.clear();
    this.byCurated.clear();
    this.loading = this.load();
    return this.loading;
  }

  rootMeta(num) {
    const m = this.meta?.[num];
    if (!m) return null;
    const [chunk, lang, form, gloss, cid, words, tr] = m;
    return { num, chunk, lang, form: form || '', gloss: gloss || '', curated: cid || '', words: words || 0, tr: tr || '' };
  }

  // the line under a suggestion: where the word comes from
  subtitle(num) {
    const m = this.rootMeta(num);
    if (!m) return '';
    if (m.curated) {
      const r = this.g.rootById[m.curated];
      if (r) return `from ${r.node.display} "${r.node.gloss}"`;
    }
    if (m.form) return m.gloss ? `from ${shown(m.form, m.tr)} "${m.gloss}"` : `from ${LANGS[m.lang]?.name || ''} ${shown(m.form, m.tr)}`;
    return `via ${LANGS[m.lang]?.name || 'another language'}`;
  }

  rootId(num) {
    const m = this.rootMeta(num);
    return m?.curated || `w${num}`;
  }

  numOf(id) {
    if (/^w\d+$/.test(id)) return +id.slice(1);
    return this.byCurated.get(id);
  }

  async chunk(n) {
    if (!this.chunks.has(n)) {
      const p = fetch(new URL(`c/${n}.json`, BASE)).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      p.catch(() => this.chunks.delete(n));
      this.chunks.set(n, p);
    }
    return this.chunks.get(n);
  }

  // → the root record ({id, node, imported, num}); for a root that extends a curated one,
  // the curated record, with the imported branches hung on its nodes
  async root(num, retried = false) {
    if (this.roots.has(num)) return this.roots.get(num);
    const m = this.rootMeta(num);
    if (!m) return null;
    const data = await this.chunk(m.chunk);
    if (data.b && this.buildId && data.b !== this.buildId) {
      // the import was rebuilt while this page was open: take the new index, then try again
      if (retried) return null;
      await this.reload();
      return this.root(num, true);
    }
    if (this.roots.has(num)) return this.roots.get(num);
    const obj = data.r[num];
    if (!obj) return null;
    const rec = this.build(num, obj, m);
    this.roots.set(num, rec);
    return rec;
  }

  build(num, obj, m) {
    const curated = obj.c ? this.g.rootById[obj.c] : null;
    const id = curated ? curated.id : `w${num}`;
    const anchors = curated ? this.anchorsFor(curated) : null;
    const nodes = obj.n.map(([lang, form, gloss, date, tr, extra], i) => {
      if (anchors) {
        if (i === 0) return curated.node;
        const a = extra?.a && anchors.get(extra.a);
        if (a) return a;
      }
      if (!LANGS[lang]) LANGS[lang] = { code: lang, name: lang, family: 'other', date: 1800, imported: true };
      const word = lang === 'En' || lang === 'Ru';
      const n = {
        id: `${id}:${i}`, lang, form, display: shown(form, tr), native: tr && !LATIN.test(form) && !word ? form : '',
        gloss: gloss || '', date: typeof date === 'number' ? date : LANGS[lang].date, dateExplicit: false,
        parents: [], children: [], inEdges: [], outEdges: [], tags: [], imported: true, rootIds: [id],
        rank: extra?.r ?? 0, zipf: null,
      };
      if (word) {
        n.key = `w:${form}${extra?.h ? '#' + extra.h : ''}`;
        n.h = extra?.h || '';
        if (lang === 'En') n.isEn = true;
        if (extra?.cur) n.curatedTwin = true;
      }
      if (i === 0) {
        n.isRoot = true;
        n.rootKey = id;
      }
      return n;
    });
    const fresh = (n) => n.imported === true;
    for (const [p, c, code, prim] of obj.e) {
      const s = nodes[p];
      const t = nodes[c];
      if (!s || !t || !fresh(t)) continue; // curated nodes keep their own parents
      const rel = String(code);
      const [kind, how] = REL[rel[0]] || REL.d;
      const e = {
        source: s, target: t, tags: [], uncertain: rel.endsWith('?'), primary: prim !== 0 && !t.inEdges.length,
        kind, how, imported: true,
      };
      t.parents.push(s);
      t.inEdges.push(e);
      if (fresh(s)) {
        s.children.push(t);
        s.outEdges.push(e);
      } else {
        (s.xOut ||= []).push(e); // a curated node: its own edges stay as they were, and only Explore reads these
      }
    }
    // colour: a stage of English takes the colour of the road it came by
    const famOf = (n, guard = 0) => {
      if (n._fam) return n._fam;
      let f = LANGS[n.lang]?.family || 'other';
      if (ENGLISH_STAGES.has(n.lang) || n.lang === 'En') {
        const e = n.inEdges.find((x) => x.primary) || n.inEdges[0];
        const pf = e && guard < 60 ? (e.source.family || famOf(e.source, guard + 1)) : 'germanic';
        f = pf === 'root' ? 'germanic' : pf;
      }
      n._fam = f;
      return f;
    };
    for (const n of nodes) if (fresh(n)) n.family = famOf(n);
    const rec = curated || { id, node: nodes[0], imported: true, num, domain: null };
    rec.importNum = num;
    rec.importWords = m.words;
    return rec;
  }

  // curated nodes under a curated root, by the keys the importer anchors to ("En|heart", "Lat|pes")
  anchorsFor(root) {
    const map = new Map();
    const seen = new Set();
    const stack = [root.node];
    while (stack.length) {
      const n = stack.pop();
      if (seen.has(n)) continue;
      seen.add(n);
      if (n.lang === 'En' || n.lang === 'Ru') map.set(`${n.lang}|${n.display.toLowerCase()}`, n);
      else {
        const k = `${n.lang}|${flat(n.display)}`;
        if (!map.has(k)) map.set(k, n);
      }
      for (const e of n.outEdges) stack.push(e.target);
    }
    return map;
  }

  // the node of a word entry inside its loaded root
  findWord(rec, ent) {
    const stack = [rec.node];
    const seen = new Set();
    let best = null;
    while (stack.length) {
      const n = stack.pop();
      if (seen.has(n)) continue;
      seen.add(n);
      if (n.imported && (n.lang === 'En' || n.lang === 'Ru') && n.form === ent.display) {
        if ((n.h || '') === (ent.h || '')) return n;
        best ||= n;
      }
      for (const e of n.outEdges) stack.push(e.target);
      if (n.xOut) for (const e of n.xOut) stack.push(e.target);
    }
    return best;
  }
}

export function shown(form, tr) {
  return tr && !LATIN.test(form) && !/[Ѐ-ӿ]/.test(form) ? tr : form;
}
