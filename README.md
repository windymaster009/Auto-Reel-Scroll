# Auto Reel Scroll (Chrome Extension - Manifest V3)

Auto Reel Scroll is a plug-and-play Chrome extension that automatically moves to the next short-form video (reel/short) after the current one finishes.

It is designed for personal use and can be installed with **Load unpacked** in Chrome.

## What this extension does

- Detects the most visible video in the current viewport.
- Watches for video completion in two ways:
  - Normal `ended` event.
  - Loop-safe time threshold: if `currentTime >= duration - 0.25`, it treats the video as complete.
- Waits for a configurable delay (default: **1200ms**).
- Scrolls to the next reel/video container when possible.
- Falls back to a small downward scroll if no next container is found immediately.
- Prevents rapid duplicate scrolling for the same video end.
- Re-detects active videos continuously to handle SPA/dynamic page updates.

## Supported websites

- Instagram Reels
- Facebook Reels
- TikTok
- YouTube Shorts (`/shorts/`)

## Files

- `manifest.json` — Extension manifest, permissions, content script registration.
- `content.js` — Main auto-scroll logic running on supported sites.
- `popup.html` — Popup UI layout.
- `popup.css` — Popup styling.
- `popup.js` — Popup behavior and settings persistence.

## Installation (Load unpacked)

1. Download or copy all extension files into one folder (for example: `Auto-Reel-Scroll`).
2. Open Chrome and go to:
   - `chrome://extensions`
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the extension folder.
6. The extension should now appear in your extensions list and be ready to use.

## How to use

1. Open a supported site (Instagram/Facebook/TikTok/YouTube Shorts).
2. Click the extension icon to open the popup.
3. Configure options:
   - **Enable auto scrolling**: On/Off
   - **Delay before next scroll (ms)**
   - **Smooth scrolling**: On/Off
4. Leave the tab on reels/shorts. The extension will continue auto-scrolling as each video finishes.

## Settings persistence

Settings are stored in `chrome.storage.sync`, so your preferences are remembered.

Default values:

- Enabled: `true`
- Delay: `1200`
- Smooth scrolling: `true`

## Limitations / notes

- Social platforms frequently update DOM structures, so selectors may need updates over time.
- Some videos may be ads/live/interactive content and not behave exactly like standard short videos.
- YouTube support is targeted for `https://www.youtube.com/shorts/*` pages.
- For safety, the extension includes anti-duplicate and anti-rapid scroll checks to avoid excessive scrolling.

## Manual install readiness

This project is intentionally dependency-free and requires no build steps.
Just place files in a folder and load it as an unpacked extension.
