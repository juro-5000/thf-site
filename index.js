/**
 * thfProject — Main site controller
 *
 * Modules:
 *  - CONFIG          : Centralised constants (no magic numbers/strings)
 *  - Carousel        : Hero image slideshow with keyboard & dot navigation
 *  - ScrollManager   : Throttled scroll handler (navbar, parallax, reveal)
 *  - Toast           : Copy-to-clipboard feedback overlay
 *  - StatusChecker   : Periodic Minecraft server status polling
 */

'use strict';

/* ─────────────────────────────────────────────
   CONFIG — single source of truth for all
   hard-coded values and selector strings
───────────────────────────────────────────── */

/** @type {Object} Site-wide configuration constants */
const CONFIG = {
  carousel: {
    /** Auto-advance interval in milliseconds */
    interval: 4500,
    images: [
      'img/1.webp',
      'img/2.webp',
      'img/3.webp',
      'img/4.webp',
      'img/5.webp',
      'img/6.webp',
    ],
  },
  scroll: {
    /** Scroll distance (px) before navbar gains glass effect */
    navbarThreshold: 30,
    /** Fraction of hero height at which parallax fade is complete */
    parallaxFadeFraction: 0.55,
    /** Multiplier for hero-overlay opacity reduction */
    overlayFadeFactor: 0.5,
    /** Multiplier for hero-content opacity reduction */
    contentFadeFactor: 2.5,
    /** Fraction of viewport height used as reveal threshold */
    revealThreshold: 0.9,
    /** Minimum ms between scroll handler invocations (throttle) */
    throttleMs: 16,
  },
  toast: {
    /** Duration (ms) the toast remains visible */
    displayMs: 1800,
    defaultMessage: 'Copied!',
  },
  status: {
    /** Minecraft server hostname */
    host: 'thfproject.xyz',
    /** mcstatus.io API base URL */
    apiUrl: 'https://api.mcstatus.io/v2/status/java/',
    /** Polling interval in milliseconds */
    pollInterval: 30000,
  },
  selectors: {
    navbar:      '#navbar',
    hero:        '#hero',
    heroOverlay: '#hero-overlay',
    heroContent: '#hero-content',
    navDots:     '#nav-dots',
    copyToast:   '#copy-toast',
    statusDot:   '#status-dot',
    playerText:  '#player-text',
    revealEls: [
      '#info-text',
      '#sc1',
      '#sc2',
      '#sc3',
      '.fcard',
      '#join-cards',
      '#rules-box',
    ],
  },
};

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

/**
 * Safely query a single element; returns null and warns if missing.
 * @param {string} selector - CSS selector
 * @param {ParentNode} [root=document]
 * @returns {Element|null}
 */
function qs(selector, root = document) {
  const el = root.querySelector(selector);
  if (!el) console.warn(`[thf] Element not found: ${selector}`);
  return el;
}

/**
 * Returns a throttled version of the given function.
 * @param {Function} fn - Function to throttle
 * @param {number} limitMs - Minimum ms between calls
 * @returns {Function}
 */
function throttle(fn, limitMs) {
  let lastCall = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - lastCall >= limitMs) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
}

/* ─────────────────────────────────────────────
   CAROUSEL
───────────────────────────────────────────── */

/**
 * Hero image carousel with auto-advance, dot navigation and
 * keyboard left/right arrow support.
 */
const Carousel = (() => {
  const { images, interval } = CONFIG.carousel;
  const { hero: heroSel, navDots: dotsSel } = CONFIG.selectors;

  /** @type {HTMLElement|null} */
  const heroEl = qs(heroSel);
  /** @type {HTMLElement|null} */
  const dotsWrap = qs(dotsSel);

  /** @type {HTMLElement[]} */
  let slides = [];
  /** @type {HTMLElement[]} */
  let dotEls = [];
  /** @type {number} */
  let current = 0;
  /** @type {number|null} */
  let timer = null;

  /**
   * Navigate to a specific slide index.
   * @param {number} index - Target slide index
   */
  function goTo(index) {
    if (!slides.length) return;
    slides[current].classList.remove('active');
    dotEls[current].classList.remove('active');
    dotEls[current].setAttribute('aria-selected', 'false');
    current = ((index % slides.length) + slides.length) % slides.length;
    slides[current].classList.add('active');
    dotEls[current].classList.add('active');
    dotEls[current].setAttribute('aria-selected', 'true');
  }

  /** Advance to the next slide. */
  function next() {
    goTo(current + 1);
  }

  /** Start the auto-advance timer. */
  function startTimer() {
    timer = setInterval(next, interval);
  }

  /**
   * Build slide and dot elements, then start the timer.
   */
  function init() {
    if (!heroEl || !dotsWrap) return;

    slides = images.map((src, i) => {
      const div = document.createElement('div');
      div.className = `slide${i === 0 ? ' active' : ''}`;
      div.style.backgroundImage = `url(${src})`;
      heroEl.insertBefore(div, heroEl.firstChild);
      return div;
    });

    dotEls = images.map((_, i) => {
      const dot = document.createElement('div');
      dot.className = `ndot${i === 0 ? ' active' : ''}`;
      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => goTo(i));
      dot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goTo(i);
        }
      });
      dotsWrap.appendChild(dot);
      return dot;
    });

    document.addEventListener('keydown', (e) => {
      // Only handle arrow keys when no interactive element has focus,
      // to avoid conflicting with form inputs, textareas, etc.
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') goTo(current - 1);
      else if (e.key === 'ArrowRight') next();
    });

    startTimer();
  }

  return { init, goTo, getSlides: () => slides, getCurrent: () => current };
})();

