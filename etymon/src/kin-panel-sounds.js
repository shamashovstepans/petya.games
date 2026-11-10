// Etymon, languages: the sound laws as a table of counts. A row for each stop a Proto-Indo-European
// word could begin with, a column for each language, and in the square what the heirs begin with.

import { esc, num, fold } from './kin-card-word.js';
import { sounds, witnesses, SERIES, KEYS } from './kin-sounds.js';

const FEW = 4;   // fewer words than this, and a square says nothing
const HEAD = { skt: 'Sanskrit', gk: 'Greek', lat: 'Latin', oir: 'Old Irish', goth: 'Gothic', en: 'English', g: 'German', lith: 'Lithuanian', ru: 'Russian', oarm: 'Armenian' };
const show = (f) => f || '∅';

// One square as a finding: the words of a language whose ancestor began with one stop.
export function lawSet(k, r, id) {
  const K = k.K, S = sounds(K, k.L), s = K.byId.get(id), x = S.langs.indexOf(s);
  if (x < 0 || !(r >= 0 && r < KEYS.length)) return null;
  const c = S.cells[r][x];
  if (c.n < FEW) return null;
  const [f, hits] = c.tops[0], lang = K.stations[s], key = KEYS[r];
  const list = witnesses(K, S, r, x, f), rest = c.list.filter((i) => !list.includes(i));
  // a word, its reading if it is not in Latin letters, and the old word it continues
  const one = (i) => `<button type="button" class="kn-chip" data-i="${i}"><span class="it">${esc(K.form[i])}</span>${
    K.tr[i] ? `<small class="kn-rom">${esc(K.tr[i])}</small>` : ''}<small>‹ ${esc(K.form[S.src[i]])}</small></button>`;
  const says = `${num(hits)} of the ${num(c.n)} ${esc(lang.name)} words that came down by plain descent from a Proto-Indo-European word in <b>*${esc(key)}</b> ${
    f ? `begin with <b>${esc(f)}</b>` : 'begin with a vowel: the consonant is gone'}.`;
  const other = c.tops.slice(1).map(([g, m]) => `<b>${esc(show(g))}</b> ${num(m)}`).join(' · ');
  return {
    kind: 'set', key: `law-${r}-${lang.slug}`, list: list.slice(0, 90), law: [r, x],
    kicker: `${lang.name} · a sound law, counted`,
    title: f ? `*${key} became ${f}` : `*${key} was lost`,
    foot: `<p class="kn-sum">${says}</p><div class="kn-chips">${list.slice(0, 8).map(one).join('')}</div>`,
    html: `<p class="sp-gloss">${says}</p><div class="kn-chips">${fold(list.slice(0, 90).map(one), 14)}</div>
      ${other ? `<h3 class="kn-h">The others<small>${other}</small></h3><div class="kn-chips">${fold(rest.slice(0, 40).map(one), 8)}</div>` : ''}`,
  };
}

export function soundTab(k) {
  const K = k.K, S = sounds(K, k.L), st = K.stations, cols = S.langs.length;
  const el = document.createElement('div');
  const head = S.langs.map((s) => `<th scope="col"><button type="button" data-s="${s}" title="${esc(st[s].name)}"><span>${esc(HEAD[st[s].slug] || st[s].name)}</span></button></th>`).join('');
  const cell = (c, r, x) => {
    if (c.n < FEW) return `<td class="kn-none" title="${num(c.n)} ${c.n === 1 ? 'word' : 'words'}: too few to tell">·</td>`;
    const [f, hits] = c.tops[0], share = hits / c.n;
    const also = c.tops.slice(1, 3).filter(([, m]) => m / c.n >= 0.15).map(([g]) => show(g)).join(' ');
    const tip = `*${KEYS[r]} in ${st[S.langs[x]].name}: ${c.tops.slice(0, 4).map(([g, m]) => `${show(g)} ${m}`).join(', ')} (of ${c.n} words)`;
    return `<td><button type="button" data-law="${r},${x}" aria-pressed="false" style="--a:${(0.05 + 0.34 * share * share).toFixed(3)}" title="${esc(tip)}"><b>${esc(show(f))}</b>${
      also ? `<small>${esc(also)}</small>` : ''}</button></td>`;
  };
  const line = (key) => {
    const r = KEYS.indexOf(key);
    return `<tr><th scope="row">*${esc(key)}</th>${S.cells[r].map((c, x) => cell(c, r, x)).join('')}</tr>`;
  };
  const body = SERIES.map((ser) => `<tr class="kn-ser"><th colspan="${cols + 1}">${ser.name}</th></tr>${ser.keys.map(line).join('')}`).join('');
  el.innerHTML = `<h2 class="kn-ph">The sound laws, counted</h2>
    <p class="kn-pp">Down the side, the consonant a Proto-Indo-European word began with. Across, what its heirs begin with in each language, in that language's own spelling, by plain count over the words that came down the family line. Read Latin against English: p and f, t and th, c and h (<i>pater</i> father, <i>tres</i> three, <i>cornu</i> horn). That is Grimm's law, and nobody typed it in. The empty row is real too: hardly a Proto-Indo-European word began with b.</p>
    <div class="kn-sndw"><table class="kn-snd"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <p class="kn-read" aria-live="polite">Press a square to see its words on the globe. A small letter beside the big one is a second outcome, at least one word in seven.</p>`;
  const read = el.querySelector('.kn-read'), rest = read.textContent;
  el.addEventListener('pointerover', (e) => {
    const b = e.target.closest('[data-law]');
    read.textContent = b ? b.title : rest;
  });

  return {
    el,
    click(t) {
      if (!t.dataset.law) return false;
      const [row, x] = t.dataset.law.split(',').map(Number), w = lawSet(k, row, st[S.langs[x]].slug);
      if (w) k.show(w);
      return true;
    },
    chosen(what) {
      const on = what?.law ? what.law.join(',') : '';
      for (const b of el.querySelectorAll('[data-law]')) b.setAttribute('aria-pressed', b.dataset.law === on);
    },
    detail: (what) => what?.foot || '',
  };
}
