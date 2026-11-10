// Radial time layout.
//   radius  = time (centre = 4500 BCE, rim = now)
//   angle   = position in a radial dendrogram: domains → roots → families → words
// Every English word lives on the rim (the present). Its "entry" point sits at
// the radius of the year it entered English, and a straight life-line runs from
// there to the rim.

import { timeToR, FAMILY_ORDER, DOMAINS } from './langs.js';

const ROOT_GAP = 1.4; // empty leaf-slots between two roots
const DOMAIN_GAP = 6; // between two domains
const TOP_GAP = 26; // the wedge at 12 o'clock, kept clear for ring labels
const MIN_STEP = 0.011; // minimum radial step from parent to child
export const RIM = 1.0;
const A0 = -Math.PI / 2; // 12 o'clock
export let SWIRL = 1.05;
export function setSwirl(v) { SWIRL = v; }

export function computeLayout(g) {
  const famIdx = (n) => {
    const i = FAMILY_ORDER.indexOf(n.family);
    return i < 0 ? 99 : i;
  };
  for (const n of g.nodes) {
    n.kids = n.outEdges.filter((e) => e.primary).map((e) => e.target);
    n.kids.sort((a, b) => famIdx(a) - famIdx(b) || a.date - b.date || (a.display < b.display ? -1 : 1));
  }

  const domainOrder = DOMAINS.map((d) => d.id);
  const roots = [...g.roots].sort((a, b) => domainOrder.indexOf(a.domain) - domainOrder.indexOf(b.domain));

  let slot = TOP_GAP / 2;
  let prevDomain = null;
  const domainSpans = {};
  const assign = (n) => {
    if (!n.kids.length) {
      n.slot = slot;
      n.slotLo = n.slotHi = slot;
      slot += 1;
      return;
    }
    for (const c of n.kids) assign(c);
    n.slotLo = n.kids[0].slotLo;
    n.slotHi = n.kids[n.kids.length - 1].slotHi;
    n.slot = (n.slotLo + n.slotHi) / 2;
  };
  for (const r of roots) {
    if (prevDomain !== null) slot += r.domain !== prevDomain ? DOMAIN_GAP : ROOT_GAP;
    prevDomain = r.domain;
    assign(r.node);
    const sp = (domainSpans[r.domain] ||= { lo: Infinity, hi: -Infinity, roots: [] });
    sp.lo = Math.min(sp.lo, r.node.slotLo);
    sp.hi = Math.max(sp.hi, r.node.slotHi);
    sp.roots.push(r);
  }
  const total = slot + TOP_GAP / 2;
  const slotAngle = (2 * Math.PI) / total;
  const ang = (s) => A0 + s * slotAngle;

  for (const n of g.nodes) n.theta = ang(n.slot ?? 0);

  // radii
  const place = (n, p) => {
    let pr = 0;
    if (p) pr = p.isEn ? Math.max(timeToR(n.date), p.rEntry) : p.r;
    if (n.isEn) {
      const step = p && p.isEn ? 0.004 : MIN_STEP * 0.45;
      n.rEntry = Math.min(Math.max(timeToR(n.date), pr + step), 0.988);
      n.r = RIM;
    } else {
      n.r = n.isRoot ? timeToR(n.date) : Math.min(Math.max(timeToR(n.date), pr + MIN_STEP), 0.975);
      n.rEntry = n.r;
    }
    for (const c of n.kids) place(c, n);
  };
  for (const r of roots) place(r.node, null);

  for (const n of g.nodes) {
    const rr = n.isEn ? n.rEntry : n.r;
    n.x = rr * Math.cos(n.theta);
    n.y = rr * Math.sin(n.theta);
    n.rimX = Math.cos(n.theta);
    n.rimY = Math.sin(n.theta);
  }

  // edge geometry: cubic béziers in unit space
  for (const e of g.edges) {
    const p = e.source;
    const c = e.target;
    const ra = p.isEn ? Math.max(c.rEntry, p.rEntry) : p.r;
    const ta = p.theta;
    const rc = c.isEn ? c.rEntry : c.r;
    const tc = c.theta;
    let r1, r2;
    let tw = 0;
    if (e.primary) {
      const rm = (ra + rc) / 2;
      r1 = rm;
      r2 = rm;
      // a gentle clockwise swirl, stronger for long leaps through time
      tw = SWIRL * (rc - ra);
    } else {
      // bridges bow toward the centre, like chords in a chord diagram
      const rm = Math.min(ra, rc) * 0.42;
      r1 = rm;
      r2 = rm;
    }
    e.g = [
      ra * Math.cos(ta), ra * Math.sin(ta),
      r1 * Math.cos(ta + tw), r1 * Math.sin(ta + tw),
      r2 * Math.cos(tc + tw), r2 * Math.sin(tc + tw),
      rc * Math.cos(tc), rc * Math.sin(tc),
    ];
    e.ra = ra;
    e.rc = rc;
    e.len = Math.hypot(e.g[6] - e.g[0], e.g[7] - e.g[1]) + Math.abs(rc - ra) * 0.5;
  }

  const domains = DOMAINS.filter((d) => domainSpans[d.id]).map((d) => ({
    ...d,
    a0: ang(domainSpans[d.id].lo - 0.5),
    a1: ang(domainSpans[d.id].hi + 0.5),
    roots: domainSpans[d.id].roots,
  }));

  // English words sorted by angle, for rim hit-testing
  const rimWords = g.words.slice().sort((a, b) => a.theta - b.theta);

  return { slotAngle, total, domains, rimWords, topGapAngle: TOP_GAP * slotAngle, A0 };
}

// Re-bend the branches without moving any node (used while history plays).
export function bendEdges(g, swirl) {
  for (const e of g.edges) {
    if (!e.primary) continue;
    const p = e.source;
    const c = e.target;
    const ta = p.theta;
    const tc = c.theta;
    const rm = (e.ra + e.rc) / 2;
    const tw = swirl * (e.rc - e.ra);
    const gm = e.g;
    gm[2] = rm * Math.cos(ta + tw);
    gm[3] = rm * Math.sin(ta + tw);
    gm[4] = rm * Math.cos(tc + tw);
    gm[5] = rm * Math.sin(tc + tw);
  }
}

// point on a cubic bézier
export function bez(gm, t, out) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  out[0] = a * gm[0] + b * gm[2] + c * gm[4] + d * gm[6];
  out[1] = a * gm[1] + b * gm[3] + c * gm[5] + d * gm[7];
  return out;
}

// the first part [0, t] of a cubic bézier (de Casteljau)
export function bezHead(gm, t) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = gm;
  const lx = (a, b) => a + (b - a) * t;
  const x01 = lx(x0, x1), y01 = lx(y0, y1);
  const x12 = lx(x1, x2), y12 = lx(y1, y2);
  const x23 = lx(x2, x3), y23 = lx(y2, y3);
  const x012 = lx(x01, x12), y012 = lx(y01, y12);
  const x123 = lx(x12, x23), y123 = lx(y12, y23);
  const x0123 = lx(x012, x123), y0123 = lx(y012, y123);
  return [x0, y0, x01, y01, x012, y012, x0123, y0123];
}
