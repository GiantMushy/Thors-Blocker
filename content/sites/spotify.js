'use strict';

// Spotify: only podcasts you follow. Unfollowed shows/episodes are hidden from Home (and the
// "Show all" pages it links to) and from the right-hand panel, and if one starts playing
// (autoplay, a recommendation, anything) playback is paused and the tab is sent to TB.STOP_URL.
//
// Spotify doesn't expose "is this show followed" in the page, so the followed set is learned from
// the Your Library sidebar (which only lists shows you follow) and from show pages' Follow button,
// and persisted in chrome.storage.local.
(() => {
  const STORE_KEY = 'spotifyFollowedShows'; // { showId: showName }
  const SIDEBAR = '#Desktop_LeftSidebar_Id, [data-testid="left-sidebar"], nav[aria-label="Main"]';
  const RIGHT_PANEL = '#Desktop_PanelContainer_Id, [data-testid="right-sidebar"]';
  const PODCAST_LINK = 'a[href*="/show/"], a[href*="/episode/"]';
  const GRID = '[data-testid="grid-container"]';
  // Links to any piece of content; used to tell where one card ends and the next begins.
  const CONTENT_HREF = /\/(episode|show|album|playlist|artist|track|audiobook|collection)(?:\/([A-Za-z0-9]+))?/;
  // Pages that are recommendation feeds: Home ("/", or "/home?facet=…" when a filter chip like
  // Podcasts is picked), plus the "Show all" section and genre pages it links to.
  const FEED_PAGE = /^\/($|home\/?$|section\/|genre\/)/;

  let followed = {};
  let storeLoaded = false;
  let sidebarSeen = false;
  let stopping = false;

  chrome.storage.local.get({ [STORE_KEY]: {} }, (r) => {
    followed = r[STORE_KEY] || {};
    storeLoaded = true;
  });

  function save() {
    chrome.storage.local.set({ [STORE_KEY]: followed });
  }

  function showId(href) {
    const m = /\/show\/([A-Za-z0-9]+)/.exec(href || '');
    return m && m[1];
  }

  function remember(id, name) {
    if (!id) return false;
    if (id in followed && (!name || followed[id] === name)) return false;
    followed[id] = name || followed[id] || '';
    return true;
  }

  function mentionsFollowedShow(text) {
    return Object.values(followed).some((name) => name && text.includes(name));
  }

  // Decide using the show link if the element has one, otherwise by show name in its text.
  function isFollowed(el) {
    const showLink = el.matches('a[href*="/show/"]') ? el : el.querySelector('a[href*="/show/"]');
    if (showLink) return showId(showLink.getAttribute('href')) in followed;
    return mentionsFollowedShow(TB.textOf(el));
  }

  function learnFromSidebar() {
    const bar = document.querySelector(SIDEBAR);
    if (!bar) return;
    let changed = false;
    // Library rows carry the show's URI (spotify:show:<id>) in their title id / aria-labelledby.
    for (const title of bar.querySelectorAll('[id^="listrow-title-spotify:show:"]')) {
      changed = remember(title.id.split(':').pop(), TB.textOf(title)) || changed;
    }
    for (const row of bar.querySelectorAll('[aria-labelledby*="spotify:show:"], [id*="spotify:show:"]')) {
      const m = /spotify:show:([A-Za-z0-9]+)/.exec(row.getAttribute('aria-labelledby') || row.id);
      if (m) changed = remember(m[1], '') || changed;
    }
    for (const a of bar.querySelectorAll('a[href*="/show/"]')) {
      changed = remember(showId(a.getAttribute('href')), TB.textOf(a) || a.getAttribute('aria-label')) || changed;
    }
    if (bar.querySelector('[role="row"], [id^="listrow-title-"]')) sidebarSeen = true;
    if (changed) save();
  }

  function learnFromShowPage() {
    const id = showId(location.pathname);
    const main = document.querySelector('main');
    if (!id || !main) return;
    const button = [...main.querySelectorAll('button')].find((b) => /^Follow(ing)?$/.test(TB.textOf(b)));
    if (!button) return;
    if (TB.textOf(button) === 'Following') {
      const h1 = main.querySelector('h1');
      if (remember(id, h1 ? TB.textOf(h1) : '')) save();
    } else if (id in followed) {
      delete followed[id];
      save();
    }
  }

  // Can el be the container of a single item? An item holds at most one episode and one show
  // (an episode card links to both) and nothing else.
  function isSingleItem(el) {
    const keys = { episode: new Set(), show: new Set(), other: new Set() };
    for (const a of el.querySelectorAll('a[href]')) {
      const m = CONTENT_HREF.exec(a.getAttribute('href'));
      if (m) (keys[m[1]] || keys.other).add(m[0]);
    }
    return keys.episode.size <= 1 && keys.show.size <= 1 && keys.other.size === 0;
  }

  // The whole card/grid cell around a podcast link, found by climbing until the next ancestor would
  // also contain another item. Spotify uses several card layouts (small tiles, large preview cards
  // with a label above them), so this avoids depending on any one of them, and hiding the whole
  // cell lets the remaining cards close up instead of leaving gaps.
  function itemContainer(link, root) {
    let el = link;
    while (el.parentElement && el.parentElement !== root && !el.parentElement.matches('section, main')) {
      if (!isSingleItem(el.parentElement)) break;
      el = el.parentElement;
    }
    return el;
  }

  // True if el sits inside something we hid within section (ignoring the section itself).
  function hiddenWithin(el, section) {
    const hidden = el.closest(`[${TB.HIDDEN_ATTR}]`);
    return !!hidden && hidden !== section && section.contains(hidden);
  }

  // The shelf's title block (e.g. "Popular with listeners of <show>"): from the heading, climb as far
  // as possible without taking in any of the cards we hid. Card titles are headings too, so skip
  // anything inside the card grid.
  function shelfHeader(section) {
    let el = [...section.querySelectorAll('h1, h2, h3')].find((h) => !h.closest(GRID));
    if (!el) return null;
    while (el.parentElement && el.parentElement !== section && !el.parentElement.querySelector(`[${TB.HIDDEN_ATTR}]`)) {
      el = el.parentElement;
    }
    return el;
  }

  function filterPodcasts(root) {
    for (const a of root.querySelectorAll(PODCAST_LINK)) {
      const item = itemContainer(a, root);
      TB.setHidden(item, !isFollowed(item));
    }
    // Drop shelves with nothing left in them, so no empty headings remain. Links in the shelf's title
    // block ("Show all", or the show a "Popular with listeners of" shelf is based on) don't count.
    for (const section of root.querySelectorAll('section')) {
      const header = shelfHeader(section);
      const items = [...section.querySelectorAll('a[href]')].filter(
        (a) => !/\/(section|genre)\//.test(a.getAttribute('href')) && !(header && header.contains(a))
      );
      TB.setHidden(section, items.length > 0 && items.every((a) => hiddenWithin(a, section)));
    }
    fitGridRows(root);
  }

  // Shelves are grids with a fixed number of rows (grid-template-rows: repeat(--row-count, 1fr)); cards
  // beyond those rows overflow into zero-height rows. When cards are hidden the rest move up, but the
  // reserved rows keep their height and leave empty space, so shrink the row count to what's still
  // filled. spotify.css applies --tb-row-count only while the extension is on.
  function fitGridRows(root) {
    for (const grid of root.querySelectorAll(GRID)) {
      const cells = [...grid.children];
      const visible = cells.filter((c) => !c.hasAttribute(TB.HIDDEN_ATTR)).length;
      const rowCount = parseInt(grid.style.getPropertyValue('--row-count'), 10);
      const columns = getComputedStyle(grid).gridTemplateColumns;
      if (visible === cells.length || !rowCount || columns.includes('(')) {
        grid.removeAttribute('data-tb-rows');
        continue;
      }
      const perRow = columns.split(' ').filter(Boolean).length || 1;
      const rows = Math.max(1, Math.min(rowCount, Math.ceil(visible / perRow)));
      grid.style.setProperty('--tb-row-count', String(rows));
      grid.setAttribute('data-tb-rows', '');
    }
  }

  function guardPlayback() {
    if (stopping || !sidebarSeen) return;
    // The player bar also shows the last-played item while paused (e.g. right after opening Spotify),
    // so only act while something is actually playing: the play/pause button then offers "Pause".
    const playPause = document.querySelector('[data-testid="control-button-playpause"]');
    if (!playPause || !/pause/i.test(playPause.getAttribute('aria-label') || '')) return;
    const widget = document.querySelector('[data-testid="now-playing-widget"]');
    if (!widget || !widget.querySelector('a[href*="/episode/"]')) return; // nothing, music, or audiobook
    if (isFollowed(widget)) return;

    stopping = true;
    console.info("[Thor's Blocker] Unfollowed podcast playing:", TB.textOf(widget), '| known followed shows:', followed);
    playPause.click();
    setTimeout(TB.stop, 300);
  }

  TB.register({
    scan() {
      if (!storeLoaded) return;
      learnFromSidebar();
      learnFromShowPage();

      const main = document.querySelector('main');
      if (main && FEED_PAGE.test(location.pathname)) filterPodcasts(main);
      const panel = document.querySelector(RIGHT_PANEL);
      if (panel) filterPodcasts(panel);

      guardPlayback();
    },
  });
})();
