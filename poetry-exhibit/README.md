# Poetry Across the Partition

A static digital exhibit with an interactive, two-track timeline of history and poetry. No dependencies or build step.

Serve `dist/` with any static web server so the browser can load the timeline JSON.

## Interactive timeline

Serve the static files (the timeline loads its JSON over HTTP):

```sh
python3 -m http.server 8000 --directory poetry-exhibit/dist
```

Then open http://localhost:8000. No dependencies or build step are required.

- `dist/timeline-data.json` holds all 22 cards, references, relationships, and August markers. Edit content here without changing rendering code.
- Each card has a stable `id`, `dateLabel`, `datePrecision`, `track`, `title`, `description`, `referenceIds`, and `relatedCardIds`. Poetry adds separate `composition`, `publication`, and `edition` fields.
- `axisDate` is a numeric chronological sorting coordinate (fractional years for dates within a year). Approximate coordinates are presentation aids, not claims of exact dates. The displayed date and precision are authoritative.
- Optional `dateRange` stores numeric `start` and `end` coordinates and `openEnd`. The displacement endpoint is illustrative and explicitly labeled as open. Span geometry is calculated from the same shared axis as the cards.
- `views.august.markers` defines the expanded day markers. Faiz has one month-level marker; it is never assigned a particular day.
- Related IDs must resolve to existing cards and link back in both directions. Selecting one opens its details and moves focus to its card.
- Desktop uses horizontal scrolling; mobile uses a vertical axis with History left and Poetry right. Tab reaches cards and jump buttons, Enter/Space activates native buttons, arrows scroll a focused timeline, Home/End reach its edges, and Escape closes details and restores focus.
- The overview expands chronological spacing for readability; it does not imply proportional elapsed time. The August view explicitly identifies its expanded scale.

## Editorial status

The references are attached to their cards. The dedicated Punjab annexation source and Allahabad Address text have been added. Unverified references, first-publication dates, and translation/poem selections are marked for review. “Freedom’s Dawn” is presented using the text supplied for the exhibit; other poem texts remain pending. Add verified URLs to reference records when available; references without a URL display their bibliographic citation and editorial note.

## Browser checks

With the server running and Google Chrome installed:

```sh
python3 poetry-exhibit/tests/verify_timeline.py http://127.0.0.1:8000
```

The dependency-free smoke runner checks all cards and reference IDs, reciprocal links, focus movement in all eight requested directions, August marker overlap, mobile track placement, closing details, period jumps, keyboard scrolling, and page overflow. It creates and removes a temporary QA page. Requested window widths are 1440, 390, and 320 pixels; the report includes actual browser width.

## GitHub Pages

The repository's `.github/workflows/deploy-pages.yml` publishes only `poetry-exhibit/dist/` when changes are pushed to `main`. No build step or dependency installation is required.

In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the publishing source. Push the workflow to `main`, or run **Deploy exhibit to GitHub Pages** manually from the Actions tab after enabling Pages.

Expected address after a successful deployment: https://syedshazli.github.io/Poetry_Across_Partition/

## Meet the Poets

The five short introductions live in `timeline-data.json` under `poets`, with `firstCardId` pointing to each poet’s first timeline entry. Their order follows those entries. Poetry cards use `poetId` for a separate, keyboard-accessible name link back to the introduction. Iqbal’s introduction starts at “Taranah-i-Hindi”; its related-card link opens “Taranah-i-Milli” and vice versa.

## Portrait images

The five poet portraits are stored locally in `dist/images/poets/`. Each poet’s `image` record in `timeline-data.json` holds its alt text, dimensions, focal position, source, creator credit, and license. The cards link to the Commons source pages and license terms. Original image files are preserved (Iqbal uses a Commons thumbnail); monochrome styling and framing are applied with CSS. CC BY-SA portraits remain available under CC BY-SA 4.0.

## Freedom’s Dawn

The Faiz card’s `poem` field contains the supplied translation, stored as five stanzas and 25 separate lines. Wording and ASCII punctuation are preserved; line breaks and stanza spacing follow the linked IIT Kanpur transcription. Each stanza and line has a stable ID. The reader preserves the poem text and translator credit. Optional `poem.annotations` records identify a line ID and exact phrase, plus definition, dictionary source, and interpretation. Highlights are native buttons that reveal notes after their stanza; Close or Escape dismisses a note and restores focus. Keep line IDs stable when adding annotations.

The full poem is rendered once in the permanent **Poems** section immediately below the timeline. The main navigation links to that section; the Faiz timeline details link directly to the poem heading, and the reader links back to the timeline.

The whole-poem analysis is now populated under **Reading the Poem**, connecting the opening question with the final call to keep going. The shared last-stanza highlight opens a note on public celebration, criticism of discontent, medical imagery, and continuing darkness.

## Poet backgrounds

Each poet card has a Background button that opens a native modal dialog. Edit `poets[].background.paragraphs` and `poets[].background.sources` in `timeline-data.json` to update the biography and citations. The popup closes with its Close button, Escape, or a click outside it, and restores focus to the opening button.

The final reading now puts Foster’s quest approach in conversation with Gopi Chand Narang’s “How not to Read Faiz Ahmad Faiz,” translated by Baidar Bakht (2009). `poem.wholePoemAnalysis.sources` holds the secondary citations. The discussion includes printed page references and distinguishes Narang’s own example from the exhibit’s application to “Freedom’s Dawn.”
