// Etymon, languages: the kinship table. A square for every two languages; beside it the family
// tree those squares draw when the nearest are joined first. The colours on the tree are the
// families as the handbooks have them: where a limb is all of one colour, the count found the family.

import { esc, num } from './kin-card-word.js';
import { kinship, pairsOf, ENOUGH } from './kin-stats.js';

// alike … nothing alike
const RAMP = [[255, 241, 194], [240, 184, 84], [199, 90, 90], [91, 58, 134], [23, 27, 58]];
const NEAR = 0.15, FAR = 0.85, DIM = 'rgba(236,232,223,0.3)';

function tint(d) {
  const t = Math.min(1, Math.max(0, (d - NEAR) / (FAR - NEAR))) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i, a = RAMP[i], b = RAMP[i + 1];
  return `rgb(${[0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * f)).join(',')})`;
}

export function kinTab(k) {
  const { K, T, L } = k, { langs, n, dist, count, tree, order } = kinship(K, T, L);
  const st = K.stations, name = (x) => st[langs[x]].name, branch = (x) => st[langs[x]].branch;
  const slot = new Map(langs.map((s, x) => [s, x])), rowOf = new Int32Array(n);
  order.forEach((x, r) => { rowOf[x] = r; });

  const el = document.createElement('div');
  el.innerHTML = `<h2 class="kn-ph">The family tree, from spelling alone</h2>
    <p class="kn-pp">Each square sets two languages side by side: take the words both had from one ancestor by plain descent, and count the letters that differ. Bright is alike. The tree on the left was told nothing but these numbers, joining the nearest first. Its colours are the families of the handbooks: it found them.</p>
    <canvas class="kn-mx" role="img" aria-label="A table of ${n} languages by ${n}: how alike their inherited words still are"></canvas>
    <p class="kn-scale"><span>alike</span><i style="background:linear-gradient(90deg,${[0, 0.25, 0.5, 0.75, 1].map((t) => tint(NEAR + t * (FAR - NEAR))).join(',')})"></i><span>nothing alike</span></p>
    <p class="kn-read" aria-live="polite"></p>`;
  const cv = el.querySelector('canvas'), read = el.querySelector('.kn-read');
  let geo = null, hot = null, sel = null;   // hot and sel: [row, column] of the table

  const draw = () => {
    const W = el.clientWidth;
    if (!W) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lab = W >= 460 ? 116 : 0, den = W >= 460 ? 64 : 40;
    const c = Math.max(5, Math.floor((W - den - lab - 10) / n)), g0 = den + lab + 8, top = 4, H = top + c * n + 4;
    geo = { c, g0, top };
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.height = `${H}px`;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const y = (r) => top + (r + 0.5) * c, hue = (b) => (b >= 0 ? K.branches[b].color : DIM);
    const line = (x1, y1, x2, y2, col) => { g.strokeStyle = col; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    // the tree: the further left two limbs join, the less alike they are
    const hx = (h) => den - 3 - (h / tree.h) * (den - 8);
    g.lineWidth = 1.3;
    g.globalAlpha = 0.95;
    const limb = (node) => {
      if (!node.kids) return { x: hx(0), y: y(rowOf[node.leaves[0]]), b: branch(node.leaves[0]) };
      const [a, b] = node.kids.map(limb), X = hx(node.h), same = a.b === b.b ? a.b : -1;
      line(a.x, a.y, X, a.y, hue(a.b));
      line(b.x, b.y, X, b.y, hue(b.b));
      line(X, a.y, X, b.y, hue(same));
      return { x: X, y: (a.y + b.y) / 2, b: same };
    };
    limb(tree);
    g.globalAlpha = 1;
    const lit = (r) => (hot && (hot[0] === r || hot[1] === r)) || (sel && (sel[0] === r || sel[1] === r));
    if (lab) {
      g.font = `${Math.min(12.5, c + 1.5)}px ${getComputedStyle(el).fontFamily}`;
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      order.forEach((x, r) => {
        g.fillStyle = lit(r) ? '#e8c77a' : 'rgba(236,232,223,0.66)';
        g.fillText(name(x), den + lab, y(r) + 0.5);
      });
    }
    for (let r = 0; r < n; r++) {
      for (let q = 0; q < n; q++) {
        const x = order[r], z = order[q], at = x * n + z;
        g.fillStyle = r === q ? hue(branch(x)) : count[at] >= ENOUGH ? tint(dist[at]) : 'rgba(236,232,223,0.045)';
        g.fillRect(g0 + q * c, top + r * c, c - 1, c - 1);
      }
    }
    const ring = (p, col) => {
      if (!p) return;
      g.strokeStyle = col;
      g.lineWidth = 1.5;
      for (const [r, q] of [p, [p[1], p[0]]]) g.strokeRect(g0 + q * c - 1, top + r * c - 1, c + 1, c + 1);
    };
    ring(sel, '#fff');
    ring(hot, '#e8c77a');
  };

  const cellAt = (e) => {
    if (!geo) return null;
    const b = cv.getBoundingClientRect();
    const q = Math.floor((e.clientX - b.left - geo.g0) / geo.c), r = Math.floor((e.clientY - b.top - geo.top) / geo.c);
    return r >= 0 && r < n && q >= 0 && q < n && r !== q ? [r, q] : null;
  };
  const alike = (at) => `${Math.round(100 * (1 - dist[at]))}% alike over ${num(count[at])} word pairs`;
  const say = (p) => {
    if (!p) { read.textContent = 'Point at a square; press it to see the two languages on the globe.'; return; }
    const x = order[p[0]], z = order[p[1]], at = x * n + z;
    read.innerHTML = `<b>${esc(name(x))} × ${esc(name(z))}</b> ${count[at] >= ENOUGH ? alike(at) : 'too few shared words to tell'}`;
  };
  cv.addEventListener('pointermove', (e) => {
    const p = cellAt(e);
    if (String(p) === String(hot)) return;
    hot = p;
    cv.style.cursor = p ? 'pointer' : '';
    draw();
    say(p);
  });
  cv.addEventListener('pointerleave', () => { hot = null; draw(); say(null); });
  cv.addEventListener('click', (e) => {
    const p = cellAt(e);
    if (p) k.show({ kind: 'pair', a: langs[order[p[0]]], b: langs[order[p[1]]] });
  });
  say(null);

  return {
    el,
    shown: draw,
    chosen(what) {
      const a = what?.kind === 'pair' ? slot.get(what.a) : undefined, b = what?.kind === 'pair' ? slot.get(what.b) : undefined;
      sel = a !== undefined && b !== undefined ? [rowOf[a], rowOf[b]] : null;
      draw();
    },
    // two languages: how alike, and the words that show it either way
    detail(what) {
      if (what?.kind !== 'pair') return '';
      const ps = pairsOf(K, L, what.a, what.b);
      if (ps.length < 8) return '';
      const fame = (m) => K.rank.charCodeAt(m.ai) + K.rank.charCodeAt(m.bi);
      const best = (list) => list.sort((p, q) => fame(q) - fame(p) || p.ai - q.ai).slice(0, 4);
      const q = Math.max(4, Math.floor(ps.length / 4));
      const two = (m) => `<button type="button" data-set="${m.ai},${m.bi}"><span class="it">${esc(K.form[m.ai])}</span> × <span class="it">${esc(K.form[m.bi])}</span></button>`;
      const mean = ps.reduce((s, m) => s + m.d, 0) / ps.length;
      return `<p class="kn-sum">${Math.round(100 * (1 - mean))}% alike over ${num(ps.length)} word pairs.</p>
        <p class="kn-line"><span>still alike</span>${best(ps.slice(0, q)).map(two).join('')}</p>
        <p class="kn-line"><span>worn apart</span>${best(ps.slice(-q)).map(two).join('')}</p>`;
    },
  };
}
