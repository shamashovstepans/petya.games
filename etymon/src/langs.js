// Languages, language families, colours and the time → radius scale.
//
// Every node in the graph carries a language code. The code decides:
//   - its family (and so its colour),
//   - its default date when the data does not give one,
//   - whether an edge into it is an inheritance or a borrowing (via PARENT_LANG).

// Family hues validated for CVD separation in this adjacency order on the
// dark ground #07080d (dataviz skill validator, adjacent pairs, all checks pass).
export const FAMILIES = {
  germanic: { name: 'Germanic', long: 'Germanic — the native core', color: '#2fae6d' },
  norse:    { name: 'Old Norse', long: 'Old Norse — the Viking layer', color: '#3b95d9' },
  celtic:   { name: 'Celtic', long: 'Celtic', color: '#d0694a' },
  slavic:   { name: 'Russian & Slavic', long: 'Russian and its Slavic relatives', color: '#8a9d22' },
  greek:    { name: 'Greek', long: 'Greek', color: '#7b72e8' },
  latin:    { name: 'Latin', long: 'Latin', color: '#e0457a' },
  romance:  { name: 'French & Romance', long: 'French, Italian, Spanish', color: '#bb8410' },
  indoiran: { name: 'Sanskrit & Persian', long: 'Sanskrit, Persian, Hindi', color: '#c55bc0' },
  other:    { name: 'Other languages', long: 'Celtic, Arabic, Chinese, Nahuatl and more', color: '#d0694a' },
  // neutrals
  root:     { name: 'Proto-Indo-European root', long: 'Reconstructed root', color: '#f3e6c4' },
  english:  { name: 'English', long: 'English', color: '#ece8df' },
};

// Order of sibling branches inside every root's wedge (also the legend order).
export const FAMILY_ORDER = ['germanic', 'norse', 'slavic', 'greek', 'latin', 'romance', 'indoiran', 'other'];

