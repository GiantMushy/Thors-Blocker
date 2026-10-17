'use strict';

// Instagram: Home shows the chronological "Following" feed, no ads or suggested posts/accounts,
// no Reels or Explore tab. Reels opened from a profile (/<user>/reels, /reel/<id>) and DMs still work.
(() => {
  const POST_LABELS = new Set(['Sponsored', 'Ad', 'Suggested for you']);
  const SUGGESTED_LABEL = new Set(['Suggested for you']);
  const META_LABELS = new Set(['Also from Meta', 'More from Meta']);

  // Number of "Follow" buttons inside el; a block of suggested accounts has several.
  function followButtons(el) {
    let n = 0;
    for (const b of el.querySelectorAll('button, div[role="button"]')) {
      if (TB.textOf(b) === 'Follow') n++;
    }
    return n;
  }

  TB.register({
    route(url) {
      const p = url.pathname;
      // The Reels tab is /reels/ (it becomes /reels/<id>/ as you scroll). Single reels are /reel/<id>/.
      if (p === '/reels' || p.startsWith('/reels/')) return TB.STOP_URL;
      if (p === '/explore' || p === '/explore/') return TB.STOP_URL;
      if (p === '/' && url.searchParams.get('variant') !== 'following') return TB.url('/?variant=following');
      return null;
    },

    scan() {
      // Ads and suggested posts in the feed.
      for (const article of document.querySelectorAll('article')) {
        if (TB.isHidden(article)) continue;
        if (TB.findLabels(article, 'span, a', POST_LABELS).length) TB.hide(article);
      }

      // "Suggested for you" account lists (right column and in-feed carousels): climb from the
      // heading to the first ancestor that holds the Follow buttons.
      for (const label of TB.findLabels(document, 'span, h4', SUGGESTED_LABEL)) {
        if (TB.isHidden(label) || label.closest('article')) continue;
        let el = label;
        for (let i = 0; i < 10 && el.parentElement; i++) {
          el = el.parentElement;
          if (el.matches('main, body, [role="main"]')) break;
          if (followButtons(el) >= 2) {
            TB.hide(el);
            break;
          }
        }
      }

      // "Also from Meta" / "More from Meta" nav entry.
      for (const label of TB.findLabels(document, 'span', META_LABELS)) {
        TB.hide(label.closest('a, [role="button"], [role="link"]') || label);
      }
    },
  });
})();
