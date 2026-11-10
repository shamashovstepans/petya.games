// Timeline eras, captioned events, and guided stories.

export const ERAS = [
  { from: -4500, to: -2500, name: 'Proto-Indo-European' },
  { from: -2500, to: -500, name: 'Daughter languages' },
  { from: -500, to: 450, name: 'Classical' },
  { from: 450, to: 1100, name: 'Old English' },
  { from: 1100, to: 1500, name: 'Middle English' },
  { from: 1500, to: 1700, name: 'Early Modern' },
  { from: 1700, to: 2025, name: 'Modern' },
];

// Rings drawn on the disc, with their labels.
export const RINGS = [
  { year: -4000, label: '4000 BCE' },
  { year: -500, label: '500 BCE' },
  { year: 450, label: '450' },
  { year: 1066, label: '1066' },
  { year: 1500, label: '1500' },
  { year: 1700, label: '1700' },
  { year: 1900, label: '1900' },
];

// Captions shown while time plays. `law` pulses that law's edges.
export const EVENTS = [
  {
    year: -4500, title: 'Proto-Indo-European',
    text: 'North of the Black Sea, herders speak a language nobody ever wrote down. Every root at the centre is reconstructed from its descendants; the asterisk marks a word no one has seen.',
  },
  {
    year: -3300, title: 'Younger than the wheel',
    text: 'The language had words for wheel, axle and wagon, so it was still spoken after the wheel was invented.',
  },
  {
    year: -2400, title: 'The family scatters',
    text: 'Daughter languages drift west into Europe and east toward Iran and India, each changing in its own regular ways.',
  },
  {
    year: -800, title: "Grimm's Law", law: 'grimm',
    text: 'In the Germanic north every stop consonant shifts one step: p becomes f, t becomes th, k becomes h. Pater turns into father.',
  },
  {
    year: -300, title: "Verner's Law", law: 'verner',
    text: 'Where the old accent fell later in the word, the new consonants were voiced. That is why English says was but were.',
  },
  {
    year: 100, title: 'Trading with Rome',
    text: 'Germanic tribes borrow street, wine, pound, mint and kitchen from Latin traders, centuries before English exists.',
  },
  {
    year: 449, title: 'English begins',
    text: 'Angles, Saxons and Jutes cross the North Sea. Their dialects become Old English.',
  },
  {
    year: 600, title: 'i-umlaut', law: 'umlaut',
    text: 'An i in the next syllable pulls the vowel forward, then vanishes: fōtiz becomes fēt, our feet. A rule dies and leaves grammar behind.',
  },
  {
    year: 793, title: 'The Vikings',
    text: 'Raids begin at Lindisfarne. Norse settlers lend everyday words: sister, egg, guest, window, husband, birth, trust.',
  },
  {
    year: 1066, title: 'The Norman Conquest',
    text: 'For three centuries England’s rulers speak French. The kitchen stays English (cow, swine, calf); the table turns French (beef, pork, veal).',
  },
  {
    year: 1362, title: 'English returns',
    text: 'After the Black Death, English replaces French in the law courts. Chaucer begins the Canterbury Tales.',
  },
  {
    year: 1420, title: 'The Great Vowel Shift', law: 'gvs',
    text: 'Every long vowel climbs. Bite had sounded like beet, house like hoose, name like nahm.',
  },
  {
    year: 1476, title: 'The printing press',
    text: 'Caxton’s press fixes spellings in the middle of the vowel shift. The letters stop; the sounds keep moving.',
  },
  {
    year: 1560, title: 'The Renaissance', law: 'respell',
    text: 'Scholars pour in Latin and Greek, and re-spell old words to look Latin: doute becomes doubt, dette becomes debt.',
  },
  {
    year: 1755, title: 'Johnson’s Dictionary',
    text: 'Samuel Johnson defines 42,000 words, and spelling settles into roughly the shape it has today.',
  },
  {
    year: 1830, title: 'Words from everywhere',
    text: 'Trade and empire bring shampoo, pyjamas, ketchup and tycoon. Science names the new in old Greek: telegraph, photograph.',
  },
  {
    year: 1990, title: 'Now',
    text: 'Television, video, robot: the newest words are built from roots six thousand years old.',
  },
];

