// Etymon, languages: the card for two languages side by side. How they stand in the family, and
// every word of one that has a match in the other, sorted by the way the two came to share it.
// Also the card for one such match: two words, and the two roads down from the form they share.

import { CLOSE, NOTE, esc, num, when, dot, chip, road } from './kin-card-word.js';
import { meetings } from './kin-pairs.js';

const TINT = { down: '#e8c77a', kin: '#e8c77a', fromB: '#7fbfe0', fromA: '#e58fb1', via: '#9d9bb0', root: '#5f6170' };

// how the two stand in the family tree, in a sentence
function standing(K, r, a, b) {
  const n = (s) => esc(K.stations[s].name);
  if (r.kind === 'stage') return `${n(r.young)} comes down from ${n(r.old)}: the same line, ${when(K.stations[r.old]) || 'earlier'} and ${when(K.stations[r.young]) || 'now'}.`;
  if (r.kind === 'kin') {
    const at = K.stations[r.at];
    return r.at === 0
      ? `Distant kin: the two lines parted in ${n(0)}, ${when(at)}.`
      : `Kin: both come down from ${n(r.at)}, spoken ${when(at)}.`;
  }
  return `Not known to be kin: whatever ${n(a)} and ${n(b)} share was carried across.`;
}

// one meeting: the word of each, and the form they meet at when it is neither of the two
function row(K, m, g) {
  const tip = g ? [m.ai, m.bi].map((i) => (g[i] ? `${K.form[i]}: ${g[i]}` : '')).filter(Boolean).join(' · ') : '';
  const far = m.c !== m.ai && m.c !== m.bi;
  return `<div class="kn-pr"${tip ? ` title="${esc(tip)}"` : ''}>${chip(K, m.ai, false)}<button type="button" class="kn-x" data-set="${m.ai},${m.bi}" aria-label="Show the two on the globe">×</button>${chip(K, m.bi, false)}${
    far ? `<button type="button" class="kn-from" data-i="${m.c}" title="${esc(K.stations[m.x].name)}"><span class="it">${esc(K.form[m.c])}</span></button>` : ''}</div>`;
}

// a list of meetings; past the first few, the rest wait behind "+ more"
function rows(K, list, g, shown = 6, most = 320) {
  const all = list.slice(0, most).map((m) => row(K, m, g));
  if (all.length <= shown + 1) return `<div class="kn-prs">${all.join('')}</div>`;
  return `<div class="kn-prs kn-fold">${all.slice(0, shown).join('')}<div class="kn-rest">${all.slice(shown).join('')}</div>
    <button type="button" class="kn-more" data-act="more">+${num(all.length - shown)} more</button></div>`;
}

// meetings sorted by the language they meet in
function groups(K, by, g, shown = 4) {
  const one = (e) => {
    const s = K.stations[e.x];
    return `<div class="kn-sub"><p class="kn-brn"><button type="button" class="kn-lang" data-s="${e.x}">${dot(K, s.branch)}${esc(s.name)}</button><b>${num(e.list.length)}</b></p>${rows(K, e.list, g, 3, 40)}</div>`;
  };
  const all = by.slice(0, 24).map(one);
  if (all.length <= shown + 1) return all.join('');
  return `<div class="kn-fold">${all.slice(0, shown).join('')}<div class="kn-rest">${all.slice(shown).join('')}</div>
    <button type="button" class="kn-more" data-act="more">+${num(all.length - shown)} more languages</button></div>`;
}

export function pairCard(k, what, gloss) {
  const { K, T, L } = k, { a, b } = what;
  const m = meetings(K, T, L, a, b), by = m.by, n = m.list.length;
  const na = esc(K.stations[a].name), nb = esc(K.stations[b].name);
  const parts = [
    ['down', by.downA.length ? by.downA : by.downB, by.downA.length ? `${nb} kept from ${na}` : `${na} kept from ${nb}`, 'handed down the line'],
    ['kin', by.kin, 'Handed down to both', 'from a common ancestor, no border crossed'],
    ['fromB', by.fromB, `${na} took from ${nb}`, 'straight, or through other languages'],
    ['fromA', by.fromA, `${nb} took from ${na}`, 'straight, or through other languages'],
    ['via', by.via, 'Both from a third language', 'at least one of the two by borrowing'],
    ['root', by.root, 'Perhaps from one root', 'by a road that is unsure or not on record'],
  ].filter((p) => p[1].length);

  const bar = n ? `<div class="kn-bar">${parts.map(([key, list, title]) => `<i style="flex:${list.length} 0 0;background:${TINT[key]}" title="${title}: ${num(list.length)}"></i>`).join('')}</div>
    <ul class="kn-key">${parts.map(([key, list, title]) => `<li><i class="kn-dot" style="background:${TINT[key]}"></i>${title} <b>${num(list.length)}</b></li>`).join('')}</ul>` : '';
  const sec = parts.map(([key, list, title, sub]) => `<h3 class="kn-h"><i class="kn-dot" style="background:${TINT[key]}"></i>${title}<small>${num(list.length)} · ${sub}</small></h3>${
    key === 'kin' && m.kinBy.length > 1 ? groups(K, m.kinBy, gloss) : key === 'via' ? groups(K, m.viaBy, gloss) : rows(K, list, gloss)}`);

  return `${CLOSE}
    <p class="sp-kicker">Two languages</p>
    <h2 class="sp-word kn-title kn-two"><button type="button" data-s="${a}">${na}</button><span>×</span><button type="button" data-s="${b}">${nb}</button></h2>
    <p class="sp-gloss">${standing(K, m.rel, a, b)}</p>
    <p class="kn-sum">${n ? `<b>${num(n)}</b> ${n === 1 ? 'word of one has' : 'words of one have'} a match in the other. Press × between two words to see their roads.`
    : 'No word of one has a match in the other in this data.'}</p>
    ${bar}${sec.join('')}
    <div class="sp-actions"><button type="button" data-s="${a}">All of ${na}</button><button type="button" data-s="${b}">All of ${nb}</button></div>${NOTE}`;
}

// Two words and the form they both come from: a finding of its own, with the two roads side by side.
export function crossing(k, ai, bi, gloss) {
  const K = k.K;
  const up = (i) => { const p = []; for (let j = i; j >= 0; j = K.par[j]) p.push(j); return p; };
  const pa = up(ai), pb = up(bi), c = pa.find((j) => pb.includes(j));
  if (c === undefined) return null;
  const down = (p) => p.slice(0, p.indexOf(c) + 1).reverse();
  const part = (p, i) => {
    const s = K.stations[K.st[i]], steps = down(p);
    return `<h3 class="kn-h">To ${esc(s.name)}<small>${steps.length > 1 ? `${num(steps.length - 1)} ${steps.length === 2 ? 'step' : 'steps'}` : 'the word itself'}</small></h3>${road(K, steps, i, gloss)}`;
  };
  const at = K.stations[K.st[c]];
  return {
    kind: 'set', key: `two-${ai}-${bi}`, list: [ai, bi], kicker: 'Two words, one source',
    title: `${K.form[ai]} × ${K.form[bi]}`,
    html: `<p class="sp-gloss">They meet in ${esc(at.name)}${when(at) ? `, ${when(at)}` : ''}: ${chip(K, c, false)}</p>${part(pa, ai)}${part(pb, bi)}`,
  };
}