// code: [display name, family, default date (year; negative = BCE)]
// Family 'english' marks a stage of English itself: its colour is inherited
// from the route the word took (its nearest non-English ancestor).
const L = {
  PIE: ['Proto-Indo-European', 'root', -4000],

  // Germanic
  PGmc: ['Proto-Germanic', 'germanic', -500],
  PWGmc: ['Proto-West-Germanic', 'germanic', 200],
  Goth: ['Gothic', 'germanic', 350],
  Frk: ['Frankish', 'germanic', 450],
  OS: ['Old Saxon', 'germanic', 850],
  OHG: ['Old High German', 'germanic', 900],
  MHG: ['Middle High German', 'germanic', 1200],
  G: ['German', 'germanic', 1750],
  OFris: ['Old Frisian', 'germanic', 1200],
  MDu: ['Middle Dutch', 'germanic', 1300],
  Du: ['Dutch', 'germanic', 1600],
  MLG: ['Middle Low German', 'germanic', 1400],
  LG: ['Low German', 'germanic', 1600],
  Yid: ['Yiddish', 'germanic', 1800],
  Sc: ['Scots', 'english', 1500],
  OE: ['Old English', 'english', 800],
  ME: ['Middle English', 'english', 1250],
  EModE: ['Early Modern English', 'english', 1550],
  En: ['English', 'english', 1500],
  ODu: ['Old Dutch', 'germanic', 900],
  Fris: ['West Frisian', 'germanic', 1800],
  Afr: ['Afrikaans', 'germanic', 1850],

  // Norse
  PNor: ['Proto-Norse', 'norse', 300],
  ON: ['Old Norse', 'norse', 900],
  ONor: ['Old Norwegian', 'norse', 1200],
  OSw: ['Old Swedish', 'norse', 1300],
  ODa: ['Old Danish', 'norse', 1300],
  Ice: ['Icelandic', 'norse', 1600],
  Fae: ['Faroese', 'norse', 1800],
  Da: ['Danish', 'norse', 1600],
  Sw: ['Swedish', 'norse', 1600],
  No: ['Norwegian', 'norse', 1750],

  // Celtic
  PCel: ['Proto-Celtic', 'other', -500],
  Gaul: ['Gaulish', 'other', -100],
  OIr: ['Old Irish', 'other', 750],
  MIr: ['Middle Irish', 'other', 1100],
  Ir: ['Irish', 'other', 1600],
  ScG: ['Scottish Gaelic', 'other', 1600],
  Manx: ['Manx', 'other', 1700],
  PBry: ['Proto-Brythonic', 'other', 300],
  OW: ['Old Welsh', 'other', 900],
  MW: ['Middle Welsh', 'other', 1200],
  W: ['Welsh', 'other', 1300],
  Corn: ['Cornish', 'other', 1500],
  Bret: ['Breton', 'other', 1500],

  // Greek
  PHel: ['Proto-Hellenic', 'greek', -1700],
  Myc: ['Mycenaean Greek', 'greek', -1400],
  Gk: ['Ancient Greek', 'greek', -500],
  LGk: ['Koine Greek', 'greek', 200],
  Byz: ['Byzantine Greek', 'greek', 900],
  MGk: ['Modern Greek', 'greek', 1900],

  // Latin
  PIt: ['Proto-Italic', 'latin', -1000],
  Osc: ['Oscan', 'latin', -300],
  Umb: ['Umbrian', 'latin', -300],
  OLat: ['Old Latin', 'latin', -300],
  Lat: ['Latin', 'latin', -100],
  VL: ['Vulgar Latin', 'latin', 300],
  LL: ['Late Latin', 'latin', 400],
  ML: ['Medieval Latin', 'latin', 1000],
  NL: ['New Latin', 'latin', 1650],

  // Romance
  OFr: ['Old French', 'romance', 1100],
  ONF: ['Old Northern French', 'romance', 1100],
  AN: ['Anglo-Norman', 'romance', 1150],
  MFr: ['Middle French', 'romance', 1450],
  Fr: ['French', 'romance', 1700],
  Prov: ['Old Occitan', 'romance', 1200],
  Occ: ['Occitan', 'romance', 1800],
  OIt: ['Old Italian', 'romance', 1250],
  It: ['Italian', 'romance', 1500],
  Ven: ['Venetian', 'romance', 1400],
  OSp: ['Old Spanish', 'romance', 1200],
  Sp: ['Spanish', 'romance', 1500],
  OPt: ['Old Galician-Portuguese', 'romance', 1250],
  Pt: ['Portuguese', 'romance', 1500],
  Cat: ['Catalan', 'romance', 1400],
  Ro: ['Romanian', 'romance', 1700],

  // Indo-Iranian
  PIIr: ['Proto-Indo-Iranian', 'indoiran', -2200],
  PIAr: ['Proto-Indo-Aryan', 'indoiran', -1800],
  Skt: ['Sanskrit', 'indoiran', -1000],
  Pali: ['Pali', 'indoiran', -300],
  Pkt: ['Prakrit', 'indoiran', 200],
  Hi: ['Hindi', 'indoiran', 1700],
  Ur: ['Urdu', 'indoiran', 1700],
  Hnd: ['Hindustani', 'indoiran', 1700],
  Beng: ['Bengali', 'indoiran', 1700],
  Pan: ['Punjabi', 'indoiran', 1700],
  Mar: ['Marathi', 'indoiran', 1700],
  Rom: ['Romani', 'indoiran', 1800],
  PIr: ['Proto-Iranian', 'indoiran', -1500],
  Av: ['Avestan', 'indoiran', -800],
  OPer: ['Old Persian', 'indoiran', -500],
  MPer: ['Middle Persian', 'indoiran', 400],
  Per: ['Persian', 'indoiran', 1000],

  // Balto-Slavic (folded into "other" colour; few words)
  PBSl: ['Proto-Balto-Slavic', 'slavic', -1500],
  PSl: ['Proto-Slavic', 'slavic', 500],
  OCS: ['Old Church Slavonic', 'slavic', 900],
  OES: ['Old East Slavic', 'slavic', 1100],
  MRu: ['Middle Russian', 'slavic', 1550],
  Ru: ['Russian', 'slavic', 1050],
  Uk: ['Ukrainian', 'slavic', 1800],
  Bel: ['Belarusian', 'slavic', 1800],
  Cz: ['Czech', 'slavic', 1900],
  Slk: ['Slovak', 'slavic', 1800],
  Pol: ['Polish', 'slavic', 1700],
  Slv: ['Slovene', 'slavic', 1800],
  Bul: ['Bulgarian', 'slavic', 1800],
  SC: ['Serbo-Croatian', 'slavic', 1400],
  Lith: ['Lithuanian', 'other', 1600],
  Latv: ['Latvian', 'other', 1600],
  OPru: ['Old Prussian', 'other', 1400],

  // other Indo-European branches
  Hit: ['Hittite', 'other', -1600],
  OArm: ['Old Armenian', 'other', 450],
  Arm: ['Armenian', 'other', 1800],
  Alb: ['Albanian', 'other', 1600],
  TochA: ['Tocharian A', 'other', 600],
  TochB: ['Tocharian B', 'other', 600],

  // Beyond Indo-European
  Hu: ['Hungarian', 'other', 1450],
  Fin: ['Finnish', 'other', 1700],
  Est: ['Estonian', 'other', 1700],
  Basq: ['Basque', 'other', 1600],
  Geo: ['Georgian', 'other', 1200],
  Ar: ['Arabic', 'other', 700],
  Heb: ['Hebrew', 'other', -500],
  Aram: ['Aramaic', 'other', -300],
  Syr: ['Classical Syriac', 'other', 400],
  Phn: ['Phoenician', 'other', -800],
  Akk: ['Akkadian', 'other', -1500],
  Sum: ['Sumerian', 'other', -2500],
  Egy: ['Egyptian', 'other', -1500],
  Copt: ['Coptic', 'other', 300],
  OTr: ['Ottoman Turkish', 'other', 1500],
  Tr: ['Turkish', 'other', 1700],
  Mong: ['Mongolian', 'other', 1700],
  OC: ['Old Chinese', 'other', -800],
  MC: ['Middle Chinese', 'other', 700],
  Mand: ['Mandarin', 'other', 1800],
  Chin: ['Chinese', 'other', 1500],
  Min: ['Min Chinese (Hokkien)', 'other', 1600],
  Cant: ['Cantonese', 'other', 1700],
  Ja: ['Japanese', 'other', 1800],
  Ko: ['Korean', 'other', 1800],
  Viet: ['Vietnamese', 'other', 1800],
  Thai: ['Thai', 'other', 1800],
  Tib: ['Tibetan', 'other', 1200],
  Tam: ['Tamil', 'other', 500],
  Tel: ['Telugu', 'other', 1500],
  Mal: ['Malayalam', 'other', 1500],
  Kan: ['Kannada', 'other', 1500],
  Drav: ['Dravidian', 'other', -500],
  Malay: ['Malay', 'other', 1500],
  Indo: ['Indonesian', 'other', 1900],
  Tag: ['Tagalog', 'other', 1800],
  Haw: ['Hawaiian', 'other', 1800],
  Maori: ['Māori', 'other', 1800],
  Swa: ['Swahili', 'other', 1800],
  Zulu: ['Zulu', 'other', 1850],
  Yor: ['Yoruba', 'other', 1850],
  Nah: ['Nahuatl', 'other', 1400],
  Taino: ['Taíno', 'other', 1450],
  Quech: ['Quechua', 'other', 1550],
  Tupi: ['Old Tupi', 'other', 1550],
  Guar: ['Guarani', 'other', 1600],
  Ojib: ['Ojibwe', 'other', 1700],
  Inuk: ['Inuktitut', 'other', 1800],
};

