(async () => {
  const results = [];
  window.timelineQaProgress = results;
  const assert = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  const wait = () => new Promise(resolve => setTimeout(resolve, 50));
  try {
    for (let i = 0; i < 60 && !document.querySelector('#card-company'); i++) await wait();
    const data = await (await fetch('timeline-data.json')).json();
    assert(data.cards.length > 0, 'Timeline card data present');
    assert(new Set(data.cards.map(c => c.id)).size === data.cards.length, 'Stable IDs are unique');
    for (const c of data.cards) {
      assert(c.referenceIds.every(id => data.references[id]), `References resolve: ${c.id}`);
      assert(c.relatedCardIds.every(id => data.cards.find(other => other.id === id)?.relatedCardIds.includes(c.id)), `Related links reciprocal: ${c.id}`);
    }
    assert(document.querySelectorAll('.timeline-card').length === data.cards.length, 'Full timeline renders all current cards');
    assert(document.querySelectorAll('.poet-intro').length === 5, 'Five poet introductions');
    assert(document.querySelector('#poets').nextElementSibling.id === 'timeline', 'Poets immediately precede timeline');
    assert([...document.querySelectorAll('.poet-intro')].map(c => c.id).join(',') === 'poet-iqbal,poet-faiz,poet-pritam,poet-gulzar,poet-auden', 'Auden follows Gulzar at the right end of the poet introductions');
    for (const poet of data.poets) {
      document.querySelector('[data-view="august"]').click();
      document.querySelector(`#poet-${poet.id} .find-poet`).click();
      assert(document.querySelector('#view-title').textContent === 'Full timeline', `Poet jump restores full view: ${poet.id}`);
      assert(document.activeElement.id === `card-${poet.firstCardId}`, `Poet jump focuses first poem: ${poet.id}`);
      const button = document.activeElement;
      const link = button.previousElementSibling;
      assert(link?.matches('.poet-link') && link.textContent === poet.name, `Timeline has separate poet name link: ${poet.id}`);
      const br = button.getBoundingClientRect(), lr = link.getBoundingClientRect();
      assert(lr.bottom <= br.top, `Poet name does not overlap poem button: ${poet.id}`);
      link.click();
      assert(document.activeElement.id === `poet-${poet.id}`, `Name link focuses introduction: ${poet.id}`);
      const portrait = document.querySelector(`#poet-${poet.id} img`);
      await portrait.decode();
      assert(portrait.naturalWidth > 0 && portrait.alt.includes(poet.name), `Portrait loads with descriptive alt text: ${poet.id}`);

    }
    for (const poet of data.poets) {
      const trigger = document.querySelector(`#poet-${poet.id} .poet-background-button`);
      trigger.click();
      const popup = document.querySelector('#poet-background');
      assert(popup.open && popup.matches(':modal'), `Poet background opens modally: ${poet.id}`);
      assert(document.querySelector('#poet-background-title').textContent === poet.name, `Background identifies poet: ${poet.id}`);
      assert(popup.querySelectorAll('#poet-background-content p').length >= 2 && popup.querySelectorAll('a').length > 0, `Biography and sources present: ${poet.id}`);
      assert(popup.getBoundingClientRect().width <= innerWidth && popup.scrollWidth <= popup.clientWidth, `Biography fits viewport: ${poet.id}`);
      document.querySelector('#close-poet-background').click();
      await wait();
      assert(!popup.open && document.activeElement === trigger, `Closing background restores focus: ${poet.id}`);
    }
    for (const id of ['faiz', 'gulzar']) {
      document.querySelector(`#poet-${id} .poet-background-button`).click();
      for (let i = 0; i < 100 && !document.querySelector('.journey-frame svg'); i++) await wait();
      const host = document.querySelector('.journey-map');
      assert(Boolean(host.querySelector('svg')), `${id} geographic map loads`);
      assert(host.querySelectorAll('.map-city').length === (id === 'faiz' ? 3 : 2), `${id} early places mapped`);
      assert(!host.querySelector('.map-border'), `${id} early view hides political borders`);
      assert(host.querySelector('.journey-stop-sources a'), `${id} selected place has a biography source`);
      host.querySelector('.journey-after').click();
      assert(host.querySelectorAll('.map-city').length === (id === 'faiz' ? 1 : 2), `${id} later places mapped`);
      if (id === 'faiz') assert(!host.querySelector('.map-route') && !host.querySelector('.map-mile-marker') && host.querySelector('.journey-distance').textContent.includes('no journey distance inferred'), 'Faiz workplace does not imply a refugee journey');
      else {
        host.querySelector('.journey-stops [data-stop="mumbai"]').click();
        assert(host.querySelector('.map-mile-marker') && host.textContent.includes('After 1947'), 'Gulzar later journey has approximate miles and dates');
      }
      const popup = document.querySelector('#poet-background');
      assert(popup.scrollWidth <= popup.clientWidth, `${id} map fits popup`);
      document.querySelector('#close-poet-background').click();await wait();
    }
    for (const id of ['iqbal', 'auden']) {
      document.querySelector(`#poet-${id} .poet-background-button`).click();
      assert(!document.querySelector('.journey-map') && document.querySelector('.poet-partition-context a'), `${id} has sourced upbringing instead of an invented migration`);
      document.querySelector('#close-poet-background').click();await wait();
    }
    document.querySelector('#poet-pritam .poet-background-button').click();
    for (let i = 0; i < 60 && !document.querySelector('.journey-frame svg'); i++) await wait();
    const map = document.querySelector('.journey-map');
    assert(Boolean(map.querySelector('svg')), 'Pritam journey map loads from local data');
    const basemaps = await (await fetch('pritam-basemaps.json')).json();
    assert(basemaps.projection === 'Web Mercator' && basemaps.before.featureCount > 100 && basemaps.after.featureCount > 100, 'Detailed basemaps were exported from real geographic features');
    assert(basemaps.before.placeNames.includes('Gujranwala') && basemaps.before.placeNames.includes('Lahore'), 'Early-life basemap contains the correct cities');
    assert(basemaps.after.placeNames.includes('Dehradun') && basemaps.after.placeNames.includes('New Delhi'), 'Later basemap covers Dehradun and Delhi');
    assert(map.querySelector('image.map-basemap').getAttribute('href') === basemaps.before.src, 'Before Partition uses the local detailed map image');
    assert(map.querySelector('.map-attribution a[href="https://www.openstreetmap.org/copyright"]'), 'Map visibly credits OpenStreetMap');

    assert(map.querySelectorAll('.map-city').length === 2 && !map.querySelector('.map-border'), 'Before Partition shows two cities and no border');
    assert(!map.textContent.includes('PAKISTAN') && !map.textContent.includes('INDIA'), 'Before Partition does not show modern country labels');
    map.querySelector('.journey-after').click();
    assert(map.querySelectorAll('.map-city').length === 3 && Boolean(map.querySelector('.map-border')), 'After Partition shows border, Lahore, Dehradun, and Delhi');
    assert(map.querySelector('image.map-basemap').getAttribute('href') === basemaps.after.src, '1947 view switches to its georeferenced basemap');
    const cityLabel = map.querySelector('.map-city-label');
    const labelPixels = parseFloat(cityLabel.style.fontSize) * map.querySelector('svg').getBoundingClientRect().width / Number(map.querySelector('svg').getAttribute('viewBox').split(' ')[2]);
    assert(labelPixels >= 12 && labelPixels <= 16, 'City labels stay readable without becoming oversized');

    assert(map.querySelectorAll('.map-mile-marker').length > 0, 'Post-Partition route has mile markers');
    const mile = map.querySelector('.map-mile-marker');
    mile.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter',bubbles:true}));
    assert(map.querySelector('.journey-place-detail').textContent.includes('not a documented stop'), 'Mile marker explains approximate distance without inventing a stop');
    map.querySelector('.journey-stops [data-stop="delhi"]').click();
    assert(map.querySelector('.journey-place-detail').textContent.includes('return train journey'), 'Delhi stop includes the return journey context');
    map.querySelector('.journey-stops [data-stop="dehradun"]').click();
    assert(map.querySelector('.journey-place-detail h4').textContent === 'Dehradun', 'City selection updates journey detail');
    const mapSvg = map.querySelector('svg');
    const originalView = mapSvg.getAttribute('viewBox');
    map.querySelector('.map-zoom-in').click();
    assert(mapSvg.getAttribute('viewBox') !== originalView, 'Map zoom changes the view');
    map.querySelector('.map-reset').click();
    assert(mapSvg.getAttribute('viewBox') === originalView, 'Reset restores the route view');
    const frame = map.querySelector('.journey-frame');
    map.querySelector('.map-zoom-in').click();
    const zoomedView = mapSvg.getAttribute('viewBox');
    frame.focus();frame.dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight',bubbles:true}));
    assert(mapSvg.getAttribute('viewBox') !== zoomedView, 'Focused map supports keyboard panning within the basemap');
    map.querySelector('.map-mile-toggle input').click();
    assert(!map.querySelector('.map-mile-marker'), 'Mile markers can be hidden');
    map.querySelector('.journey-before').click();
    assert(!map.querySelector('.map-border'), 'Switching back removes the border');
    assert(document.querySelector('#poet-background').scrollWidth <= document.querySelector('#poet-background').clientWidth, 'Map does not overflow the popup');
    assert(map.textContent.includes('straight-line') && map.textContent.includes('not her exact'), 'Approximate mileage and route limits are visible');
    document.querySelector('#close-poet-background').click();await wait();
    document.querySelector('#poet-iqbal .find-poet').click();
    document.querySelector('#card-iqbal-hindi').click();
    document.querySelector('[data-related="iqbal"]').click();
    assert(document.activeElement.id === 'card-iqbal', 'First Iqbal poem links to second');
    document.querySelector('[data-related="iqbal-hindi"]').click();
    assert(document.activeElement.id === 'card-iqbal-hindi', 'Second Iqbal poem links back to first');
    for (const [a,b] of [['radcliffe','auden'],['displacement','pritam'],['independence','faiz'],['allahabad','iqbal']]) {
      for (const [from,to] of [[a,b],[b,a]]) {
        document.getElementById(`card-${from}`).click();
        document.querySelector(`[data-related="${to}"]`).click();
        assert(document.activeElement.id === `card-${to}`, `Related link moves focus: ${from} to ${to}`);
        assert(document.getElementById(`card-${to}`).getAttribute('aria-expanded') === 'true', `Related card opens: ${to}`);
      }
    }
    document.querySelector('#card-faiz').click();
    assert(document.querySelector('#partition-maps').nextElementSibling.getAttribute('aria-labelledby') === 'photographs-heading' && document.querySelector('.partition-photographs').nextElementSibling.id === 'poems', 'Maps and photographs sit between the timeline and poems');
    assert(document.querySelector('#freedoms-dawn-title').textContent === "Freedom's Dawn (August 1947)", 'Poem has its full title');
    assert(!document.querySelector('#card-detail .poem-text'), 'Timeline detail links to the separate reader');
    const readers = [...document.querySelectorAll('.poem-reader')];
    assert(readers.map(r => r.querySelector('h3').id).join(',') === 'iqbal-hindi-poem-title,iqbal-milli-poem-title,freedoms-dawn-title,to-waris-shah-title,karachi-title,auden-partition-title', 'Readers place both Iqbal poems before Faiz, Pritam after Faiz, and Auden after Gulzar');
    assert(readers.every(reader => reader.querySelector('.poem-publication dl')), 'Every reader includes publication and edition details');
    for (const id of ['iqbal-hindi-poem', 'iqbal-milli-poem']) {
      const reader = document.getElementById(`${id}-title`).closest('.poem-reader');
      assert(!reader.open && reader.querySelector('.poem-text'), `${id} has a collapsed poem reader`);
      assert(reader.querySelectorAll('.poem-line').length === (id === 'iqbal-hindi-poem' ? 20 : 24), `${id} preserves the supplied edition’s printed lines`);
      assert(reader.querySelector('.poem-byline').textContent.includes('Ikram Azam'), `${id} credits the selected translator`);
    }
    assert(document.querySelector('#faiz-publication-title').parentElement.textContent.includes('122–127'), 'Faiz cites verified bilingual page range');
    assert(document.querySelector('#pritam-publication-title').parentElement.textContent.includes('27–28'), 'Pritam cites Mahfil pages');
    assert(document.querySelector('#auden-publication-title').parentElement.textContent.includes('earlier version'), 'Auden distinguishes the 1966 journal version from the supplied text');
    const pritamReader = document.querySelector('#to-waris-shah-title').closest('.poem-reader');
    assert(!pritamReader.open, 'Pritam poem starts collapsed');
    pritamReader.querySelector('summary').click();
    assert(pritamReader.querySelectorAll('.poem-line').length === 52 && pritamReader.querySelectorAll('.poem-stanza').length === 13, 'Pritam preserves 52 lines in 13 four-line stanzas');
    assert(pritamReader.querySelector('.poem-byline').textContent.includes('Kiron Bajaj and Carlo Coppola'), 'Pritam credits the supplied translation');
    assert(document.getElementById('to-waris-shah-line-52').textContent === 'In the Book of Love.', 'Pritam ends at the requested Book of Love line');
    assert(!pritamReader.querySelector('.poem-text').textContent.includes('TRAVELER') && !pritamReader.querySelector('.poem-text').textContent.includes('After searching'), 'O Traveler is excluded from Pritam poem text');
    assert(pritamReader.querySelectorAll('.poem-highlight').length === 4, 'Pritam highlights the four opening lines');
    pritamReader.querySelector('summary').click();
    const gulzarReader = document.querySelector('#karachi-title').closest('.poem-reader');
    assert(!gulzarReader.open, 'Karachi starts collapsed');
    gulzarReader.querySelector('summary').click();
    assert(gulzarReader.querySelectorAll('.poem-line').length === 8 && [...gulzarReader.querySelectorAll('.poem-stanza')].map(s => s.querySelectorAll('.poem-line').length).join(',') === '6,2', 'Karachi preserves the photographed eight lines and two stanzas');
    assert(document.getElementById('karachi-line-08').textContent === 'So much is common among the common people.', 'Karachi ends with the photographed final line');
    assert(gulzarReader.querySelector('.poem-byline').textContent.includes('Rakhshanda Jalil') && !gulzarReader.querySelector('.poem-highlight'), 'Karachi credits the translator without adding annotations');
    assert(document.getElementById('card-gulzar').textContent.includes('Karachi'), 'Gulzar timeline card names the selected poem');
    gulzarReader.querySelector('summary').click();
    const audenReader = document.querySelector('#auden-partition-title').closest('.poem-reader');
    assert(!audenReader.open, 'Auden poem starts collapsed');
    audenReader.querySelector('summary').click();
    assert(audenReader.open && audenReader.querySelectorAll('.poem-line').length === 25, 'Auden reader opens with all 25 supplied lines');
    assert([...audenReader.querySelectorAll('.poem-stanza')].map(s => s.querySelectorAll('.poem-line').length).join(',') === '12,10,3', 'Auden preserves supplied stanza breaks');
    assert(audenReader.querySelector('.poem-byline').textContent === 'W. H. Auden', 'Original English poem has no translator credit');
    assert(!audenReader.querySelector('.poem-highlight') && !audenReader.querySelector('.whole-poem-analysis'), 'Auden has no added annotations or analysis');
    audenReader.querySelector('summary').click();
    const poemReader = document.querySelector('#freedoms-dawn-title').closest('.poem-reader');
    assert(!poemReader.open, 'Poem starts collapsed');
    poemReader.querySelector('.poem-summary').click();
    assert(poemReader.open && poemReader.querySelector('.poem-text').getBoundingClientRect().height > 0, 'Poem disclosure reveals the reader');
    poemReader.querySelector('.poem-summary').click();
    assert(!poemReader.open, 'Poem disclosure can hide the reader again');
    document.querySelector('.read-poem').click();
    assert(poemReader.open, 'Timeline read link expands the collapsed poem');
    assert(document.activeElement.id === 'freedoms-dawn-title', 'Timeline read link focuses the poem');
    assert(poemReader.querySelector('.poem-byline').textContent.includes('V. G. Kiernan'), 'Poem credits its translator');
    assert(document.querySelectorAll('#freedoms-dawn .poem-stanza').length === 5, 'Poem preserves five stanzas');
    assert(document.querySelectorAll('#freedoms-dawn .poem-line').length === 25, 'Poem preserves 25 lines');
    assert(document.querySelectorAll('#freedoms-dawn .poem-stanza br').length === 20, 'Explicit breaks separate lines within stanzas');
    assert(new Set([...document.querySelectorAll('#freedoms-dawn .poem-line')].map(line => line.id)).size === 25, 'Poem lines have unique annotation IDs');
    assert(document.querySelector('#freedoms-dawn-line-25').textContent === 'Let us go on, our goal is not reached yet.', 'Poem ends with supplied final line');
    assert(getComputedStyle(poemReader.querySelector('.poem-text')).overflowX === 'auto', 'Long verse lines scroll within the poem');
    assert([...document.querySelectorAll('#freedoms-dawn .poem-line')].every(line => line.getBoundingClientRect().height <= parseFloat(getComputedStyle(line).lineHeight) + 4), 'Each printed verse line remains one visual line');
    assert([...document.querySelectorAll('#freedoms-dawn .poem-stanza')].map(stanza => stanza.querySelectorAll('.poem-line').length).join(',') === '4,3,7,2,9', 'Stanza breaks match the supplied scan');
    const highlight = poemReader.querySelector('.poem-highlight');
    assert(highlight.textContent === "night's fangs have mangled", 'Correct phrase highlighted');
    const note = document.getElementById(highlight.getAttribute('aria-controls'));
    assert(note.hidden, 'Annotation starts closed');
    highlight.click();
    assert(!note.hidden && highlight.getAttribute('aria-expanded') === 'true', 'Click opens annotation');
    assert(note.textContent.includes('Severely damaged') && [...note.querySelectorAll('h5')].some(heading => heading.textContent === 'A possible reading'), 'Definition and interpretation shown separately');
    note.querySelector('.close-annotation').click();
    assert(note.hidden && document.activeElement === highlight, 'Closing annotation restores focus');
    highlight.click();
    note.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
    assert(note.hidden && document.activeElement === highlight, 'Escape dismisses annotation');
    const dawnHighlights = [...document.querySelectorAll('[aria-controls="freedoms-dawn-uncertain-dawn"]')];
    const dawnNote = document.querySelector('#freedoms-dawn-uncertain-dawn');
    assert(dawnHighlights.length === 2 && dawnNote.hidden, 'Two dawn lines share one initially closed annotation');
    dawnHighlights[1].click();
    assert(!dawnNote.hidden && dawnHighlights.every(button => button.getAttribute('aria-expanded') === 'true'), 'Either dawn line opens the shared annotation');
    assert(dawnNote.textContent.toLowerCase().includes('mourning, loss') && !dawnNote.textContent.includes('Definition adapted'), 'Dawn annotation shows interpretation without an unrelated definition');
    dawnNote.querySelector('.close-annotation').click();
    assert(dawnNote.hidden && document.activeElement === dawnHighlights[1], 'Closing dawn note restores focus to the activated line');
    dawnHighlights[0].click();
    assert(!dawnNote.hidden, 'First dawn line also opens the note');
    dawnNote.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true}));
    assert(dawnNote.hidden && document.activeElement === dawnHighlights[0], 'Escape returns focus to first dawn line');
    for (const id of ['freedoms-dawn-bright-cheek', 'freedoms-dawn-light-winged']) {
      const trigger = document.querySelector(`[aria-controls="${id}"]`);
      const panel = document.getElementById(id);
      assert(trigger && panel.hidden, `Stanza three annotation starts closed: ${id}`);
      trigger.click();
      assert(!panel.hidden && panel.textContent.includes('travelers'), `Stanza three annotation opens: ${id}`);
      panel.querySelector('.close-annotation').click();
      assert(panel.hidden && document.activeElement === trigger, `Stanza three annotation restores focus: ${id}`);
    }
    assert(document.querySelector('#freedoms-dawn-bright-cheek .annotation-source a').textContent.includes('Thomas C. Foster'), 'Quest annotation credits Foster');
    const festive = [...document.querySelectorAll('[aria-controls="freedoms-dawn-festive-looks"]')];
    assert(festive.length === 9, 'Whole final stanza shares one reading across all nine lines');
    festive[1].click();
    const finalNote = document.querySelector('#freedoms-dawn-festive-looks');
    assert(!finalNote.hidden && finalNote.textContent.toLowerCase().includes('medicine'), 'Last stanza note opens with physic definition');
    finalNote.querySelector('.close-annotation').click();
    assert(document.activeElement === festive[1], 'Last stanza note restores focus');
    assert(finalNote.querySelectorAll('.word-meaning').length === 4, 'Final stanza defines physic, reproved, unslaked, and severance');
    const dictionaryLinks = [...poemReader.querySelectorAll('.word-meaning a')];
    assert(dictionaryLinks.length === 6, 'All six word meanings have dictionary links');
    assert(dictionaryLinks.every(link => /^(www\.)?(merriam-webster\.com|collinsdictionary\.com)$/.test(new URL(link.href).hostname)), 'Definitions link directly to dictionary publishers');
    assert(dictionaryLinks.every(link => link.target === '_blank' && link.rel.includes('noopener')), 'Dictionary entries open safely without leaving the poem');

    assert(document.querySelector('.whole-poem-analysis h4').textContent === 'Reading the Poem', 'Whole-poem section has requested heading');
    assert(document.querySelector('.whole-poem-analysis').textContent.includes('Let us go on'), 'Whole-poem reading connects the opening and ending');
    const secondary = document.querySelector('.whole-poem-analysis .reading-sources');
    assert(secondary.querySelectorAll('li').length === 3, 'Whole-poem reading cites Foster, Narang, and newspaper context');
    assert(secondary.querySelector('a[href="https://www.jstor.org/stable/23348482"]'), 'Narang citation links to the supplied essay');
    assert(secondary.textContent.includes('Baidar Bakht') && secondary.textContent.includes('Dast-e Teh-e Sang Amada'), 'Narang translator and distinct poem are identified');




    document.querySelector('#freedoms-dawn-title').closest('.poem-reader').querySelector('.text-link').click();
    assert(document.activeElement.id === 'card-faiz', 'Poem return link focuses Faiz on full timeline');
    document.querySelector('[data-view="august"]').click();
    assert(document.querySelector('#view-title').textContent === 'August 1947 detail', 'Detail scale labeled');
    assert(document.querySelectorAll('#card-faiz').length === 1, 'Single Faiz month marker');
    const r = id => document.getElementById(`card-${id}`).getBoundingClientRect();
    const a = r('independence'), b = r('radcliffe'), f = r('faiz');
    const overlaps = (x,y) => x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
    assert(!overlaps(a,b) && !overlaps(a,f) && !overlaps(b,f), 'August cards do not overlap');
    document.getElementById('card-independence').click();
    assert(!document.getElementById('card-detail').hidden, 'Details open on activation');
    document.querySelector('.close-detail').click();
    assert(document.activeElement.id === 'card-independence', 'Closing details returns focus');
    document.querySelector('[data-jump="displacement"]').click();
    assert(document.querySelector('#view-title').textContent === 'Full timeline', 'Jump restores full timeline');
    assert(document.activeElement.id === 'card-displacement', 'Jump focuses destination');
    assert(![...document.querySelectorAll('h2')].some(heading => heading.textContent === 'An exhibit in progress.'), 'Old exhibit-in-progress heading removed');
    assert(document.querySelector('#exhibit-reading-heading').textContent.includes('six poems'), 'Exhibit-wide reading section covers six poems');
    assert(!document.querySelector('#exhibit-claim').textContent.trim() && !document.querySelector('#exhibit-analysis').textContent.trim(), 'Overarching claim and analysis remain empty');
    for (const id of ['plan', 'radcliffe', 'displacement']) {
      document.getElementById(`card-${id}`).click();
      const section = document.querySelector('#card-detail .timeline-map-comparison');
      const choices = [...section.querySelectorAll('button')];
      assert(choices.length === 3 && choices[0].getAttribute('aria-pressed') === 'true', `Religious geography comparison opens on Punjab: ${id}`);
      for (const choice of choices) {
        choice.click();
        const map = section.querySelector('img');
        for (let i=0; i<100 && !(map.complete && map.naturalWidth); i++) await wait();
        assert(map.naturalWidth > 0 && map.alt, `Map loads: ${id} / ${choice.textContent}`);
        assert(choices.filter(button => button.getAttribute('aria-pressed') === 'true').length === 1, 'Exactly one map is selected');
        assert(map.getBoundingClientRect().right <= innerWidth, 'Comparison map fits the viewport');
      }
      assert(section.textContent.includes('August 17'), 'Border view distinguishes final borders from June plan');
      assert(section.textContent.includes('Others stayed'), 'Comparison distinguishes demographic patterns from individual journeys');
    }
    const standaloneMaps = document.querySelector('#partition-maps');
    assert(document.querySelector('#timeline').nextElementSibling === standaloneMaps, 'Standalone maps appear directly after timeline');
    assert(standaloneMaps.querySelectorAll('figure').length === 3, 'All three standalone maps are visible without selecting a timeline card');
    for (const image of standaloneMaps.querySelectorAll('img')) {
      for (let i=0; i<100 && !(image.complete && image.naturalWidth); i++) await wait();
      assert(image.naturalWidth > 0 && image.alt, 'Standalone map loads with accessible text');
      assert(image.getBoundingClientRect().right <= innerWidth, 'Standalone map fits viewport');
    }
    const photographs = [...document.querySelectorAll('.partition-photo-card')];
    assert(photographs.length === 5, 'Five sourced historical photographs render');
    for (const card of photographs) {
      const image = card.querySelector('img');image.scrollIntoView();
      for (let i=0; i<100 && !(image.complete && image.naturalWidth); i++) await wait();
      assert(image.naturalWidth > 0 && image.alt && card.querySelector('.partition-photo-credit a'), `Archival photograph loads with alt text and source: ${card.id}`);
      const account = card.querySelector('details');
      assert(!account.open && account.querySelector('a'), `Travel account starts collapsed with a source: ${card.id}`);
      account.querySelector('summary').click();assert(account.open, `Travel account expands: ${card.id}`);
      account.querySelector('summary').click();
    }
    assert(document.querySelector('#photo-delhi').textContent.includes('September 27, 1947') && document.querySelector('#photo-karachi').textContent.includes('August 14, 1947'), 'City photographs identify locations and dates');
    assert(document.querySelector('#photo-train').textContent.includes('1954') && document.querySelector('#photo-convoy').textContent.includes('1954'), 'Photograph captions distinguish archival record dates');
    document.querySelector('#card-gulzar').click();
    assert(document.querySelector('#card-detail a[href="#photo-karachi"]'), 'Karachi poem links to the city photograph');
    document.querySelector('#card-displacement').click();
    assert(document.querySelectorAll('#card-detail .related-photographs a').length === 4, 'Displacement links to journey and witness photographs');
    document.querySelector('.close-detail').click();
    const mobile = matchMedia('(max-width: 700px)').matches;
    assert(document.documentElement.scrollWidth <= innerWidth, 'No page horizontal overflow');
    const history = r('independence'), poetry = r('faiz');
    if (mobile) assert(history.right < poetry.left, 'Mobile tracks are on opposite sides');
    else assert(history.bottom < poetry.top, 'Desktop tracks are above and below axis');
    const viewport = document.querySelector('#timeline-viewport');
    viewport.focus();
    viewport.dispatchEvent(new KeyboardEvent('keydown', {key:'Home', bubbles:true}));
    viewport.dispatchEvent(new KeyboardEvent('keydown', {key:mobile ? 'ArrowDown':'ArrowRight', bubbles:true}));
    assert(mobile ? viewport.scrollTop > 0 : viewport.scrollLeft > 0, 'Axis responds to keyboard arrows');
    document.querySelector('[data-view="august"]').click();
    document.querySelector('#timeline').scrollIntoView();
    const report = document.createElement('pre'); report.id = 'qa-results'; report.textContent = JSON.stringify({passed:true, mobile, actualWidth:innerWidth, checks:results.length, results}); document.body.append(report);
  } catch (error) {const report = document.createElement('pre'); report.id='qa-results'; report.textContent=JSON.stringify({passed:false, error:error.message, results}); document.body.append(report);}
})();
