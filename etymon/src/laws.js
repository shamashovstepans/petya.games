// The "rules": sound laws and other processes that reshaped words.
// Data lines tag the edge into a node with +id (for example +grimm.p).
// A tag with a dot is a sub-rule of the tag before the dot.

export const LAW_GROUPS = [
  { id: 'gmc', name: 'Germanic sound laws', blurb: 'Changes that made English sound Germanic, long before English existed.' },
  { id: 'eng', name: 'English changes', blurb: 'Rules that ran inside English itself and left fossils in today’s grammar and spelling.' },
  { id: 'rom', name: 'Latin & French', blurb: 'How Latin reshaped itself, and what French mouths did to it.' },
  { id: 'gk', name: 'Greek', blurb: 'Greek’s own regular changes.' },
  { id: 'misc', name: 'How words travel', blurb: 'Not sound laws, but recurring ways words are rebuilt.' },
];

export const LAWS = {
  // ---------------------------------------------------------------- Germanic
  grimm: {
    group: 'gmc', name: "Grimm's Law", era: [-1000, -500],
    rule: 'p t k → f þ h · b d g → p t k · bʰ dʰ gʰ → b d g',
    pairs: [['father','paternal'],['three','trio'],['heart','cardiac'],['two','dual'],['knee','genuflect'],['brother','fraternal'],['door','forum'],['guest','hostile'],['wheel','cycle'],['come','venue']],
    desc: 'Somewhere in northern Europe, in the first millennium BCE, the ancestors of the Germanic peoples shifted every stop consonant one step along a chain. It happened to every word at once, which is why Latin pater and English father still line up, letter for letter, with thousands of others. Jacob Grimm (of the fairy tales) described it in 1822.',
  },
  'grimm.p': { name: 'p → f', parent: 'grimm', from: 'p', to: 'f', ex: 'pater → father' , pairs: [['father','paternal'],['foot','pedal'],['fish','Pisces'],['five','pentagon'],['full','plenty'],['few','paucity'],['farrow','pork']] },
  'grimm.t': { name: 't → th', parent: 'grimm', from: 't', to: 'þ', ex: 'trēs → three' , pairs: [['three','trio'],['brother','fraternal'],['mother','maternal'],['tooth','dental']] },
  'grimm.k': { name: 'k → h', parent: 'grimm', from: 'k', to: 'h', ex: 'cornu → horn' , pairs: [['heart','cardiac'],['horn','cornucopia'],['hundred','century'],['head','capital'],['hound','canine'],['hell','conceal']] },
  'grimm.kw': { name: 'kʷ → hw', parent: 'grimm', from: 'kʷ', to: 'hw', ex: 'quis → who' , pairs: [['wheel','cycle'],['night','nocturnal'],['loan','relinquish']] },
  'grimm.b': { name: 'b → p', parent: 'grimm', from: 'b', to: 'p', ex: 'rare: PIE had few b’s' },
  'grimm.d': { name: 'd → t', parent: 'grimm', from: 'd', to: 't', ex: 'duo → two' , pairs: [['two','dual'],['ten','decimal'],['eat','edible'],['sit','session'],['water','hydrant'],['sweet','suave'],['tooth','dental']] },
  'grimm.g': { name: 'g → k', parent: 'grimm', from: 'g', to: 'k', ex: 'genu → knee' , pairs: [['knee','genuflect'],['know','cognition'],['kin','genus'],['corn','grain'],['acre','agriculture'],['choose','gusto']] },
  'grimm.gw': { name: 'gʷ → kw', parent: 'grimm', from: 'gʷ', to: 'kw', ex: 'venire → come' , pairs: [['come','venue'],['queen','gynecology'],['cow','bovine'],['quick','vital']] },
  'grimm.bh': { name: 'bʰ → b', parent: 'grimm', from: 'bʰ', to: 'b', ex: 'frāter → brother' , pairs: [['brother','fraternal'],['bear#carry','fertile'],['bloom','flower'],['bite','fission'],['be','future']] },
  'grimm.dh': { name: 'dʰ → d', parent: 'grimm', from: 'dʰ', to: 'd', ex: 'forēs → door' , pairs: [['door','forum'],['do','fact'],['word','verb'],['red','ruby'],['middle','medium']] },
  'grimm.gh': { name: 'gʰ → g', parent: 'grimm', from: 'gʰ', to: 'g', ex: 'hostis → guest' , pairs: [['guest','hostile'],['yard#garden','horticulture'],['yellow','chlorophyll'],['gall','cholera'],['gut','fusion']] },
  'grimm.gwh': { name: 'gʷʰ → g, w', parent: 'grimm', from: 'gʷʰ', to: 'g/w', ex: '*sneygʷʰ- → snow' , pairs: [['snow','Nevada']] },

  verner: {
    group: 'gmc', name: "Verner's Law", era: [-500, -200],
    rule: 'f þ h s → b d g z, when the accent did not fall just before',
    arrow: true,
    pairs: [['was','were']],
    desc: 'Grimm’s Law had exceptions, until Karl Verner noticed in 1875 that they depended on where the old accent fell. If the stress came after it, the new consonant was voiced. That is why father has a d-sound history (Old English fæder) while brother kept its th, and why English still says was but were.',
  },
  rhot: {
    group: 'gmc', name: 'Rhotacism', era: [-400, 300],
    rule: 's / z → r between vowels',
    desc: 'An s caught between vowels buzzed into z and then rolled into r. Latin did it (genus, generis; iūs, iūris → jury), and Germanic did it after Verner’s Law (was ~ were, lose ~ forlorn).',
  },
  ingv: {
    group: 'gmc', name: 'The lost n', era: [100, 500],
    rule: 'n before f, th, s vanishes; the vowel grows long',
    desc: 'On the North Sea coast, an n before f, th or s disappeared and lengthened the vowel. German, inland, kept it. So German Mund, Zahn, Gans, fünf, uns stand beside English mouth, tooth, goose, five, us.',
  },
  umlaut: {
    group: 'gmc', name: 'i-umlaut', era: [450, 700],
    rule: 'u o a → y e æ, when an i or j followed',
    arrow: true,
    pairs: [['foot','feet'],['tooth','teeth'],['goose','geese'],['mouse','mice'],['cow','kine'],['full','fill'],['sit','set'],['doom','deem'],['gold','gild'],['corn','kernel'],['whole','heal'],['book','beech'],['one','any'],['brother','brethren']],
    desc: 'In early Old English, an i or j in the next syllable pulled the stressed vowel forward in the mouth. Then the i itself wore away, leaving only the changed vowel. The rule died, but its results became grammar: foot ~ feet, mouse ~ mice, full ~ fill, food ~ feed, blood ~ bleed, gold ~ gild, old ~ elder. Today’s irregularity is yesterday’s regular rule.',
  },
  palatal: {
    group: 'eng', name: 'Palatalization', era: [450, 700],
    rule: 'k → ch · g → y · sk → sh, next to front vowels',
    desc: 'Old English softened k, g and sk beside front vowels: cirice → church, cild → child, geard → yard, scip → ship. The Vikings, who did not, later handed English the hard versions back: kirk beside church, skirt beside shirt, dike beside ditch, egg instead of ey.',
  },
  metath: {
    group: 'eng', name: 'Metathesis', era: [700, 1500],
    rule: 'neighbouring sounds swap places',
    desc: 'Sounds that sit together trade places: Old English brid became bird, þridda became third, hros became horse, wæps became wasp. Ask and aks were both Old English (ascian, acsian); the variant that won was a coin toss.',
  },
  dth: {
    group: 'eng', name: 'd → th before -er', era: [1400, 1550],
    rule: 'd → ð before -er',
    desc: 'In late Middle English, a d before an unstressed -er became the th of this: fæder → father, mōdor → mother, gaderian → gather, weder → weather.',
  },
  gvs: {
    group: 'eng', name: 'The Great Vowel Shift', era: [1400, 1700],
    rule: 'every long vowel climbs one step; the highest break into diphthongs',
    desc: 'Between Chaucer and Shakespeare, every long vowel in English moved up in the mouth, and the two highest broke into glides. Bite had sounded like beet, house like hoose, name like nahm. Printing arrived halfway through, freezing spellings that described the old sounds. That is why English vowel letters are named nothing like the vowels of every other language.',
  },
  'gvs.i': { name: 'iː → aɪ', parent: 'gvs', from: 'iː', to: 'aɪ', ex: 'bite: "beet" → "bite"' },
  'gvs.u': { name: 'uː → aʊ', parent: 'gvs', from: 'uː', to: 'aʊ', ex: 'house: "hoose" → "house"' },
  'gvs.e': { name: 'eː → iː', parent: 'gvs', from: 'eː', to: 'iː', ex: 'feet: "fate" → "feet"' },
  'gvs.ea': { name: 'ɛː → iː', parent: 'gvs', from: 'ɛː', to: 'iː', ex: 'meat: "mett" → "meet"' },
  'gvs.a': { name: 'aː → eɪ', parent: 'gvs', from: 'aː', to: 'eɪ', ex: 'name: "nahm" → "name"' },
  'gvs.o': { name: 'oː → uː', parent: 'gvs', from: 'oː', to: 'uː', ex: 'food: "fode" → "food"' },
  'gvs.oa': { name: 'ɔː → oʊ', parent: 'gvs', from: 'ɔː', to: 'oʊ', ex: 'boat: "bawt" → "boat"' },
  gh: {
    group: 'eng', name: 'Silent gh', era: [1400, 1650],
    rule: 'the throat sound /x/ fades or becomes f',
    desc: 'Night once rhymed with German Nacht. The rasping /x/ spelled gh faded away (night, light, daughter, though) or turned into f (laugh, tough, enough). The spelling stayed behind like a footprint.',
  },
  kn: {
    group: 'eng', name: 'Silent k, g, w', era: [1600, 1750],
    rule: 'kn- gn- wr- → n- n- r-',
    desc: 'Knight, knee and know were said with a k until the 1600s; gnaw with a g, write and wrong with a w. The letters stayed when the sounds left.',
  },
  respell: {
    group: 'eng', name: 'Respelled to look Latin', era: [1500, 1650],
    rule: 'letters added to show a Latin ancestor',
    desc: 'Renaissance scholars “fixed” French-shaped spellings to show off their Latin: dette became debt (dēbitum), doute became doubt (dubitāre), sotil became subtle. Sometimes they guessed wrong: island got its s from Latin insula, but it is a native word, Old English īegland.',
  },

  // ---------------------------------------------------------------- Latin & French
  'italic.f': {
    group: 'rom', name: 'Aspirates become f and h', era: [-1000, -500],
    rule: 'bʰ dʰ → f · gʰ → h, at the start of a word',
    pairs: [['brother','fraternal'],['bear#carry','fertile'],['bloom','flower'],['door','forum'],['guest','hostile']],
    desc: 'Where Germanic turned the breathy stops bʰ dʰ gʰ into plain b d g, early Latin turned them into f and h. So brother pairs with frāter, bear (carry) with ferre, door with forēs, guest with hostis.',
  },
  assim: {
    group: 'rom', name: 'Prefix assimilation', era: [-300, 100],
    rule: 'ad- in- con- ob- sub- copy the next consonant',
    desc: 'Latin prefixes melted into the consonant after them: ad+capere → accept, in+legālis → illegal, in+mortālis → immortal, con+legere → collect, ob+ferre → offer, sub+ferre → suffer. It is the reason English is full of doubled letters.',
  },
  fr: {
    group: 'rom', name: 'French erosion', era: [400, 1100],
    rule: 'unstressed syllables and middle consonants wear away',
    desc: 'Spoken for a thousand years in Gaul, Latin was worn smooth: rēgālis → royal, legālis → loyal, fragilis → frail, dignitātem → dainty, cōnsuere → sew. English often borrowed the same word twice: once worn down from French, once fresh from a Latin book.',
  },
  'fr.ka': {
    group: 'rom', name: 'ca- → cha-', era: [500, 900],
    rule: 'Latin ca-, ga- → French cha-, ja-',
    desc: 'Central French softened ca- to cha-: caput → chef, camera → chambre, cantāre → chanter. Norman French did not, so English got pairs: catch and chase (both captiāre), cattle and chattel (both capitāle).',
  },
  'fr.w': {
    group: 'rom', name: 'w- → gu-', era: [500, 900],
    rule: 'Frankish w- → French gu-',
    desc: 'French borrowed Germanic words with w- and could only say them as gw-, later g-. Norman French kept the w. English took both and kept a family of twins: ward and guard, warranty and guarantee, wise and guise, reward and regard.',
  },
  'fr.s': {
    group: 'rom', name: 'Lost s', era: [1100, 1300],
    rule: 's before a consonant falls silent (later: ^)',
    desc: 'French dropped s before consonants (hostel → hôtel, feste → fête, beste → bête), marking the gap later with a circumflex. English borrowed earlier and kept the s: hostel, feast, beast, forest.',
  },

  // ---------------------------------------------------------------- Greek
  'greek.h': {
    group: 'gk', name: 's- → h-', era: [-1700, -1200],
    rule: 's- at the start of a word → h-',
    desc: 'Greek breathed out its initial s: so Greek hex, hepta, hals, hēlios, hyper match Latin sex, septem, sal, sōl, super and English six, seven, salt, sun, over.',
  },
  'greek.asp': {
    group: 'gk', name: 'Aspirates become ph, th, kh', era: [-1700, -1200],
    rule: 'bʰ dʰ gʰ → pʰ tʰ kʰ',
    desc: 'Greek kept the breathiness of the PIE aspirates but made them voiceless: bʰ → ph, dʰ → th, gʰ → kh. That breath is why English spells Greek words with ph, th and ch.',
  },
  'greek.lab': {
    group: 'gk', name: 'kʷ → p, t', era: [-1600, -1200],
    rule: 'labiovelars split: kʷ → p, t or k',
    desc: 'Greek broke PIE kʷ three ways depending on the vowel after it: *pénkʷe → pente (five), *kʷékʷlos → kyklos (wheel, cycle). Same root, unrecognisable results.',
  },

  // ---------------------------------------------------------------- misc
  abl: {
    group: 'misc', name: 'Ablaut', era: [-4500, -2500],
    rule: 'one root, three vowel grades: e / o / none',
    desc: 'PIE roots changed their vowel to change their job: *sed- (sit) but *sod- (set). English still runs on it: sing sang sung song, ride rode road, bind band bond bundle. The strong verbs are the oldest grammar you use.',
  },
  calque: { group: 'misc', name: 'Loan translation', desc: 'A word copied piece by piece from another language: Greek phōsphoros “light-bearer” → Latin lūcifer.' },
  folk: { group: 'misc', name: 'Folk etymology', desc: 'Speakers rebuild a strange word out of familiar parts: Old English brȳdguma “bride-man” became bridegroom; femelle became female, to look like male.' },
  rebracket: { group: 'misc', name: 'Rebracketing', desc: 'An n hops across the article. An ekename (an extra name) became a nekename, our nickname; going the other way, a napron became an apron and a nadder became an adder.' },
  taboo: { group: 'misc', name: 'Taboo', desc: 'Some things were too dangerous to name. Germanic hunters stopped saying the bear’s real name and called it “the brown one”.' },
  sem: { group: 'misc', name: 'Meaning shift', desc: 'The form survives, the meaning wanders: nice once meant ignorant; silly meant blessed; deer meant any animal.' },
  clip: { group: 'misc', name: 'Clipping', desc: 'Long words cut short: mobile vulgus → mob, omnibus → bus.' },
};

export const LAW_IDS = Object.keys(LAWS);

export function lawRoot(id) {
  const l = LAWS[id];
  return l && l.parent ? l.parent : id;
}

export function lawLabel(id) {
  const l = LAWS[id];
  if (!l) return id;
  if (l.parent) return `${LAWS[l.parent].name}: ${l.name}`;
  return l.name;
}
