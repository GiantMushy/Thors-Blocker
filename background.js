'use strict';

// Shows an "OFF" badge on the toolbar icon while blocking is switched off.
function updateBadge(enabled) {
  chrome.action.setBadgeBackgroundColor({ color: '#777777' });
  chrome.action.setBadgeText({ text: enabled ? '' : 'OFF' });
}

chrome.storage.local.get({ enabled: true }, (r) => updateBadge(r.enabled));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) updateBadge(changes.enabled.newValue);
});
