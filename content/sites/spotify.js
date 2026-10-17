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
  const CARD = '[data-encore-id="card"], [data-testid="card"], [role="row"], [role="listitem"], li';
  const PODCAST_LINK = 'a[href*="/show/"], a[href*="/episode/"]';
  // Pages that are recommendation feeds: Home, plus the "Show all" section and genre pages it links to.
  const FEED_PAGE = /^\/($|section\/|genre\/)/;

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
    for (const title of bar.querySelectorAll('[id^="listrow-title-spotify:show:"]')) {
      changed = remember(title.id.split(':').pop(), TB.textOf(title)) || changed;
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

  function filterPodcasts(root) {
    for (const a of root.querySelectorAll(PODCAST_LINK)) {
      const card = a.closest(CARD) || a;
      TB.setHidden(card, !isFollowed(card));
    }
    // Drop shelves whose cards are all hidden, so no empty "Episodes for you" headings remain.
    for (const section of root.querySelectorAll('section')) {
      const cards = [...section.querySelectorAll(CARD)];
      TB.setHidden(section, cards.length > 0 && cards.every((c) => c.hasAttribute(TB.HIDDEN_ATTR)));
    }
  }

  function guardPlayback() {
    if (stopping || !sidebarSeen) return;
    const widget = document.querySelector('[data-testid="now-playing-widget"]');
    if (!widget || !widget.querySelector('a[href*="/episode/"]')) return; // nothing, music, or audiobook
    if (isFollowed(widget)) return;

    stopping = true;
    const playPause = document.querySelector('[data-testid="control-button-playpause"]');
    if (playPause && /pause/i.test(playPause.getAttribute('aria-label') || '')) playPause.click();
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
