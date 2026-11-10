// Explore one word at a time: its road back to the root, then everything else
// that grew from that root, in English and beyond. Time runs left to right.
// Doubles as a small game: every word you type is "found", and in guess mode
// the relatives you have not found yet are hidden behind hints.

import { FAMILIES, FAMILY_ORDER, LANGS, timeToR, T_MAX } from './langs.js';
import { LAWS } from './laws.js';

// Big trees (imported roots can hold thousands of words) open around the selected
// road: other branches stay folded, with a count, until you open them.
const ROW_BUDGET = 150;
const FULL_TREE = 220;
const KID_LIMIT = 24;
const IMP_NOTE = 'From Wiktionary, imported automatically: not hand-checked.';

const NS = 'http://www.w3.org/2000/svg';
const STORE = 'etymon:found:v1';
const TRY = ['flower', 'two', 'heart', 'guest', 'money', 'window', 'salary', 'nice', 'брат', 'сердце', 'вода', 'знать'];
const TICKS = [-4000, -2000, -500, 450, 1066, 1500, T_MAX];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const byId = (id) => document.getElementById(id);
const isWord = (n) => n.lang === 'En' || n.lang === 'Ru';
const keyOf = (n) => (n.lang === 'En' ? n.key : `${n.lang}:${n.form}`);
// curated nodes can carry imported branches in xOut; the radial map never reads it
const outs = (n) => (n.xOut ? n.outEdges.concat(n.xOut) : n.outEdges);

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

function sv(tag, attrs = {}, text) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
}

const yearText = (y) => (y >= T_MAX ? 'now' : y < 0 ? `${Math.abs(y).toLocaleString('en-US')} BCE` : String(y));
const approx = (n) => (n.lang === 'PIE' ? 'c. 4500–2500 BCE' : n.dateExplicit && isWord(n) ? yearText(n.date) : `c. ${yearText(n.date)}`);
const commonness = (z) => (z >= 6 ? 'one of the commonest words in English' : z >= 5 ? 'very common' : z >= 4 ? 'common' : z >= 3 ? 'familiar' : z >= 2 ? 'uncommon' : 'rare');
const mask = (s) => [...s].map((ch, i) => (i === 0 || /[\s\-]/.test(ch) ? ch : '·')).join('');
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

