// Etymon: what the data is, where it came from, how it was read, and what it cannot tell.
// One text, shown as a leaf of the Languages panel and as a sheet over the other views.

const num = (n) => n.toLocaleString('en-US');
const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

// K: the Languages data when it is loaded (the counts are then exact), or nothing
export function aboutHtml(K) {
  const used = K ? K.stations.filter((s) => s.count > 0).length : 190;
  const words = K ? num(K.N) : 'about 186,000', fams = K ? num(K.F) : 'about 17,800';
  const de = K && K.byId.has('g') ? num(K.stations[K.byId.get('g')].count) : '4,205';
  return `<h2 class="kn-ph">About the data</h2>
    <p class="kn-pp">Everything on the globe of languages comes from Wiktionary, the free dictionary that anyone can edit. A program read it. Nobody checked the result by hand. Here is what was read, how, and what the picture can and cannot tell you.</p>

    <h3 class="kn-h">What you see</h3>
    <p class="kn-pp">Every dot is one word in one language at one time. English <i>water</i>, Old English <i>wæter</i> and Proto-Germanic <i>*watōr</i> are three dots, joined by two lines. There are ${words} words here, in ${used} languages and older stages of languages. They fall into ${fams} families: a family is every word that goes back to one root.</p>
    <ul class="ab-list">
      <li><b>Distance from the centre is time.</b> A language sits at the date it was spoken, with its ancestors beneath it. The centre is Proto-Indo-European, spoken about 4000 BCE and never written down. Forms marked * are reconstructed, not recorded.</li>
      <li><b>Colour is origin.</b> A word keeps the colour of the branch its line began in, wherever it ends up. That is why the rim of English is pink: those words began in Latin and French.</li>
      <li><b>A line is one step.</b> Made at home (formed from another word of the same language), handed down (from an older stage of the same language), or carried across (taken from another language).</li>
    </ul>

    <h3 class="kn-h">Where it comes from</h3>
    <p class="kn-pp">The English edition of ${link('https://en.wiktionary.org/', 'Wiktionary')}, in the machine-readable form published by ${link('https://kaikki.org/', 'kaikki.org')} (the Wiktextract project). Three files, dated 30 October 2026: every English entry, every Russian entry, and the 1,931 pages of Proto-Indo-European roots.</p>

    <h3 class="kn-h">How it was read</h3>
    <ol class="ab-list">
      <li>For each English and Russian entry, the etymology: the chain "from Middle English…, from Old English…, from Proto-Germanic…". Wiktionary marks each step as inherited or borrowed, and the program keeps that.</li>
      <li>The cognates an entry names ("cognate with German <i>Wasser</i>, Dutch <i>water</i>") and the descendants listed under a word or a root. This is how the other languages get onto the globe.</li>
      <li>Chains that reach the same root are joined into one tree. Where a page names a root but not the steps to it, the step is marked as a gap. Where it says "perhaps" or "possibly", the step is marked unsure.</li>
      <li>Some things are left out on purpose, because they would draw false lines: what follows a "+" in an etymology (a part of the word, not an ancestor), words the text sets aside ("unrelated to", "not to be confused with"), and roots that are only spelt alike.</li>
    </ol>

    <h3 class="kn-h">What it cannot tell you</h3>
    <ul class="ab-list">
      <li><b>Only English and Russian are read in full.</b> Every other language is here only as far as English, Russian and Proto-Indo-European pages mention it. German has ${de} words on this globe because that many were named as cognates or descendants, not because German is small. Counts between two other languages are samples, not totals.</li>
      <li><b>Wiktionary can be wrong.</b> Volunteers write it. Some etymologies are disputed or incomplete, and this picture repeats them.</li>
      <li><b>Dates are rough.</b> They belong to the stage of the language, not to the word: a Latin word sits at 50 BCE whenever it was coined.</li>
      <li><b>"Handed down to both" is strict.</b> It needs every step of both roads on record. True cognates with a step missing fall under "perhaps from one root".</li>
    </ul>

    <h3 class="kn-h">The counted things</h3>
    <ul class="ab-list">
      <li><b>Kinship</b> compares spellings, or transliterations where the script is not Latin: the share of letters that differ between two words that came down from one ancestor. It does not measure pronunciation, and it is rough. It is still enough to rebuild the families.</li>
      <li><b>Sounds</b> sets the first letter of each word against the first consonant of its Proto-Indo-European ancestor, in each language's own spelling. A square with fewer than four words is left empty.</li>
      <li><b>Doublets</b> are the pairs Wiktionary itself marks as doublets. The other findings are plain counts over the trees.</li>
    </ul>

    <h3 class="kn-h">The other views</h3>
    <p class="kn-pp">The 3D view shows a core of 1,414 English words from 144 roots, written by hand from standard references: Watkins' dictionary of Indo-European roots, the Oxford English Dictionary, Etymonline and Wiktionary. Explore adds about 155,000 English and 11,500 Russian words from the same Wiktionary files. Those are marked ◇ and are not checked by hand either.</p>

    <h3 class="kn-h">Licence and credit</h3>
    <p class="kn-pp">Wiktionary's text is free to reuse under the ${link('https://creativecommons.org/licenses/by-sa/4.0/', 'Creative Commons Attribution-ShareAlike 4.0')} licence. The data shown here is derived from it and carries the same licence. The extracts are the work of kaikki.org: Tatu Ylonen, "Wiktextract: Wiktionary as Machine-Readable Structured Data", LREC 2022.</p>`;
}

// the leaf of the Languages panel
export function aboutTab(k) {
  const el = document.createElement('div');
  el.className = 'ab-text';
  el.innerHTML = aboutHtml(k.K);
  return { el };
}

// the sheet over the other views: opened by anything marked data-about, closed by its button, Escape,
// or a press beside it
export function bindAbout() {
  const sheet = document.getElementById('about');
  if (!sheet) return;
  const shut = () => { sheet.hidden = true; };
  const open = () => {
    if (!sheet.firstChild) {
      sheet.innerHTML = `<div class="ab-card ab-text" role="dialog" aria-modal="true" aria-label="About the data" tabindex="-1">
        <button type="button" class="sp-close" data-shut aria-label="Close">×</button>${aboutHtml(null)}</div>`;
    }
    sheet.hidden = false;
    sheet.firstChild.scrollTop = 0;
    sheet.firstChild.focus();
  };
  for (const b of document.querySelectorAll('[data-about]')) b.addEventListener('click', open);
  sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest('[data-shut]')) shut(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) shut(); });
}
