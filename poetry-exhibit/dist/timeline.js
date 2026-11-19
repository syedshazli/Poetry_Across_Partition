'use strict';
(async () => {
  const canvas = document.querySelector('#timeline-canvas');
  const viewport = document.querySelector('#timeline-viewport');
  const detail = document.querySelector('#card-detail');
  const status = document.querySelector('#timeline-status');
  const mobile = window.matchMedia('(max-width: 700px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let data, view = 'full', selected = null;
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const scrollToCard = id => {
    const node = document.getElementById(`card-${id}`);
    if (!node) return;
    node.focus({preventScroll: true});
    node.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'nearest', inline: 'center'});
  };
  function reference(id) {
    const ref = data.references[id];
    const li = el('li');
    if (ref.url) {
      const a = el('a', `${id} · ${ref.title}`);
      a.href = ref.url;
      li.append(a);
    } else li.append(el('span', `${id} · ${ref.title}`));
    if (ref.note) li.append(el('p', ref.note, 'source-note'));
    return li;
  }
  const poetDialog = document.querySelector('#poet-background');
  let backgroundTrigger = null;
  let backgroundScroll = 0;
  function openPoetBackground(poet, trigger) {
    backgroundTrigger = trigger;
    document.querySelector('#poet-background-title').textContent = poet.name;
    const content = document.querySelector('#poet-background-content');
    content.replaceChildren();
    poetDialog.classList.toggle('has-journey-map', Boolean(poet.journey));
    const context = poet.background.partitionContext;
    if (context) {
      const box = el('section', null, 'poet-partition-context');
      box.append(el('h3', context.label), el('p', context.text));
      const links = el('p', null, 'source-note');
      (context.sourceIds || []).forEach((id, index) => {
        const source = poet.background.sources.find(s => s.id === id);
        if (!source) return;
        const link = el('a', `Read source ${index + 1} ↗`);link.setAttribute('aria-label', source.title);link.href = source.url;link.target = '_blank';link.rel = 'noopener noreferrer';
        if (links.childNodes.length) links.append(document.createTextNode(' · '));
        links.append(link);
      });
      box.append(links);content.append(box);
    }
    if (poet.journey) window.createPoetJourneyMap(poet.journey, content);
    if (poet.background.sectionTitle) content.append(el('h3', poet.background.sectionTitle));
    poet.background.paragraphs.forEach(paragraph => content.append(el('p', paragraph)));
    content.append(el('h3', 'Sources'));
    const sources = el('ul');
    poet.background.sources.forEach(source => {
      const item = el('li');
      const link = el('a', source.title);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
      sources.append(item);
    });
    content.append(sources);
    backgroundScroll = window.scrollY;
    document.documentElement.classList.add('poet-popup-open');
    document.body.style.top = `-${backgroundScroll}px`;
    document.body.classList.add('poet-popup-open');
    window.scrollTo(0, 0);
    poetDialog.showModal();
    document.querySelector('#poet-background-title').focus({preventScroll:true});
  }
  document.querySelector('#close-poet-background').addEventListener('click', () => poetDialog.close());
  poetDialog.addEventListener('close', () => {
    document.body.classList.remove('poet-popup-open');
    document.documentElement.classList.remove('poet-popup-open');
    document.body.style.top = '';
    window.scrollTo({top:backgroundScroll, left:0, behavior:'instant'});
    backgroundTrigger?.focus({preventScroll: true});
  });
  poetDialog.addEventListener('click', event => {
    const rect = poetDialog.getBoundingClientRect();
    if (event.target === poetDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) poetDialog.close();
  });
  function renderPhotographs() {
    const list = document.querySelector('#partition-photo-list');
    const sourceLink = (label, url) => {
      const link = el('a', label);link.href = url;link.target = '_blank';link.rel = 'noopener noreferrer';return link;
    };
    (data.photographs || []).forEach(photo => {
      const item = el('article', null, 'partition-photo-card');
      item.id = `photo-${photo.id}`;item.tabIndex = -1;
      const figure = el('figure');
      const full = sourceLink(`View ${photo.title} at full size`, photo.src);
      full.className = 'partition-photo-image';
      const image = el('img');image.src = photo.src;image.alt = photo.alt;
      image.width = photo.width;image.height = photo.height;image.loading = 'lazy';image.decoding = 'async';
      full.replaceChildren(image);
      const caption = el('figcaption');
      const heading = el('h4', photo.title);heading.id = `photo-${photo.id}-title`;
      item.setAttribute('aria-labelledby', heading.id);
      caption.append(el('p', photo.date, 'partition-photo-date'), heading, el('p', photo.caption));
      const credit = el('p', null, 'partition-photo-credit');
      credit.append(document.createTextNode(`${photo.credit}. `),sourceLink('Archive record & reuse information',photo.sourceUrl));
      caption.append(credit);
      figure.append(full,caption);item.append(figure);
      const story = el('details', null, 'partition-travel-account');
      story.append(el('summary', photo.story.title),el('p',photo.story.text),sourceLink(photo.story.sourceTitle,photo.story.url));
      item.append(story);list.append(item);
    });
  }
  function publicationDetails(card) {
    const section = el('section', null, 'poem-publication');
    const title = el('h4', 'Publication & edition');
    title.id = `${card.id}-publication-title`;
    section.setAttribute('aria-labelledby', title.id);
    const list = el('dl');
    (card.publicationDetails || []).forEach(item => {
      const value = el('dd', item.text);
      const links = el('span', null, 'publication-citations');
      (item.referenceIds || []).forEach(id => {
        const source = data.references[id];
        if (!source?.url) return;
        const link = el('a', id);
        link.href = source.url;link.target = '_blank';link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', source.title);
        links.append(document.createTextNode(' '), link);
      });
      value.append(links);list.append(el('dt', item.label), value);
    });
    section.append(title, list);return section;
  }
  function renderPoems() {
    const list = document.querySelector('#poem-list');
    const poetOrder = data.poets.map(poet => poet.id);
    data.cards.filter(c => c.poem || c.readerPlaceholder).sort((a, b) => poetOrder.indexOf(a.poetId) - poetOrder.indexOf(b.poetId)).forEach(c => {
      const poem = c.poem || c.readerPlaceholder;
      const article = el('details', null, 'poem-reader');
      article.setAttribute('aria-labelledby', `${poem.id}-title`);
      const heading = el('h3', poem.title);
      heading.id = `${poem.id}-title`;
      heading.tabIndex = -1;
      const summary = el('summary', null, 'poem-summary');
      const closedLabel = c.poem ? 'View poem' : 'View details';
      const state = el('span', closedLabel, 'poem-disclosure-label');
      summary.append(heading, state);
      const body = el('div', null, 'poem-reader-body');
      article.append(summary, body);
      article.addEventListener('toggle', () => {state.textContent = article.open ? (c.poem ? 'Hide poem' : 'Hide details') : closedLabel;});
      if (c.readerPlaceholder && !c.poem) {
        body.append(el('p', poem.message, 'poem-text-status'), publicationDetails(c));
        const back = el('a', 'Find on timeline ↑', 'text-link');
        back.href = `#card-${c.id}`;
        back.addEventListener('click', event => {event.preventDefault();setView('full');scrollToCard(c.id);});
        body.append(back);list.append(article);return;
      }
      body.append(el('p', poem.translator ? `${poem.author} · Translated by ${poem.translator}` : poem.author, 'poem-byline'));
      const text = el('div', null, 'poem-text');
      text.id = poem.id;
      text.lang = poem.language;
      text.setAttribute('aria-label', poem.title);
      text.tabIndex = 0;
      const readingHelp = el('p', 'Scroll sideways if needed to read each line as printed.', 'poem-scroll-help');
      readingHelp.id = `${poem.id}-scroll-help`;
      text.setAttribute('aria-describedby', readingHelp.id);
      body.append(publicationDetails(c), readingHelp);
      const notes = new Map();
      function annotation(note) {
        if (notes.has(note.id)) return notes.get(note.id);
        const panel = el('aside', null, 'poem-annotation');
        panel.id = note.id;
        panel.hidden = true;
        panel.setAttribute('aria-labelledby', `${note.id}-heading`);
        const title = el('h4', note.term);
        title.id = `${note.id}-heading`;
        panel.append(title);
        const definitions = note.definitions || (note.definition ? [{word: note.term, definition: note.definition, dictionaryName: note.dictionaryName, dictionaryUrl: note.dictionaryUrl}] : []);
        if (definitions.length) {
          const meanings = el('div', null, 'word-meanings');
          meanings.append(el('h5', 'Word meanings'));
          definitions.forEach(entry => {
            const item = el('div', null, 'word-meaning');
            item.append(el('h6', entry.word), el('p', entry.definition));
            if (entry.dictionaryUrl) {
              const dictionary = el('a', `Read the ${entry.dictionaryName} entry ↗`);
              dictionary.href = entry.dictionaryUrl;
              dictionary.target = '_blank';
              dictionary.rel = 'noopener noreferrer';
              dictionary.setAttribute('aria-label', `Read ${entry.word} in ${entry.dictionaryName} (opens in a new tab)`);
              item.append(dictionary);
            }
            meanings.append(item);
          });
          meanings.append(el('p', 'Meanings are paraphrased from the linked dictionaries.', 'dictionary-note'));
          panel.append(meanings);
        }
        panel.append(el('h5', 'A possible reading'), el('p', note.analysis));
        if (note.source) {
          const source = el('p', null, 'annotation-source');
          const link = el('a', note.source.title);
          link.href = note.source.url;
          source.append(link);
          if (note.source.note) source.append(document.createTextNode(`. ${note.source.note}`));
          panel.append(source);
        }
        const state = {panel, triggers: [], active: null};
        const dismiss = () => {
          panel.hidden = true;
          state.triggers.forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
          state.active?.focus({preventScroll: true});
        };
        const close = el('button', 'Close note', 'close-annotation');
        close.type = 'button';
        close.addEventListener('click', dismiss);
        panel.addEventListener('keydown', event => {if (event.key === 'Escape') {event.preventDefault(); dismiss();}});
        panel.append(close);
        notes.set(note.id, state);
        return state;
      }
      poem.stanzas.forEach(stanza => {
        const paragraph = el('p', null, 'poem-stanza');
        paragraph.id = stanza.id;
        const stanzaNotes = new Set();
        stanza.lines.forEach((line, index) => {
          const span = el('span', null, 'poem-line');
          span.id = line.id;
          span.dataset.lineId = line.id;
          const annotations = (poem.annotations || []).flatMap(note =>
            (note.segments || [{lineId: note.lineId, quote: note.quote}])
              .filter(segment => segment.lineId === line.id)
              .map(segment => ({note, quote: segment.quote})))
            .sort((a, b) => line.text.indexOf(a.quote) - line.text.indexOf(b.quote));
          let offset = 0;
          annotations.forEach(({note, quote}) => {
            const start = line.text.indexOf(quote, offset);
            if (start < offset) return;
            span.append(document.createTextNode(line.text.slice(offset, start)));
            const highlight = el('button', quote, 'poem-highlight');
            highlight.type = 'button';
            highlight.id = `${note.id}-${line.id}-trigger`;
            highlight.setAttribute('aria-expanded', 'false');
            highlight.setAttribute('aria-controls', note.id);
            const state = annotation(note);
            state.triggers.push(highlight);
            highlight.addEventListener('click', () => {
              state.active = highlight;
              state.panel.hidden = !state.panel.hidden;
              state.triggers.forEach(trigger => trigger.setAttribute('aria-expanded', String(!state.panel.hidden)));
              if (!state.panel.hidden) state.panel.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'nearest'});
            });
            span.append(highlight);
            stanzaNotes.add(note.id);
            offset = start + quote.length;
          });
          span.append(document.createTextNode(line.text.slice(offset)));
          paragraph.append(span);
          if (index < stanza.lines.length - 1) paragraph.append(el('br'));
        });
        text.append(paragraph, ...[...stanzaNotes].map(id => notes.get(id).panel));
      });
      body.append(text);
      const wholePoem = el('section', null, 'whole-poem-analysis');
      wholePoem.setAttribute('aria-labelledby', `${poem.id}-analysis-title`);
      const analysisTitle = el('h4', poem.wholePoemAnalysis?.title || 'Whole-poem claim & analysis');
      analysisTitle.id = `${poem.id}-analysis-title`;
      wholePoem.append(analysisTitle);
      if (poem.wholePoemAnalysis?.claim) wholePoem.append(el('p', poem.wholePoemAnalysis.claim, 'whole-poem-claim'));
      if (poem.wholePoemAnalysis?.analysis) wholePoem.append(el('p', poem.wholePoemAnalysis.analysis));
      const readingSources = poem.wholePoemAnalysis?.sources || (poem.wholePoemAnalysis?.source ? [poem.wholePoemAnalysis.source] : []);
      if (readingSources.length) {
        wholePoem.append(el('h5', 'Secondary sources'));
        const sourceList = el('ul', null, 'reading-sources');
        readingSources.forEach(source => {
          const credit = el('li', null, 'annotation-source');
          const link = el('a', source.title);
          link.href = source.url;
          credit.append(link);
          if (source.note) credit.append(el('p', source.note));
          sourceList.append(credit);
        });
        wholePoem.append(sourceList);
      }
      if (poem.wholePoemAnalysis) body.append(wholePoem);

      const sources = el('details', null, 'poem-sources');
      sources.append(el('summary', poem.translator ? 'Text & translation source' : 'Text source'));
      const references = el('ul');
      c.referenceIds.forEach(id => references.append(reference(id)));
      sources.append(references);
      body.append(sources);
      const back = el('a', 'Find on timeline ↑', 'text-link');
      back.href = `#card-${c.id}`;
      back.addEventListener('click', event => {
        event.preventDefault();
        setView('full');
        scrollToCard(c.id);
      });
      body.append(back);
      list.append(article);
    });
  }
  function openCard(id, reveal = true) {
    selected = id;
    const c = data.cards.find(card => card.id === id);
    document.querySelectorAll('.timeline-card').forEach(b => b.setAttribute('aria-expanded', String(b.dataset.id === id)));
    detail.replaceChildren();
    detail.hidden = false;
    detail.dataset.track = c.track;
    detail.append(el('p', `${c.track === 'history' ? 'History' : 'Poetry'} / ${c.dateLabel}`, 'eyebrow'));
    const heading = el('h3', c.poem ? c.poem.title : c.title);
    heading.id = 'detail-title';
    detail.append(heading);
    detail.append(el('p', c.description));
    if (c.photographIds?.length) {
      const photos = el('nav', null, 'related-photographs');
      photos.setAttribute('aria-label', 'Related historical photographs');
      c.photographIds.forEach(id => {
        const photo = data.photographs.find(p => p.id === id);
        if (!photo) return;
        const link = el('a', photo.title);link.href = `#photo-${id}`;photos.append(link);
      });
      detail.append(photos);
    }
    if (c.poem || c.readerPlaceholder) {
      const reader = c.poem || c.readerPlaceholder;
      const link = el('a', c.poem ? 'Read the poem ↓' : 'View poem details ↓', 'text-link read-poem');
      link.href = `#${reader.id}-title`;
      link.addEventListener('click', event => {
        event.preventDefault();
        const target = document.getElementById(`${reader.id}-title`);
        target.closest('.poem-reader').open = true;
        target.focus({preventScroll: true});
        target.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'start'});
      });
      detail.append(link);
    }
    if (c.dateRange?.openEnd) detail.append(el('p', 'Span: 1947 onward. The endpoint is illustrative, not a fixed end to displacement.', 'source-note'));
    if (c.track === 'poetry') {
      const dl = el('dl');
      [['Written / dated', 'composition'], ['Published', 'publication'], ['Exhibit edition / translation', 'edition']].forEach(([label, key]) => dl.append(el('dt', label), el('dd', c[key])));
      detail.append(dl);
    }
    if (c.editorialNote) detail.append(el('p', c.editorialNote, 'editorial-note'));
    detail.append(el('h4', 'Sources'));
    const list = el('ul');
    c.referenceIds.forEach(ref => list.append(reference(ref)));
    detail.append(list);
    if (c.relatedCardIds.length) {
      detail.append(el('h4', 'Related cards'));
      const links = el('div', null, 'related-links');
      c.relatedCardIds.forEach(relatedId => {
        const other = data.cards.find(card => card.id === relatedId);
        const button = el('button', `${other.dateLabel} · ${other.title} ↗`);
        button.type = 'button';
        button.dataset.related = relatedId;
        button.addEventListener('click', () => {
          if (view === 'august' && !['independence', 'radcliffe', 'faiz', 'displacement'].includes(relatedId)) setView('full');
          openCard(relatedId, false);
          scrollToCard(relatedId);
          status.textContent = `Selected related card: ${other.title}, ${other.dateLabel}. Details updated below the timeline.`;
        });
        links.append(button);
      });
      detail.append(links);
    }
    const close = el('button', 'Close details ↑', 'close-detail');
    close.type = 'button';
    close.addEventListener('click', closeDetail);
    detail.append(close);
    if (reveal) {
      detail.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'nearest'});
    }
  }
  function closeDetail() {
    const id = selected;
    detail.hidden = true;
    selected = null;
    document.querySelectorAll('.timeline-card').forEach(b => b.setAttribute('aria-expanded', 'false'));
    scrollToCard(id);
  }
  function render() {
    canvas.replaceChildren();
    const august = view === 'august';
    const ordered = [...data.cards].sort((a, b) => a.axisDate - b.axisDate);
    const groups = august ? data.views.august.markers : ordered.map(c => ({label: c.dateLabel, ids: [c.id]}));
    const step = 244;
    canvas.style.setProperty('--length', `${groups.length * step}px`);
    canvas.classList.toggle('august-view', august);
    groups.forEach((g, index) => {
      const cell = el('div', null, 'date-cell');
      cell.style.setProperty('--position', `${index * step}px`);
      const tick = el('span', g.label, 'axis-date');
      cell.append(tick);
      g.ids.forEach(id => {
        const c = data.cards.find(card => card.id === id);
        cell.append(cardButton(c));
      });
      canvas.append(cell);
    });
    if (august) {
      const month = el('div', null, 'month-marker');
      month.append(el('span', 'August 1947 · month-level marker', 'month-label'), cardButton(data.cards.find(c => c.id === 'faiz')));
      canvas.append(month);
      const span = el('button', 'History · Punjab displacement · throughout this period and beyond →', 'august-displacement');
      span.type = 'button';
      span.id = 'card-displacement';
      span.dataset.id = 'displacement';
      span.classList.add('timeline-card');
      span.setAttribute('aria-controls', 'card-detail');
      span.setAttribute('aria-expanded', String(selected === 'displacement'));
      span.addEventListener('click', () => openCard('displacement'));
      canvas.append(span);
    } else {
      // Span ends share the same chronological positions as the event markers.
      const anchorYears = ordered.map(c => c.axisDate);
      const position = year => {
        let i = anchorYears.findIndex(y => y >= year);
        const offset = mobile.matches ? 53 : 22;
        if (i === -1) return (anchorYears.length - 1) * step + offset;
        if (i === 0) return offset;
        return (i - 1 + (year - anchorYears[i - 1]) / (anchorYears[i] - anchorYears[i - 1])) * step + offset;
      };
      data.cards.filter(c => c.dateRange && c.id !== 'independence').forEach((c, i) => {
        const band = el('div', `${c.dateLabel}${c.dateRange.openEnd ? ' →' : ''}`, 'duration-band');
        band.style.setProperty('--start', `${position(c.dateRange.start)}px`);
        band.style.setProperty('--span', `${Math.max(18, position(c.dateRange.end) - position(c.dateRange.start))}px`);
        band.style.setProperty('--lane', String(i % 3));
        band.setAttribute('aria-label', `${c.title}: ${c.dateLabel}`);
        canvas.append(band);
      });
    }
  }
  function cardButton(c) {
    const b = el('button', null, `timeline-card ${c.track}`);
    b.type = 'button'; b.id = `card-${c.id}`; b.dataset.id = c.id;
    b.setAttribute('aria-expanded', String(selected === c.id));
    b.setAttribute('aria-controls', 'card-detail');
    b.append(el('span', `${c.track === 'history' ? 'History' : 'Poetry'} · ${c.dateLabel}`, 'card-date'), el('strong', c.title), el('span', c.poem ? 'Read poem ↗' : c.dateRange ? 'Explore span ↗' : 'Read more ↗', 'card-action'));
    b.onclick = () => openCard(c.id);
    if (!c.poetId) return b;
    const poet = data.poets.find(p => p.id === c.poetId);
    const name = el('a', poet.name, 'poet-link');
    name.href = `#poet-${poet.id}`;
    name.setAttribute('aria-label', `Meet ${poet.name}`);
    name.addEventListener('click', event => {
      event.preventDefault();
      const intro = document.getElementById(`poet-${poet.id}`);
      intro.focus({preventScroll: true});
      intro.scrollIntoView({behavior: reduced.matches ? 'instant' : 'smooth', block: 'center'});
      history.replaceState(null, '', name.hash);
    });
    const fragment = document.createDocumentFragment();
    fragment.append(name, b);
    return fragment;
  }
  function setView(next) {
    view = next;
    document.querySelector('#view-title').textContent = next === 'august' ? 'August 1947 detail' : 'Full timeline';
    document.querySelector('#scale-note').textContent = next === 'august' ? 'Expanded August view · day markers spaced for reading; Faiz is dated to the month' : 'Chronological overview · spacing expanded for reading, not proportional to elapsed time';
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === next)));
    detail.hidden = true; selected = null;
    render(); viewport.scrollTo(0, 0);
    status.textContent = next === 'august' ? 'August 1947 detail opened.' : 'Full timeline opened.';
  }
  try {
    const response = await fetch('timeline-data.json');
    if (!response.ok) throw new Error('Timeline data could not be loaded.');
    data = await response.json();
    renderPoems();
    renderPhotographs();
    const poets = [...data.poets];
    poets.forEach(poet => {
      const card = el('article', null, 'poet-intro');
      card.id = `poet-${poet.id}`;
      card.tabIndex = -1;
      card.setAttribute('aria-labelledby', `poet-name-${poet.id}`);
      const heading = el('h3', poet.name);
      heading.id = `poet-name-${poet.id}`;
      const link = el('a', 'Find on timeline ↓', 'find-poet');
      link.href = `#card-${poet.firstCardId}`;
      link.addEventListener('click', event => {
        event.preventDefault();
        setView('full');
        scrollToCard(poet.firstCardId);
        history.replaceState(null, '', link.hash);
        status.textContent = `Timeline entry: ${poet.name}.`;
      });
      if (poet.image) {
        const image = poet.image;
        const figure = el('figure', null, 'poet-portrait');
        const portrait = el('img');
        portrait.src = image.src;
        portrait.alt = image.alt;
        portrait.width = image.width;
        portrait.height = image.height;
        portrait.loading = 'lazy';
        portrait.decoding = 'async';
        portrait.style.objectPosition = image.position;
        const caption = el('figcaption');
        const credit = el('a', image.credit);
        credit.href = image.sourceUrl;
        const license = el('a', image.license);
        license.href = image.licenseUrl;
        caption.append(credit, document.createTextNode(' · '), license);
        figure.append(portrait, caption);
        card.append(figure);
      }
      const background = el('button', 'Background ↗', 'poet-background-button');
      background.type = 'button';
      background.setAttribute('aria-label', `Read about ${poet.name}`);
      background.setAttribute('aria-haspopup', 'dialog');
      background.setAttribute('aria-controls', 'poet-background');
      background.addEventListener('click', () => openPoetBackground(poet, background));
      const dates = el('p', null, 'poet-life-dates');
      if (poet.lifeDates) {
        const format = new Intl.DateTimeFormat('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
        const addDate = (label, value) => {
          const time = el('time', format.format(new Date(`${value}T00:00:00Z`)));
          time.dateTime = value;
          dates.append(document.createTextNode(`${label} `), time);
        };
        addDate('Born', poet.lifeDates.born);
        if (poet.lifeDates.died) {
          dates.append(el('br'));
          addDate('Died', poet.lifeDates.died);
        }
      }
      if (poet.journey) { background.textContent = poet.journey.buttonLabel; background.setAttribute('aria-label', `Explore ${poet.name}’s journey and background`); }
      card.append(heading, dates, el('p', poet.description), background, link);
      document.querySelector('#poet-list').append(card);
    });
    render();
    document.querySelector('#reference-list').append(...Object.keys(data.references).map(reference));
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {setView(b.dataset.view); viewport.focus({preventScroll: true});}));
    document.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => {setView('full'); scrollToCard(b.dataset.jump);}));
    document.querySelectorAll('a[href="#timeline"]').forEach(a => a.addEventListener('click', () => setView('full')));
    mobile.addEventListener('change', render);
    viewport.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !detail.hidden) {closeDetail(); return;}
      if (e.target !== viewport || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
      e.preventDefault();
      if (e.key === 'Home' || e.key === 'End') viewport.scrollTo({left: e.key === 'Home' ? 0 : viewport.scrollWidth, top: e.key === 'Home' ? 0 : viewport.scrollHeight});
      else viewport.scrollBy({left: mobile.matches ? 0 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -244 : 244), top: mobile.matches ? (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -244 : 244) : 0});
    });
    detail.addEventListener('keydown', e => {if (e.key === 'Escape') closeDetail();});
  } catch (error) {
    canvas.replaceChildren(el('p', 'The timeline could not load. Serve this exhibit with a static web server and try again.'));
    status.textContent = error.message;
  }
})();
