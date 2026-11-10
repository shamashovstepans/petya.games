// Etymon, languages: the findings. Lists that fall out of going through all the words once: the
// same word taken twice, the words that travelled furthest, who gave to whom.

import { esc, num, chip, road, when } from './kin-card-word.js';
import { doublets, travelled, flows, families, givers, roadOf } from './kin-finds.js';

// how well known a word must be to stand in a list (the two languages are counted on different scales)
const KNOWN = { en: 6, ru: 5 };

// One group of doublets as a thing to show: the words, and the road of each from where they part.
// i: any word of the group
export function findingSet(k, i) {
  const K = k.K;
  if (!(i >= 0 && i < K.N)) return null;
  const g = doublets(K, K.st[i]).find((x) => x.list.includes(i));
  if (!g) return null;
  const at = K.stations[K.st[g.c]], lang = K.stations[K.st[i]], date = when(at) ? `, ${when(at)}` : '';
  const part = (j, gloss) => {
    const p = roadOf(K, j), down = p.slice(p.indexOf(g.c));
    return `<h3 class="kn-h">${esc(K.form[j])}<small>${num(down.length - 1)} ${down.length === 2 ? 'step' : 'steps'} from there</small></h3>${road(K, down, j, gloss)}`;
  };
  return {
    kind: 'set', key: `twice-${g.list[0]}`, list: g.list.slice(), twice: g.list[0],
    kicker: `${lang.name} · one word, taken twice`,
    title: g.list.slice(0, 4).map((j) => K.form[j]).join(' · ') + (g.list.length > 4 ? ' …' : ''),
    foot: `<p class="kn-sum">One word once: ${esc(at.name)} <i>${esc(K.form[g.c])}</i>${date}. Each came into ${esc(lang.name)} by a road of its own.</p>`,
    html: (gloss) => `<p class="sp-gloss">They were one word once, in ${esc(at.name)}${date}: ${chip(K, g.c, false)}</p>${g.list.slice(0, 6).map((j) => part(j, gloss)).join('')}`,
  };
}

// rows, the first few on show and the rest behind "+ more"
function rows(items, shown) {
  if (items.length <= shown + 1) return `<div class="kn-frs">${items.join('')}</div>`;
  return `<div class="kn-frs kn-fold">${items.slice(0, shown).join('')}<div class="kn-rest">${items.slice(shown).join('')}</div>
    <button type="button" class="kn-more" data-act="more">+${num(items.length - shown)} more</button></div>`;
}
const head = (title, sub) => `<h3 class="kn-h">${title}<small>${sub}</small></h3>`;

export function findTab(k, panel) {
  const { K, L } = k, st = K.stations, el = document.createElement('div');
  let lang = k.what?.kind === 'lang' && st[k.what.s].slug === 'ru' ? 'ru' : 'en';
  const name = (s) => esc(st[s].name), form = (i) => esc(K.form[i]);

  const render = () => {
    const s = K.byId.get(lang), g = panel.ui.gloss, nm = name(s);
    const dbl = doublets(K, s), fam = families(K, s);
    const twice = dbl.slice(0, 160).map((d) => `<button type="button" class="kn-fr" data-twice="${d.list[0]}"><span class="kn-fw it">${
      d.list.slice(0, 6).map(form).join(' · ')}</span><small>‹ ${name(K.st[d.c])} <i>${form(d.c)}</i></small></button>`);
    const far = travelled(K, L, s, 40, KNOWN[lang] || 5).map((t) => `<button type="button" class="kn-fr" data-i="${t.i}"><span class="kn-fw it">${
      form(t.i)}</span><b>${t.hops}</b><small>${t.via.map(name).join(' › ')} › ${nm}</small></button>`);
    const gave = givers(K, L, s, 30).map((t) => `<button type="button" class="kn-fr" data-i="${t.i}"><span class="kn-fw it">${form(t.i)}</span><b>${num(t.n)}</b></button>`);
    const root = (t) => `<button type="button" class="kn-fr" data-i="${t.i}"><span class="kn-fw it">${form(t.i)}</span><b>${num(t.n)}</b>${
      g && g[t.i] ? `<small>${esc(g[t.i])}</small>` : ''}</button>`;
    const top = flows(K, L, 30), most = top[0].n;
    const flow = top.map((f) => `<button type="button" class="kn-fr kn-fl" data-pair="${f.a},${f.b}"><span class="kn-fw">${name(f.a)} → ${name(f.b)}</span><b>${
      num(f.n)}</b><i style="width:${(100 * f.n / most).toFixed(1)}%"></i></button>`);
    el.innerHTML = `<div class="kn-fh"><h2 class="kn-ph">What the count turns up</h2>
      <div class="kn-seg" role="group" aria-label="Whose words">${['en', 'ru'].map((id) => `<button type="button" data-lang="${id}" aria-pressed="${id === lang}">${name(K.byId.get(id))}</button>`).join('')}</div></div>
      <p class="kn-pp">Press a row to see it on the globe.</p>
      ${head('One word, taken twice', `${num(dbl.length)} sets the dictionary calls doublets: one old word that reached ${nm} by more than one road`)}${rows(twice, 9)}
      ${head('Furthest travelled', `borders crossed on the way into ${nm}, and the languages that handed the word on`)}${rows(far, 7)}
      ${head('Given furthest', `${nm} words, and how many languages took each straight from ${nm}`)}${rows(gave, 6)}
      ${head(`The roots ${nm} made most of`, `words of ${nm} that go back to one Proto-Indo-European root`)}${rows(fam.rich.map(root), 5)}
      ${head('The widest families', 'living languages that still have a word from the root')}${rows(fam.wide.map(root), 5)}
      ${head('Who took from whom', 'words carried from one language into another, as far as this data knows')}${rows(flow, 8)}`;
    mark(k.what);
  };

  // the row of what is chosen
  const mark = (what) => {
    const pair = what?.kind === 'pair' ? [`${what.a},${what.b}`, `${what.b},${what.a}`] : [];
    for (const b of el.querySelectorAll('.kn-fr')) {
      const d = b.dataset;
      const on = !!what && ((what.twice != null && +d.twice === what.twice) || (what.kind === 'word' && d.twice == null && +d.i === what.i) || pair.includes(d.pair));
      b.classList.toggle('is-on', on);
    }
  };

  render();
  panel.ui.meanings('find', render);

  return {
    el,
    click(t) {
      const d = t.dataset;
      if (d.lang) { lang = d.lang; render(); return true; }
      if (d.twice == null) return false;
      const w = findingSet(k, +d.twice);
      if (w) k.show(w);
      return true;
    },
    chosen: mark,
    detail: (what) => what?.foot || '',
  };
}