/* ─────────────────────────────────────────────
   SCROLL MANAGER
───────────────────────────────────────────── */

/**
 * Handles all scroll-driven behaviour:
 *  - Navbar glass effect
 *  - Hero parallax / fade-out
 *  - Reveal animations for sections entering the viewport
 */
const ScrollManager = (() => {
  const {
    navbarThreshold,
    parallaxFadeFraction,
    overlayFadeFactor,
    contentFadeFactor,
    revealThreshold,
    throttleMs,
  } = CONFIG.scroll;
  const { navbar: navbarSel, heroOverlay: overlaySel, heroContent: contentSel, revealEls } = CONFIG.selectors;

  const navbar      = qs(navbarSel);
  const heroOverlay = qs(overlaySel);
  const heroContent = qs(contentSel);

  /**
   * Toggle the glass-effect class on the navbar.
   */
  function updateNavbar() {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > navbarThreshold);
  }

  /**
   * Apply parallax fade to the active hero slide, overlay, and content.
   * @param {HTMLElement[]} slides - Array of slide elements
   * @param {HTMLElement} heroEl   - Hero section element
   */
  function updateParallax(slides, heroEl) {
    if (!heroEl) return;
    const progress = Math.min(window.scrollY / (heroEl.offsetHeight * parallaxFadeFraction), 1);

    slides.forEach((s) => {
      s.style.opacity = s.classList.contains('active') ? String(1 - progress) : '0';
    });

    if (heroOverlay) heroOverlay.style.opacity = String(1 - progress * overlayFadeFactor);
    if (heroContent) heroContent.style.opacity = String(Math.max(0, 1 - progress * contentFadeFactor));
  }

  /**
   * Add the "visible" class to any tracked elements that have entered the viewport.
   */
  function checkVisible() {
    const threshold = window.innerHeight * revealThreshold;

    revealEls.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (el.getBoundingClientRect().top < threshold) {
            el.classList.add('visible');
          }
        });
      } catch (err) {
        console.warn(`[thf] Invalid reveal selector: ${selector}`, err);
      }
    });
  }

  /**
   * Attach the (throttled) scroll listener and run an initial check.
   */
  function init() {
    const heroEl = qs(CONFIG.selectors.hero);
    const slides = Carousel.getSlides();

    const onScroll = throttle(() => {
      updateNavbar();
      updateParallax(slides, heroEl);
      checkVisible();
    }, throttleMs);

    window.addEventListener('scroll', onScroll, { passive: true });

    // Run once on load so elements already in view animate immediately.
    updateNavbar();
    updateParallax(slides, heroEl);
    checkVisible();
  }

  return { init, checkVisible };
})();

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */

/**
 * Lightweight copy-feedback toast notification.
 */
const Toast = (() => {
  const { displayMs, defaultMessage } = CONFIG.toast;
  const toastEl = qs(CONFIG.selectors.copyToast);
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;

  /**
   * Show the toast with the given message.
   * @param {string} [message] - Text to display (defaults to CONFIG value)
   */
  function show(message = defaultMessage) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => toastEl.classList.remove('show'), displayMs);
  }

  return { show };
})();

/* ─────────────────────────────────────────────
   STATUS CHECKER
───────────────────────────────────────────── */

/**
 * Polls the Minecraft server status API and updates the UI.
 */
const StatusChecker = (() => {
  const { host, apiUrl, pollInterval } = CONFIG.status;
  const statusDot  = qs(CONFIG.selectors.statusDot);
  const playerText = qs(CONFIG.selectors.playerText);

  /**
   * Format player count as a human-readable string.
   * @param {number} n - Number of online players
   * @returns {string}
   */
  function formatPlayerCount(n) {
    return n === 1 ? '1 player online' : `${n} players online`;
  }

  /**
   * Update the UI to reflect the given online/offline state.
   * @param {boolean} online  - Whether the server is reachable
   * @param {number}  [count] - Player count when online
   */
  function updateUI(online, count = 0) {
    if (statusDot) {
      statusDot.className = online ? 'status-dot' : 'status-dot offline';
    }
    if (playerText) {
      playerText.textContent = online ? formatPlayerCount(count) : 'Server offline';
    }
  }

  /**
   * Fetch current server status from the API and update the UI.
   * @returns {Promise<void>}
   */
  async function fetch() {
    try {
      const response = await window.fetch(`${apiUrl}${host}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      updateUI(data.online === true, data.players?.online ?? 0);
    } catch (err) {
      console.warn('[thf] Could not reach status API:', err);
      if (statusDot)  statusDot.className    = 'status-dot offline';
      if (playerText) playerText.textContent = 'Could not reach server';
    }
  }

  /**
   * Run an initial status check and schedule periodic polling.
   */
  function init() {
    fetch();
    setInterval(fetch, pollInterval);
  }

  return { init };
})();

/* ─────────────────────────────────────────────
   PUBLIC API
   copyText is called directly from HTML onclick
   attributes, so it must remain globally accessible.
───────────────────────────────────────────── */

/**
 * Copy text to the clipboard and show a toast notification.
 * Exposed globally for use in inline HTML onclick handlers.
 * @param {string} text  - Text to copy
 * @param {string} [label] - Optional toast message
 * @returns {void}
 */
function copyText(text, label) {
  navigator.clipboard.writeText(text).then(
    () => Toast.show(label),
    (err) => {
      console.warn('[thf] Clipboard write failed:', err);
      Toast.show('Copy failed — please try again');
    },
  );
}

/* ─────────────────────────────────────────────
   BOOT
───────────────────────────────────────────── */

Carousel.init();
ScrollManager.init();
StatusChecker.init();

