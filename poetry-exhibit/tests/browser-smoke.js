(async () => {
  const results = [];
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
    assert([...document.querySelectorAll('.poet-intro')].map(c => c.id).join(',') === 'poet-iqbal,poet-faiz,poet-pritam,poet-auden,poet-gulzar', 'Poets follow timeline encounter order');
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
    assert(document.querySelector('#timeline').nextElementSibling.id === 'poems', 'Poems section immediately follows timeline');
    assert(document.querySelector('#freedoms-dawn-title').textContent === "Freedom's Dawn (August 1947)", 'Poem has its full title');
    assert(!document.querySelector('#card-detail .poem-text'), 'Timeline detail links to the separate reader');
    document.querySelector('.read-poem').click();
    assert(document.activeElement.id === 'freedoms-dawn-title', 'Timeline read link focuses the poem');
    assert(document.querySelector('.poem-byline').textContent.includes('V. G. Kiernan'), 'Poem credits its translator');
    assert(document.querySelectorAll('.poem-stanza').length === 5, 'Poem preserves five stanzas');
    assert(document.querySelectorAll('.poem-line').length === 25, 'Poem preserves 25 lines');
    assert(document.querySelectorAll('.poem-stanza br').length === 20, 'Explicit breaks separate lines within stanzas');
    assert(new Set([...document.querySelectorAll('.poem-line')].map(line => line.id)).size === 25, 'Poem lines have unique annotation IDs');
    assert(document.querySelector('#freedoms-dawn-line-25').textContent === 'Let us go on, our goal is not reached yet.', 'Poem ends with supplied final line');
    assert(getComputedStyle(document.querySelector('.poem-text')).overflowX === 'auto', 'Long verse lines scroll within the poem');
    assert([...document.querySelectorAll('.poem-line')].every(line => line.getBoundingClientRect().height <= parseFloat(getComputedStyle(line).lineHeight) + 4), 'Each printed verse line remains one visual line');
    assert([...document.querySelectorAll('.poem-stanza')].map(stanza => stanza.querySelectorAll('.poem-line').length).join(',') === '4,3,7,2,9', 'Stanza breaks match the supplied scan');
    const highlight = document.querySelector('.poem-highlight');
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
    const dictionaryLinks = [...document.querySelectorAll('.word-meaning a')];
    assert(dictionaryLinks.length === 6, 'All six word meanings have dictionary links');
    assert(dictionaryLinks.every(link => /^(www\.)?(merriam-webster\.com|collinsdictionary\.com)$/.test(new URL(link.href).hostname)), 'Definitions link directly to dictionary publishers');
    assert(dictionaryLinks.every(link => link.target === '_blank' && link.rel.includes('noopener')), 'Dictionary entries open safely without leaving the poem');

    assert(document.querySelector('.whole-poem-analysis h4').textContent === 'Reading the Poem', 'Whole-poem section has requested heading');
    assert(document.querySelector('.whole-poem-analysis').textContent.includes('Let us go on'), 'Whole-poem reading connects the opening and ending');



    document.querySelector('.poem-reader .text-link').click();
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
