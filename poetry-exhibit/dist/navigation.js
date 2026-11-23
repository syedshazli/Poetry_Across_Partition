/* Separate exhibit views with stable fragment links and browser history. */
(() => {
  const sections = [...document.querySelectorAll('main > section')];
  const menu = document.querySelector('.exhibit-menu');
  const small = matchMedia('(max-width: 900px)');
  const resetMenu = () => { menu.open = !small.matches; };
  resetMenu();
  small.addEventListener('change', resetMenu);

  function reveal(hash, focus = false) {
    let target;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return; }
    if (!target && hash.startsWith('#card-')) target = document.getElementById('timeline');
    if (!hash || hash === '#main') target = document.getElementById('home');
    const section = target?.closest('main > section');
    if (!section) return;
    sections.forEach(item => { item.hidden = item !== section; });
    document.querySelectorAll('nav[aria-label="Main navigation"] a').forEach(link => {
      if (link.hash === `#${section.id}`) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const reader = target.closest('.poem-reader');
    if (reader) reader.open = true;
    if (small.matches) menu.open = false;
    if (focus) {
      if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
      target.focus({preventScroll: true});
      target.scrollIntoView({block: 'start', behavior: 'instant'});
    }
  }

  // Capture reveals the destination before the timeline's own focus handlers run.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target?.closest('main > section') && !link.hash.startsWith('#card-')) return;
    history.pushState(null, '', link.hash);
    reveal(link.hash, true);
    event.preventDefault();
  }, true);
  addEventListener('popstate', () => reveal(location.hash, true));
  addEventListener('hashchange', () => reveal(location.hash, true));
  // Timeline content is fetched asynchronously, including deep-link destinations.
  document.addEventListener('exhibit-ready', () => reveal(location.hash, Boolean(location.hash)));
})();
