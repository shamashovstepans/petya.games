// Etymon, languages: the panel of counted things. Four leaves: findings, the kinship table, the
// sound laws, and what all of it is made from. While it is open it stands where the card stands; what is chosen from it lights up on
// the globe and is named at its foot, and "Open the card" trades the panel for the card.

import { esc } from './kin-card-word.js';
import { crossing } from './kin-card-pair.js';
import { findTab, findingSet } from './kin-panel-find.js';
import { kinTab } from './kin-panel-kin.js';
import { soundTab, lawSet } from './kin-panel-sounds.js';
import { aboutTab } from './about.js';

// key, name on the tab, the leaf's maker, its address
const TABS = [
  ['find', 'Findings', findTab, 'findings'],
  ['kin', 'Kinship', kinTab, 'kinship'],
  ['sounds', 'Sounds', soundTab, 'sounds'],
  ['about', 'About', aboutTab, 'about'],
];

export class KinPanel {
  constructor(k, ui) {
    this.k = k;
    this.ui = ui;
    this.el = document.getElementById('kn-panel');
    this.tab = null;      // the leaf on show; null while the panel is shut
    this.made = {};       // the leaves built so far: { el, shown(), chosen(what), detail(what), click(t) }
    this.el.innerHTML = `<div class="kn-ptop"><div class="kn-tabs" role="tablist">${
      TABS.map(([key, name]) => `<button type="button" role="tab" data-tab="${key}">${name}</button>`).join('')}</div>
      <button class="sp-close" type="button" data-act="shut" aria-label="Close the panel">×</button></div>
      <div class="kn-pbody"></div><div class="kn-pick" hidden></div>`;
    this.body = this.el.querySelector('.kn-pbody');
    this.pick = this.el.querySelector('.kn-pick');
    this.el.addEventListener('click', (e) => {
      const t = e.target.closest('button, [data-i], [data-s]');
      if (!t || !this.el.contains(t)) return;
      const d = t.dataset;
      k.lastInput = performance.now();
      if (d.tab) this.show(d.tab);
      else if (d.act === 'shut' || d.act === 'open') this.shut();
      else if (d.act === 'none') k.clear();
      else if (!this.made[this.tab]?.click?.(t)) ui.act(t);
    });
    window.addEventListener('resize', () => { if (this.open) this.made[this.tab]?.shown?.(); });
  }

  get open() { return this.tab !== null; }

  // the address of the leaf on show ('' when shut)
  slug() {
    const t = TABS.find((x) => x[0] === this.tab);
    return t ? t[3] : '';
  }

  show(tab) {
    const k = this.k, row = TABS.find((x) => x[0] === tab);
    if (!k.M || !row) return;
    this.tab = tab;
    if (!this.made[tab]) {
      const leaf = (this.made[tab] = row[2](k, this));
      leaf.el.classList.add('kn-leaf');
      this.body.append(leaf.el);
    }
    for (const [key, leaf] of Object.entries(this.made)) leaf.el.hidden = key !== tab;
    for (const b of this.el.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', b.dataset.tab === tab);
    this.el.hidden = false;
    this.body.scrollTop = 0;
    this.ui.cardEl.hidden = true;
    this.ui.sync();
    this.made[tab].shown?.();
    k.reframe();
  }

  shut() {
    if (!this.open) return;
    this.tab = null;
    this.el.hidden = true;
    this.ui.sync();
    this.k.reframe();
  }

  toggle(tab) {
    if (this.tab === tab) this.shut();
    else this.show(tab);
  }

  // what is chosen now: the leaf marks it, and the foot of the panel names it
  chosen(what) {
    const leaf = this.made[this.tab];
    if (!leaf) return;
    leaf.chosen?.(what);
    if (!what) { this.pick.hidden = true; this.pick.innerHTML = ''; return; }
    this.pick.innerHTML = `<p class="kn-pk-t"><b>${esc(this.k.title(what))}</b>${what.kicker ? `<span>${esc(what.kicker)}</span>` : ''}</p>
      ${leaf.detail?.(what) || ''}
      <div class="kn-pk-a"><button type="button" class="primary" data-act="open">Open the card</button><button type="button" data-act="none">Clear</button></div>`;
    this.pick.hidden = false;
  }

  // the address of a counted thing: a leaf of the panel (it opens; nothing is chosen), or a finding
  address(key) {
    const row = TABS.find((x) => x[3] === key);
    if (row) { this.show(row[0]); return null; }
    let m = key.match(/^law-(\d+)-([a-z0-9]+)$/);
    if (m) return lawSet(this.k, +m[1], m[2]);
    m = key.match(/^twice-(\d+)$/);
    if (m) return findingSet(this.k, +m[1]);
    m = key.match(/^two-(\d+)-(\d+)$/);
    if (m && +m[1] < this.k.K.N && +m[2] < this.k.K.N) return crossing(this.k, +m[1], +m[2], this.ui.gloss);
    return null;
  }
}
