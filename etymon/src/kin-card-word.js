// Etymon, languages: the card for one word. Where it came from, what came of it, and its kin.

import { formatYear } from './langs.js';
import { depths, tellings } from './kin-addr.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const num = (n) => n.toLocaleString('en-US');
export const plural = (n, one, many = one + 's') => `${num(n)} ${n === 1 ? one : many}`;
export const CLOSE = `<button type="button" class="sp-close" data-act="close" aria-label="Close">
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>`;
// what the data is, said wherever a number is shown
export const NOTE = `<p class="kn-note">As recorded in Wiktionary, not checked by hand. English and Russian are read in full;
  every other language is known here only through what their pages, and the pages of Proto-Indo-European roots, say of it.</p>`;

const HOW = { r: '', i: 'handed down', b: 'borrowed', l: 'borrowed from books', d: 'derived', f: 'formed from it', s: 'by steps not recorded' };

// when a language was spoken, if it no longer is
export const when = (s) => (s.date >= 2000 ? '' : formatYear(s.date, { approx: true }));
export const dot = (K, b) => `<i class="kn-dot" style="background:${K.branches[b].color}"></i>`;
export const rank = (K, i) => K.rank.charCodeAt(i) - 48;

// a form as a button: the word, then (unless told not to) its language
export function chip(K, i, lang = true) {
  const tr = K.tr[i];
  return `<button type="button" class="kn-chip" data-i="${i}"><span class="it">${esc(K.form[i])}</span>${
    tr ? `<small class="kn-rom">${esc(tr)}</small>` : ''}${lang ? `<small>${esc(K.stations[K.st[i]].name)}</small>` : ''}</button>`;
}

// a row of chips; past n, the rest wait behind "+ more"
export function fold(chips, n) {
  if (chips.length <= n + 2) return chips.join('');
  return `<span class="kn-fold">${chips.slice(0, n).join('')}<span class="kn-rest">${chips.slice(n).join('')}</span><button type="button" class="kn-more" data-act="more">+${num(chips.length - n)} more</button></span>`;
}

// of these forms, the best known in each language; the best-known languages first
export function byLang(K, list) {
  const d = depths(K), best = new Map();
  for (const j of list) {
    const s = K.st[j], o = best.get(s);
    if (o === undefined || rank(K, j) > rank(K, o) || (rank(K, j) === rank(K, o) && d[j] < d[o])) best.set(s, j);
  }
  return [...best.values()].sort((x, y) => rank(K, y) - rank(K, x) || K.stations[K.st[y]].count - K.stations[K.st[x]].count);
}

// forms sorted into the branches their languages belong to, one row a branch
export function byBranch(K, list, shown = 4) {
  const rows = K.branches.map(() => []);
  for (const j of byLang(K, list)) rows[K.stations[K.st[j]].branch].push(j);
  return rows.map((g, b) => (g.length
    ? `<div class="kn-br"><p class="kn-brn">${dot(K, b)}${esc(K.branches[b].name)}</p><div class="kn-chips">${fold(g.slice(0, 48).map((j) => chip(K, j)), shown)}</div></div>`
    : '')).join('');
}

// a road, form by form: each a button, with its language, its date, and how it came there
export function road(K, path, here, gloss) {
  return `<ol class="sp-path">${path.map((p) => {
    const s = K.stations[K.st[p]], r = K.rel[p], low = r.toLowerCase();
    const how = HOW[low] ? ` · ${HOW[low]}${r !== low ? ', perhaps' : ''}` : '';
    const g = gloss && gloss[p];
    return `<li${p === here ? ' class="is-here"' : ''}><button type="button" data-i="${p}"><span class="sp-s-form it">${esc(K.form[p])}</span>
      <span class="sp-s-lang">${esc(s.name)}${when(s) ? ' · ' + when(s) : ''}${how}</span>${g ? `<span class="sp-s-gloss">${esc(g)}</span>` : ''}</button></li>`;
  }).join('')}</ol>`;
}

export function wordCard(k, i, gloss) {
  const K = k.K, st = K.stations[K.st[i]], f = K.fam[i], a = K.start[f], b = K.start[f + 1];
  const path = [];
  for (let p = i; p >= 0; p = K.par[p]) path.unshift(p);

  // the rest of its family: what came of it, and what only shares its root
  const mine = new Uint8Array(b - a);
  for (const p of path) mine[p - a] = 1;
  mine[i - a] = 2;
  let down = [], kin = [];
  for (let j = a; j < b; j++) {
    if (mine[j - a]) continue;
    const p = K.par[j];
    if (p >= 0 && mine[p - a] === 2) { mine[j - a] = 2; down.push(j); } else kin.push(j);
  }
  const langs = (list) => new Set(list.map((j) => K.st[j])).size;
  const isRoot = i === a;

  const steps = path.length > 1 ? road(K, path, i, gloss) : '';

  const sec = [];
  if (down.length) {
    const n = langs(down);
    sec.push(`<h3 class="kn-h">${isRoot ? 'Where it went' : 'What came of it'}<small>${plural(down.length, 'form')} in ${plural(n, 'language')}</small></h3>${
      n > 6 ? byBranch(K, down) : `<div class="kn-chips">${fold(byLang(K, down).map((j) => chip(K, j)), 10)}</div>`}`);
    // the same language may hold many: its own makings are one click further, on the language
  }
  if (kin.length) {
    sec.push(`<h3 class="kn-h">Kin<small>${plural(kin.length, 'other form')} from the same root, in ${plural(langs(kin), 'language')}</small></h3>${byBranch(K, kin)}`);
  }

  const others = tellings(K, i).filter((j) => j !== i);
  const also = others.length
    ? `<p class="kn-also">Wiktionary sets it under ${others.length > 1 ? 'other roots' : 'another root'} as well: ${
      others.map((j) => chip(K, K.start[K.fam[j]], false).replace(`data-i="${K.start[K.fam[j]]}"`, `data-i="${j}"`)).join(' ')}</p>`
    : '';

  const tr = K.tr[i], g = gloss && gloss[i];
  const acts = [`<button type="button" data-s="${st.i}">All of ${esc(st.name)}</button>`];
  if (st.id === 'En' && !/\s/.test(K.form[i])) acts.unshift(`<button type="button" class="primary" data-act="explore" data-w="${i}">Open in Explore</button>`);

  return `${CLOSE}
    <p class="sp-kicker"><button type="button" class="kn-lang" data-s="${st.i}">${dot(K, st.branch)}${esc(st.name)}</button>${when(st) ? ` · ${when(st)}` : ''}</p>
    <h2 class="sp-word it">${esc(K.form[i])}</h2>
    ${tr ? `<p class="kn-tr">${esc(tr)}</p>` : ''}
    ${g ? `<p class="sp-gloss">${esc(g)}</p>` : ''}
    ${steps}${sec.join('')}${also}
    <div class="sp-actions">${acts.join('')}</div>${NOTE}`;
}