export const LANGS = Object.fromEntries(
  Object.entries(L).map(([code, [name, family, date]]) => [code, { code, name, family, date }])
);

// Ancestry between languages: an edge parent → child is an inheritance when the
// parent's language is an ancestor of the child's language; otherwise a borrowing.
export const PARENT_LANG = {
  PGmc: 'PIE', PWGmc: 'PGmc', Goth: 'PGmc', ON: 'PGmc', Frk: 'PWGmc', OS: 'PWGmc', OHG: 'PWGmc',
  MHG: 'OHG', G: 'MHG', Yid: 'MHG', OFris: 'PWGmc', MDu: 'PWGmc', Du: 'MDu', MLG: 'OS', LG: 'MLG',
  OE: 'PWGmc', ME: 'OE', EModE: 'ME', En: 'EModE', Sc: 'ME',
  ONor: 'ON', Ice: 'ON', Da: 'ON', Sw: 'ON', No: 'ONor',
  PCel: 'PIE', Gaul: 'PCel', OIr: 'PCel', MIr: 'OIr', Ir: 'MIr', ScG: 'MIr', OW: 'PCel', W: 'OW', Bret: 'PCel',
  Myc: 'PIE', Gk: 'PIE', LGk: 'Gk', Byz: 'LGk', MGk: 'Byz',
  PIt: 'PIE', OLat: 'PIt', Lat: 'OLat', VL: 'Lat', LL: 'Lat', ML: 'LL', NL: 'ML',
  OFr: 'VL', ONF: 'VL', AN: 'OFr', MFr: 'OFr', Fr: 'MFr', Prov: 'VL', It: 'VL', Ven: 'VL', Sp: 'VL', Pt: 'VL', Cat: 'VL',
  Skt: 'PIE', Pali: 'Skt', Pkt: 'Skt', Hi: 'Pkt', Ur: 'Pkt', Av: 'PIE', OPer: 'PIE', MPer: 'OPer', Per: 'MPer',
  PSl: 'PIE', OCS: 'PSl', Ru: 'PSl', Cz: 'PSl', Pol: 'PSl', Lith: 'PIE',
  Tr: 'OTr', SC: 'PSl',
  // languages added for the Wiktionary import
  ODu: 'PWGmc', Fris: 'OFris', Afr: 'Du', PNor: 'PGmc', OSw: 'ON', ODa: 'ON', Fae: 'ON',
  Manx: 'MIr', PBry: 'PCel', MW: 'OW', Corn: 'PBry',
  PHel: 'PIE', Osc: 'PIt', Umb: 'PIt',
  Occ: 'Prov', OIt: 'VL', OSp: 'VL', OPt: 'VL', Ro: 'VL',
  PIIr: 'PIE', PIAr: 'PIIr', PIr: 'PIIr', Hnd: 'Pkt', Beng: 'Pkt', Pan: 'Pkt', Mar: 'Pkt', Rom: 'Pkt',
  PBSl: 'PIE', OES: 'PSl', MRu: 'OES', Uk: 'OES', Bel: 'OES', Slk: 'PSl', Slv: 'PSl', Bul: 'PSl',
  Latv: 'PBSl', OPru: 'PBSl', OArm: 'PIE', Arm: 'OArm',
  Chin: 'MC', Mand: 'MC', Indo: 'Malay',
};
// Proto-Slavic and the Baltic languages share Proto-Balto-Slavic; Gk, Skt and
// the Iranian languages sit under their own proto-languages. Re-parent them
// here rather than above so the original links stay easy to read.
Object.assign(PARENT_LANG, {
  PSl: 'PBSl', Lith: 'PBSl', Gk: 'PHel', Myc: 'PHel', Skt: 'PIAr', Av: 'PIr', OPer: 'PIr',
  ON: 'PNor', Ice: 'ON', OW: 'PBry', Bret: 'PBry', Ru: 'OES', MC: 'OC',
});

