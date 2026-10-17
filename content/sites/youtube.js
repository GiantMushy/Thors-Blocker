'use strict';

// YouTube: no Shorts anywhere, Home -> Subscriptions, no recommendations or autoplay on watch pages.
// Search and direct video links are left alone.
(() => {
  // Containers that hold a single video/Short link, so a Shorts link hides its whole tile.
  const ITEM = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-reel-item-renderer',
    'ytd-guide-entry-renderer',
    'ytd-mini-guide-entry-renderer',
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',
    'yt-lockup-view-model',
  ].join(',');
  const SHORTS_LABEL = new Set(['Shorts']);

  TB.register({
    route(url) {
      if (url.pathname === '/') return TB.url('/feed/subscriptions');
      if (url.pathname.startsWith('/shorts')) return TB.STOP_URL;
      return null;
    },

    scan() {
      for (const a of document.querySelectorAll('a[href^="/shorts"]')) {
        TB.hide(a.closest(ITEM));
      }

      // "Shorts" filter chips on search and channel pages.
      for (const chip of TB.findLabels(document, 'yt-chip-cloud-chip-renderer, chip-view-model', SHORTS_LABEL)) {
        TB.hide(chip);
      }

      // Switch off autoplay so nothing new starts when a video ends.
      const autoplay = document.querySelector('.ytp-autonav-toggle-button[aria-checked="true"]');
      if (autoplay) (autoplay.closest('button') || autoplay).click();
    },
  });
})();
