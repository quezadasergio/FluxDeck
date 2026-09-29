import type { ColumnType } from '../../../shared/types'

const WAIT_AND_SEND = `
function waitForElement(selector, index, callback, once) {
  if (once === undefined) once = true;
  const existing = document.querySelectorAll(selector)[index];
  if (existing) {
    callback(existing);
    if (once) return;
  }
  const observer = new MutationObserver(() => {
    const element = document.querySelectorAll(selector)[index];
    if (element) {
      callback(element);
      if (once) observer.disconnect();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
function fluxSend(type, body) {
  if (window.fluxdeck && typeof window.fluxdeck.send === 'function') {
    window.fluxdeck.send(type, body);
  }
}
`

const HIDE_HEADER = `
(() => {
  if (window.__fluxHideHeader) return;
  window.__fluxHideHeader = true;
  const style = document.createElement('style');
  style.textContent = "header { display: none !important; }";
  document.documentElement.appendChild(style);
})();
`

const COMPOSE_FAB = `
(() => {
  if (window.__fluxComposeFab) return;
  window.__fluxComposeFab = true;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = '+';
  btn.title = 'Publicar';
  btn.setAttribute('aria-label', 'Publicar');
  btn.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:2147483646',
    'width:52px',
    'height:52px',
    'border-radius:999px',
    'border:none',
    'background:#1d9bf0',
    'color:#fff',
    'font-size:28px',
    'font-weight:700',
    'line-height:1',
    'cursor:pointer',
    'box-shadow:0 2px 10px rgba(0,0,0,.45)'
  ].join(';');
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    location.href = 'https://x.com/compose/post';
  });
  function syncFab() {
    btn.style.display = /\\/compose/i.test(location.pathname) ? 'none' : 'block';
  }
  syncFab();
  setInterval(syncFab, 1000);
  document.documentElement.appendChild(btn);
})();
`

const HIDE_ADS = `
(() => {
  if (window.__fluxHideAds) return;
  window.__fluxHideAds = true;
  const style = document.createElement('style');
  // CSS-only: JS display:none on MutationObserver was jumping the feed scroll
  // position when new posts/ads mounted below the viewport.
  style.textContent = 'div[data-testid="cellInnerDiv"]:has([data-testid="placementTracking"]) { display: none !important; height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }';
  document.documentElement.appendChild(style);
})();
`

const HORIZONTAL_SCROLL = `
(() => {
  if (window.__fluxHorizScroll) return;
  window.__fluxHorizScroll = true;
  window.addEventListener('wheel', (e) => {
    const ax = Math.abs(e.deltaX);
    const ay = Math.abs(e.deltaY);
    // Ignore trackpad noise on mostly-vertical scrolls.
    if (ax < 6 || ax < ay * 1.75) return;
    e.preventDefault();
    fluxSend('scrollHorizontal', e.deltaX);
  }, { passive: false, capture: true });
})();
`