export function isAncestorLang(a, b) {
  let cur = PARENT_LANG[b];
  let guard = 0;
  while (cur && guard++ < 20) {
    if (cur === a) return true;
    cur = PARENT_LANG[cur];
  }
  return false;
}

export const ENGLISH_STAGES = new Set(['OE', 'ME', 'EModE', 'En', 'Sc']);

// ---------------------------------------------------------------------------
// Time → radius. Radius is time: the centre is the deep past, the rim is now.
// Piecewise-linear so that 6,000 years fit while English history (450 → now)
// gets the outer 60% of the disc.
export const TIME_ANCHORS = [
  [-4500, 0.045],
  [-4000, 0.12],
  [-2500, 0.17],
  [-1000, 0.225],
  [-500, 0.265],
  [0, 0.315],
  [450, 0.395],
  [800, 0.465],
  [1066, 0.53],
  [1300, 0.61],
  [1500, 0.69],
  [1700, 0.79],
  [1900, 0.905],
  [2025, 1.0],
];

export const T_MIN = TIME_ANCHORS[0][0];
export const T_MAX = TIME_ANCHORS[TIME_ANCHORS.length - 1][0];

export function timeToR(year) {
  const A = TIME_ANCHORS;
  if (year <= A[0][0]) return A[0][1];
  if (year >= A[A.length - 1][0]) return A[A.length - 1][1];
  for (let i = 1; i < A.length; i++) {
    if (year <= A[i][0]) {
      const [t0, r0] = A[i - 1];
      const [t1, r1] = A[i];
      return r0 + ((year - t0) / (t1 - t0)) * (r1 - r0);
    }
  }
  return 1;
}

export function rToTime(r) {
  const A = TIME_ANCHORS;
  if (r <= A[0][1]) return A[0][0];
  if (r >= A[A.length - 1][1]) return A[A.length - 1][0];
  for (let i = 1; i < A.length; i++) {
    if (r <= A[i][1]) {
      const [t0, r0] = A[i - 1];
      const [t1, r1] = A[i];
      return t0 + ((r - r0) / (r1 - r0)) * (t1 - t0);
    }
  }
  return T_MAX;
}

export function formatYear(y, { approx = false } = {}) {
  const yr = Math.round(y);
  const c = approx ? 'c. ' : '';
  if (yr < 0) return `${c}${Math.abs(yr).toLocaleString('en-US')} BCE`;
  if (yr >= T_MAX) return 'now';
  return `${c}${yr}`;
}

// Semantic domains: sectors around the circle, in this order (clockwise from top).
export const DOMAINS = [
  { id: 'body', name: 'Body & senses' },
  { id: 'kin', name: 'Kin, home & rule' },
  { id: 'number', name: 'Number & measure' },
  { id: 'nature', name: 'Sky, earth & light' },
  { id: 'beast', name: 'Beasts & food' },
  { id: 'mind', name: 'Mind & speech' },
  { id: 'motion', name: 'Motion & making' },
  { id: 'being', name: 'Being & time' },
  { id: 'wander', name: 'Wanderers' },
];
