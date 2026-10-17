'use strict';

// Facebook: Home shows the chronological friends-only feed, no suggested/sponsored posts,
// no Reels or Gaming tabs. Friends' own posts (including their reels) stay.
(() => {
  const POST_LABELS = new Set([
    'Sponsored',
    'Suggested for you',
    'Reels and short videos',
    'People you may know',
    'Suggested groups',
    'Suggested pages',
  ]);
  const SPONSORED_LABEL = new Set(['Sponsored']);
  const POSTS = '[role="feed"] > div, div[data-pagelet^="FeedUnit"], [role="article"][aria-posinset]';
  const SPONSORED_LINK = 'a[href*="/ads/about"], a[aria-label="Sponsored"]';
  // Right-column blocks we keep; climbing from "Sponsored" stops before swallowing these.
  const RAIL_KEEP = /Contacts|Birthdays|Group chats|Your Pages and profiles/;

  TB.register({
    route(url) {
      const p = url.pathname.replace(/\/+$/, '') || '/';
      if (p === '/reel' || p === '/reels') return TB.STOP_URL;
      if (p === '/gaming' || p.startsWith('/gaming/')) return TB.STOP_URL;
      if ((p === '/' || p === '/home.php') && url.searchParams.get('sk') !== 'h_chr') {
        return TB.url('/?filter=friends&sk=h_chr');
      }
      return null;
    },

    scan() {
      for (const post of document.querySelectorAll(POSTS)) {
        if (TB.isHidden(post)) continue;
        if (post.querySelector(SPONSORED_LINK) || TB.findLabels(post, 'span, h3, h4', POST_LABELS).length) {
          TB.hide(post);
        }
      }

      const rail = document.querySelector('[data-pagelet="RightRail"]') || document.querySelector('[role="complementary"]');
      if (rail) {
        for (const label of TB.findLabels(rail, 'span, h3', SPONSORED_LABEL)) {
          let el = label;
          while (el.parentElement && el.parentElement !== rail && !RAIL_KEEP.test(el.parentElement.textContent)) {
            el = el.parentElement;
          }
          TB.hide(el);
        }
      }
    },
  });
})();
