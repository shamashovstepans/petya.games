// DOM interface: masthead, search, lens rail (laws / stories / families),
// journey panel, timeline, captions, tooltip.

import { FAMILIES, FAMILY_ORDER, LANGS, T_MIN, T_MAX, timeToR, rToTime, formatYear } from './langs.js';
import { LAWS, LAW_GROUPS, lawLabel } from './laws.js';
import { ERAS, EVENTS, STORIES } from './content.js';
import { allPaths, cognatePairs, composition } from './analysis.js';

const $ = (sel, el = document) => el.querySelector(sel);
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.setAttribute('style', v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};

const yearLabel = (n) => {
  const y = n.date;
  if (n.lang === 'PIE') return 'c. 4500–2500 BCE';
  if (y < 0) return `c. ${Math.abs(y).toLocaleString('en-US')} BCE`;
  if (n.dateExplicit && (n.lang === 'En')) return String(y);
  return `c. ${y}`;
};

const commonness = (z) =>
  z >= 6 ? 'among the most common words in English' : z >= 5 ? 'very common' : z >= 4 ? 'common' : z >= 3 ? 'familiar' : z >= 2 ? 'uncommon' : 'rare';

export class UI {
  constructor(app) {
    this.app = app;
    this.g = app.g;
    this.tab = 'laws';
  }

  init() {
    this.buildRail();
    this.buildTimeline();
    this.buildSearch();
    this.bindKeys();
    const st = this.app.state;
    $('#stat-roots').textContent = this.g.roots.length;
    $('#stat-words').textContent = this.g.words.length.toLocaleString('en-US');
    $('#rail-toggle').addEventListener('click', () => document.body.classList.toggle('rail-open'));
    $('#skip').addEventListener('click', () => this.app.skipToNow());
    $('#journey-close').addEventListener('click', () => this.app.select(null));
    $('#home').addEventListener('click', () => this.app.goHome());
    const starred = this.g.words.filter((w) => w.star && (w.note || w.rootIds.length > 1 || w.inEdges.some((e) => e.source.note)));
    let last = null;
    $('#surprise').addEventListener('click', () => {
      let w;
      do w = starred[(Math.random() * starred.length) | 0];
      while (w === last && starred.length > 1);
      last = w;
      this.app.select(w, true);
    });
    this.updateTime(st.time);
  }

  // ------------------------------------------------------------------ rail
  buildRail() {
    const tabs = $('#rail-tabs');
    for (const [id, label] of [['laws', 'Laws'], ['stories', 'Stories'], ['families', 'Families']]) {
      tabs.append(h('button', { class: 'tab', role: 'tab', 'data-tab': id, 'aria-selected': id === this.tab ? 'true' : 'false', onclick: () => this.showTab(id) }, label));
    }
    this.showTab(this.tab);
  }

  showTab(id) {
    this.tab = id;
    for (const b of document.querySelectorAll('#rail-tabs .tab')) b.setAttribute('aria-selected', b.dataset.tab === id ? 'true' : 'false');
    const body = $('#rail-body');
    body.replaceChildren();
    if (id === 'laws') this.renderLaws(body);
    if (id === 'stories') this.renderStories(body);
    if (id === 'families') this.renderFamilies(body);
    body.scrollTop = 0;
  }

  refreshRail() {
    const body = $('#rail-body');
    const top = body.scrollTop;
    this.showTab(this.tab);
    body.scrollTop = top;
  }

  renderLaws(body) {
    const lens = this.app.state.lens;
    body.append(h('p', { class: 'rail-intro' }, 'Sound laws are rules that once ran through a language, changing every word that fit them. Pick one to see every branch it reshaped.'));
    for (const grp of LAW_GROUPS) {
      const laws = Object.entries(LAWS).filter(([id, l]) => l.group === grp.id && !l.parent);
      const sec = h('section', { class: 'law-group' }, h('h3', {}, grp.name));
      for (const [id, l] of laws) {
        const n = this.g.law[id]?.words.length || 0;
        if (!n) continue;
        const active = lens && lens.type === 'law' && (lens.id === id || LAWS[lens.id]?.parent === id);
        const row = h('button', { class: `law${active ? ' active' : ''}`, onclick: () => this.app.setLens(active && lens.id === id ? null : { type: 'law', id }) },
          h('span', { class: 'law-name' }, l.name),
          h('span', { class: 'law-count', title: `${n} English words` }, String(n)),
          l.rule ? h('span', { class: 'law-rule' }, l.rule) : null,
        );
        sec.append(row);
        if (active) sec.append(this.lawCard(id, lens.id));
      }
      body.append(sec);
    }
  }

