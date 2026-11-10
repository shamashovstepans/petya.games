// Etymon: where words come from. Three views of it, and this file holds what they share: the graph
// of hand-written words, the address in the bar, and the way back.
//   kin      the globe of languages; the front door
//   explore  one word at a time: its road to the root, the tree that grew from that root, its card
//   space    the hand-written words as one tree in three dimensions

import { parseAll } from './parse.js';
import sources from '../data/index.js';
import { analyze } from './analysis.js';
import { Explore } from './explore.js';
import { Imported } from './imported.js';
import { Space } from './space.js';
import { Kin } from './kin.js';
import { bindAbout } from './about.js';

const byId = (id) => document.getElementById(id);

class App {
  constructor() {
    this.g = parseAll(sources);
    if (this.g.errors.length) console.error('data errors', this.g.errors);
    analyze(this.g);
    this.backStack = [];
    this.restoring = false;
    // the Wiktionary import: its index loads in the background, roots on demand
    this.imp = new Imported(this.g);
    this.explore = new Explore(this);
    for (const id of ['sp-back', 'kn-back']) byId(id).addEventListener('click', () => this.back());
    for (const id of ['to-kin', 'ex-landing-kin', 'sp-kin']) {
      byId(id)?.addEventListener('click', () => this.go(() => this.setMode('kin', '')));
    }
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
        e.preventDefault();
        this.back();
      }
    });
    this.boot();
  }

  // Shareable views live in the hash (#languages-en-ru, #pedigree, #3d-heart): a plain #name is what
  // survives inside an Artifact link.
  slugFor(n) {
    if (n && n.imported && (n.lang === 'En' || n.lang === 'Ru')) return `w:${n.form}${n.h ? '~' + n.h : ''}`;
    if (!n || !n.isEn) return '';
    const s = n.key.toLowerCase().replace(/#/g, '-').replace(/\s+/g, '-');
    return /^[a-z0-9-]+$/.test(s) ? s : '';
  }

  // a word of the hand-written graph by what an address calls it
  wordAt(k) {
    const g = this.g;
    return g.byKey.get(k.replace(/-/g, '#')) || g.byKey.get(k) || g.byDisplay.get(k.replace(/-/g, ' ')) || g.byDisplay.get(k) || null;
  }

  routeFromHash() {
    const h = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    if (!h) return false;
    if (h === 'explore') {
      this.setMode('explore');
      this.explore.landing();
      return true;
    }
    // the languages: #languages, #languages-en, #languages-en-ru, #languages-en-water
    const kn = h.match(/^languages(?:-(.+))?$/);
    if (kn) {
      this.setMode('kin', kn[1] || '');
      return true;
    }
    // the 3D view: #3d, #3d-word, #3d-root-<id>, #3d-n<index>
    const sp = h.match(/^3d(?:-(.+))?$/);
    if (sp) {
      const k = sp[1] || '';
      const r3 = k.match(/^root-(.+)$/);
      const n3 = k.match(/^n(\d+)$/);
      let node = null;
      if (r3) {
        const id = Object.keys(this.g.rootById).find((x) => x.toLowerCase() === r3[1]);
        node = id ? this.g.rootById[id].node : null;
      } else if (n3) node = this.g.nodes[+n3[1]] || null;
      else if (k) node = this.wordAt(k);
      this.setMode('space', node);
      if (!k && this.space.sel >= 0) this.space.clear();
      return true;
    }
    // Explore: a word of the Wiktionary import, a root, or a hand-written word
    const wm = h.match(/^w:(.+?)(?:~([\w.]+))?$/);
    if (wm) {
      this.setMode('explore');
      this.explore.openImported(wm[1], wm[2] || '').then((ok) => ok || this.explore.landing());
      return true;
    }
    const rm = h.match(/^root-(.+)$/);
    if (rm && /^w\d+$/.test(rm[1])) {
      this.setMode('explore');
      this.explore.openImportedRoot(+rm[1].slice(1)).then((ok) => ok || this.explore.landing());
      return true;
    }
    const rid = rm && Object.keys(this.g.rootById).find((k) => k.toLowerCase() === rm[1]);
    if (rid) {
      this.setMode('explore');
      this.explore.openRoot(this.g.rootById[rid]);
      return true;
    }
    const w = this.wordAt(h);
    if (w) {
      this.select(w);
      return true;
    }
    // a plain #word that is not hand-written may still be an imported one
    if (this.imp && !this.imp.failed && /^[\p{L}'-]+$/u.test(h)) {
      this.setMode('explore');
      this.explore.openImported(h).then((ok) => ok || this.explore.landing());
      return true;
    }
    return false;
  }

  writeHash(slug) {
    try {
      const url = slug ? `#${slug}` : location.pathname + location.search;
      if ((location.hash || '') !== (slug ? `#${slug}` : '')) history.replaceState(null, '', url);
    } catch {
      /* some frames refuse history changes; the view still works */
    }
  }

  boot() {
    // an address typed or followed while the page is open; an empty one is the front door
    window.addEventListener('hashchange', () => {
      if (!this.routeFromHash() && location.hash.length <= 1) this.setMode('kin', '');
    });
    if (location.hash.length > 1 && this.routeFromHash()) return;
    const word = new URLSearchParams(location.search).get('word');
    const w = word && (this.g.byKey.get(word) || this.g.byDisplay.get(word.toLowerCase()));
    if (w) this.select(w);
    else this.setMode('kin', '');
  }

  // node: for the languages an address ('' the whole globe, null to stay where it was);
  // for the 3D view a word to fly to
  setMode(mode, node = null) {
    const prev = this.mode;
    this.mode = mode;
    document.body.dataset.mode = mode;
    if (prev === 'space' && mode !== 'space' && this.space) this.space.exit();
    if (prev === 'kin' && mode !== 'kin' && this.kin) this.kin.exit();
    if (mode === 'kin') {
      // built the first time it is opened
      this.kin ||= new Kin(this);
      const at = typeof node === 'string' ? node : null;
      if (prev !== 'kin') this.kin.enter(at);
      else if (at != null) this.kin.open(at);
      return;
    }
    if (mode === 'space') {
      this.space ||= new Space(this);
      const at = node && this.space.S.index.has(node) ? node : null;
      if (prev !== 'space') this.space.enter(at);
      else if (at) this.space.select(this.space.S.index.get(at), { remember: false });
      return;
    }
    const sel = this.explore && this.explore.sel;
    this.writeHash(sel ? (sel.isRoot ? `root-${sel.rootKey}` : this.slugFor(sel)) : 'explore');
  }

  // ------------------------------------------------------------------ back
  // Where you were: the view, and in it the word, the root it was opened in, or the address.
  snapshot() {
    if (this.mode === 'space') return { mode: 'space', node: this.space && this.space.sel >= 0 ? this.g.nodes[this.space.sel] : null, root: null };
    if (this.mode === 'kin') return { mode: 'kin', slug: this.kin ? this.kin.slug() : '', title: this.kin ? this.kin.title() : '', node: null, root: null };
    const ex = this.explore;
    // object references, so words from the Wiktionary import come back too
    return { mode: 'explore', node: ex && ex.sel ? ex.sel : null, root: ex && ex.root ? ex.root : null };
  }

  remember() {
    if (this.restoring || !this.mode) return;
    const s = this.snapshot();
    const last = this.backStack[this.backStack.length - 1];
    const same = (a, b) => a.mode === b.mode && a.node === b.node && a.root === b.root && (a.slug || '') === (b.slug || '');
    if (last && same(last, s)) return;
    this.backStack.push(s);
    if (this.backStack.length > 80) this.backStack.shift();
    this.updateBack();
  }

  // run one user navigation: remember where we were, once
  go(fn) {
    this.remember();
    const prev = this.restoring;
    this.restoring = true;
    try {
      fn();
    } finally {
      this.restoring = prev;
    }
    this.updateBack();
  }

  back() {
    const s = this.backStack.pop();
    if (!s) return;
    this.restoring = true;
    try {
      if (s.mode === 'kin') {
        this.setMode('kin', s.slug || '');
      } else if (s.mode === 'space') {
        this.setMode('space', s.node);
        if (!s.node) this.space.clear();
      } else {
        this.setMode('explore');
        if (s.node) this.explore.open(s.node, { animate: false, root: s.root });
        else this.explore.landing();
      }
    } finally {
      this.restoring = false;
    }
    this.updateBack();
  }

  describe(s) {
    if (!s) return '';
    if (s.mode === 'kin') return s.slug && s.title ? s.title : 'Languages';
    if (s.mode === 'space') return s.node ? `${s.node.display} in 3D` : '3D';
    return s.node ? s.node.display : 'Explore';
  }

  updateBack() {
    const top = this.backStack[this.backStack.length - 1];
    const label = this.describe(top);
    for (const id of ['ex-back', 'sp-back', 'kn-back']) {
      const b = byId(id);
      if (!b) continue;
      b.hidden = !top;
      b.title = top ? `Back to ${label}` : '';
      b.setAttribute('aria-label', top ? `Back to ${label}` : 'Back');
      const t = b.querySelector('.bk-t');
      if (t) t.textContent = label;
    }
  }

  // open a word in Explore, from anywhere
  select(n) {
    if (!n) return;
    this.go(() => {
      this.setMode('explore');
      this.explore.open(n);
    });
  }
}

window.app = new App();
bindAbout();
