# Thor's Blocker

A Chrome (Manifest V3) extension that strips the algorithmic, addictive parts out of social sites and keeps the
content from people you actually follow. Desktop sites only for now.

If you reach something that is blocked (a Reels/Shorts/Spotlight page, an unfollowed podcast starting on Spotify, …)
you get sent to the *Stop it right now* link.

## Install (developer mode)

1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. Click **Load unpacked** and pick this folder.
3. Pin the extension. Its popup has a single on/off switch; the icon shows an `OFF` badge while it's off.

After editing any file, hit the reload ↻ button on the extension card and refresh the site's tab.

## What it does

| Site | Behaviour |
| --- | --- |
| **YouTube** | Home → Subscriptions. Shorts removed (sidebar, shelves, search results, channel tab, filter chips); `/shorts/*` redirects. No recommended videos beside/under the player, no end screens/end cards, autoplay switched off. Ad slots hidden. Search and direct links untouched. |
| **Facebook** | Home → chronological **Friends** feed (`/?filter=friends&sk=h_chr`). Sponsored, "Suggested for you", "People you may know" and Reels carousels hidden from the feed; sponsored block hidden from the right column. Reels and Gaming tabs hidden from the top bar and sidebar; `/reel/` (the tab) and `/gaming` redirect. Friends' own reels still open. |
| **Instagram** | Home → chronological **Following** feed (`/?variant=following`). Posts marked "Ad"/"Sponsored"/"Suggested for you" hidden; "Suggested for you" account lists hidden. Reels and Explore tabs hidden and redirect; "Also from Meta" hidden. Single reels (`/reel/<id>`, a profile's Reels tab) and DMs still work. |
| **Snapchat** | Spotlight and Discover links hidden; `/spotlight` and `/discover` redirect. "Quick Add"/"Suggested" sections hidden. |
| **Spotify** | Unfollowed podcast shows/episodes hidden from Home (and its "Show all"/genre pages) and the right-hand panel. If an episode from an unfollowed show starts playing (autoplay or otherwise), playback is paused and the tab redirects. |

## How it's built

```
manifest.json
background.js            OFF badge
popup/                   on/off switch (chrome.storage.local "enabled")
content/common.js        shared runtime: on/off gating, SPA URL watching, throttled DOM rescans, redirects
content/common.css       hides anything a site script marks with data-tb-hidden
content/sites/<site>.js  route(url) → redirect target; scan() → mark elements to hide
content/sites/<site>.css static selectors, all scoped under html.tb-on
```

Everything is gated on the `tb-on` class on `<html>`, so switching off in the popup reveals hidden content
immediately without a reload.

## Known limitations

These sites change their markup often and use obfuscated class names, so selectors are based on stable-ish
hooks (URLs, ARIA roles, element names, visible label text) and will need occasional tuning.

- **Spotify followed shows** are learned from the *Your Library* sidebar and from a show page's Follow button, then
  saved. The library list is virtualised: if you follow many podcasts, scroll through the library (filter: Podcasts)
  once, or open a show's page, so it gets recorded. Until a show is recorded, playing it counts as unfollowed.
- **Facebook "Sponsored"** labels are deliberately obfuscated by Facebook; detection is best effort. The friends-only
  chronological feed avoids most of them anyway.
- **Label matching is English-only** ("Sponsored", "Suggested for you", …). Other UI languages need extra labels.
- **Snapchat** web's layout was written against its public structure only and is the least tested.
