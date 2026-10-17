'use strict';

// Shared runtime loaded before every site script. A site script calls TB.register({ route, scan }):
//   route(url) -> URL string to redirect to, or null to stay. Runs on load and on every SPA navigation.
//   scan()     -> hides things via TB.hide / TB.setHidden. Runs (throttled) whenever the DOM changes.
// Everything is gated on the on/off switch in the popup (chrome.storage.local "enabled").
const TB = (() => {
  const STOP_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const ON_CLASS = 'tb-on';
  const HIDDEN_ATTR = 'data-tb-hidden';
  const SCAN_THROTTLE_MS = 200;

  let enabled = true;
  let site = null;
  let lastUrl = '';
  let scanTimer = null;

  // Assume "on" until storage answers, so blocked content never flashes on screen.
  document.documentElement.classList.add(ON_CLASS);

  // Hidden elements are only marked; the CSS rule in common.css does the hiding while html.tb-on is set,
  // so switching the extension off reveals everything again without a reload.
  function setHidden(el, hidden) {
    if (!el || el.nodeType !== 1) return;
    if (hidden) {
      if (!el.hasAttribute(HIDDEN_ATTR)) el.setAttribute(HIDDEN_ATTR, '');
    } else if (el.hasAttribute(HIDDEN_ATTR)) {
      el.removeAttribute(HIDDEN_ATTR);
    }
  }

  function hide(el) {
    setHidden(el, true);
  }

  function isHidden(el) {
    return !!el.closest(`[${HIDDEN_ATTR}]`);
  }

  function redirect(url) {
    if (!url || url === location.href) return;
    // If a site rewrites our target URL back to the original, don't reload forever.
    try {
      const key = 'tb-last-redirect';
      const now = Date.now();
      const last = JSON.parse(sessionStorage.getItem(key) || 'null');
      const recent = last && last.url === url && now - last.at < 3000;
      if (recent && last.count >= 3) return;
      sessionStorage.setItem(key, JSON.stringify({ url, at: now, count: recent ? last.count + 1 : 1 }));
    } catch (_) {
      // sessionStorage can be unavailable; redirect anyway.
    }
    location.replace(url);
  }

  function stop() {
    redirect(STOP_URL);
  }

  function url(path) {
    return new URL(path, location.origin).href;
  }

  function textOf(el) {
    return (el.textContent || '').trim();
  }

  // Elements under root matching selector whose whole text is one of labels (a Set).
  function findLabels(root, selector, labels) {
    const out = [];
    for (const el of root.querySelectorAll(selector)) {
      if (labels.has(textOf(el))) out.push(el);
    }
    return out;
  }

  function checkUrl() {
    if (!enabled || !site || !site.route) return;
    redirect(site.route(new URL(location.href)));
  }

  function runScan() {
    scanTimer = null;
    if (!enabled || !site || !site.scan) return;
    try {
      site.scan();
    } catch (err) {
      console.debug("[Thor's Blocker]", err);
    }
  }

  function queueScan() {
    if (enabled && scanTimer === null) scanTimer = setTimeout(runScan, SCAN_THROTTLE_MS);
  }

  function setEnabled(on) {
    enabled = on;
    document.documentElement.classList.toggle(ON_CLASS, on);
    if (on) {
      checkUrl();
      queueScan();
    }
  }

  function register(def) {
    site = def;
    lastUrl = location.href;

    chrome.storage.local.get({ enabled: true }, (r) => setEnabled(r.enabled));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.enabled) setEnabled(changes.enabled.newValue);
    });

    new MutationObserver(queueScan).observe(document.documentElement, { childList: true, subtree: true });

    // SPAs change the URL without a page load, and content scripts can't hook the page's own
    // history API, so poll for URL changes. Also rescan every second as a safety net.
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        checkUrl();
      }
      queueScan();
    }, 250);
  }

  return { STOP_URL, HIDDEN_ATTR, register, hide, setHidden, isHidden, redirect, stop, url, textOf, findLabels };
})();
