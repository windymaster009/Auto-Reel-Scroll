(() => {
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

  const state = {
    settings: { ...DEFAULT_SETTINGS, platforms: { ...DEFAULT_SETTINGS.platforms } },
    activeVideo: null,
    activeVideoKey: null,
    scrollScheduledForKey: null,
    activeVideoEndedListener: null,
    observer: null,
    visibilityCheckTimer: null,
    locationHref: location.href,
    locationCheckTimer: null,
    onScrollHandler: null,
    onResizeHandler: null,
    lastScrollAt: 0
  };

  function getCurrentPlatform() {
    const host = location.hostname.toLowerCase();
    const path = location.pathname.toLowerCase();

    if (host.endsWith('instagram.com')) return 'instagram';
    if (host.endsWith('facebook.com')) return 'facebook';
    if (host.endsWith('tiktok.com')) return 'tiktok';
    if (host.endsWith('youtube.com') && path.startsWith('/shorts/')) return 'youtube';

    return null;
  }

  function normalizeSettings(raw = {}) {
    const oldDelayMs = Number(raw.delayMs);
    const delay = Number(raw.delay);

    return {
      enabled: raw.enabled ?? DEFAULT_SETTINGS.enabled,
      delay: Number.isFinite(delay)
        ? Math.max(0, Math.min(15000, Math.round(delay)))
        : (Number.isFinite(oldDelayMs)
            ? Math.max(0, Math.min(15000, Math.round(oldDelayMs)))
            : DEFAULT_SETTINGS.delay),
      smoothScroll: raw.smoothScroll ?? DEFAULT_SETTINGS.smoothScroll,
      platforms: {
        instagram: raw.platforms?.instagram ?? DEFAULT_SETTINGS.platforms.instagram,
        facebook: raw.platforms?.facebook ?? DEFAULT_SETTINGS.platforms.facebook,
        youtube: raw.platforms?.youtube ?? DEFAULT_SETTINGS.platforms.youtube,
        tiktok: raw.platforms?.tiktok ?? DEFAULT_SETTINGS.platforms.tiktok
      }
    };
  }

  function shouldRunOnCurrentPage() {
    const platform = getCurrentPlatform();
    if (!platform) return false;
    if (!state.settings.enabled) return false;
    return Boolean(state.settings.platforms[platform]);
  }

  function getVideoKey(video) {
    if (!video) return null;
    if (!video.dataset.autoReelScrollId) {
      video.dataset.autoReelScrollId = `ars-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return video.dataset.autoReelScrollId;
  }

  function isVideoVisible(video) {
    if (!video || !(video instanceof HTMLVideoElement)) return false;
    if (video.readyState === 0) return false;

    const style = window.getComputedStyle(video);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }

    const rect = video.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) return false;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const visibleW = Math.max(0, Math.min(rect.right, viewportW) - Math.max(rect.left, 0));
    const visibleH = Math.max(0, Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0));
    const visibleArea = visibleW * visibleH;
    const totalArea = rect.width * rect.height;

    if (totalArea <= 0) return false;

    return visibleArea / totalArea >= 0.25;
  }

  function getVideoVisibilityScore(video) {
    const rect = video.getBoundingClientRect();
    const viewportCenterY = window.innerHeight / 2;
    const videoCenterY = rect.top + rect.height / 2;
    const centerDistance = Math.abs(videoCenterY - viewportCenterY);

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const visibleW = Math.max(0, Math.min(rect.right, viewportW) - Math.max(rect.left, 0));
    const visibleH = Math.max(0, Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0));
    const visibleArea = visibleW * visibleH;

    return visibleArea - centerDistance * 100;
  }

  function findActiveVideo() {
    const candidates = Array.from(document.querySelectorAll('video')).filter(isVideoVisible);
    if (!candidates.length) return null;

    candidates.sort((a, b) => getVideoVisibilityScore(b) - getVideoVisibilityScore(a));
    return candidates[0];
  }

  function detachActiveVideoListener() {
    if (state.activeVideo && state.activeVideoEndedListener) {
      state.activeVideo.removeEventListener('ended', state.activeVideoEndedListener);
    }

    state.activeVideoEndedListener = null;
  }

  function resetActiveState() {
    detachActiveVideoListener();
    state.activeVideo = null;
    state.activeVideoKey = null;
    state.scrollScheduledForKey = null;
  }

  function getScrollableContainer(video) {
    if (!video) return null;

    const selectors = [
      '[data-e2e="recommend-list-item-container"]',
      '[data-e2e="feed-video"]',
      'article',
      '[role="article"]',
      'ytd-reel-video-renderer',
      '[data-pagelet^="Reels"]',
      '[aria-label*="Reel"]'
    ];

    for (const selector of selectors) {
      const match = video.closest(selector);
      if (match) return match;
    }

    let current = video.parentElement;
    while (current && current !== document.body) {
      if (current.getBoundingClientRect().height > window.innerHeight * 0.5) return current;
      current = current.parentElement;
    }

    return video;
  }

  function findNextContainer(currentContainer) {
    if (!currentContainer) return null;

    const currentTop = currentContainer.getBoundingClientRect().top;

    const possible = Array.from(document.querySelectorAll('*')).filter((el) => {
      if (!(el instanceof HTMLElement) || el === currentContainer) return false;
      const rect = el.getBoundingClientRect();

      if (rect.height < 100 || rect.width < 100) return false;
      if (rect.top <= currentTop + 10) return false;
      return rect.top < window.innerHeight * 2;
    });

    if (!possible.length) return null;

    possible.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return possible[0];
  }

  function scrollToNextReel(activeVideo) {
    const behavior = state.settings.smoothScroll ? 'smooth' : 'auto';
    const currentContainer = getScrollableContainer(activeVideo);
    const nextContainer = findNextContainer(currentContainer);

    if (nextContainer) {
      nextContainer.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
      return;
    }

    window.scrollBy({
      top: Math.max(300, Math.round(window.innerHeight * 0.85)),
      behavior
    });
  }

  function handleVideoFinished() {
    if (!shouldRunOnCurrentPage()) return;
    if (!state.activeVideo || !state.activeVideoKey) return;

    if (state.scrollScheduledForKey === state.activeVideoKey) return;

    if (Date.now() - state.lastScrollAt < 800) return;

    const activeKey = state.activeVideoKey;
    state.scrollScheduledForKey = activeKey;

    window.setTimeout(() => {
      if (!shouldRunOnCurrentPage()) {
        state.scrollScheduledForKey = null;
        return;
      }

      if (!state.activeVideo || state.activeVideoKey !== activeKey) {
        state.scrollScheduledForKey = null;
        return;
      }

      scrollToNextReel(state.activeVideo);
      state.lastScrollAt = Date.now();
      state.scrollScheduledForKey = null;
    }, state.settings.delay);
  }

  function updateActiveVideo() {
    if (!shouldRunOnCurrentPage()) {
      resetActiveState();
      return;
    }

    const candidate = findActiveVideo();
    const candidateKey = getVideoKey(candidate);

    if (candidate === state.activeVideo && candidateKey === state.activeVideoKey) return;

    detachActiveVideoListener();

    state.activeVideo = candidate;
    state.activeVideoKey = candidateKey;

    if (!candidate) return;

    state.activeVideoEndedListener = () => handleVideoFinished();
    candidate.addEventListener('ended', state.activeVideoEndedListener);
  }

  function thresholdLoopCheck() {
    if (!shouldRunOnCurrentPage()) return;
    if (!state.activeVideo) return;

    const duration = state.activeVideo.duration;
    const currentTime = state.activeVideo.currentTime;

    if (!Number.isFinite(duration) || duration <= 0) return;

    if (currentTime >= duration - 0.25) {
      handleVideoFinished();
    }
  }

  function startObservers() {
    if (state.observer) {
      state.observer.disconnect();
    }

    state.observer = new MutationObserver(() => {
      updateActiveVideo();
    });

    state.observer.observe(document.documentElement, { childList: true, subtree: true });

    if (state.onScrollHandler) {
      window.removeEventListener('scroll', state.onScrollHandler);
    }
    state.onScrollHandler = () => updateActiveVideo();
    window.addEventListener('scroll', state.onScrollHandler, { passive: true });

    if (state.onResizeHandler) {
      window.removeEventListener('resize', state.onResizeHandler);
    }
    state.onResizeHandler = () => updateActiveVideo();
    window.addEventListener('resize', state.onResizeHandler, { passive: true });

    if (state.visibilityCheckTimer) clearInterval(state.visibilityCheckTimer);
    state.visibilityCheckTimer = setInterval(() => {
      updateActiveVideo();
      thresholdLoopCheck();
    }, 250);

    if (state.locationCheckTimer) clearInterval(state.locationCheckTimer);
    state.locationCheckTimer = setInterval(() => {
      if (state.locationHref !== location.href) {
        state.locationHref = location.href;
        state.scrollScheduledForKey = null;
        updateActiveVideo();
      }
    }, 500);
  }

  function applySettings(rawSettings) {
    state.settings = normalizeSettings(rawSettings);

    if (!shouldRunOnCurrentPage()) {
      resetActiveState();
      return;
    }

    updateActiveVideo();
  }

  function init() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (raw) => {
      const settings = normalizeSettings(raw);
      state.settings = settings;

      // Persist normalized shape for older stored versions.
      chrome.storage.sync.set(settings);

      startObservers();
      updateActiveVideo();
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;

    const incoming = { ...state.settings };
    let hasRelevantChange = false;

    ['enabled', 'delay', 'delayMs', 'smoothScroll', 'platforms'].forEach((key) => {
      if (changes[key]) {
        incoming[key] = changes[key].newValue;
        hasRelevantChange = true;
      }
    });

    if (hasRelevantChange) {
      applySettings(incoming);
    }
  });

  init();
})();