const FIND_USERNAME = `
(function() {
  const RESERVED = new Set([
    'home','explore','search','notifications','messages','settings','i','compose',
    'login','logout','intent','hashtag','tos','privacy','share','jobs',
    'signup','flow','about','download','help','terms','communitynotes',
    'following','followers','lists','bookmarks','communities','premium','verified'
  ]);
  if (window.__fluxUserWatch) return;
  window.__fluxUserWatch = true;
  let sent = false;
  function extractFromHref(href) {
    if (!href) return null;
    try {
      const url = new URL(href, window.location.origin);
      const segments = url.pathname.split('/').filter(Boolean);
      const first = segments[0];
      if (first && !RESERVED.has(first.toLowerCase()) && /^[A-Za-z0-9_]{1,15}$/.test(first)) {
        return first;
      }
    } catch (_) {}
    return null;
  }
  function fromPageJson() {
    try {
      const html = document.documentElement && document.documentElement.innerHTML;
      if (!html) return null;
      const patterns = [
        /"screen_name":"([A-Za-z0-9_]{1,15})"/,
        /"screen_name":"(@?[A-Za-z0-9_]{1,15})"/,
        /\\\\"screen_name\\\\":\\\\"([A-Za-z0-9_]{1,15})\\\\"/
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m && m[1]) {
          const name = m[1].replace(/^@/, '');
          if (!RESERVED.has(name.toLowerCase())) return name;
        }
      }
    } catch (_) {}
    return null;
  }
  function tryDetect() {
    if (sent) return true;
    if (/\\/i\\/flow\\/login|\\/i\\/flow\\/single_sign_on|\\/login(?:\\/|$)/i.test(location.pathname + location.hash)) {
      return false;
    }
    const selectors = [
      "a[data-testid='AppTabBar_Profile_Link']",
      "a[data-testid='AppTabBar_Profile_Link'] span",
      "a[aria-label='Profile']",
      "a[aria-label='Perfil']",
      "a[aria-label*='Profile']",
      "a[aria-label*='Perfil']",
      "[data-testid='SideNav_AccountSwitcher_Button']",
      "button[data-testid='SideNav_AccountSwitcher_Button']",
      "[data-testid='UserAvatar-Container-unknown'] a[href]",
      "a[href^='/'][role='link']"
    ];
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      for (const el of nodes) {
        let name = extractFromHref(el.getAttribute('href') || el.href || '');
        if (!name) {
          const nested = el.closest('a[href]') || el.querySelector('a[href]');
          if (nested) name = extractFromHref(nested.getAttribute('href') || nested.href || '');
        }
        if (!name) {
          const label = el.getAttribute('aria-label') || '';
          const m = label.match(/@([A-Za-z0-9_]{1,15})/);
          if (m) name = m[1];
        }
        if (name) {
          sent = true;
          fluxSend("userName", name);
          return true;
        }
      }
    }
    const fromJson = fromPageJson();
    if (fromJson) {
      sent = true;
      fluxSend("userName", fromJson);
      return true;
    }
    return false;
  }
  if (tryDetect()) return;
  const obs = new MutationObserver(() => {
    if (tryDetect()) obs.disconnect();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  let ticks = 0;
  const timer = setInterval(() => {
    if (tryDetect() || ++ticks > 120) {
      clearInterval(timer);
      obs.disconnect();
    }
  }, 1000);
})();
`

const FIND_THEME = `
waitForElement("meta[name='theme-color']", 0, (meta) => {
  let debounceTimer = null;
  const reportWhenStable = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fluxSend("themeColor", meta.getAttribute('content'));
    }, 500);
  };
  new MutationObserver(reportWhenStable).observe(meta, { attributes: true, attributeFilter: ['content'] });
  reportWhenStable();
});
`

function wrapOnLoad(body: string): string {
  return `(function() {
  const run = () => {
${body}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();`
}

export function columnOnLoad(type: ColumnType): string {
  // Keep compose available in-column (FAB + X compose). Do not hide the post box.
  let body = WAIT_AND_SEND + HIDE_HEADER + HIDE_ADS + HORIZONTAL_SCROLL + COMPOSE_FAB
  if (type === 'forYou') {
    body += `
(() => {
  if (window.__fluxTabClicked) return;
  window.__fluxTabClicked = true;
  waitForElement("a[href='/home'][role='tab']", 0, (element) => element.click());
})();`
  } else if (type === 'following') {
    body += `
(() => {
  if (window.__fluxTabClicked) return;
  window.__fluxTabClicked = true;
  waitForElement("a[href='/home'][role='tab']", 1, (element) => element.click());
})();`
  }
  return wrapOnLoad(body)
}

export function loginOnLoad(): string {
  return wrapOnLoad(WAIT_AND_SEND + FIND_USERNAME)
}

export function detectUserNameOnce(): string {
  return (
    WAIT_AND_SEND +
    `(function() {
  if (typeof fluxSend !== 'function') return;
  if (/\\/i\\/flow\\/login|\\/login(?:\\/|$)/i.test(location.pathname)) return;
  const RESERVED = new Set([
    'home','explore','search','notifications','messages','settings','i','compose',
    'login','logout','signup','flow','following','followers','bookmarks'
  ]);
  function extract(href) {
    try {
      const parts = new URL(href, location.origin).pathname.split('/').filter(Boolean);
      const first = parts[0];
      if (first && !RESERVED.has(first.toLowerCase()) && /^[A-Za-z0-9_]{1,15}$/.test(first)) return first;
    } catch (_) {}
    return null;
  }
  const profile = document.querySelector("a[data-testid='AppTabBar_Profile_Link'], a[aria-label='Profile'], a[aria-label='Perfil']");
  if (profile) {
    const name = extract(profile.getAttribute('href') || profile.href || '');
    if (name) { fluxSend('userName', name); return; }
  }
  const html = document.documentElement ? document.documentElement.innerHTML : '';
  const m = html && html.match(/"screen_name":"([A-Za-z0-9_]{1,15})"/);
  if (m && m[1] && !RESERVED.has(m[1].toLowerCase())) fluxSend('userName', m[1]);
})();`
  )
}
