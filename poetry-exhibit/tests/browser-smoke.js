(async () => {
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  const wait = () => new Promise(resolve => setTimeout(resolve, 50));
  try {
    for (let i = 0; i < 60 && !document.querySelector('#card-company'); i++) await wait();
    const data = await (await fetch('timeline-data.json')).json();
    assert(data.cards.length === 21, 'All 21 cards present');
    assert(new Set(data.cards.map(c => c.id)).size === 21, 'Stable IDs are unique');
    for (const c of data.cards) {
      assert(c.referenceIds.every(id => data.references[id]), `References resolve: ${c.id}`);
      assert(c.relatedCardIds.every(id => data.cards.find(other => other.id === id)?.relatedCardIds.includes(c.id)), `Related links reciprocal: ${c.id}`);
    }
    assert(document.querySelectorAll('.timeline-card').length === 21, 'Full timeline renders 21 buttons');
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
