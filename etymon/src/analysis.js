// Derived facts the interface needs: lineages, cousins, law reach, cognate pairs.

import { LAWS } from './laws.js';
import { FAMILY_ORDER } from './langs.js';

export function analyze(g) {
  // English descendants of every node (through all edges)
  const memo = new Map();
  const enDesc = (n) => {
    if (memo.has(n)) return memo.get(n);
    const s = new Set();
    memo.set(n, s);
    if (n.isEn) s.add(n);
    for (const c of n.children) for (const w of enDesc(c)) s.add(w);
    return s;
  };
  for (const n of g.nodes) n.enDesc = enDesc(n);

  // words of each root
  g.rootWords = {};
  for (const r of g.roots) g.rootWords[r.id] = [...r.node.enDesc];

  // laws: edges carrying each tag (a sub-tag also counts for its parent)
  const lawEdges = {};
  for (const e of g.edges) {
    for (const t of e.tags) {
      const ids = [t];
      if (LAWS[t]?.parent) ids.push(LAWS[t].parent);
      for (const id of ids) (lawEdges[id] ||= []).push(e);
    }
  }
  g.law = {};
  for (const id of Object.keys(LAWS)) {
    const edges = lawEdges[id] || [];
    const words = new Set();
    for (const e of edges) for (const w of e.target.enDesc) words.add(w);
    g.law[id] = { edges, words: [...words].sort((a, b) => b.zipf - a.zipf) };
  }

  g.wordsByZipf = g.words.slice().sort((a, b) => b.zipf - a.zipf);
  g.byKey = new Map(g.words.map((w) => [w.key, w]));
  g.byDisplay = new Map();
  for (const w of g.wordsByZipf) {
    const k = w.display.toLowerCase();
    if (!g.byDisplay.has(k)) g.byDisplay.set(k, w);
  }
}

export function ancestors(n) {
  const nodes = new Set();
  const edges = new Set();
  const q = [n];
  while (q.length) {
    const x = q.pop();
    if (nodes.has(x)) continue;
    nodes.add(x);
    for (const e of x.inEdges) {
      edges.add(e);
      q.push(e.source);
    }
  }
  return { nodes, edges };
}

export function descendants(n) {
  const nodes = new Set();
  const edges = new Set();
  const q = [n];
  while (q.length) {
    const x = q.pop();
    if (nodes.has(x)) continue;
    nodes.add(x);
    for (const e of x.outEdges) {
      edges.add(e);
      q.push(e.target);
    }
  }
  return { nodes, edges };
}

// The focus set for a node: its whole lineage (up and down) plus its English cousins.
export function lineageFocus(g, n) {
  const up = ancestors(n);
  const down = descendants(n);
  const nodes = new Set([...up.nodes, ...down.nodes]);
  const edges = new Set([...up.edges, ...down.edges]);
  const words = new Set();
  for (const id of n.rootIds) for (const w of g.rootWords[id] || []) words.add(w);
  const strong = new Set([...nodes].filter((x) => x.isEn));
  return { nodes, edges, words, strong, kind: 'lineage', anchor: n };
}

// A set of English words, with the full ancestry of each.
export function wordsFocus(words, kind = 'set') {
  const nodes = new Set();
  const edges = new Set();
  for (const w of words) {
    const up = ancestors(w);
    for (const x of up.nodes) nodes.add(x);
    for (const e of up.edges) edges.add(e);
  }
  return { nodes, edges, words: new Set(words), strong: new Set(words), kind };
}

export function lawFocus(g, id) {
  const L = g.law[id];
  const nodes = new Set();
  const edges = new Set(L.edges);
  for (const e of L.edges) {
    nodes.add(e.source);
    nodes.add(e.target);
    // carry the highlight down to the English words the change reached
    const d = descendants(e.target);
    for (const x of d.nodes) nodes.add(x);
    for (const de of d.edges) edges.add(de);
  }
  return { nodes, edges, words: new Set(L.words), strong: new Set(L.words), kind: 'law', law: id, lawEdges: new Set(L.edges) };
}

export function familyFocus(g, fam) {
  const words = g.words.filter((w) => w.family === fam);
  const f = wordsFocus(words, 'family');
  f.family = fam;
  return f;
}

// Cognate pairs for a law edge set: the inherited (Germanic) English word next
// to the best-known English word from the same root that took another road.
export function cognatePairs(g, id, max = 14) {
  const L = g.law[id];
  const out = [];
  const seenRoots = new Set();
  for (const e of L.edges) {
    const rootId = e.source.rootIds[0];
    if (seenRoots.has(rootId)) continue;
    const native = [...e.target.enDesc].filter((w) => w.family === 'germanic' || w.family === 'norse').sort((a, b) => b.zipf - a.zipf)[0];
    if (!native) continue;
    const others = (g.rootWords[rootId] || [])
      .filter((w) => w.family !== 'germanic' && w.family !== 'norse' && w.rootIds[0] === rootId)
      .sort((a, b) => b.zipf - a.zipf);
    const pick = others.find((w) => w.family === 'latin') || others.find((w) => w.family === 'romance') || others[0];
    if (!pick) continue;
    seenRoots.add(rootId);
    out.push({ root: g.rootById[rootId], native, other: pick });
  }
  return out.sort((a, b) => b.native.zipf - a.native.zipf).slice(0, max);
}

// Primary path root → n, as a list of {node, edge}.
export function primaryPath(n) {
  const path = [];
  let cur = n;
  let guard = 0;
  while (cur && guard++ < 50) {
    const e = cur.inEdges.find((x) => x.primary) || null;
    path.unshift({ node: cur, edge: e });
    cur = e ? e.source : null;
  }
  return path;
}

// Every route from a root down to n (bridges have more than one), primary first.
export function allPaths(n, limit = 4) {
  const res = [];
  const walk = (x, acc) => {
    if (res.length >= limit) return;
    const next = [x, ...acc];
    if (!x.inEdges.length) {
      res.push(next);
      return;
    }
    const ins = [...x.inEdges].sort((a, b) => b.primary - a.primary);
    for (const e of ins) walk(e.source, next);
  };
  walk(n, []);
  return res.map((nodes) =>
    nodes.map((node, i) => ({ node, edge: i ? node.inEdges.find((e) => e.source === nodes[i - 1]) : null }))
  );
}

export function composition(g, minZipf) {
  const counts = Object.fromEntries(FAMILY_ORDER.map((f) => [f, 0]));
  let total = 0;
  let tokens = 0;
  const tokenShare = Object.fromEntries(FAMILY_ORDER.map((f) => [f, 0]));
  for (const w of g.words) {
    if (w.zipf < minZipf) continue;
    counts[w.family] = (counts[w.family] || 0) + 1;
    total++;
    const t = Math.pow(10, w.zipf); // frequency weight
    tokenShare[w.family] = (tokenShare[w.family] || 0) + t;
    tokens += t;
  }
  return { counts, total, tokenShare, tokens };
}
