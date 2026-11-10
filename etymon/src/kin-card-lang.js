// Etymon, languages: the card for one language. Where its words began, by what road they came,
// and where they went from here. Also the card for a finding (any handful of forms).

import { CLOSE, NOTE, esc, num, plural, when, dot, rank, chip, fold } from './kin-card-word.js';
import { fullest } from './kin-addr.js';

const share = (n, of) => { const p = (100 * n) / (of || 1); return p < 1 ? '<1%' : `${Math.round(p)}%`; };

// The forms of one language, counted by the road they came. A road is the last border a word
// crossed on its way here, whether this language crossed it or an older stage of it did.
export function census(k, s) {
  const memo = (k.censusMemo ||= new Map());
  if (memo.has(s)) return memo.get(s);
  const { K, L } = k, { N, st, par } = K;
  const began = new Int32Array(K.branches.length), via = new Map(), gave = new Map();
  const c = { all: 0, home: 0, kept: 0, took: 0, began };
  const tally = (m, o, i, score) => {
    let e = m.get(o);
    if (!e) m.set(o, (e = { s: o, n: 0, ex: [] }));
    e.n++;
    const x = e.ex;   // the three best known
    if (x.length === 3 && score <= x[2][0]) return;
    x.push([score, i]);
    x.sort((p, q) => q[0] - p[0] || p[1] - q[1]);
    if (x.length > 3) x.pop();
  };
  for (let i = 0; i < N; i++) {
    const d = L.donor[i], e = L.etype[i];
    if (st[i] === s) {
      if (fullest(K, i) !== i) continue;
      c.all++; began[L.orig[i]]++;
      if (e === 1) c.home++;
      else if (d < 0) c.kept++;
      else { c.took++; tally(via, d, i, rank(K, i)); }
    } else if (d === s && e !== 1) tally(gave, st[i], i, e === 3 && st[par[i]] === s ? 10 + rank(K, par[i]) + rank(K, i) : rank(K, i));
  }
  const rows = (m) => [...m.values()].sort((p, q) => q.n - p.n);
  c.via = rows(via); c.gave = rows(gave);
  memo.set(s, c);
  return c;
}

// one road: the other language, how many forms, a bar, and three examples. A click sets the two side by side.
function roads(K, s, list, shown = 6) {
  if (!list.length) return '';
  const max = list[0].n;
  const row = (e) => {
    const o = K.stations[e.s];
    return `<div class="kn-row"><button type="button" class="kn-rowh" data-pair="${s},${e.s}" title="${esc(K.stations[s].name)} × ${esc(o.name)}">${
      dot(K, o.branch)}<span class="kn-rn">${esc(o.name)}</span><b>${num(e.n)}</b><i style="width:${((100 * e.n) / max).toFixed(1)}%"></i></button>
      <div class="kn-chips">${e.ex.map(([, i]) => chip(K, i, false)).join('')}</div></div>`;
  };
  const all = list.slice(0, 40).map(row);
  if (all.length <= shown + 1) return `<div class="kn-rows">${all.join('')}</div>`;
  return `<div class="kn-rows kn-fold">${all.slice(0, shown).join('')}<div class="kn-rest">${all.slice(shown).join('')}</div>
    <button type="button" class="kn-more" data-act="more">+${num(all.length - shown)} more</button></div>`;
}

export function langCard(k, s) {
  const { K } = k, st = K.stations[s], c = census(k, s), B = K.branches;
  const line = [];
  for (let a = st.parent; a >= 0; a = K.stations[a].parent) line.unshift(a);
  const kids = st.kids.filter((j) => K.stations[j].count > 0);
  const link = (j) => `<button type="button" data-s="${j}">${esc(K.stations[j].name)}</button>`;
  const lineage = (line.length ? `<p class="kn-line"><span>from</span>${line.map(link).join('<i>›</i>')}</p>` : '')
    + (kids.length ? `<p class="kn-line"><span>became</span>${kids.map(link).join('<i>·</i>')}</p>` : '');

  const sec = [];
  if (!s) {
    // the mother tongue: its largest families
    const big = [];
    for (let f = 0; f < K.F && big.length < 14; f++) if (!K.st[K.start[f]]) big.push(f);
    sec.push(`<h3 class="kn-h">Its largest families<small>a root, and the forms that grew from it</small></h3>
      <div class="kn-chips">${big.map((f) => chip(K, K.start[f], false).replace('</button>', `<small>${num(K.start[f + 1] - K.start[f])}</small></button>`)).join('')}</div>`);
  } else {
    const parts = [...c.began.keys()].filter((b) => c.began[b]).sort((x, y) => c.began[y] - c.began[x]);
    sec.push(`<h3 class="kn-h">Where its words began<small>the branch each line first belonged to</small></h3>
      <div class="kn-bar">${parts.map((b) => `<i style="flex:${c.began[b]} 0 0;background:${B[b].color}" title="${esc(B[b].name)} ${share(c.began[b], c.all)}"></i>`).join('')}</div>
      <ul class="kn-key">${parts.filter((b) => c.began[b] * 200 >= c.all).slice(0, 6).map((b) => `<li>${dot(K, b)}${esc(B[b].name)} <b>${share(c.began[b], c.all)}</b></li>`).join('')}</ul>
      <p class="kn-sum"><b>${num(c.kept)}</b> came down the family line untouched, <b>${num(c.took)}</b> crossed a border on the way,
        and <b>${num(c.home)}</b> were made at home from the others.</p>`);
    if (c.via.length) {
      sec.push(`<h3 class="kn-h">By what road they came<small>the last border crossed, by ${esc(st.name)} or an older stage of it</small></h3>${roads(K, s, c.via)}`);
    }
  }
  if (c.gave.length) {
    sec.push(`<h3 class="kn-h">Where its words went<small>${plural(c.gave.length, 'language')} took from it</small></h3>${roads(K, s, c.gave)}`);
  }

  const age = when(st), b = B[st.branch];
  return `${CLOSE}
    <p class="sp-kicker">${dot(K, st.branch)}${esc(b.name)}${st.group ? ` · ${esc(st.group)}` : ''}</p>
    <h2 class="sp-word kn-title">${esc(st.name)}</h2>
    <p class="sp-gloss">${age ? `Spoken ${age}` : 'Spoken today'} · ${plural(c.all, 'form')} on this globe</p>
    ${lineage}${sec.join('')}${NOTE}`;
}

// a finding: a title, a line or two, and the forms it is about
export function setCard(k, what, gloss) {
  const K = k.K, list = what.list || [], html = typeof what.html === 'function' ? what.html(gloss) : what.html;
  return `${CLOSE}
    <p class="sp-kicker">${esc(what.kicker || 'A finding')}</p>
    <h2 class="sp-word kn-title">${esc(what.title || '')}</h2>
    ${what.text ? `<p class="sp-gloss">${esc(what.text)}</p>` : ''}
    ${html || `<div class="kn-chips">${fold(list.slice(0, 160).map((i) => chip(K, i)), 30)}</div>`}
    ${NOTE}`;
}
