// Etymon, languages: the words around the globe. The card, the search box, the buttons, the legend.

import { esc, num, wordCard } from './kin-card-word.js';
import { langCard, setCard } from './kin-card-lang.js';
import { pairCard, crossing } from './kin-card-pair.js';
import { search } from './kin-search.js';
import { KinPanel } from './kin-panel.js';

const $ = (id) => document.getElementById(id);

export class KinUI {
  constructor(k) {
    this.k = k;
    this.cardEl = $('kn-card');
    this.yearEl = $('kn-year');
    this.hintEl = $('kn-hint');
    this.input = $('kn-input');
    this.sugg = $('kn-suggest');
    this.items = [];
    this.cur = -1;
    this.gloss = null;   // the meanings, a second file: fetched when a card or the search first needs one
    const app = k.app;

    $('kn-home').addEventListener('click', () => k.home());
    $('kn-replay').addEventListener('click', () => { k.lastInput = performance.now(); this.panel.shut(); k.playIntro(); });
    $('kn-explore').addEventListener('click', () => app.go(() => app.setMode('explore')));
    $('kn-3d').addEventListener('click', () => app.go(() => app.setMode('space')));

    // the counted things: findings, the kinship table, the sound laws
    this.panel = new KinPanel(k, this);
    this.tabs = { find: $('kn-find'), kin: $('kn-matrix'), sounds: $('kn-sounds'), about: $('kn-about') };
    for (const [tab, b] of Object.entries(this.tabs)) b.addEventListener('click', () => { k.lastInput = performance.now(); this.panel.toggle(tab); });

    this.cardEl.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act], [data-i], [data-s], [data-pair], [data-set]');
      if (t && this.cardEl.contains(t)) this.act(t);
    });

    $('kn-legend').addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (b) k.show({ kind: 'lang', s: +b.dataset.s });
    });

    // search
    $('kn-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.take(this.items[Math.max(0, this.cur)]);
    });
    this.input.addEventListener('input', () => this.suggest());
    this.input.addEventListener('focus', () => this.suggest());
    this.input.addEventListener('blur', () => setTimeout(() => { this.sugg.hidden = true; }, 160));
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!this.items.length) return;
        this.cur = (this.cur + (e.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length;
        [...this.sugg.children].forEach((li, n) => li.setAttribute('aria-selected', n === this.cur));
      } else if (e.key === 'Escape') this.input.blur();
    });
    this.sugg.addEventListener('pointerdown', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      e.preventDefault();
      this.take(this.items[+li.dataset.k]);
    });
  }

  // the data is in: the legend names the branches, each a way to its mother tongue
  ready() {
    const K = this.k.K, st = K.stations;
    $('kn-load').hidden = true;
    const lg = $('kn-legend');
    lg.innerHTML = K.branches.map((b) => {
      const mine = st.filter((s) => s.branch === b.i && s.count > 0);
      if (!mine.length || b.key === 'root') return '';
      const top = mine.find((s) => s.parent >= 0 && st[s.parent].branch !== b.i);
      const body = `<i style="background:${b.color}"></i>${esc(b.name)}`;
      return top ? `<button type="button" class="sp-lg" data-s="${top.i}" title="${esc(top.name)}">${body}</button>` : `<span class="sp-lg">${body}</span>`;
    }).join('');
    lg.hidden = false;
  }

  fail(msg) {
    $('kn-load').hidden = true;
    const el = $('kn-fail');
    if (msg) el.textContent = msg;
    el.hidden = false;
  }

  // run `then` once the meanings are here (at once if they are); one waiting call a key
  meanings(key, then) {
    if (this.gloss) return;
    const first = !this.wait;
    (this.wait ||= new Map()).set(key, then);
    if (first) {
      this.k.K.loadGloss().then((g) => {
        this.gloss = g;
        const w = this.wait;
        this.wait = null;
        for (const f of w.values()) f();
      });
    }
  }

  // a press on anything that names a word, a language, two languages or two words
  act(t) {
    const k = this.k, d = t.dataset;
    k.lastInput = performance.now();
    if (d.act === 'close') k.clear();
    else if (d.act === 'more') t.closest('.kn-fold')?.classList.add('open');
    else if (d.act === 'explore') this.explore(+d.w);
    else if (d.set) { const [x, y] = d.set.split(',').map(Number), w = crossing(k, x, y, this.gloss); if (w) k.show(w); }
    else if (d.pair) { const [a, b] = d.pair.split(',').map(Number); k.show({ kind: 'pair', a, b }); }
    else if (d.i != null) k.show({ kind: 'word', i: +d.i });
    else if (d.s != null) k.show({ kind: 'lang', s: +d.s });
  }

  // the buttons of the panel show which leaf is open
  sync() {
    for (const [tab, b] of Object.entries(this.tabs)) b.setAttribute('aria-pressed', this.panel.tab === tab);
    this.k.writeHash();
  }

  card(what) {
    const el = this.cardEl, k = this.k;
    // while the panel is open it stands in the card's place, and names what is chosen at its foot
    if (this.panel.open) { el.hidden = true; el.innerHTML = ''; this.panel.chosen(what); return; }
    if (!what) { el.hidden = true; el.innerHTML = ''; return; }
    const render = () => {
      const g = this.gloss;
      el.innerHTML = what.kind === 'word' ? wordCard(k, what.i, g)
        : what.kind === 'lang' ? langCard(k, what.s)
          : what.kind === 'pair' ? pairCard(k, what, g) : setCard(k, what, g);
      el.hidden = false;
    };
    render();
    el.scrollTop = 0;
    this.meanings('card', () => {
      if (k.what !== what) return;
      const top = el.scrollTop;
      render();
      el.scrollTop = top;
    });
  }

  // the address of a counted thing: a leaf of the panel (it opens), or one finding to show
  finding(key) {
    return this.panel.address(key);
  }

  // an English word in the time-tree of Explore: a hand-written one if there is one, else Wiktionary's
  explore(i) {
    const app = this.k.app, w = this.k.K.form[i];
    const n = app.g.byDisplay.get(w.toLowerCase());
    if (n) app.select(n);
    else app.go(() => { app.setMode('explore'); app.explore.openImported(w, '').then((ok) => ok || app.explore.landing()); });
  }

  blur() {
    if (document.activeElement === this.input) this.input.blur();
  }

  suggest() {
    const k = this.k, K = k.K;
    this.cur = -1;
    if (!K || !this.input.value.trim()) { this.items = []; this.sugg.hidden = true; return; }
    this.meanings('search', () => { if (!this.sugg.hidden) this.suggest(); });
    const st = K.stations, g = this.gloss;
    this.items = search(K, this.input.value, k.what?.kind === 'lang' ? k.what.s : -1);
    this.sugg.innerHTML = this.items.map((it, n) => {
      let w, sub;
      if (it.kind === 'lang') { w = esc(st[it.s].name); sub = `language · ${num(st[it.s].count)} forms`; }
      else if (it.kind === 'pair') { w = `${esc(st[it.a].name)} × ${esc(st[it.b].name)}`; sub = 'where the two cross'; }
      else {
        w = `<span class="it">${esc(K.form[it.i])}</span>`;
        sub = [st[K.st[it.i]].name, K.tr[it.i], g && g[it.i]].filter(Boolean).map(esc).join(' · ');
      }
      return `<li role="option" data-k="${n}" class="kn-s-${it.kind}"><span class="s-w">${w}</span><span class="s-sub">${sub}</span></li>`;
    }).join('');
    this.sugg.hidden = !this.items.length;
  }

  take(it) {
    if (!it) return;
    const k = this.k;
    this.sugg.hidden = true;
    this.input.value = '';
    this.input.blur();
    k.lastInput = performance.now();
    if (it.kind === 'word') k.show({ kind: 'word', i: it.i });
    else if (it.kind === 'lang') k.show({ kind: 'lang', s: it.s });
    else k.show({ kind: 'pair', a: it.a, b: it.b });
  }

  // how far down the top bar reaches (on a phone the search box wraps onto its own row)
  topInset() {
    let b = 0;
    for (const c of document.querySelector('#kin .sp-bar').children) {
      const r = c.getBoundingClientRect();
      if (r.height) b = Math.max(b, r.bottom);
    }
    return b + 6;
  }

  // the card's footprint, so the camera can keep the chosen thing clear of it
  cardBox() {
    const el = this.panel.open ? this.panel.el : this.cardEl;
    if (el.hidden) return null;
    const r = el.getBoundingClientRect();
    return { w: r.width + 28, h: r.height + 10 };
  }

  // what lies on the picture and must not be written over: the legend
  keepClear() {
    const lg = $('kn-legend');
    if (lg.hidden || !lg.offsetWidth) return [];
    const r = lg.getBoundingClientRect(), o = this.k.el.getBoundingClientRect();
    return [[r.left - o.left - 6, r.top - o.top - 4, r.width + 12, r.height + 8]];
  }

  year(text) {
    const el = this.yearEl;
    if (text == null) { el.classList.remove('on'); return; }
    if (el.textContent !== text) el.textContent = text;
    el.hidden = false;
    el.classList.add('on');
  }

  hint(on) {
    const el = this.hintEl;
    clearTimeout(this.hintT);
    el.hidden = false;
    el.classList.toggle('on', on);
    if (on) this.hintT = setTimeout(() => el.classList.remove('on'), 7000);
  }
}
