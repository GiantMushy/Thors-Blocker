'use strict';

const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

function render(enabled) {
  toggle.checked = enabled;
  status.textContent = enabled ? 'Blocking is on' : 'Blocking is off';
}

chrome.storage.local.get({ enabled: true }, (r) => render(r.enabled));

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked });
  render(toggle.checked);
});
