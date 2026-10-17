'use strict';

// Snapchat web: no Spotlight or Discover, no suggested friends/content. Chats and stories stay.
(() => {
  const NAV_LABELS = new Set(['Spotlight', 'Discover']);
  const SUGGESTED_LABELS = new Set(['Quick Add', 'Suggested', 'Suggested for you', 'Suggested Friends']);

  function labelOf(el) {
    return el.getAttribute('aria-label') || el.getAttribute('title') || TB.textOf(el);
  }

  TB.register({
    route(url) {
      const p = url.pathname;
      if (p.startsWith('/spotlight') || p.startsWith('/discover')) return TB.STOP_URL;
      return null;
    },

    scan() {
      for (const el of document.querySelectorAll('a, button, [role="button"], [role="tab"]')) {
        if (NAV_LABELS.has(labelOf(el).trim())) TB.hide(el);
      }

      // A suggestions heading sits next to its list, so hide the wrapper holding both.
      for (const heading of TB.findLabels(document, 'h1, h2, h3, h4, span, div', SUGGESTED_LABELS)) {
        if (heading.childElementCount === 0) TB.hide(heading.parentElement);
      }
    },
  });
})();
