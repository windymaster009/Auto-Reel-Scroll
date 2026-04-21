const DEFAULT_SETTINGS = {
  enabled: true,
  delayMs: 1200,
  smoothScroll: true
};

const SUPPORTED_MATCHERS = [
  /(^|\.)instagram\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)youtube\.com$/i
];

const enabledToggle = document.getElementById('enabledToggle');
const delayInput = document.getElementById('delayInput');
const smoothToggle = document.getElementById('smoothToggle');
const statusText = document.getElementById('statusText');

function saveSetting(patch) {
  chrome.storage.sync.set(patch);
}

function clampDelay(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.delayMs;
  return Math.max(0, Math.min(15000, Math.round(parsed)));
}

function updateStatusForTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs?.[0]?.url;
    if (!url) {
      statusText.textContent = 'Not active on this page';
      return;
    }

    try {
      const { hostname, pathname } = new URL(url);
      const isSupportedHost = SUPPORTED_MATCHERS.some((matcher) => matcher.test(hostname));
      const isShortsPath = hostname.includes('youtube.com') ? pathname.startsWith('/shorts/') : true;

      if (isSupportedHost && isShortsPath) {
        statusText.textContent = 'Running on this tab';
      } else {
        statusText.textContent = 'Not active on this page';
      }
    } catch {
      statusText.textContent = 'Not active on this page';
    }
  });
}

function init() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (saved) => {
    const settings = {
      ...DEFAULT_SETTINGS,
      ...saved
    };

    enabledToggle.checked = Boolean(settings.enabled);
    delayInput.value = String(clampDelay(settings.delayMs));
    smoothToggle.checked = Boolean(settings.smoothScroll);
  });

  enabledToggle.addEventListener('change', () => {
    saveSetting({ enabled: enabledToggle.checked });
  });

  delayInput.addEventListener('change', () => {
    const clamped = clampDelay(delayInput.value);
    delayInput.value = String(clamped);
    saveSetting({ delayMs: clamped });
  });

  smoothToggle.addEventListener('change', () => {
    saveSetting({ smoothScroll: smoothToggle.checked });
  });

  updateStatusForTab();
}

init();
