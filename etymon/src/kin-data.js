// Etymon, languages: the cognate data (data/kin/, built by tools/import/kin.py), decoded.
// Every form is one node; nodes are stored family by family, root first, parents before children.

const BASE = new URL('../data/kin/', import.meta.url);

// kin.json -> flat arrays
export function decodeKin(d) {
  const form = d.form.split('\n');
  const tr = d.tr.split('\n');
  const N = form.length, F = d.start.length - 1;
  const start = Int32Array.from(d.start);
  const fam = new Uint16Array(N);
  const par = new Int32Array(N);
  for (let f = 0; f < F; f++) {
    for (let i = start[f]; i < start[f + 1]; i++) {
      fam[i] = f;
      par[i] = d.parent[i] ? i - d.parent[i] : -1;
    }
  }

  const branches = d.branches.map(([key, name, color], i) => ({ i, key, name, color }));
  const branchOf = new Map();
  for (const b of branches) if (!branchOf.has(b.key)) branchOf.set(b.key, b.i);

  const stations = d.stations.map(([id, name, parent, date, branch, group, count], i) => ({
    i, id, name, parent, date, branch: branchOf.get(branch) ?? branches.length - 1, group, count, kids: [],
  }));
  // a language's address: its short name in lower case, or its full name where two short names
  // differ only by case (Sc Scots, SC Serbo-Croatian). Full names work as addresses too.
  const byId = new Map();
  const plain = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  for (const s of stations) {
    const k = s.id.toLowerCase();
    s.slug = byId.has(k) ? plain(s.name) : k;
    byId.set(s.slug, s.i);
    if (s.parent >= 0) stations[s.parent].kids.push(s.i);
  }
  for (const s of stations) if (!byId.has(plain(s.name))) byId.set(plain(s.name), s.i);

  return {
    N, F, start, fam, par,
    st: Uint8Array.from(d.st),
    rel: d.rel, src: d.src, rank: d.rank,
    dbl: d.dbl || [],   // pairs of forms the dictionary itself calls doublets
    form, tr, stations, branches, byId,
    // what to print for a node: the word itself, with its transliteration when it has one
    text(i) { return form[i]; },
    roman(i) { return tr[i] || form[i]; },
  };
}

export async function loadKin() {
  const res = await fetch(new URL('kin.json', BASE));
  if (!res.ok) throw new Error(`kin.json: ${res.status}`);
  const K = decodeKin(await res.json());
  let gloss = null;
  // meanings are a second file, fetched the first time a card needs one
  K.loadGloss = () => (gloss ||= fetch(new URL('gloss.json', BASE))
    .then((r) => (r.ok ? r.json() : { gloss: '' }))
    .then((j) => j.gloss.split('\n'))
    .catch(() => []));
  return K;
}