export class Explore {
  constructor(app) {
    this.app = app;
    this.g = app.g;
    this.root = null;
    this.sel = null;
    this.guess = false;
    this.found = this.load();
    this.imp = app.imp || null;
    this.expanded = new Set();
    this.full = new Set();
    this.words = this.g.nodes.filter(isWord);
    this.ruCount = this.words.filter((n) => n.lang === 'Ru').length;
    this.enCount = this.words.length - this.ruCount;
    this.index = new Map();
    for (const n of this.words) {
      const k = norm(n.display);
      if (!this.index.has(k)) this.index.set(k, []);
      this.index.get(k).push(n);
    }
    for (const list of this.index.values()) list.sort((a, b) => (b.zipf ?? 3) - (a.zipf ?? 3));
    this.keys = [...this.index.keys()];
    this.sugg = [];
    this.si = 0;
    this.bind();
    this.renderLanding();
    this.renderProgress();
    if (this.imp) {
      this.imp.loading.then(() => {
        this.renderLanding();
        this.renderProgress();
        const input = byId('ex-input');
        if (document.activeElement === input && input.value) this.suggest(input.value);
      });
    }
    let t = 0;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (this.root && this.app.mode === 'explore') this.draw(false);
      }, 160);
    });
  }

  // ------------------------------------------------------------------ roots, curated or imported
  rootById(id) {
    if (this.g.rootById[id]) return this.g.rootById[id];
    const num = this.imp?.numOf(id);
    return num != null ? this.imp.roots.get(num) || null : null;
  }

  rootCount() {
    return this.g.roots.length + (this.imp?.ready ? this.imp.counts.roots || 0 : 0);
  }

  // ------------------------------------------------------------------ progress
  load() {
    try {
      const j = JSON.parse(localStorage.getItem(STORE) || '{}');
      return { w: new Set(j.w || []), r: new Set(j.r || []), v: new Set(j.v || []) };
    } catch {
      return { w: new Set(), r: new Set(), v: new Set() };
    }
  }

  save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ w: [...this.found.w], r: [...this.found.r], v: [...this.found.v] }));
    } catch {
      /* progress simply isn't kept */
    }
  }

  isFound(n) {
    const k = keyOf(n);
    return this.found.w.has(k) || this.found.v.has(k);
  }

  markFound(n) {
    if (!isWord(n)) return null;
    const k = keyOf(n);
    const fresh = !this.found.w.has(k);
    this.found.w.add(k);
    let newRoot = null;
    for (const id of n.rootIds) {
      if (!this.found.r.has(id)) {
        this.found.r.add(id);
        newRoot = newRoot || this.rootById(id);
      }
    }
    this.save();
    this.renderProgress();
    if (newRoot) return `New root: ${newRoot.node.display}${newRoot.node.gloss ? ` "${newRoot.node.gloss}"` : ''}. ${this.found.r.size} of ${this.rootCount().toLocaleString('en-US')} found.`;
    if (fresh) return `Found: ${n.display}.`;
    return null;
  }

  renderProgress() {
    const el = byId('ex-progress');
    el.replaceChildren('Roots found ', h('b', {}, String(this.found.r.size)), ` of ${this.rootCount().toLocaleString('en-US')}`);
    el.title = `${this.found.w.size} words found by typing them`;
  }

  // ------------------------------------------------------------------ input
  bind() {
    const input = byId('ex-input');
    const list = byId('ex-suggest');
    byId('ex-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!list.hidden && this.sugg[this.si]) this.pick(this.sugg[this.si]);
      else this.submit(input.value);
    });
    input.addEventListener('input', () => this.suggest(input.value));
    input.addEventListener('keydown', (e) => {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { this.si = Math.min(this.sugg.length - 1, this.si + 1); this.renderSuggest(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { this.si = Math.max(0, this.si - 1); this.renderSuggest(); e.preventDefault(); }
      if (e.key === 'Escape') { list.hidden = true; }
    });
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
    byId('ex-guess').addEventListener('click', () => this.setGuess(!this.guess));
    byId('ex-home').addEventListener('click', () => this.app.go(() => this.landing()));
    byId('to-map').addEventListener('click', () => this.app.go(() => this.app.setMode('map')));
    byId('ex-landing-map').addEventListener('click', () => this.app.go(() => this.app.setMode('map')));
    byId('to-3d').addEventListener('click', () => this.app.go(() => this.app.setMode('space', byId('ex-main').hidden ? null : this.sel)));
    byId('ex-landing-3d').addEventListener('click', () => this.app.go(() => this.app.setMode('space')));
    byId('ex-back').addEventListener('click', () => this.app.back());
    const tree = byId('ex-tree');
    const act = (e) => {
      const g = e.target.closest('[data-i]');
      if (!g) return;
      const n = this.nodes[+g.dataset.i];
      if (!n) return;
      if (n.isMore) {
        this.full.add(n.of);
        this.draw(false);
        return;
      }
      this.open(n, { animate: false });
    };
    tree.addEventListener('click', act);
    tree.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        act(e);
      }
    });
  }

  suggest(q) {
    const list = byId('ex-suggest');
    const k = norm(q);
    if (!k || this.guess) {
      list.hidden = true;
      this.sugg = [];
      return;
    }
    // curated words and imported ones in one list: prefix matches, shortest first; curated wins a tie
    const cands = [];
    for (const x of this.keys) {
      if (x.startsWith(k)) cands.push({ key: x, pre: 0, cur: 1 });
      else if (x.includes(k)) cands.push({ key: x, pre: 1, cur: 1 });
    }
    const curated = new Set(cands.map((c) => c.key));
    if (this.imp?.ready) {
      for (const i of this.imp.search(k, 12)) {
        const key = this.imp.keys[i];
        if (!curated.has(key)) cands.push({ key, pre: key.startsWith(k) ? 0 : 1, cur: 0, i });
      }
    }
    cands.sort((a, b) => a.pre - b.pre || a.key.length - b.key.length || b.cur - a.cur || (a.key < b.key ? -1 : 1));
    const out = [];
    for (const c of cands) {
      if (c.cur) for (const n of this.index.get(c.key)) out.push({ node: n });
      else for (const ent of this.imp.entries(c.i)) out.push({ ent });
      if (out.length >= 8) break;
    }
    this.sugg = out.slice(0, 8);
    this.si = 0;
    this.renderSuggest();
  }

  renderSuggest() {
    const list = byId('ex-suggest');
    list.replaceChildren(
      ...this.sugg.map((it, i) => {
        const n = it.node;
        const word = n ? n.display : it.ent.display;
        const sub = n
          ? (n.lang === 'Ru' ? `Russian, ${n.gloss || ''}` : n.gloss || FAMILIES[n.family]?.name || '')
          : `${/[\u0400-\u04ff]/.test(word) ? 'Russian, ' : ''}${this.imp.subtitle(it.ent.nums[0])}`;
        return h('li', { role: 'option', class: n ? null : 'imp', 'aria-selected': i === this.si ? 'true' : 'false', onmousedown: (e) => { e.preventDefault(); this.pick(it); } },
          h('span', { class: 's-w' }, word),
          h('span', { class: 's-sub' }, sub),
          n ? null : h('span', { class: 's-imp', title: IMP_NOTE }, 'Wiktionary'));
      })
    );
    list.hidden = !this.sugg.length;
  }

  pick(it) {
    byId('ex-input').value = '';
    byId('ex-suggest').hidden = true;
    if (it.ent) this.openEntry(it.ent, { typed: true });
    else this.open(it.node, { typed: true });
  }

  submit(q) {
    const k = norm(q);
    if (!k) return;
    const hits = this.index.get(k);
    const input = byId('ex-input');
    if (!hits) {
      const ents = this.imp?.lookup(k) || [];
      if (ents.length) {
        input.value = '';
        byId('ex-suggest').hidden = true;
        const here = this.root && ents.find((x) => x.nums.some((m) => this.imp.rootId(m) === this.root.id));
        this.openEntry(here || ents[0], { typed: true });
        return;
      }
      if (this.imp && !this.imp.ready && !this.imp.failed) {
        this.imp.loading.then(() => this.submit(q));
        return;
      }
      const en = this.enCount + (this.imp?.counts?.en || 0);
      const ru = this.ruCount + (this.imp?.counts?.ru || 0);
      this.toast(`"${q.trim()}" isn't in Etymon yet. It knows ${en.toLocaleString('en-US')} English and ${ru.toLocaleString('en-US')} Russian words.`, true);
      input.classList.remove('shake');
      void input.offsetWidth;
      input.classList.add('shake');
      return;
    }
    input.value = '';
    byId('ex-suggest').hidden = true;
    // prefer a homonym from the root on screen
    const here = this.root && hits.find((n) => n.rootIds.includes(this.root.id));
    this.open(here || hits[0], { typed: true });
  }

  setGuess(on) {
    this.guess = on;
    // the word already on screen stays visible
    if (on && this.sel && isWord(this.sel) && !this.isFound(this.sel)) {
      this.found.v.add(keyOf(this.sel));
      this.save();
    }
    const b = byId('ex-guess');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    byId('ex-input').placeholder = on ? 'Guess a word from this root' : 'Type a word you know';
    byId('ex-suggest').hidden = true;
    if (this.root) {
      this.draw(false);
      this.renderCard();
    }
    if (on) this.toast(this.root ? 'Guess mode: relatives you have not typed are hidden. Type them to reveal.' : 'Guess mode: type a word to uncover its root, then its relatives.');
  }

  toast(text, miss = false) {
    const t = byId('ex-toast');
    t.textContent = text;
    t.classList.toggle('miss', miss);
    t.classList.add('show');
    clearTimeout(this._toast);
    this._toast = setTimeout(() => t.classList.remove('show'), miss ? 3200 : 3800);
  }

  // ------------------------------------------------------------------ landing
  renderLanding() {
    const tryEl = byId('ex-try');
    tryEl.replaceChildren(
      ...TRY.map((w) => {
        const n = this.index.get(norm(w))?.[0];
        return n ? h('button', { type: 'button', onclick: () => this.open(n, { typed: true }) }, w) : null;
      })
    );
    const stats = byId('ex-stats');
    stats.replaceChildren(`${this.g.roots.length} hand-checked roots, ${this.enCount.toLocaleString('en-US')} English words, ${this.ruCount} Russian cousins.`);
    const c = this.imp?.ready ? this.imp.counts : null;
    if (c) {
      stats.append(h('br'), h('span', { class: 'imp-stats', title: this.imp.source || IMP_NOTE },
        `Plus ${(c.en || 0).toLocaleString('en-US')} English and ${(c.ru || 0).toLocaleString('en-US')} Russian words from ${(c.roots || 0).toLocaleString('en-US')} more roots, imported from Wiktionary and not hand-checked.`));
    }
  }

  landing() {
    this.root = null;
    this.sel = null;
    byId('ex-landing').hidden = false;
    byId('ex-main').hidden = true;
    this.app.writeHash('');
    byId('ex-input').focus({ preventScroll: true });
  }

  // ------------------------------------------------------------------ open a word
  rootOf(n) {
    let cur = n;
    let guard = 0;
    while (cur && !cur.isRoot && guard++ < 80) {
      const e = cur.inEdges.find((x) => x.primary) || cur.inEdges[0];
      cur = e ? e.source : null;
    }
    return cur ? this.rootById(cur.rootKey) : null;
  }

  // an imported word from the search index: fetch its root, then open it
  async openEntry(ent, opts = {}) {
    if (!this.imp) return;
    const t = setTimeout(() => this.toast(`Loading ${ent.display} from the Wiktionary import…`), 250);
    let rec = null;
    try {
      rec = await this.imp.root(ent.nums[0]);
    } catch (err) {
      clearTimeout(t);
      this.toast('That part of the Wiktionary import did not load. Check the connection and try again.', true);
      return;
    }
    clearTimeout(t);
    const n = rec && this.imp.findWord(rec, ent);
    if (!n) {
      this.toast(`"${ent.display}" did not load from the Wiktionary import.`, true);
      return;
    }
    n.rootIds = [...new Set(ent.nums.map((m) => this.imp.rootId(m)))];
    byId('ex-toast').classList.remove('show');
    this.open(n, { ...opts, root: rec });
  }

  // "#w:salary" and "#root-w12" links
  async openImported(word, h = '') {
    if (!this.imp) return false;
    await this.imp.loading;
    const ents = this.imp.lookup(norm(word));
    const ent = ents.find((x) => x.h === h && x.display === word) || ents.find((x) => x.display === word) || ents[0];
    if (!ent) return false;
    await this.openEntry(ent);
    return true;
  }

  async openImportedRoot(num) {
    if (!this.imp) return false;
    await this.imp.loading;
    const rec = await this.imp.root(num).catch(() => null);
    if (!rec) return false;
    this.open(rec.node, { root: rec });
    return true;
  }

  // a curated root with imported branches: hang them on, then redraw if it is still on screen
  extend(r) {
    if (!this.imp || r.imported) return;
    const go = () => {
      const num = this.imp.byCurated.get(r.id);
      if (num == null || this.imp.roots.has(num)) return;
      this.imp.root(num).then(() => {
        if (this.root !== r) return;
        this.layout();
        this.draw(false);
        this.renderCard();
      }).catch(() => {});
    };
    if (this.imp.ready) go();
    else this.imp.loading.then(go);
  }

  open(n, { typed = false, animate = true, root = null } = {}) {
    if (!n) return;
    // remember where we were, for the Back button
    if (n !== this.sel || this.app.mode !== 'explore') this.app.remember();
    // a node of the tree on screen stays in this tree; anything else opens its own root
    const inView = this.root && this.view && this.view.reach.has(n);
    const r = root || (inView ? this.root : n.isRoot ? this.rootById(n.rootKey) : this.rootOf(n));
    if (!r) return;
    const msg = typed ? this.markFound(n) : null;
    const same = this.root === r;
    byId('ex-suggest').hidden = true;
    this.root = r;
    this.sel = n;
    byId('ex-landing').hidden = true;
    byId('ex-main').hidden = false;
    if (!same) this.layout();
    this.draw(!same && animate);
    this.renderCard();
    this.scrollToSel();
    if (msg) this.toast(msg);
    this.app.writeHash(n.isRoot ? `root-${n.rootKey}` : this.app.slugFor(n));
    if (!same) this.extend(r);
  }

  layout() {
    const R = this.root.node;
    const reach = new Set();
    const stack = [R];
    while (stack.length) {
      const n = stack.pop();
      if (reach.has(n)) continue;
      reach.add(n);
      for (const e of outs(n)) stack.push(e.target);
    }
    // one parent per node in this view: the primary one when it is in view
    const vp = new Map();
    for (const n of reach) {
      if (n === R) continue;
      const ins = n.inEdges.filter((e) => reach.has(e.source));
      const e = ins.find((x) => x.primary) || ins[0];
      if (e) vp.set(n, e);
    }
    const all = new Map([...reach].map((n) => [n, []]));
    for (const [n, e] of vp) all.get(e.source).push(n);
    const fi = (n) => {
      const i = FAMILY_ORDER.indexOf(n.family);
      return i < 0 ? 99 : i;
    };
    for (const list of all.values()) list.sort((a, b) => fi(a) - fi(b) || a.date - b.date || (!!a.imported - !!b.imported) || (a.display < b.display ? -1 : 1));
    // words below each node (branch thickness, and the count on a folded branch)
    const wc = new Map();
    const count = (n, guard = 0) => {
      let c = isWord(n) && n !== R ? 1 : 0;
      if (guard < 400) for (const k of all.get(n)) c += count(k, guard + 1);
      wc.set(n, c);
      return c;
    };
    count(R);
    const words = [...reach].filter((n) => n !== R && isWord(n));
    this.view = { R, reach, vp, all, wc, words, imported: words.filter((n) => n.imported).length };
    this.expanded = new Set();
    this.full = new Set();
  }

  // which branches are open: the selected road always, then whatever fits the budget,
  // nearest the root first; a node with many children shows the most telling ones
  visible() {
    const { R, all, wc } = this.view;
    const road = new Set(this.pathTo(this.sel).map((s) => s.node));
    const fullRows = [...this.view.reach].filter((n) => n !== R && (isWord(n) || !all.get(n).length)).length;
    const open = new Set([R, ...road, ...this.expanded]);
    const big = fullRows > FULL_TREE;
    const shown = (n) => {
      const ks = all.get(n);
      if (!big || ks.length <= KID_LIMIT || this.full.has(n)) return ks;
      const pick = new Set(ks.filter((k) => road.has(k) || this.expanded.has(k)));
      const rest = ks.filter((k) => !pick.has(k)).sort((a, b) => (!!a.imported - !!b.imported) || (wc.get(b) - wc.get(a)) || ((b.rank || 0) - (a.rank || 0)));
      for (const k of rest) {
        if (pick.size >= KID_LIMIT) break;
        pick.add(k);
      }
      return ks.filter((k) => pick.has(k));
    };
    if (!big) {
      for (const n of this.view.reach) open.add(n);
    } else {
      let rows = 0;
      const tally = (n) => {
        const ks = open.has(n) ? shown(n) : [];
        let r = n !== R && (isWord(n) || !ks.length) ? 1 : 0;
        for (const k of ks) r += tally(k);
        if (open.has(n) && ks.length < all.get(n).length) r += 1;
        return r;
      };
      rows = tally(R);
      // breadth-first, small branches before big ones
      let layer = [R];
      while (layer.length && rows < ROW_BUDGET) {
        const next = [];
        for (const n of layer) for (const k of open.has(n) ? shown(n) : []) next.push(k);
        next.sort((a, b) => wc.get(a) - wc.get(b));
        for (const k of next) {
          if (open.has(k) || !all.get(k).length) continue;
          const add = shown(k).length - (isWord(k) ? 0 : 1) + (shown(k).length < all.get(k).length ? 1 : 0);
          if (rows + add > ROW_BUDGET) continue;
          open.add(k);
          rows += add;
        }
        layer = next;
      }
    }
    const kids = new Map();
    const more = new Map();
    const rowsList = [];
    const nodes = [];
    const walk = (n) => {
      nodes.push(n);
      const ks = open.has(n) ? shown(n) : [];
      kids.set(n, ks);
      if (n !== R && (isWord(n) || !ks.length)) rowsList.push(n);
      for (const k of ks) walk(k);
      const hidden = all.get(n).length - ks.length;
      if (open.has(n) && hidden > 0) {
        const m = { isMore: true, of: n, count: hidden, words: all.get(n).filter((k) => !ks.includes(k)).reduce((a, k) => a + wc.get(k), 0), display: '', lang: n.lang, family: n.family, date: n.date };
        kids.get(n).push(m);
        kids.set(m, []);
        rowsList.push(m);
        nodes.push(m);
      } else if (!open.has(n) && all.get(n).length) {
        more.set(n, wc.get(n) - (isWord(n) ? 1 : 0));
      }
    };
    walk(R);
    this.view.kids = kids;
    this.view.rows = rowsList;
    this.view.more = more;
    this.nodes = nodes;
  }

  pathTo(n) {
    const { R, vp } = this.view;
    const out = [];
    let cur = n;
    let guard = 0;
    while (cur && cur !== R && guard++ < 80) {
      const e = vp.get(cur);
      out.unshift({ node: cur, edge: e });
      cur = e ? e.source : null;
    }
    out.unshift({ node: R, edge: null });
    return out;
  }

  masked(n) {
    return this.guess && isWord(n) && !this.isFound(n);
  }

  // ------------------------------------------------------------------ the tree
  draw(animate) {
    this.visible();
    const { R, kids, vp, rows, wc, more } = this.view;
    const host = byId('ex-tree');
    const W = Math.max(300, host.clientWidth);
    const narrow = W < 600;
    const labelW = narrow ? Math.max(128, Math.min(178, W * 0.47)) : Math.min(310, Math.max(220, W * 0.33));
    const x0 = 26;
    const x1 = W - labelW - 12;
    const top = narrow ? 74 : 84;
    const rowH = narrow ? 31 : 28;
    const r0 = timeToR(R.date);
    const X = (t) => x0 + ((timeToR(t) - r0) / (1 - r0)) * (x1 - x0);
    const P = new Map();
    const place = (n, px) => {
      const step = isWord(n) ? 10 : 18;
      const x = n === R ? x0 : Math.min(x1 - 6, Math.max(X(n.date), px + step));
      P.set(n, { x, y: 0 });
      for (const c of kids.get(n)) place(c, x);
    };
    place(R, x0);
    rows.forEach((n, i) => (P.get(n).y = top + i * rowH + rowH / 2));
    const fixY = (n) => {
      const ks = kids.get(n);
      if (!ks.length || (n !== R && isWord(n))) {
        for (const c of ks) fixY(c);
        return P.get(n).y;
      }
      const ys = ks.map(fixY);
      P.get(n).y = (ys[0] + ys[ys.length - 1]) / 2;
      return P.get(n).y;
    };
    fixY(R);
    const H = top + rows.length * rowH + 28;

    const sel = this.sel;
    const path = new Set(this.pathTo(sel).map((s) => s.node));
    const idx = new Map(this.nodes.map((n, i) => [n, i]));
    const svg = sv('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': `Words grown from ${R.display}` });
    const gHits = sv('g', { class: 'hits' });
    const gAxis = sv('g', { class: 'axis' });
    const gEdges = sv('g', { class: 'edges' });
    const gPath = sv('g', { class: 'onpath' });
    const gSeg = sv('g', { class: 'segs' });
    const gNodes = sv('g', { class: 'nodes' });
    const gLabels = sv('g', { class: 'labels' });
    svg.append(gHits, gAxis, gEdges, gPath, gSeg, gNodes, gLabels);
    // every line is a button: a wide invisible stroke that selects the node it leads to
    const seg = (d, n, label) => {
      const el = sv('path', { d, class: 'seg', 'data-i': idx.get(n) });
      el.append(sv('title', {}, label));
      gSeg.append(el);
    };

    // time axis: when each form was spoken
    let lastX = -1e9;
    for (const t of TICKS) {
      if (t < R.date) continue;
      const x = X(t);
      gAxis.append(sv('line', { x1: x, y1: top - 14, x2: x, y2: H - 10 }));
      if (x - lastX > (narrow ? 46 : 54)) {
        gAxis.append(sv('text', { x, y: top - 22, 'text-anchor': t === T_MAX ? 'end' : 'middle' }, yearText(t)));
        lastX = x;
      }
    }
    if (R.date > -4000) gAxis.append(sv('text', { x: x0, y: top - 22, 'text-anchor': 'start' }, yearText(R.date)));

    const color = (n) => `var(--${n.family === 'root' ? 'root' : n.family})`;
    const curve = (a, b) => {
      const xm = a.x + (b.x - a.x) * 0.5;
      return `M${a.x},${a.y} C${xm},${a.y} ${xm},${b.y} ${b.x},${b.y}`;
    };
    const pathEdges = [];
    const stepMs = 170;
    const pathLen = path.size + 1;
    for (const n of this.nodes) {
      if (n === R) continue;
      if (n.isMore) {
        // the rest of a crowded branch, folded into one line
        const a = P.get(n.of);
        const b = P.get(n);
        const el = sv('path', { d: curve(a, b), class: 'edge fold', style: `stroke:${color(n.of)}` });
        gEdges.append(el);
        continue;
      }
      const e = vp.get(n);
      if (!e || !P.has(e.source)) continue;
      const a = P.get(e.source);
      const b = P.get(n);
      const d = curve(a, b);
      const w = Math.min(4.5, 1.1 + Math.sqrt(Math.max(1, wc.get(n) || 1)) * 0.42);
      const on = path.has(n) && path.has(e.source);
      const el = sv('path', { d, class: `edge${e.uncertain ? ' unsure' : ''}${e.imported ? ' imp' : ''}`, style: `stroke:${color(n)};stroke-width:${w}` });
      if (animate) el.classList.add('grow-in'), el.style.animationDelay = `${pathLen * stepMs + 80}ms`;
      gEdges.append(el);
      seg(d, n, `${e.source.display} → ${n.display}${e.imported ? ` (${e.how}; from Wiktionary)` : ''}`);
      if (on) pathEdges.push({ n, e, d, a, b });
    }
    // life-lines: from the year a word entered its language out to the present
    for (const n of rows) {
      if (!isWord(n)) continue;
      const p = P.get(n);
      const l = sv('line', { x1: p.x, y1: p.y, x2: x1, y2: p.y, class: 'life', style: `stroke:${color(n)}` });
      seg(`M${p.x},${p.y} L${x1},${p.y}`, n, n.display);
      if (animate) l.classList.add('grow-in'), l.style.animationDelay = `${pathLen * stepMs + 80}ms`;
      gEdges.append(l);
    }
    // the selected road, drawn last and dug from the word back to the root
    const selWord = sel !== R && isWord(sel);
    if (selWord) {
      const p = P.get(sel);
      const el = sv('path', { d: `M${p.x},${p.y} L${x1},${p.y}`, class: `edge path${animate ? ' dig' : ''}`, pathLength: 1 });
      gPath.append(el);
    }
    const lead = selWord ? 1 : 0;
    pathEdges.sort((u, v) => P.get(v.n).x - P.get(u.n).x);
    pathEdges.forEach(({ n, e, d, a, b }, j) => {
      const i = j + lead;
      // pathLength=1 lets CSS draw the curve from its far end back toward the root
      const el = sv('path', { d, class: `edge path${animate ? ' dig' : ''}`, pathLength: 1 });
      if (animate) el.style.animationDelay = `${i * stepMs}ms`;
      gPath.append(el);
      const tags = e.imported
        ? [e.how].filter((x) => x && x !== 'inherited' && x !== 'derived')
        : [...e.tags.map((t) => LAWS[t]?.name || t), e.kind === 'borrow' ? 'borrowed' : null].filter(Boolean);
      if (tags.length && !narrow) {
        // the change that happened on the way in, tucked under the end of its branch
        const txt = clip(tags.join(', '), narrow ? 20 : 30);
        const wpx = txt.length * 6.1;
        const right = b.x - 6;
        const start = right - wpx < 4;
        const tx = sv('text', { x: start ? Math.max(4, a.x + 4) : right, y: b.y + 17, class: 'tagl', 'text-anchor': start ? 'start' : 'end' }, txt);
        if (animate) tx.classList.add('grow-in'), tx.style.animationDelay = `${i * stepMs + 120}ms`;
        gPath.append(tx);
      }
    });

    // labels of older forms only where they fit; the selected road always gets its own
    const boxes = [];
    const fits = (x, y, txt, force) => {
      const b = [x - 2, y - 12, x + txt.length * 6.6 + 2, y + 3];
      if (!force && boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return false;
      boxes.push(b);
      return true;
    };
    const order = [...this.nodes].sort((u, v) => (path.has(v) - path.has(u)) || (P.get(u).x - P.get(v).x));
    const showForm = new Map();
    for (const n of order) {
      if (n === R || n.isMore || isWord(n) || !kids.get(n).length) continue;
      const p = P.get(n);
      const on = path.has(n);
      if (!on && narrow) continue;
      const full = on && !narrow ? `${n.display}  ${LANGS[n.lang].name}` : n.display;
      if (fits(p.x + 6, p.y - 8, full, false)) showForm.set(n, full);
      else if (full !== n.display && fits(p.x + 6, p.y - 8, n.display, false)) showForm.set(n, n.display);
    }

    // nodes and their forms
    for (const n of this.nodes) {
      const p = P.get(n);
      const on = path.has(n);
      const word = isWord(n) && n !== R;
      if (n.isMore) {
        const g = sv('g', { class: 'node more', 'data-i': idx.get(n), tabindex: 0, role: 'button', 'aria-label': `Show ${n.count} more under ${n.of.display}` });
        g.append(sv('rect', { x: p.x - 4, y: p.y - rowH / 2, width: Math.max(140, x1 - p.x + 4), height: rowH, class: 'hit' }));
        const label = n.words ? `+ ${n.words.toLocaleString('en-US')} more word${n.words === 1 ? '' : 's'}` : `+ ${n.count} more`;
        g.append(sv('text', { x: p.x + 4, y: p.y + 4, class: 'morelab' }, `${label} under ${clip(n.of.display, 18)}`));
        gNodes.append(g);
        continue;
      }
      const fade = animate && !on ? ` grow-in` : '';
      const delayStyle = animate && !on ? `animation-delay:${pathLen * stepMs + 80}ms` : null;
      if (n === R) {
        const g = sv('g', { class: 'node rootnode', 'data-i': idx.get(n), tabindex: 0, role: 'button', 'aria-label': `Root ${n.display}, ${n.gloss}` });
        g.append(sv('circle', { cx: p.x, cy: p.y, r: 13, class: 'halo' }));
        g.append(sv('circle', { cx: p.x, cy: p.y, r: 6, class: 'rootdot' }));
        gNodes.append(g);
        const lab = sv('text', { x: p.x - 8, y: Math.max(top - 46, p.y - 30), class: 'rootlab' }, n.display);
        const gl = sv('text', { x: p.x - 8, y: Math.max(top - 46, p.y - 30) + 17, class: 'rootgloss' }, clip(n.gloss, 26));
        const rg = sv('g', { class: 'rootlabel', 'data-i': idx.get(n), tabindex: 0, role: 'button', 'aria-label': `Root ${n.display}, ${n.gloss}` });
        rg.append(lab, gl);
        gLabels.append(rg);
        continue;
      }
      if (word) {
        // the whole row is one target: click anywhere along the word's line
        gHits.append(sv('rect', { x: 0, y: p.y - rowH / 2, width: W, height: rowH, class: `rowhit${n === sel ? ' sel' : ''}`, 'data-i': idx.get(n) }));
        const found = this.isFound(n);
        const hide = this.masked(n);
        const g = sv('g', {
          class: `leaf${n === sel ? ' sel' : ''}${on ? ' on' : ''}${found ? ' found' : ''}${hide ? ' masked' : ''}${fade}`,
          'data-i': idx.get(n), tabindex: 0, role: 'button',
          'aria-label': hide ? `Hidden word, ${n.display.length} letters` : `${n.display}${n.gloss ? ', ' + n.gloss : ''}`,
          style: delayStyle,
        });
        g.append(sv('rect', { x: x1, y: p.y - rowH / 2, width: W - x1, height: rowH, class: 'hit' }));
        g.append(sv('circle', { cx: x1, cy: p.y, r: n === sel ? 5 : 3.6, class: 'rowdot', style: `fill:${color(n)}` }));
        if (found && !hide) g.append(sv('circle', { cx: x1, cy: p.y, r: 7.5, class: 'foundring' }));
        const label = hide ? mask(n.display) : n.display;
        const t = sv('text', { x: x1 + 12, y: p.y + 5, class: `w${n.imported ? ' imp' : ''}` }, label);
        if (n.imported && !hide) t.append(sv('tspan', { class: 'impmark', dx: 3 }, '◇'));
        const lang = n.lang === 'Ru' ? 'Russian' : '';
        // a word without its own gloss shows where it came from, when that says something new ("blade: from blæd 'leaf'")
        const par = vp.get(n)?.source;
        const once = !n.gloss && par && par.gloss && !norm(par.gloss).startsWith(norm(n.display)) ? `from ${par.display} "${par.gloss}"` : '';
        const sub = hide ? clip(n.gloss || once || `through ${FAMILIES[n.family]?.name}`, narrow ? 18 : 30) : clip([lang, n.gloss || once].filter(Boolean).join(', '), narrow ? 18 : 34);
        if (sub) t.append(sv('tspan', { class: 'g', dx: 8 }, sub));
        if (more.get(n)) t.append(sv('tspan', { class: 'fold', dx: 8 }, `+${more.get(n)}`));
        g.append(t);
        g.append(sv('title', {}, hide ? 'A hidden relative: type it to reveal' : `${n.display} (${LANGS[n.lang].name}, ${approx(n)})${n.gloss ? ': ' + n.gloss : ''}${n.imported ? ' · ' + IMP_NOTE : ''}${more.get(n) ? ` · ${more.get(n)} more words grew from it: select it to open them` : ''}`));
        gLabels.append(g);
        continue;
      }
      // an ancestor form in some older language
      const g = sv('g', { class: `node${on ? ' on' : ''}${fade}`, 'data-i': idx.get(n), tabindex: 0, role: 'button', 'aria-label': `${LANGS[n.lang].name} ${n.display}`, style: delayStyle });
      g.append(sv('circle', { cx: p.x, cy: p.y, r: on ? 4.5 : 3.2, class: 'formdot', style: `fill:${color(n)}` }));
      if (!kids.get(n).length) {
        // a leaf in an older language: a cousin, or a word that died
        const end = n.died ? X(Math.min(n.died, T_MAX)) : p.x;
        if (n.died) {
          gEdges.append(sv('line', { x1: p.x, y1: p.y, x2: end, y2: p.y, class: 'life dead', style: `stroke:${color(n)}` }));
          seg(`M${p.x},${p.y} L${end},${p.y}`, n, `${n.display}, died out`);
        }
        const lbl = `${n.display}${n.died ? ' †' : ''}`;
        const t = sv('text', { x: Math.max(end, p.x) + 9, y: p.y + 4, class: `form leafform${on ? ' on' : ''}` }, lbl);
        t.append(sv('tspan', { class: 'g', dx: 6 }, clip(`${LANGS[n.lang].name}${n.gloss ? ', ' + n.gloss : ''}${n.died ? ', died out' : ''}`, narrow ? 22 : 40)));
        if (more.get(n)) t.append(sv('tspan', { class: 'fold', dx: 8 }, `+${more.get(n).toLocaleString('en-US')} word${more.get(n) === 1 ? '' : 's'}`));
        g.append(t);
      } else if (showForm.has(n)) {
        g.append(sv('text', { x: p.x + 6, y: p.y - 8, class: `form${on ? ' on' : ''}` }, showForm.get(n)));
      }
      g.append(sv('title', {}, `${n.display}${n.native ? ` ${n.native}` : ''} (${LANGS[n.lang].name}, ${approx(n)})${n.gloss ? ': ' + n.gloss : ''}${n.imported ? ' · ' + IMP_NOTE : ''}`));
      gNodes.append(g);
    }

    host.replaceChildren(svg);
    this.rowY = (n) => P.get(n)?.y ?? 0;
  }

  scrollToSel() {
    if (!this.sel || !this.view) return;
    const y = this.rowY(this.sel);
    const narrow = window.innerWidth < 820;
    const sc = narrow ? byId('ex-main') : byId('ex-tree');
    const view = sc.clientHeight;
    const cur = sc.scrollTop;
    if (narrow) {
      // on phones the tree and the card share one scroll; keep the word in sight
      if (y < cur + 40 || y > cur + view * 0.6) sc.scrollTo({ top: Math.max(0, y - 120), behavior: 'smooth' });
    } else if (y < cur + 60 || y > cur + view - 60) {
      sc.scrollTo({ top: Math.max(0, y - view / 3), behavior: 'smooth' });
    }
  }

  // ------------------------------------------------------------------ the card
  renderCard() {
    const card = byId('ex-card');
    const n = this.sel;
    const R = this.view.R;
    card.replaceChildren();
    if (this.masked(n)) {
      card.append(this.hintCard(n), this.rootBlock(R));
      return;
    }
    const lang = LANGS[n.lang];
    card.append(h('p', { class: 'exc-lang' }, n.isRoot ? (n.lang === 'PIE' ? 'Proto-Indo-European root' : `${lang.name} root`) : lang.name));
    card.append(h('h2', { class: `exc-word${n.isRoot ? ' root' : ''}` }, n.display));
    if (n.native) card.append(h('p', { class: 'exc-native' }, n.native));
    if (n.imported) card.append(h('p', { class: 'exc-imp' }, h('span', { class: 'impmark' }, '◇'), ` ${IMP_NOTE}`));
    if (n.gloss) card.append(h('p', { class: 'exc-gloss' }, `"${n.gloss}"`));
    if (n.lang === 'En' && n.imported) card.append(h('p', { class: 'exc-meta' }, this.entered(n)));
    else if (n.lang === 'En') card.append(h('p', { class: 'exc-meta' }, `In English since ${n.dateExplicit ? n.date : 'Old English times'}; ${commonness(n.zipf)}.`));
    else if (!n.isRoot) card.append(h('p', { class: 'exc-meta' }, approx(n)));

    const steps = this.pathTo(n);
    if (!n.isRoot) {
      const chain = h('p', { class: 'exc-chain' });
      steps.slice().reverse().forEach((s, i, arr) => {
        chain.append(i === arr.length - 1 ? h('b', {}, s.node.display) : s.node.display);
        if (i < arr.length - 1) chain.append(h('span', { class: 'arr' }, ' ← '));
      });
      card.append(chain);
    }
    if (n.note && !n.isRoot) card.append(h('p', { class: 'exc-note' }, n.note));
    if (!n.isRoot) card.append(this.app.ui.road(steps, n));

    // the same word reached from another root
    const others = (n.rootIds || []).filter((id) => id !== this.root.id);
    if (others.length) {
      const chips = others.map((id) => {
        const r = this.g.rootById[id];
        if (r) return h('button', { class: 'chip', type: 'button', onclick: () => this.openRoot(r) }, `${r.node.display} "${r.node.gloss}"`);
        const num = this.imp?.numOf(id);
        const m = num != null ? this.imp.rootMeta(num) : null;
        if (!m) return null;
        return h('button', { class: 'chip imp', type: 'button', title: IMP_NOTE, onclick: () => this.openImportedRoot(num) }, m.form ? `${m.form}${m.gloss ? ` "${clip(m.gloss, 28)}"` : ''}` : `via ${LANGS[m.lang]?.name || 'another language'}`);
      }).filter(Boolean);
      if (chips.length) card.append(h('div', { class: 'exc-also' }, h('span', {}, 'Also grows from'), ...chips));
    }
    // same spelling, different word
    if (isWord(n)) {
      const twins = (this.index.get(norm(n.display)) || []).filter((x) => x !== n)
        .map((x) => h('button', { class: 'chip', type: 'button', onclick: () => this.open(x) }, `${x.display}, "${x.gloss || this.rootOf(x)?.node.gloss || ''}"`));
      for (const ent of this.imp?.lookup(norm(n.display)) || []) {
        if (n.imported && ent.display === n.form && (ent.h || '') === (n.h || '')) continue;
        twins.push(h('button', { class: 'chip imp', type: 'button', title: IMP_NOTE, onclick: () => this.openEntry(ent) }, `${ent.display}, ${this.imp.subtitle(ent.nums[0])}`));
      }
      if (twins.length) card.append(h('div', { class: 'exc-also' }, h('span', {}, 'Same spelling, another word:'), ...twins));
    }
    if (isWord(n)) card.append(this.sources(n));
    card.append(this.rootBlock(R));
  }

  openRoot(r) {
    this.open(r.node, { root: r });
  }

  // what we can honestly say about when an imported word came in
  entered(n) {
    const e = this.view.vp.get(n);
    const par = e?.source;
    if (!par) return 'Wiktionary gives no older form.';
    if (par.lang === 'OE') return 'In English since Old English times.';
    if (par.lang === 'ME') return 'In English since Middle English times.';
    if (par.lang === 'En') return `Formed in English from ${par.display}.`;
    if (e.how === 'steps not recorded') return 'The steps between this word and its root are not recorded here.';
    const how = e.how === 'learned borrowing' ? 'a learned borrowing from' : e.how === 'calque' ? 'a calque of' : e.kind === 'borrow' ? 'borrowed from' : 'from';
    return `Came into English as ${how} ${LANGS[par.lang]?.name || 'another language'}; the date is not recorded here.`;
  }

  sources(n) {
    const enc = encodeURIComponent;
    const links = n.lang === 'En'
      ? [['Etymonline', `https://www.etymonline.com/word/${enc(n.display.toLowerCase())}`], ['Wiktionary', `https://en.wiktionary.org/wiki/${enc(n.display)}#Etymology`]]
      : [['Wiktionary', `https://en.wiktionary.org/wiki/${enc(n.display)}#Russian`]];
    return h('div', { class: 'exc-src' }, h('span', {}, 'Check it yourself:'),
      ...links.map(([t, u]) => h('a', { href: u, target: '_blank', rel: 'noopener' }, t)));
  }

  rootBlock(R) {
    const sec = h('section', { class: 'exc-root' });
    sec.append(h('h4', {}, h('button', { class: 'j-root-form', type: 'button', onclick: () => this.open(R, { animate: false }) }, R.display), h('span', { class: 'j-root-gloss' }, ` "${R.gloss}"`)));
    if (R.note) sec.append(h('p', { class: 'j-root-note' }, R.note));
    const rows = this.view.words;
    const en = rows.filter((x) => x.lang === 'En').length;
    const ru = rows.filter((x) => x.lang === 'Ru').length;
    const got = rows.filter((x) => this.isFound(x)).length;
    sec.append(h('p', { class: 'exc-count' },
      `${en.toLocaleString('en-US')} English word${en === 1 ? '' : 's'}${ru ? ` and ${ru.toLocaleString('en-US')} Russian` : ''} grew from this root.`,
      this.guess ? ` You have found ${got} of ${rows.length}.` : ''));
    // the first branches: one cousin in each language family
    const first = this.view.kids.get(R).filter((x) => !isWord(x) && !x.isMore);
    if (first.length) {
      const dl = h('dl', { class: 'exc-cousins' });
      for (const c of first) {
        dl.append(h('dt', {}, LANGS[c.lang].name),
          h('dd', {}, h('button', { type: 'button', class: 'linkish', onclick: () => this.open(c, { animate: false }) }, c.display), c.gloss ? h('span', { class: 'cg' }, ` "${c.gloss}"`) : null));
      }
      sec.append(h('p', { class: 'exc-sub' }, 'Across the family'), dl);
    }
    if (R.lang === 'PIE') {
      sec.append(h('div', { class: 'exc-src' }, h('span', {}, 'The root on'),
        h('a', { href: `https://en.wiktionary.org/w/index.php?search=${encodeURIComponent('Reconstruction:Proto-Indo-European/' + R.display.replace(/^\*/, ''))}`, target: '_blank', rel: 'noopener' }, 'Wiktionary')));
    }
    const imp = this.view.imported;
    if (R.imported) {
      sec.append(h('p', { class: 'exc-trust imp' }, h('span', { class: 'impmark' }, '◇'),
        ' Imported automatically from Wiktionary (kaikki.org extract, CC BY-SA) and not hand-checked. Dates are rough, by language stage; dashed steps are marked uncertain there.'));
    } else {
      sec.append(h('p', { class: 'exc-trust' }, 'Hand-built from Watkins’s Indo-European roots, Etymonline and Wiktionary, then fact-checked. Debated steps are dashed and marked.'));
      if (imp) sec.append(h('p', { class: 'exc-trust imp' }, h('span', { class: 'impmark' }, '◇'),
        ` ${imp.toLocaleString('en-US')} more word${imp === 1 ? '' : 's'} on this root, and their dotted branches, were imported from Wiktionary and are not hand-checked.`));
    }
    return sec;
  }

  hintCard(n) {
    const wrap = h('div', { class: 'exc-hint' });
    wrap.append(h('p', { class: 'exc-lang' }, n.lang === 'Ru' ? 'A hidden Russian relative' : 'A hidden English relative'));
    wrap.append(h('h2', { class: 'exc-word masked' }, mask(n.display)));
    if (n.gloss) wrap.append(h('p', { class: 'exc-gloss' }, `"${n.gloss}"`));
    const route = n.lang === 'En' ? `came into English through ${FAMILIES[n.family]?.name}` : 'came down through Proto-Slavic';
    wrap.append(h('p', { class: 'exc-meta' }, `${[...n.display].filter((c) => /\p{L}/u.test(c)).length} letters; it ${route}${n.lang === 'En' && n.dateExplicit ? `, first written in ${n.date}` : ''}.`));
    wrap.append(h('p', { class: 'exc-note' }, 'Type it in the box above to reveal it.'));
    wrap.append(h('button', { class: 'ghost', type: 'button', onclick: () => this.reveal(n) }, 'Reveal it'));
    return wrap;
  }

  reveal(n) {
    this.found.v.add(keyOf(n));
    this.save();
    this.draw(false);
    this.renderCard();
  }
}