// Guided stories. `words` are word keys; `law`, `family`, `minZipf` set other lenses.
export const STORIES = [
  {
    id: 'doors',
    title: 'One root, many doors',
    lede: 'English met *ped-, "foot", at least seven times.',
    text: [
      'Inherited from Proto-Germanic, it became foot. Grimm’s Law had already turned its p into f and its d into t.',
      'Latin pēs, pedis came in as pedal and pedestrian; worn down by French as pioneer, pawn, impeach and pedigree. Greek pous, podos gave podium, octopus and tripod — and through Latin podium, the church pew. Persian pāy, leg, gave pyjamas.',
      'Seven routes, one ancestor. Hover any word on the rim to see its other doors.',
    ],
    words: ['foot', 'feet', 'pedal', 'pedestrian', 'pioneer', 'pawn#chess', 'impeach', 'pedigree', 'podium', 'pew', 'octopus', 'tripod', 'pyjamas'],
  },
  {
    id: 'grimm',
    title: "Grimm's Law",
    lede: 'Why father is pater and three is trēs.',
    text: [
      'Around 1000–500 BCE the ancestors of the Germanic languages shifted every stop consonant one step along a chain, in every word at once.',
      'Latin and Greek did not. So English words inherited through Germanic line up against English words borrowed from Latin, consonant by consonant: father / paternal, foot / pedal, three / trio, tooth / dental, heart / cardiac, horn / cornucopia, hundred / century.',
      'The highlighted branches are every place the law fired. They form a ring: one moment in time.',
    ],
    law: 'grimm',
  },
  {
    id: 'cow',
    title: 'Cow and beef',
    lede: 'Two words for one animal, divided by class.',
    text: [
      'After 1066 the people who raised animals spoke English; the people who ate them spoke French. So English keeps cow, swine, calf and deer in the field, and beef, pork, veal and venison on the plate.',
      'The twist: cow and beef are the same Proto-Indo-European word, *gʷṓws. One reached England through Germanic, the other through Latin and Norman French. Pork and farrow are one word too, and so are veal and wether.',
    ],
    words: ['cow', 'beef', 'bovine', 'butter', 'farrow', 'pork', 'veal', 'wether', 'veteran', 'venison', 'win'],
  },
  {
    id: 'umlaut',
    title: 'Foot, feet: a fossil rule',
    lede: 'Irregular plurals are regular rules from 1,400 years ago.',
    text: [
      'In early Old English an i or j in a following syllable pulled the stressed vowel forward: *fōtiz → fēt. Then the i wore away, leaving the changed vowel as the only sign of the plural.',
      'The same rule made verbs from nouns and adjectives: full → fill, food → feed, doom → deem, whole → heal, gold → gild, corn → kernel. It made set from sit, and kine from cow.',
      'Every "irregular" form here was once perfectly regular.',
    ],
    law: 'umlaut',
  },
  {
    id: 'be',
    title: '"To be" is three verbs',
    lede: 'am, is · be, been · was, were.',
    text: [
      'English welded three Proto-Indo-European verbs into one. *h₁es- gave am and is (Latin est, Sanskrit asti). *bʰuH-, to grow, gave be and been — and future, physics and neighbour. *h₂wes-, to dwell, gave was and were.',
      'Was and were show Verner’s Law still at work: the s turned to r where the ancient accent fell later in the word.',
    ],
    words: ['am', 'is', 'be', 'been', 'was', 'were', 'sooth', 'essence', 'future', 'physics', 'neighbor', 'wassail'],
  },
  {
    id: 'norse',
    title: 'The Viking layer',
    lede: 'Norse settlers lent English its everyday words.',
    text: [
      'After the Viking settlements, Old Norse and Old English lived side by side. They were close enough that people traded words for ordinary things: sister, egg, guest, window, husband, birth, trust, loan, seat, bait.',
      'Norse often kept a hard k or g where English had softened it. The pairs survive: shirt and skirt, church and kirk, yard and garth.',
      'Even the word root is Norse: Old Norse rót.',
    ],
    family: 'norse',
  },
  {
    id: 'gvs',
    title: 'The Great Vowel Shift',
    lede: 'Why English vowels sound nothing like their letters.',
    text: [
      'Between Chaucer and Shakespeare every long vowel in English moved up in the mouth, and the two highest broke into diphthongs: bite (said "beet") became bite; house ("hoose") became house; name ("nahm") became name; food ("fode") became food.',
      'Printing had just arrived. Spellings were fixed while the sounds were still sliding, so English writes the vowels of 1450 and speaks the vowels of 1700.',
    ],
    law: 'gvs',
  },
  {
    id: 'twins',
    title: 'Borrowed fresh, borrowed worn',
    lede: 'One Latin word, two English words.',
    text: [
      'French is Latin spoken for a thousand years, worn smooth. English often borrowed the same word twice: once from French, once straight from a Latin book.',
      'Royal and regal. Loyal and legal. Feat and fact. Fashion and faction. Chattel and capital. Chastise and castigate. Story and history. Poor and pauper. Hotel and hospital. The French twin is shorter, older and plainer; the Latin twin is longer, later and learned.',
    ],
    words: ['royal', 'regal', 'loyal', 'legal', 'feat', 'fact', 'fashion', 'faction', 'chattel', 'capital', 'chastise', 'castigate', 'story', 'history', 'poor', 'pauper', 'hotel', 'hospital'],
  },
  {
    id: 'spelling',
    title: 'Spelling is a museum',
    lede: 'Silent letters are fossils of sounds and of fashions.',
    text: [
      'Some silent letters were once spoken: the k of knee and know, the gh of night, light and eight (German Nacht, Licht, acht).',
      'Others were never spoken at all. Renaissance scholars added them to show a Latin ancestor: the b of doubt and subtle, the c of perfect and victuals. Could took its l from would and should. Foreign borrowed its g from reign.',
    ],
    words: ['knee', 'know', 'night', 'light', 'right', 'eight', 'doubt', 'subtle', 'could', 'foreign', 'perfect', 'victuals', 'advice', 'admiral'],
  },
  {
    id: 'hidden',
    title: 'Hidden relatives',
    lede: 'Pairs you would never guess.',
    text: [
      'Money and mind (Juno Monēta, the Warner). Disaster and star. Muscle and mouse. Salary and salt. World and werewolf. Nice and science. Travel and three. Villain and village. Glamour and grammar. Pansy and pound. Butter and cow. Window and eye.',
      'Hover any one of them to see the road it took.',
    ],
    words: ['money', 'mind', 'disaster', 'star', 'muscle', 'mouse', 'salary', 'salt', 'world', 'werewolf', 'nice', 'science', 'travel', 'three', 'villain', 'village', 'glamour', 'grammar', 'pansy', 'pound#weight'],
  },
  {
    id: 'core',
    title: 'The everyday core',
    lede: 'Count the dictionary and English looks Latin. Listen to it and it is Germanic.',
    text: [
      'Most English words in a dictionary come from Latin and French. But the words people actually say most — the, a, is, was, have, be, go, one, two, foot, hand, house, mother, water — are almost all inherited through Germanic.',
      'This view hides every word rarer than a certain frequency. Drag the frequency slider in the Families tab and watch the Latin and French branches go dark.',
    ],
    minZipf: 5.2,
  },
  {
    id: 'wander',
    title: 'Wanderers',
    lede: 'Words that crossed half the world.',
    text: [
      'Some words have no Indo-European root at all. They travelled the trade routes and arrived late: tea and chai (two routes out of China), sugar (Sanskrit for gravel), orange, coffee, zero and cipher (one Arabic word, borrowed twice), alcohol (eyeliner powder), algebra and algorithm, chocolate and tomato, ketchup and tycoon.',
      'Check, chess, cheque and checkmate came all the way from the Persian shāh, the king.',
    ],
    words: ['tea', 'chai', 'sugar', 'candy', 'orange', 'coffee', 'zero', 'cipher', 'alcohol', 'algebra', 'algorithm', 'chocolate', 'tomato', 'avocado', 'ketchup', 'tycoon', 'check', 'chess', 'checkmate', 'cheque', 'magazine', 'assassin'],
  },
];
