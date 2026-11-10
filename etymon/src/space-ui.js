// The words around the 3D view: the card for a selected node, the search box, the buttons.

import { primaryPath } from './analysis.js';
import { LANGS, FAMILIES, FAMILY_ORDER, formatYear } from './langs.js';
import { lawLabel } from './laws.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class SpaceUI {
  constructor(sp) {
    this.sp = sp;
    this.g = sp.g;
    this.cardEl = $('sp-card');
    this.yearEl = $('sp-year');
    this.hintEl = $('sp-hint');
    this.input = $('sp-input');
    this.sugg = $('sp-suggest');
    this.items = [];
    this.cur = -1;
    const app = sp.app;

    $('sp-home').addEventListener('click', () => sp.home());
    $('sp-replay').addEventListener('click', () => { sp.lastInput = performance.now(); sp.playIntro(); });
    $('sp-explore').addEventListener('click', () => {
      const n = sp.sel >= 0 ? this.g.nodes[sp.sel] : null;
      if (n) app.select(n);
      else app.go(() => app.setMode('explore'));
    });
    $('sp-map').addEventListener('click', () => app.go(() => app.setMode('map')));
    const fam = $('sp-fam');
    fam.addEventListener('click', () => {
      const on = fam.getAttribute('aria-pressed') !== 'true';
      fam.setAttribute('aria-pressed', on);
      $('sp-legend').hidden = !on;
      sp.setTint(on);
    });
    $('sp-legend').innerHTML = FAMILY_ORDER
      .map((f) => `<span class="sp-lg"><i style="background:${FAMILIES[f].color}"></i>${esc(FAMILIES[f].name)}</span>`).join('');

    this.cardEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i], [data-act]');
      if (!b) return;
      if (b.dataset.act === 'close') sp.clear();
      else if (b.dataset.act === 'explore') app.select(this.g.nodes[sp.sel]);
      else if (b.dataset.i) sp.select(+b.dataset.i);
    });

    // search
    $('sp-form').addEventListener('submit', (e) => {
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
        [...this.sugg.children].forEach((li, k) => li.setAttribute('aria-selected', k === this.cur));
      } else if (e.key === 'Escape') this.input.blur();
    });
    this.sugg.addEventListener('pointerdown', (e) => {
      const li = e.target.closest('li');
      if (!li) return;
      e.preventDefault();
      this.take(this.items[+li.dataset.k]);
    });
  }

  blur() {
    if (document.activeElement === this.input) this.input.blur();
  }

  suggest() {
    const q = this.input.value.trim().toLowerCase();
    this.cur = -1;
    if (!q) { this.items = []; this.sugg.hidden = true; return; }
    const a = [], b = [];
    for (const w of this.g.wordsByZipf) {
      const d = w.display.toLowerCase();
      if (d.startsWith(q)) a.push(w);
      else if (q.length > 2 && d.includes(q)) b.push(w);
      if (a.length >= 8) break;
    }
    this.items = a.concat(b).slice(0, 8);
    this.sugg.innerHTML = this.items
      .map((w, k) => `<li role="option" data-k="${k}"><span class="s-w">${esc(w.display)}</span><span class="s-sub">${esc(w.gloss || '')}</span></li>`).join('');
    this.sugg.hidden = !this.items.length;
  }

  take(w) {
    if (!w) return;
    this.sugg.hidden = true;
    this.input.value = '';
    this.input.blur();
    this.sp.lastInput = performance.now();
    this.sp.select(this.sp.S.index.get(w));
  }

  // how far down the top bar reaches (on a phone the search box wraps onto its own row)
  topInset() {
    let b = 0;
    for (const c of document.querySelector('.sp-bar').children) {
      const r = c.getBoundingClientRect();
      if (r.height) b = Math.max(b, r.bottom);
    }
    return b + 6;
  }

  // the card's footprint, so the camera can keep the branch clear of it
  cardBox() {
    if (this.cardEl.hidden) return null;
    const r = this.cardEl.getBoundingClientRect();
    return { w: r.width + 28, h: r.height + 10 };
  }

  when(n) {
    return formatYear(n.date, { approx: !n.dateExplicit || n.date < 1100 });
  }

  card(n) {
    const el = this.cardEl;
    if (!n) { el.hidden = true; return; }
    const S = this.sp.S;
    const path = primaryPath(n);
    const lang = n.isRoot ? 'Root' : n.isEn ? 'English' : LANGS[n.lang]?.name || n.lang;
    const steps = path.map(({ node, edge }) => {
      const laws = edge ? edge.tags.map((t) => `<span class="sp-law">${esc(lawLabel(t))}</span>`).join('') : '';
      const here = node === n;
      const name = node.isEn ? 'English' : LANGS[node.lang]?.name || node.lang;
      return `<li class="${here ? 'is-here' : ''}">${laws ? `<div class="sp-laws">${laws}</div>` : ''}
        <button type="button" data-i="${S.index.get(node)}"><span class="sp-s-form${node.isEn ? '' : ' it'}">${esc(node.display)}</span>
        <span class="sp-s-lang">${esc(name)} · ${esc(this.when(node))}</span>${node.gloss && !here ? `<span class="sp-s-gloss">${esc(node.gloss)}</span>` : ''}</button></li>`;
    }).join('');
    const kin = n.enDesc.size - (n.isEn ? 1 : 0);
    const count = kin > 0
      ? `<p class="sp-count"><b>${kin.toLocaleString('en-US')}</b> English ${kin === 1 ? 'word' : 'words'} ${n.isEn ? 'grew on from here' : 'grew from this'}.</p>`
      : path.length > 1 ? `<p class="sp-count">${path.length - 1} ${path.length === 2 ? 'step' : 'steps'} from its root.</p>` : '';
    el.innerHTML = `<button type="button" class="sp-close" data-act="close" aria-label="Close">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      <p class="sp-kicker">${esc(lang)} · ${esc(this.when(n))}</p>
      <h2 class="sp-word${n.isEn ? '' : ' it'}">${esc(n.display)}</h2>
      ${n.gloss ? `<p class="sp-gloss">${esc(n.gloss)}</p>` : ''}
      ${path.length > 1 ? `<ol class="sp-path">${steps}</ol>` : ''}
      ${count}
      <div class="sp-actions"><button type="button" class="primary" data-act="explore">Open in Explore</button></div>`;
    el.hidden = false;
    el.scrollTop = 0;
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

  fail() {
    $('sp-fail').hidden = false;
  }
}
