(() => {
  const DEFAULT_SETTINGS = {
    enabled: true,
    delayMs: 1200,
    smoothScroll: true
  };

  const ACTIVE_SITES = {
    instagram: /(^|\.)instagram\.com$/i,
    facebook: /(^|\.)facebook\.com$/i,
    tiktok: /(^|\.)tiktok\.com$/i,
    youtube: /(^|\.)youtube\.com$/i
  };

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    activeVideo: null,
    activeVideoKey: null,
    scrollScheduledForKey: null,
    activeVideoEndedListener: null,
    observer: null,
    visibilityCheckTimer: null,
    lastScrollAt: 0,
    locationHref: location.href,
    locationCheckTimer: null
  };

  function isSupportedHost() {
    return Object.values(ACTIVE_SITES).some((pattern) => pattern.test(location.hostname));
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

    const visibilityRatio = visibleArea / totalArea;
    return visibilityRatio >= 0.25;
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
    const allVideos = Array.from(document.querySelectorAll('video'));
    const candidates = allVideos.filter((video) => isVideoVisible(video));

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

  function handleVideoFinished(reason = 'threshold') {
    if (!state.settings.enabled || !state.activeVideo) return;

    const key = state.activeVideoKey;
    if (!key || state.scrollScheduledForKey === key) return;

    const now = Date.now();
    if (now - state.lastScrollAt < 800) return;

    state.scrollScheduledForKey = key;

    const delay = Number.isFinite(state.settings.delayMs)
      ? Math.max(0, Math.min(15000, state.settings.delayMs))
      : DEFAULT_SETTINGS.delayMs;

    window.setTimeout(() => {
      if (!state.settings.enabled) {
        state.scrollScheduledForKey = null;
        return;
      }

      if (state.activeVideoKey !== key) {
        state.scrollScheduledForKey = null;
        return;
      }

      scrollToNextReel(state.activeVideo);
      state.lastScrollAt = Date.now();
      state.scrollScheduledForKey = null;
    }, delay);
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
      const container = video.closest(selector);
      if (container) return container;
    }

    let current = video.parentElement;
    while (current && current !== document.body) {
      const rect = current.getBoundingClientRect();
      if (rect.height > window.innerHeight * 0.5) {
        return current;
      }
      current = current.parentElement;
    }

    return video;
  }

  function findNextContainer(currentContainer) {
    if (!currentContainer) return null;

    const all = Array.from(document.querySelectorAll('*')).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el === currentContainer) return false;
      const rect = el.getBoundingClientRect();
      if (rect.height < 100 || rect.width < 100) return false;
      if (rect.top <= currentContainer.getBoundingClientRect().top + 10) return false;
      return rect.top < window.innerHeight * 2;
    });

    if (!all.length) return null;

    all.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return all[0];
  }

  function scrollToNextReel(activeVideo) {
    const currentContainer = getScrollableContainer(activeVideo);
    const nextContainer = findNextContainer(currentContainer);

    const behavior = state.settings.smoothScroll ? 'smooth' : 'auto';

    if (nextContainer) {
      nextContainer.scrollIntoView({
        behavior,
        block: 'start',
        inline: 'nearest'
      });
      return;
    }

    window.scrollBy({
      top: Math.max(300, Math.round(window.innerHeight * 0.85)),
      behavior
    });
  }

  function updateActiveVideo(force = false) {
    if (!state.settings.enabled && !force) return;

    const candidate = findActiveVideo();
    const candidateKey = getVideoKey(candidate);

    if (candidate === state.activeVideo && candidateKey === state.activeVideoKey) {
      return;
    }

    detachActiveVideoListener();

    state.activeVideo = candidate;
    state.activeVideoKey = candidateKey;

    if (!candidate) return;

    const onEnded = () => handleVideoFinished('ended-event');
    state.activeVideoEndedListener = onEnded;
    candidate.addEventListener('ended', onEnded);
  }

  function thresholdLoopCheck() {
    if (!state.settings.enabled || !state.activeVideo) return;

    const video = state.activeVideo;
    const duration = video.duration;
    const currentTime = video.currentTime;

    if (!Number.isFinite(duration) || duration <= 0) return;

    if (currentTime >= duration - 0.25) {
      handleVideoFinished('time-threshold');
    }
  }

  function startObservers() {
    if (state.observer) {
      state.observer.disconnect();
    }

    state.observer = new MutationObserver(() => {
      updateActiveVideo(true);
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false
    });

    window.addEventListener('scroll', () => updateActiveVideo(true), { passive: true });
    window.addEventListener('resize', () => updateActiveVideo(true), { passive: true });

    if (state.visibilityCheckTimer) {
      clearInterval(state.visibilityCheckTimer);
    }
    state.visibilityCheckTimer = setInterval(() => {
      updateActiveVideo(true);
      thresholdLoopCheck();
    }, 250);

    if (state.locationCheckTimer) {
      clearInterval(state.locationCheckTimer);
    }
    state.locationCheckTimer = setInterval(() => {
      if (state.locationHref !== location.href) {
        state.locationHref = location.href;
        state.scrollScheduledForKey = null;
        updateActiveVideo(true);
      }
    }, 500);
  }

  function applySettings(newSettings) {
    state.settings = {
      ...DEFAULT_SETTINGS,
      ...newSettings,
      delayMs: Number(newSettings?.delayMs ?? DEFAULT_SETTINGS.delayMs)
    };

    if (!state.settings.enabled) {
      detachActiveVideoListener();
      state.activeVideo = null;
      state.activeVideoKey = null;
      state.scrollScheduledForKey = null;
      return;
    }

    updateActiveVideo(true);
  }

  function loadSettingsAndStart() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (saved) => {
      applySettings(saved);
      startObservers();
      updateActiveVideo(true);
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;

    const next = { ...state.settings };
    let hasRelevantChange = false;

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (changes[key]) {
        next[key] = changes[key].newValue;
        hasRelevantChange = true;
      }
    }

    if (hasRelevantChange) {
      applySettings(next);
    }
  });

  if (isSupportedHost()) {
    loadSettingsAndStart();
  }
})();
