// Parser for the root-tree data language (see DATA_FORMAT.md).
// Pure: no DOM, runs in the browser and in node (tools/validate.mjs).

import { LANGS, ENGLISH_STAGES, isAncestorLang } from './langs.js';
import { LAWS } from './laws.js';

export function parseAll(sources) {
  const g = {
    roots: [], nodes: [], edges: [],
    errors: [], warnings: [],
  };
  const err = (where, msg) => g.errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => g.warnings.push(`${where}: ${msg}`);

  const enByKey = new Map();
  const byLangForm = new Map();
  const rootIds = new Set();
  let nid = 0;
  let eid = 0;

  const mkNode = (props) => {
    const n = {
      id: nid++, parents: [], children: [], inEdges: [], outEdges: [], tags: [],
      ...props,
    };
    g.nodes.push(n);
    return n;
  };

  const addEdge = (parent, child, body, where) => {
    if (parent === child) { err(where, 'node cannot be its own parent'); return; }
    if (child.parents.includes(parent)) {
      if (!body.ref) warn(where, `duplicate edge ${parent.form} → ${child.form}`);
      return;
    }
    const e = {
      id: eid++, source: parent, target: child,
      tags: body.tags || [], uncertain: !!body.uncertain,
      primary: child.parents.length === 0,
      kind: edgeKind(parent, child),
      where,
    };
    child.parents.push(parent);
    child.inEdges.push(e);
    parent.children.push(child);
    parent.outEdges.push(e);
    g.edges.push(e);
    return e;
  };

  for (const src of sources) {
    const lines = src.text.split('\n');
    let root = null;
    let stack = [];
    let last = null;

    lines.forEach((raw, i) => {
      const where = `${src.name}:${i + 1}`;
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) return;
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) return;

      if (trimmed.startsWith('>')) {
        if (!last) { err(where, 'note before any node'); return; }
        const t = trimmed.slice(1).trim();
        last.note = last.note ? `${last.note} ${t}` : t;
        return;
      }

      if (/^\t/.test(raw)) { err(where, 'tab indentation (use two spaces)'); return; }

      if (trimmed.startsWith('@attach ')) {
        // "@attach rootId" or "@attach rootId > LANG form": add the lines below to an existing tree
        const a = trimmed.match(/^@attach\s+(\S+)(?:\s*>\s*(\S+)\s+(.+))?$/);
        const r = a && g.roots.find((x) => x.id === a[1]);
        let target = r ? r.node : null;
        if (target && a[2]) target = byLangForm.get(`${a[2]}|${a[3].trim()}`) || null;
        if (!target) {
          err(where, `cannot attach: ${trimmed}`);
          root = null;
          return;
        }
        root = target;
        stack = [];
        last = target;
        return;
      }

      if (trimmed.startsWith('@')) {
        const m = trimmed.match(/^@(\S+)\s+(.*)$/);
        if (!m) { err(where, 'bad root header'); return; }
        const id = m[1];
        if (rootIds.has(id)) err(where, `duplicate root id @${id}`);
        rootIds.add(id);
        const body = parseBody(m[2], where, err, warn);
        if (!body) { root = null; return; }
        if (!body.domain) err(where, `root @${id} has no %domain`);
        root = mkNode({
          lang: body.lang, form: body.form, display: body.display, gloss: body.gloss,
          date: body.date ?? LANGS[body.lang].date, dateExplicit: true,
          tags: body.tags, uncertain: body.uncertain, star: body.star,
          isRoot: true, rootKey: id, domain: body.domain, source: src.name,
        });
        g.roots.push({ id, node: root, domain: body.domain, source: src.name });
        stack = [];
        last = root;
        return;
      }

      if (!root) { err(where, 'node line before any @root header'); return; }
      const indent = line.match(/^ */)[0].length;
      if (indent % 2) { err(where, `odd indentation (${indent} spaces)`); return; }
      const level = indent / 2;
      if (level > stack.length) {
        err(where, `indentation jumps a level (got level ${level}, max ${stack.length})`);
        return;
      }
      const parent = level === 0 ? root : stack[level - 1];
      const body = parseBody(trimmed, where, err, warn);
      if (!body) return;

      let node;
      if (body.lang === 'En') {
        node = enByKey.get(body.key);
        if (node) {
          // the same English word reached from a second ancestor: a bridge
          if (node.zipf == null && body.zipf != null) node.zipf = body.zipf;
          if (!node.gloss && body.gloss) node.gloss = body.gloss;
          if (body.star) node.star = true;
        } else {
          node = mkNode({
            lang: 'En', form: body.form, display: body.display, key: body.key, gloss: body.gloss,
            date: resolveDate(body, parent, where, warn), dateExplicit: body.date != null, zipf: body.zipf, star: body.star,
            died: body.died, uncertain: body.uncertain, source: src.name, where,
          });
          enByKey.set(body.key, node);
        }
      } else if (body.ref) {
        node = byLangForm.get(`${body.lang}|${body.form}`);
        if (!node) { err(where, `& reference not found: ${body.lang} ${body.form}`); return; }
      } else {
        node = mkNode({
          lang: body.lang, form: body.form, display: body.display, gloss: body.gloss,
          date: resolveDate(body, parent, where, warn), dateExplicit: body.date != null, died: body.died, star: body.star,
          uncertain: body.uncertain, source: src.name, where,
        });
        const k = `${body.lang}|${body.form}`;
        if (!byLangForm.has(k)) byLangForm.set(k, node);
      }
      addEdge(parent, node, body, where);
      stack[level] = node;
      stack.length = level + 1;
      last = node;
    });
  }

  postProcess(g, warn);
  return g;
}