  lawCard(id, activeId) {
    const l = LAWS[id];
    const card = h('div', { class: 'law-card' });
    if (l.era) card.append(h('p', { class: 'law-era' }, `${formatYear(l.era[0], { approx: true })} to ${formatYear(l.era[1])}`));
    card.append(h('p', {}, l.desc));
    if (id === 'gvs') card.append(this.vowelChart(activeId));
    const subs = Object.entries(LAWS).filter(([, s]) => s.parent === id);
    if (subs.length) {
      const grid = h('div', { class: `sub-grid${id === 'grimm' ? ' grimm' : ''}` });
      for (const [sid, s] of subs) {
        const n = this.g.law[sid]?.words.length || 0;
        grid.append(h('button', {
          class: `sub${activeId === sid ? ' active' : ''}`,
          disabled: n ? null : true,
          onclick: () => this.app.setLens({ type: 'law', id: activeId === sid ? id : sid }),
          title: s.ex || '',
        }, h('span', { class: 'sub-rule' }, s.name), h('span', { class: 'sub-n' }, n ? String(n) : '–')));
      }
      card.append(grid);
    }
    // examples
    const focusId = activeId || id;
    const FL = LAWS[focusId];
    const curated = (FL.pairs || [])
      .map(([a, b]) => [this.g.byKey.get(a), this.g.byKey.get(b)])
      .filter(([a, b]) => a && b)
      .map(([a, b]) => ({ native: a, other: b, root: this.g.rootById[a.rootIds[0]] }));
    if (curated.length || focusId.startsWith('grimm') || focusId === 'italic.f') {
      const pairs = curated.length ? curated : cognatePairs(this.g, focusId, 12);
      if (pairs.length) {
        card.append(h('h4', {}, FL.arrow ? 'Before the rule, and after' : 'Inherited, and borrowed back'));
        const tbl = h('div', { class: 'pairs' });
        for (const p of pairs) {
          tbl.append(
            h('button', { class: `pair-w fam-${p.native.family}`, onclick: () => this.app.select(p.native, true) }, p.native.display),
            h('span', { class: 'pair-root' }, FL.arrow ? '→' : p.root.node.display),
            h('button', { class: `pair-w fam-${p.other.family}`, onclick: () => this.app.select(p.other, true) }, p.other.display),
          );
        }
        card.append(tbl);
      }
      const words = this.g.law[focusId]?.words || [];
      if (words.length) {
        card.append(h('h4', {}, `All ${words.length} English words it reached`));
        card.append(this.chips(words.slice(0, 60)));
      }
    } else {
      const words = this.g.law[focusId]?.words || [];
      if (words.length) {
        card.append(h('h4', {}, `${words.length} English words carry it`));
        card.append(this.chips(words.slice(0, 40)));
      }
    }
    return card;
  }

