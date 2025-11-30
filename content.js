/**
 * Injects a "Summarize with Gemini" button on YouTube video pages.
 * On click, stores a prompt in local storage and opens Gemini in a new tab.
 */

(() => {
  "use strict";

  const SCRIPT_PREFIX = "Gemini Summarizer (YouTube Content):";
  const BUTTON_ID = "gemini-summarize-youtube-page-button";
  const BUTTON_TEXT = "✨ Summarize with Gemini";
  const BUTTON_TEXT_OPENING = "✨ Opening Gemini...";
  const GEMINI_URL = "https://gemini.google.com/app";
  const STORAGE_KEY_PROMPT = "geminiPromptForNextLoad";
  const YOUTUBE_INJECTION_POINT_SELECTORS = ['ytd-watch-metadata #title'];
  const MOBILE_YOUTUBE_INJECTION_SELECTOR = 'ytm-slim-video-metadata-renderer .slim-video-metadata-title';
  let injectionInterval = null;

  function findButtonInjectionPoint(isMobile = false) {
    const selectors = isMobile ? [MOBILE_YOUTUBE_INJECTION_SELECTOR] : YOUTUBE_INJECTION_POINT_SELECTORS;
    for (const selector of selectors) {
      const parent = document.querySelector(selector);
      if (parent) {
        devLog(SCRIPT_PREFIX, `Found injection point: ${selector}`);
        return parent;
      }
    }
    devWarn(SCRIPT_PREFIX, "No injection point found", isMobile ? "(Mobile)" : "(Desktop)");
    return null;
  }

  function createSummarizeButtonElement() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.textContent = BUTTON_TEXT;
    button.classList.add("gemini-summarizer-button");
    button.addEventListener("click", handleSummarizeClick);
    devLog(SCRIPT_PREFIX, "Button created");
    return button;
  }

  async function handleSummarizeClick() {
    if (this.disabled) return;

    const originalText = this.textContent;
    this.textContent = BUTTON_TEXT_OPENING;
    this.disabled = true;

    try {
      const promptText = `Can you provide a comprehensive but short summary of the given video? Start with giving 5 bullet points. And then the summary should cover all the key points and main ideas presented in the original text, while also condensing the information into a concise and easy-to-understand format. Please ensure that the summary includes relevant details and examples that support the main ideas, while avoiding any unnecessary information or repetition. The length of the summary should be appropriate for the length and complexity of the original text, providing a clear and accurate overview without omitting any important information.: ${window.location.href}`;
      await (typeof browser !== "undefined" ? browser : chrome).storage.local.set({ [STORAGE_KEY_PROMPT]: promptText });
      devLog(SCRIPT_PREFIX, "Prompt saved to storage");
      window.open(GEMINI_URL, "_blank");
      devLog(SCRIPT_PREFIX, `Opening Gemini: ${GEMINI_URL}`);
    } catch (error) {
      devError(SCRIPT_PREFIX, "Error during summarize click:", error);
      alert(`Could not process request: ${error.message}. Please try again.`);
      this.textContent = originalText;
      this.disabled = false;
      return;
    }

    setTimeout(() => {
      const btn = document.getElementById(BUTTON_ID);
      if (btn) {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    }, 2000);
  }

  function isWatchPage() {
    const { hostname, pathname, search } = window.location;
    const isDesktopWatchPage = hostname === 'www.youtube.com' && pathname === '/watch' && search.includes('v=');
    const isMobileWatchPage = hostname === 'm.youtube.com' && pathname === '/watch';
    return isDesktopWatchPage || isMobileWatchPage;
  }

  function getSkipReason() {
    const { hostname, pathname, search } = window.location;
    if (pathname.includes('/shorts/')) return "On a Shorts page";
    if (!hostname.includes('youtube.com')) return "Not on youtube.com";
    if (hostname === 'www.youtube.com') return `Not a desktop watch page (path: ${pathname}, search: ${search})`;
    return `Not a mobile watch page (path: ${pathname})`;
  }

  function attemptButtonInjection() {
    const { hostname, pathname } = window.location;
    const existingButton = document.getElementById(BUTTON_ID);

    if (pathname.includes('/shorts/') || !hostname.includes('youtube.com') || !isWatchPage()) {
      const reason = getSkipReason();
      devLog(SCRIPT_PREFIX, `Skipping injection: ${reason}`);
      if (existingButton) {
        existingButton.remove();
        devLog(SCRIPT_PREFIX, "Button removed (not a target page)");
      }
      return;
    }

    if (existingButton) {
      const isVisible = existingButton.offsetParent !== null && getComputedStyle(existingButton).display !== 'none';
      if (isVisible) {
        devLog(SCRIPT_PREFIX, "Button exists and visible, skipping");
        return;
      }
      existingButton.remove();
      devLog(SCRIPT_PREFIX, "Removed invisible button for re-injection");
    }

    const isMobile = hostname === 'm.youtube.com';
    const injectionParentElement = findButtonInjectionPoint(isMobile);

    if (injectionParentElement) {
      const button = createSummarizeButtonElement();
      injectionParentElement.appendChild(button);
      devLog(SCRIPT_PREFIX, "Button injected successfully");
    } else {
      devWarn(SCRIPT_PREFIX, "No suitable parent element found for injection");
    }
  }

  // Event Listeners
  window.addEventListener('yt-navigate-start', (event) => {
    try {
      const upcomingUrl = event.detail?.url || event.detail?.page?.url || 
        (event.detail?.endpoint?.watchEndpoint?.videoId ? `/watch?v=${event.detail.endpoint.watchEndpoint.videoId}` : null);
      if (upcomingUrl?.includes('/shorts/')) {
        const existingButton = document.getElementById(BUTTON_ID);
        if (existingButton) {
          existingButton.remove();
          devLog(SCRIPT_PREFIX, "Button removed (navigating to Shorts)");
        }
      }
    } catch (e) {
      devWarn(SCRIPT_PREFIX, "Error in navigation handler:", e);
    }
  });

  // Initialize
  if (injectionInterval) {
    clearInterval(injectionInterval);
    injectionInterval = null;
  }

  if (window.location.hostname === 'm.youtube.com') {
    devLog(SCRIPT_PREFIX, "Mobile mode: using interval");
    setTimeout(attemptButtonInjection, 500);
    injectionInterval = setInterval(attemptButtonInjection, 1500);
  } else {
    devLog(SCRIPT_PREFIX, "Desktop mode: using events");
    window.addEventListener('yt-navigate-finish', () => {
      setTimeout(attemptButtonInjection, 250);
    });

    if (document.readyState === 'complete') {
      setTimeout(attemptButtonInjection, 250);
    } else {
      window.addEventListener('load', () => {
        setTimeout(attemptButtonInjection, 250);
      });
    }
  }

  devLog(SCRIPT_PREFIX, "Initialized", window.location.hostname === 'm.youtube.com' ? "Mobile" : "Desktop");
})();