function resolveDate(body, parent, where, warn) {
  const def = LANGS[body.lang].date;
  if (body.date != null) return body.date;
  if (body.lang === 'En') {
    if (parent && ENGLISH_STAGES.has(parent.lang)) return Math.max(parent.date, 0);
    warn(where, `English borrowing "${body.form}" has no @date`);
    return Math.max(def, parent ? parent.date : def);
  }
  if (parent && def < parent.date) return parent.date;
  return def;
}

// Default dates are rough; attested dates are not. When a child is attested
// before its parent's default date, pull the parent back. When the parent's
// date is explicit too, the data is inconsistent: warn and clamp the child.
function reconcileDates(g, warn) {
  for (let pass = 0; pass < 12; pass++) {
    let changed = false;
    for (const e of g.edges) {
      const p = e.source, c = e.target;
      if (c.date >= p.date) continue;
      if (!p.dateExplicit && !p.isRoot) { p.date = c.date; changed = true; }
    }
    if (!changed) break;
  }
  // forward pass: no child earlier than any parent (needed by the layout)
  const order = topo(g);
  for (const c of order) {
    for (const e of c.inEdges) {
      if (c.date < e.source.date) {
        if (c.dateExplicit) warn(c.where || '?', `${c.form} (${c.date}) is dated before its parent ${e.source.form} (${e.source.date})`);
        c.date = e.source.date;
      }
    }
  }
}

function topo(g) {
  const indeg = new Map(g.nodes.map((n) => [n, n.inEdges.length]));
  const q = g.nodes.filter((n) => n.inEdges.length === 0);
  const out = [];
  while (q.length) {
    const n = q.shift();
    out.push(n);
    for (const e of n.outEdges) {
      indeg.set(e.target, indeg.get(e.target) - 1);
      if (indeg.get(e.target) === 0) q.push(e.target);
    }
  }
  return out;
}

function edgeKind(a, b) {
  if (a.lang === b.lang) return 'derive';
  if (ENGLISH_STAGES.has(a.lang) && ENGLISH_STAGES.has(b.lang)) return 'inherit';
  if (isAncestorLang(a.lang, b.lang)) return 'inherit';
  return 'borrow';
}