  // The classic picture of the Great Vowel Shift: the mouth seen from the side,
  // front on the left, every long vowel pushed one step up.
  vowelChart(activeId) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 268 178');
    svg.setAttribute('class', 'vowels');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Vowel chart: long vowels each move one step higher; the two highest become diphthongs.');
    const V = {
      'iː': [34, 22], 'uː': [226, 22], 'eː': [52, 64], 'oː': [214, 64],
      'ɛː': [70, 106], 'ɔː': [202, 106], 'aː': [92, 150], 'aɪ': [112, 92], 'aʊ': [156, 92],
    };
    const el = (tag, attrs, text) => {
      const e = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      if (text) e.textContent = text;
      svg.append(e);
      return e;
    };
    const defs = el('defs', {});
    const m = document.createElementNS(ns, 'marker');
    for (const [k, v] of Object.entries({ id: 'vh', viewBox: '0 0 8 8', refX: '6', refY: '4', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' })) m.setAttribute(k, v);
    const mp = document.createElementNS(ns, 'path');
    mp.setAttribute('d', 'M0,0 L8,4 L0,8 z');
    mp.setAttribute('fill', 'currentColor');
    m.append(mp);
    defs.append(m);
    // the mouth: a trapezoid
    el('path', { d: 'M20 12 L246 12 L222 164 L72 164 Z', fill: 'none', stroke: 'rgba(236,232,223,0.16)' });
    el('text', { x: 20, y: 176, class: 'v-axis' }, 'front');
    el('text', { x: 246, y: 176, class: 'v-axis', 'text-anchor': 'end' }, 'back');
    const arrows = [
      ['gvs.i', 'iː', 'aɪ', 'bite', 'M40 30 Q60 70 104 86'],
      ['gvs.u', 'uː', 'aʊ', 'house', 'M220 30 Q200 70 164 86'],
      ['gvs.e', 'eː', 'iː', 'feet', 'M52 56 L38 32'],
      ['gvs.o', 'oː', 'uː', 'food', 'M214 56 L224 32'],
      ['gvs.ea', 'ɛː', 'eː', 'meat', 'M70 98 L56 72'],
      ['gvs.oa', 'ɔː', 'oː', 'boat', 'M202 98 L212 72'],
      ['gvs.a', 'aː', 'ɛː', 'name', 'M92 142 L74 114'],
    ];
    for (const [sid, , , word, d] of arrows) {
      const on = !activeId || activeId === 'gvs' || activeId === sid;
      el('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': on ? 1.6 : 1, 'marker-end': 'url(#vh)', class: on ? 'v-arrow on' : 'v-arrow' });
    }
    for (const [sym, [x, y]] of Object.entries(V)) el('text', { x, y: y + 4, class: sym.length > 2 || sym === 'aɪ' || sym === 'aʊ' ? 'v-sym di' : 'v-sym', 'text-anchor': 'middle' }, sym);
    const words = { bite: [64, 74], house: [196, 74], feet: [16, 50], food: [236, 50], meat: [40, 92], boat: [234, 92], name: [60, 134] };
    for (const [w, [x, y]] of Object.entries(words)) el('text', { x, y, class: 'v-word', 'text-anchor': 'middle' }, w);
    return svg;
  }

  chips(words) {
    const wrap = h('div', { class: 'chips' });
    for (const w of words) {
      wrap.append(h('button', { class: `chip fam-${w.family}`, onclick: () => this.app.select(w, true), title: w.gloss || '' }, w.display));
    }
    return wrap;
  }

  renderStories(body) {
    const lens = this.app.state.lens;
    body.append(h('p', { class: 'rail-intro' }, 'Short tours of patterns hiding in the graph.'));
    STORIES.forEach((s, i) => {
      const active = lens && lens.type === 'story' && lens.id === s.id;
      const card = h('article', { class: `story${active ? ' active' : ''}` },
        h('button', { class: 'story-head', onclick: () => this.app.setLens(active ? null : { type: 'story', id: s.id }) },
          h('span', { class: 'story-title' }, s.title),
          h('span', { class: 'story-lede' }, s.lede)),
      );
      if (active) {
        const bodyEl = h('div', { class: 'story-body' }, ...s.text.map((t) => h('p', {}, t)));
        const ws = (s.words || []).map((k) => this.g.byKey.get(k)).filter(Boolean);
        if (ws.length) bodyEl.append(this.chips(ws));
        const nav = h('div', { class: 'story-nav' },
          i > 0 ? h('button', { class: 'ghost', onclick: () => this.app.setLens({ type: 'story', id: STORIES[i - 1].id }) }, 'Previous') : h('span'),
          i < STORIES.length - 1 ? h('button', { class: 'ghost', onclick: () => this.app.setLens({ type: 'story', id: STORIES[i + 1].id }) }, 'Next story') : h('span'),
        );
        bodyEl.append(nav);
        card.append(bodyEl);
      }
      body.append(card);
    });
  }

  renderFamilies(body) {
    const st = this.app.state;
    const lens = st.lens;
    body.append(h('p', { class: 'rail-intro' }, 'Every English word on the rim is coloured by the road it took into English. Pick a road to light it up.'));
    const comp = composition(this.g, st.minZipf);
    const list = h('div', { class: 'fam-list' });
    for (const f of FAMILY_ORDER) {
      const n = comp.counts[f] || 0;
      const active = lens && lens.type === 'family' && lens.id === f;
      list.append(h('button', { class: `fam-row${active ? ' active' : ''}`, onclick: () => this.app.setLens(active ? null : { type: 'family', id: f }) },
        h('span', { class: `swatch fam-bg-${f}` }),
        h('span', { class: 'fam-name' }, FAMILIES[f].name),
        h('span', { class: 'fam-n' }, String(n)),
      ));
    }
    list.append(h('div', { class: 'fam-row static' }, h('span', { class: 'swatch root' }), h('span', { class: 'fam-name' }, 'Proto-Indo-European root'), h('span', { class: 'fam-n' }, String(this.g.roots.filter((r) => r.node.lang === 'PIE').length))));
    list.append(h('div', { class: 'fam-row static' }, h('span', { class: 'swatch bridge' }), h('span', { class: 'fam-name' }, 'One word, two roots'), h('span', { class: 'fam-n' }, String(this.g.bridges.length))));
    body.append(list);

    // frequency filter + composition
    const sec = h('section', { class: 'freq' });
    sec.append(h('h3', {}, 'How often is it said?'));
    sec.append(h('p', { class: 'rail-intro' }, 'Hide rarer words and watch the native core emerge.'));
    const out = h('output', { class: 'freq-out' });
    const label = (z) => (z <= 0 ? 'Showing every word' : `Showing words used at least ${z >= 6 ? 'once every few hundred words' : z >= 5 ? 'once per 100,000 words' : z >= 4 ? 'once per million words' : 'occasionally'}`);
    out.textContent = label(st.minZipf);
    const slider = h('input', { type: 'range', min: '0', max: '6.4', step: '0.1', value: String(st.minZipf), 'aria-label': 'Minimum word frequency' });
    slider.addEventListener('input', () => {
      const z = parseFloat(slider.value);
      out.textContent = label(z);
      this.app.setMinZipf(z);
      this.drawComposition(bar, z);
    });
    sec.append(slider, out);
    const bar = h('div', { class: 'comp' });
    sec.append(bar);
    this.drawComposition(bar, st.minZipf);
    body.append(sec);
  }

  drawComposition(el, z) {
    const comp = composition(this.g, z);
    el.replaceChildren();
    const row = (title, share, total) => {
      const r = h('div', { class: 'comp-row' }, h('span', { class: 'comp-title' }, title));
      const track = h('div', { class: 'comp-track', role: 'img', 'aria-label': `${title}: ` + FAMILY_ORDER.map((f) => `${FAMILIES[f].name} ${Math.round((100 * (share[f] || 0)) / (total || 1))}%`).join(', ') });
      for (const f of FAMILY_ORDER) {
        const v = share[f] || 0;
        if (!v) continue;
        const pct = (100 * v) / (total || 1);
        track.append(h('span', { class: `seg fam-bg-${f}`, style: `flex-basis:${pct}%`, title: `${FAMILIES[f].name}: ${pct.toFixed(1)}%` }));
      }
      r.append(track);
      const g = share.germanic + (share.norse || 0);
      r.append(h('span', { class: 'comp-note' }, `${Math.round((100 * g) / (total || 1))}% Germanic or Norse`));
      return r;
    };
    el.append(row(`Distinct words (${comp.total})`, comp.counts, comp.total));
    el.append(row('Weighted by use', comp.tokenShare, comp.tokens));
  }

  // ------------------------------------------------------------------ journey
  showJourney(n) {
    const panel = $('#journey');
    const body = $('#journey-body');
    body.replaceChildren();
    if (!n) {
      panel.hidden = true;
      document.body.classList.remove('journey-open');
      return;
    }
    panel.hidden = false;
    document.body.classList.add('journey-open');
    const lang = LANGS[n.lang];
    body.append(h('p', { class: 'j-lang' }, n.isEn ? 'English' : lang.name));
    body.append(h('h2', { class: `j-word${n.isRoot ? ' root' : ''}` }, n.display));
    if (n.gloss) body.append(h('p', { class: 'j-gloss' }, `"${n.gloss}"`));
    if (n.isEn) {
      body.append(h('p', { class: 'j-meta' }, `In English since ${n.dateExplicit ? n.date : 'Old English times'}; ${commonness(n.zipf)}.`));
    } else if (!n.isRoot) {
      body.append(h('p', { class: 'j-meta' }, yearLabel(n)));
    }
    if (n.note) body.append(h('p', { class: 'j-note' }, n.note));

    // the road(s)
    const paths = n.isRoot ? [] : allPaths(n, 3);
    paths.forEach((path, i) => {
      if (i === 1) body.append(h('h4', { class: 'j-also' }, n.isEn ? 'It also descends from' : 'Also from'));
      if (i > 0) path = path.filter((st) => !paths[0].some((p0) => p0.node === st.node) || st.node === n);
      body.append(this.road(path, n));
    });

    // root story
    const rootIds = n.rootIds || [];
    for (const rid of rootIds) {
      const r = this.g.rootById[rid];
      if (!r) continue;
      const words = (this.g.rootWords[rid] || []).filter((w) => w !== n);
      const sec = h('section', { class: 'j-root' });
      sec.append(h('h4', {}, h('span', { class: 'j-root-form' }, r.node.display), h('span', { class: 'j-root-gloss' }, ` "${r.node.gloss}"`)));
      if (r.node.note && n !== r.node) sec.append(h('p', { class: 'j-root-note' }, r.node.note));
      if (words.length) {
        sec.append(h('p', { class: 'j-cousins-h' }, `${words.length} English relatives`));
        const byFam = {};
        for (const w of words) (byFam[w.family] ||= []).push(w);
        for (const f of FAMILY_ORDER) {
          if (!byFam[f]) continue;
          const row = h('div', { class: 'j-fam' }, h('span', { class: `j-fam-name fam-text-${f}` }, `through ${FAMILIES[f].name}`));
          row.append(this.chips(byFam[f].sort((a, b) => b.zipf - a.zipf)));
          sec.append(row);
        }
      }
      body.append(sec);
    }
    if (n.isEn) body.append(h('p', { class: 'j-foot' }, 'Dates are first records in writing; forms in older languages are simplified, and a * marks a reconstructed form.'));
    $('#journey').scrollTop = 0;
  }

  road(path, target) {
    const ol = h('ol', { class: 'road' });
    for (const { node, edge } of path) {
      const lang = LANGS[node.lang];
      const li = h('li', { class: `step fam-line-${node.isRoot && node.lang === 'PIE' ? 'root' : node.family}${node === target ? ' here' : ''}${node.imported || edge?.imported ? ' imp' : ''}` });
      if (edge && edge.tags.length) {
        const tags = h('div', { class: 'tags' });
        for (const t of edge.tags) {
          tags.append(h('button', { class: 'tag', title: LAWS[t]?.desc || LAWS[LAWS[t]?.parent]?.desc || '', onclick: () => this.app.openLaw(t) }, lawLabel(t)));
        }
        li.append(tags);
      }
      if (edge && edge.imported) {
        if (edge.how && edge.how !== 'inherited' && edge.how !== 'derived') li.append(h('span', { class: 'borrow' }, edge.how));
      } else if (edge && edge.kind === 'borrow') li.append(h('span', { class: 'borrow' }, 'borrowed'));
      li.append(
        h('div', { class: 'step-head' },
          h('button', { class: 'step-form', onclick: () => this.app.select(node, true) }, node.display),
          h('span', { class: 'step-lang' }, node.isEn ? 'English' : lang.name),
          node.imported ? h('span', { class: 'impmark', title: 'From Wiktionary, imported automatically: not hand-checked' }, '◇') : null),
      );
      const meta = [];
      if (node.native) meta.push(node.native);
      if (node.gloss && node !== target) meta.push(`"${node.gloss}"`);
      if (!node.isEn) meta.push(yearLabel(node));
      else if (node !== target && node.dateExplicit) meta.push(String(node.date));
      if (node.died) meta.push(`died out c. ${node.died}`);
      if (meta.length) li.append(h('div', { class: 'step-meta' }, meta.join(', ')));
      if (node.note && node !== target && !node.isRoot) li.append(h('div', { class: 'step-note' }, node.note));
      if (edge && edge.uncertain) li.append(h('div', { class: 'step-note uncertain' }, edge.imported ? 'Wiktionary marks this step as uncertain.' : 'This step is debated.'));
      if (edge && edge.how === 'steps not recorded') li.append(h('div', { class: 'step-note' }, 'The steps between here and the root are not recorded in this import.'));
      ol.append(li);
    }
    return ol;
  }

  // ------------------------------------------------------------------ timeline
  buildTimeline() {
    const track = $('#tl-track');
    const pos = (y) => `${((timeToR(y) - timeToR(T_MIN)) / (1 - timeToR(T_MIN))) * 100}%`;
    for (const e of ERAS) {
      const a = (timeToR(e.from) - timeToR(T_MIN)) / (1 - timeToR(T_MIN));
      const b = (timeToR(e.to) - timeToR(T_MIN)) / (1 - timeToR(T_MIN));
      track.append(h('div', { class: `era${b - a < 0.11 ? ' narrow' : ''}`, style: `left:${a * 100}%;width:${(b - a) * 100}%` }, h('span', {}, e.name)));
    }
    for (const ev of EVENTS) {
      track.append(h('button', { class: 'tick', style: `left:${pos(ev.year)}`, title: `${formatYear(ev.year)}: ${ev.title}`, onclick: (e) => { e.stopPropagation(); this.app.setTime(ev.year, true); this.caption(ev, true); } }));
    }
    track.append(h('div', { class: 'tl-fill', id: 'tl-fill' }), h('div', { class: 'tl-handle', id: 'tl-handle' }));
    const toYear = (clientX) => {
      const r = track.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      return rToTime(timeToR(T_MIN) + f * (1 - timeToR(T_MIN)));
    };
    let drag = false;
    track.addEventListener('pointerdown', (e) => {
      drag = true;
      track.setPointerCapture(e.pointerId);
      this.app.pause();
      this.app.setTime(toYear(e.clientX));
    });
    track.addEventListener('pointermove', (e) => drag && this.app.setTime(toYear(e.clientX)));
    track.addEventListener('pointerup', () => (drag = false));
    track.addEventListener('keydown', (e) => {
      const st = this.app.state;
      const step = e.shiftKey ? 0.05 : 0.01;
      if (e.key === 'ArrowRight') this.app.setTime(rToTime(Math.min(1, st.tR + step)));
      if (e.key === 'ArrowLeft') this.app.setTime(rToTime(Math.max(timeToR(T_MIN), st.tR - step)));
    });
    $('#play').addEventListener('click', () => this.app.togglePlay());
  }

  updateTime(year) {
    const f = (timeToR(year) - timeToR(T_MIN)) / (1 - timeToR(T_MIN));
    $('#tl-fill').style.width = `${f * 100}%`;
    $('#tl-handle').style.left = `${f * 100}%`;
    const y = Math.round(year);
    $('#tl-year').textContent = y >= T_MAX ? 'Now' : y < 0 ? `${Math.abs(y).toLocaleString('en-US')} BCE` : `${y} CE`;
    const era = ERAS.find((e) => year >= e.from && year < e.to) || ERAS[ERAS.length - 1];
    $('#tl-era').textContent = era.name;
    $('#tl-track').setAttribute('aria-valuenow', String(y));
    $('#tl-track').setAttribute('aria-valuetext', $('#tl-year').textContent);
  }

  setPlaying(p) {
    const b = $('#play');
    b.setAttribute('aria-label', p ? 'Pause' : 'Play history');
    b.classList.toggle('playing', p);
    $('#skip').hidden = !p;
  }

  caption(ev, sticky = false) {
    const el = $('#caption');
    clearTimeout(this._capT);
    el.replaceChildren(
      h('span', { class: 'cap-year' }, ev.year >= T_MAX - 40 && ev.title === 'Now' ? 'Now' : formatYear(ev.year, { approx: ev.year < 1000 })),
      h('strong', { class: 'cap-title' }, ev.title),
      h('span', { class: 'cap-text' }, ev.text),
    );
    el.classList.add('show');
    this._capT = setTimeout(() => el.classList.remove('show'), sticky ? 9000 : 7200);
  }

  hideCaption() {
    $('#caption').classList.remove('show');
  }

  // ------------------------------------------------------------------ search
  buildSearch() {
    const input = $('#search');
    const list = $('#search-results');
    let items = [];
    let idx = 0;
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const index = [
      ...this.g.words.map((w) => ({ n: w, k: norm(w.display), label: w.display, sub: w.gloss || FAMILIES[w.family].name })),
      ...this.g.roots.map((r) => ({ n: r.node, k: norm(r.node.display.replace(/[*\-]/g, '')), label: r.node.display, sub: `root, "${r.node.gloss}"` })),
    ];
    const render = () => {
      list.replaceChildren();
      items.forEach((it, i) => {
        list.append(h('li', { role: 'option', 'aria-selected': i === idx ? 'true' : 'false', onmousedown: (e) => { e.preventDefault(); pick(it); } },
          h('span', { class: 'sr-w' }, it.label), h('span', { class: 'sr-sub' }, it.sub)));
      });
      list.hidden = !items.length;
    };
    const pick = (it) => {
      input.value = '';
      items = [];
      render();
      input.blur();
      this.app.select(it.n, true);
    };
    input.addEventListener('input', () => {
      const q = norm(input.value.trim());
      if (!q) {
        items = [];
        render();
        return;
      }
      const pre = index.filter((it) => it.k.startsWith(q));
      const sub = index.filter((it) => !it.k.startsWith(q) && it.k.includes(q));
      const z = (it) => (it.n.zipf ?? 4);
      items = [...pre.sort((a, b) => a.k.length - b.k.length || z(b) - z(a)), ...sub.sort((a, b) => z(b) - z(a))].slice(0, 8);
      idx = 0;
      render();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); render(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); render(); e.preventDefault(); }
      if (e.key === 'Enter' && items[idx]) pick(items[idx]);
      if (e.key === 'Escape') { input.value = ''; items = []; render(); input.blur(); }
    });
    input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
      if (e.key === 'Escape') this.app.escape();
      if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); this.app.togglePlay(); }
    });
  }

  // ------------------------------------------------------------------ tooltip
  tooltip(n, x, y) {
    const el = $('#tooltip');
    if (!n) {
      el.hidden = true;
      return;
    }
    const lang = LANGS[n.lang];
    const lines = [h('span', { class: `tt-form${n.isRoot ? ' root' : ''}` }, n.display)];
    const sub = [];
    if (n.isEn) {
      const via = n.family ? `through ${FAMILIES[n.family].name}` : '';
      sub.push(n.dateExplicit ? `English since ${n.date}` : 'English since Old English', via);
    } else {
      sub.push(lang.name, yearLabel(n));
    }
    lines.push(h('span', { class: 'tt-sub' }, sub.filter(Boolean).join(', ')));
    if (n.gloss) lines.push(h('span', { class: 'tt-gloss' }, `"${n.gloss}"`));
    if (n.isEn || !n.isRoot) {
      const roots = (n.rootIds || []).map((id) => this.g.rootById[id]?.node).filter(Boolean);
      if (roots.length) lines.push(h('span', { class: 'tt-root' }, `from ${roots.map((r) => `${r.display} "${r.gloss}"`).join(' + ')}`));
    } else {
      lines.push(h('span', { class: 'tt-root' }, `${n.enDesc.size} English descendants`));
    }
    el.replaceChildren(...lines);
    el.hidden = false;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const r = el.getBoundingClientRect();
    let tx = x + 16;
    let ty = y + 14;
    if (tx + r.width > W - 8) tx = x - r.width - 16;
    if (ty + r.height > H - 8) ty = y - r.height - 14;
    el.style.transform = `translate(${Math.max(8, tx)}px, ${Math.max(8, ty)}px)`;
  }
}
