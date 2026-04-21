const DEFAULT_SETTINGS = {
  enabled: true,
  delay: 1000,
  smoothScroll: true,
  platforms: {
    instagram: true,
    facebook: true,
    youtube: true,
    tiktok: true
  }
};

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube Shorts',
  tiktok: 'TikTok'
};

const controls = {
  enabled: document.getElementById('enabledToggle'),
  delay: document.getElementById('delayInput'),
  smoothScroll: document.getElementById('smoothToggle'),
  instagram: document.getElementById('instagramToggle'),
  facebook: document.getElementById('facebookToggle'),
  youtube: document.getElementById('youtubeToggle'),
  tiktok: document.getElementById('tiktokToggle'),
  status: document.getElementById('statusText')
};

function clampDelay(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SETTINGS.delay;
  return Math.max(0, Math.min(15000, Math.round(parsed)));
}

function normalizeSettings(raw = {}) {
  const oldDelayMs = Number(raw.delayMs);
  const nextDelay = Number(raw.delay);

  return {
    enabled: raw.enabled ?? DEFAULT_SETTINGS.enabled,
    delay: clampDelay(Number.isFinite(nextDelay) ? nextDelay : (Number.isFinite(oldDelayMs) ? oldDelayMs : DEFAULT_SETTINGS.delay)),
    smoothScroll: raw.smoothScroll ?? DEFAULT_SETTINGS.smoothScroll,
    platforms: {
      instagram: raw.platforms?.instagram ?? DEFAULT_SETTINGS.platforms.instagram,
      facebook: raw.platforms?.facebook ?? DEFAULT_SETTINGS.platforms.facebook,
      youtube: raw.platforms?.youtube ?? DEFAULT_SETTINGS.platforms.youtube,
      tiktok: raw.platforms?.tiktok ?? DEFAULT_SETTINGS.platforms.tiktok
    }
  };
}

function saveSettings(patch) {
  chrome.storage.sync.set(patch);
}

function getPlatformFromUrl(url) {
  if (!url) return { key: null, supported: false };

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.endsWith('instagram.com')) return { key: 'instagram', supported: true };
    if (host.endsWith('facebook.com')) return { key: 'facebook', supported: true };
    if (host.endsWith('tiktok.com')) return { key: 'tiktok', supported: true };
    if (host.endsWith('youtube.com') && path.startsWith('/shorts/')) return { key: 'youtube', supported: true };

    return { key: null, supported: false };
  } catch {
    return { key: null, supported: false };
  }
}

function updateStatus(settings) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeUrl = tabs?.[0]?.url;
    const platformInfo = getPlatformFromUrl(activeUrl);

    if (!settings.enabled) {
      controls.status.textContent = 'Extension off';
      return;
    }

    if (!platformInfo.supported || !platformInfo.key) {
      controls.status.textContent = 'Unsupported page';
      return;
    }

    if (!settings.platforms[platformInfo.key]) {
      controls.status.textContent = `Disabled for ${PLATFORM_LABELS[platformInfo.key]}`;
      return;
    }

    controls.status.textContent = `Active on ${PLATFORM_LABELS[platformInfo.key]}`;
  });
}

function paint(settings) {
  controls.enabled.checked = Boolean(settings.enabled);
  controls.delay.value = String(clampDelay(settings.delay));
  controls.smoothScroll.checked = Boolean(settings.smoothScroll);
  controls.instagram.checked = Boolean(settings.platforms.instagram);
  controls.facebook.checked = Boolean(settings.platforms.facebook);
  controls.youtube.checked = Boolean(settings.platforms.youtube);
  controls.tiktok.checked = Boolean(settings.platforms.tiktok);
}

function bindEvents() {
  controls.enabled.addEventListener('change', () => {
    saveSettings({ enabled: controls.enabled.checked });
  });

  controls.delay.addEventListener('change', () => {
    const clamped = clampDelay(controls.delay.value);
    controls.delay.value = String(clamped);
    saveSettings({ delay: clamped });
  });

  controls.smoothScroll.addEventListener('change', () => {
    saveSettings({ smoothScroll: controls.smoothScroll.checked });
  });

  ['instagram', 'facebook', 'youtube', 'tiktok'].forEach((platform) => {
    controls[platform].addEventListener('change', () => {
      chrome.storage.sync.get(DEFAULT_SETTINGS, (raw) => {
        const current = normalizeSettings(raw);
        const nextPlatforms = {
          ...current.platforms,
          [platform]: controls[platform].checked
        };

        saveSettings({ platforms: nextPlatforms });
      });
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;

    chrome.storage.sync.get(DEFAULT_SETTINGS, (raw) => {
      const settings = normalizeSettings(raw);
      paint(settings);
      updateStatus(settings);
    });
  });
}

function init() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (raw) => {
    const settings = normalizeSettings(raw);

    // Save normalized structure for older installs (delayMs -> delay, missing platform flags)
    saveSettings(settings);

    paint(settings);
    bindEvents();
    updateStatus(settings);
  });
}

init();