export function parseBody(text, where, err, warn) {
  const sp = text.indexOf(' ');
  if (sp < 0) { err(where, `missing form in "${text}"`); return null; }
  const lang = text.slice(0, sp);
  if (!LANGS[lang]) { err(where, `unknown language code "${lang}"`); return null; }
  let rest = text.slice(sp + 1).trim();
  let meta = '';
  const mi = rest.indexOf(' |');
  if (mi >= 0) {
    meta = rest.slice(mi + 2).trim();
    rest = rest.slice(0, mi).trim();
  }
  let form = rest;
  let gloss = '';
  const gi = rest.indexOf(' :: ');
  if (gi >= 0) {
    form = rest.slice(0, gi).trim();
    gloss = rest.slice(gi + 4).trim();
  }
  if (!form) { err(where, 'empty form'); return null; }
  const out = { lang, form, gloss, tags: [], uncertain: false, ref: false, star: false };
  for (const tok of meta.split(/\s+/).filter(Boolean)) {
    if (/^@-?\d+$/.test(tok)) out.date = parseInt(tok.slice(1), 10);
    else if (/^z\d+(\.\d+)?$/.test(tok)) out.zipf = parseFloat(tok.slice(1));
    else if (tok.startsWith('+')) {
      const t = tok.slice(1);
      if (!LAWS[t]) warn(where, `unknown tag +${t}`);
      out.tags.push(t);
    } else if (tok === '?') out.uncertain = true;
    else if (tok.startsWith('†')) out.died = tok.length > 1 ? parseInt(tok.slice(1), 10) : 1500;
    else if (tok === '&') out.ref = true;
    else if (tok === '!') out.star = true;
    else if (tok.startsWith('%')) out.domain = tok.slice(1);
    else warn(where, `unknown token "${tok}"`);
  }
  // "bear#carry" keeps homonyms apart; only the part before # is shown
  const hi = form.indexOf('#');
  out.display = hi >= 0 ? form.slice(0, hi) : form;
  if (lang === 'En') {
    out.key = form;
    if (out.zipf == null) warn(where, `English word "${form}" has no z-frequency`);
  }
  return out;
}

function postProcess(g, warn) {
  reconcileDates(g, warn);

  // Family / colour: stages of English take the family of the route the word took.
  const famOf = (n, guard = 0) => {
    if (n._fam) return n._fam;
    let f;
    if (ENGLISH_STAGES.has(n.lang)) {
      const p = n.parents[0];
      if (!p || guard > 40) f = 'germanic';
      else {
        const pf = famOf(p, guard + 1);
        f = pf === 'root' ? 'germanic' : pf;
      }
    } else {
      f = LANGS[n.lang].family;
    }
    n._fam = f;
    return f;
  };
  for (const n of g.nodes) n.family = famOf(n);

  // Root membership, propagated downward through every edge.
  for (const n of g.nodes) n.rootIds = new Set();
  for (const r of g.roots) {
    const q = [r.node];
    while (q.length) {
      const n = q.pop();
      if (n.rootIds.has(r.id)) continue;
      n.rootIds.add(r.id);
      for (const c of n.children) q.push(c);
    }
  }
  for (const n of g.nodes) {
    n.isEn = n.lang === 'En';
    n.rootIds = [...n.rootIds];
    n.root = n.rootIds[0];
    if (n.isEn && n.zipf == null) n.zipf = 2.5;
  }

  // Primary-tree depth.
  for (const r of g.roots) {
    const q = [[r.node, 0]];
    while (q.length) {
      const [n, d] = q.pop();
      if (n.depth != null && n.depth <= d) continue;
      n.depth = d;
      for (const e of n.outEdges) if (e.primary) q.push([e.target, d + 1]);
    }
  }

  g.bridges = g.nodes.filter((n) => n.isEn && n.rootIds.length > 1);
  g.words = g.nodes.filter((n) => n.isEn);
  g.rootById = Object.fromEntries(g.roots.map((r) => [r.id, r]));
  for (const n of g.nodes) {
    if (!n.isRoot && n.parents.length === 0) warn(n.where || '?', `orphan node ${n.form}`);
  }
}
