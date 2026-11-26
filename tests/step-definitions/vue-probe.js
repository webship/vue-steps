'use strict';

// The page side of the pack: put into every page before the page's own scripts (vue-helpers.js does
// it), it installs `window.__webshipVue`.
//
// It keeps to the page side and to the app's own signals: an id for each document (so a step tells a
// navigation inside the app from a whole page load without counting on requests), the frames the page
// asks for, the requests it has in flight (fetch and XMLHttpRequest: a form sent in place, the data of
// a view), the input events, the changes of the DOM, whether the server's HTML held the page or only an
// empty shell, and, once the app has wired the page up, the navigations of its router: Nuxt's own
// page:loading:start and page:loading:end, or Vue Router's guards in an app without Nuxt.
//
// Not a step file: it registers no step definitions. `appProbe` is a plain function, serialised into
// the page.

function appProbe() {
  if (window.__webshipVue) return;
  const now = () => performance.now();
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  const state = {
    doc: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    frames: 0,
    pending: new Set(),
    lastFrame: 0,
    lastInput: 0,
    lastMutation: 0,
    inFlight: 0,
    seq: 0,
    requests: [],
    navPending: 0,
    navStarts: 0,
    navEnds: 0,
    lastNavEnd: 0,
    hooked: false,
    shellOnly: null,
  };

  // Frames: every callback the page asks for, until it runs or is cancelled. The probe's own waits use
  // the original function, so they are not counted.
  window.requestAnimationFrame = function requestAnimationFrame(callback) {
    let id = 0;
    id = nativeRaf((time) => {
      state.pending.delete(id);
      state.frames += 1;
      state.lastFrame = now();
      return callback(time);
    });
    state.pending.add(id);
    return id;
  };
  window.cancelAnimationFrame = function cancelAnimationFrame(id) {
    state.pending.delete(id);
    return nativeCancel(id);
  };

  // Requests the page starts, by fetch (Nuxt's $fetch and useFetch) or XMLHttpRequest (a library of the app).
  const track = (url, method) => {
    const entry = { seq: (state.seq += 1), url, method, status: 0, start: now(), end: 0, body: '' };
    state.requests.push(entry);
    if (state.requests.length > 200) state.requests.shift();
    state.inFlight += 1;
    return (status, body) => {
      if (entry.end) return;
      entry.status = status;
      entry.end = now();
      if (typeof body === 'string') entry.body = body.slice(0, 2000);
      state.inFlight -= 1;
    };
  };
  if (nativeFetch) {
    window.fetch = function fetch(input, init) {
      let url = '';
      let method = 'GET';
      try {
        url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, location.href).href;
        method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      } catch (e) { /* an address the page itself will refuse */ }
      const done = track(url, method);
      return nativeFetch(input, init).then((response) => {
        // The answer's text for the form steps, read from a copy, never from the page's own body.
        if (method !== 'GET') response.clone().text().then((text) => done(response.status, text), () => done(response.status));
        else done(response.status);
        return response;
      }, (error) => { done(-1); throw error; });
    };
  }
  if (window.XMLHttpRequest) {
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__webshipVue = { method: String(method || 'GET').toUpperCase(), url: String(url) };
      return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      const meta = this.__webshipVue || { method: 'GET', url: '' };
      let url = meta.url;
      try { url = new URL(meta.url, location.href).href; } catch (e) { /* kept as given */ }
      const done = track(url, meta.method);
      this.addEventListener('loadend', () => done(this.status, typeof this.responseText === 'string' ? this.responseText : ''));
      return send.apply(this, arguments);
    };
  }

  const markInput = () => { state.lastInput = now(); };
  for (const type of ['pointerdown', 'mousedown', 'keydown', 'click', 'submit', 'input']) {
    window.addEventListener(type, markInput, true);
  }

  new MutationObserver(() => { state.lastMutation = now(); })
    .observe(document, { childList: true, subtree: true, attributes: true, characterData: true });

  // The server's HTML, before the app's scripts run (they run after parsing, before DOMContentLoaded): did
  // it hold the page, or only an empty element for the app to draw into?
  const mountPoint = () => document.getElementById('__nuxt') || document.getElementById('app');
  document.addEventListener('readystatechange', () => {
    if (document.readyState !== 'interactive' || state.shellOnly !== null) return;
    const el = mountPoint();
    const data = document.getElementById('__NUXT_DATA__');
    state.shellOnly = data && data.dataset ? data.dataset.ssr === 'false' : (el ? el.children.length === 0 : null);
  });

  // Nuxt's own app, from the page it rendered on the server or drew in the browser.
  const nuxtMarked = () => !!(document.getElementById('__NUXT_DATA__') || window.__NUXT__ || document.getElementById('__nuxt'));
  const nuxtApp = () => {
    try { return typeof window.useNuxtApp === 'function' ? window.useNuxtApp() : null; } catch (e) { return null; }
  };
  const vueRoot = () => document.querySelector('[data-v-app]');
  // A Vue app that has not mounted yet: create-vue's page, an empty #app and the app's module script.
  const vueShell = () => !!(document.getElementById('app') && document.querySelector('script[type="module"]'));
  const vueRouter = () => {
    const root = vueRoot();
    try { return root && root.__vue_app__ ? root.__vue_app__.config.globalProperties.$router || null : null; } catch (e) { return null; }
  };
  const navStart = () => { state.navPending += 1; state.navStarts += 1; };
  const navEnd = () => { state.navPending = Math.max(0, state.navPending - 1); state.navEnds += 1; state.lastNavEnd = now(); };

  // Wired up: Nuxt's app no longer hydrating, or a Vue app mounted. Once it is, the probe listens to the
  // app's navigations: Nuxt's page:loading hooks (an error that ends a navigation ends it too), or Vue
  // Router's guards in an app without Nuxt.
  function wiredUp() {
    const app = nuxtApp();
    if (app) {
      if (app.isHydrating !== false) return false;
      if (!state.hooked) {
        state.hooked = true;
        try {
          app.hook('page:loading:start', navStart);
          app.hook('page:loading:end', navEnd);
          app.hook('app:error', () => { if (state.navPending) { state.navPending = 0; state.navEnds += 1; state.lastNavEnd = now(); } });
          app.hook('vue:error', () => { if (state.navPending) { state.navPending = 0; state.navEnds += 1; state.lastNavEnd = now(); } });
        } catch (e) { /* an app without hooks: the address and the quiet still tell */ }
      }
      return true;
    }
    if (nuxtMarked()) return false;
    if (!vueRoot()) return false;
    const router = vueRouter();
    if (router && !state.hooked) {
      state.hooked = true;
      try {
        router.beforeEach(() => { navStart(); });
        router.afterEach(() => { navEnd(); });
        router.onError(() => { if (state.navPending) navEnd(); });
      } catch (e) { /* the quiet still tells */ }
    }
    return true;
  }

  // Does this page run its own scripts? A browser without JavaScript (a lane of the suite) never lets the
  // app wire the page up, and the steps do not wait for it there. Asked once per document.
  let scriptsRun = null;
  function jsOn() {
    if (scriptsRun !== null) return scriptsRun;
    try {
      const s = document.createElement('script');
      s.textContent = 'window.__webshipVueScripts = 1;';
      (document.head || document.documentElement).appendChild(s);
      s.remove();
      scriptsRun = window.__webshipVueScripts === 1;
    } catch (e) {
      scriptsRun = false;
    }
    return scriptsRun;
  }

  function runningAnimations() {
    if (!document.getAnimations) return [];
    return document.getAnimations().filter((a) => {
      if (a.playState !== 'running') return false;
      try {
        const end = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : 0;
        return Number.isFinite(end);
      } catch (e) {
        return false;
      }
    }).map((a) => a.animationName || a.transitionProperty || 'an animation');
  }

  const announcerEl = () => document.querySelector('.nuxt-route-announcer [aria-live], .nuxt-route-announcer [role="status"]');
  const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();

  const lib = {
    doc: () => state.doc,
    jsOn,
    seq: () => state.seq,
    requestsSince: (seq) => state.requests.filter((r) => r.seq > seq).map((r) => ({ ...r })),
    navCounts: () => ({ starts: state.navStarts, ends: state.navEnds, pending: state.navPending }),
    route() {
      const app = nuxtApp();
      try { if (app && app._route) return app._route.fullPath; } catch (e) { /* below */ }
      const router = vueRouter();
      try { if (router) return router.currentRoute.value.fullPath; } catch (e) { /* below */ }
      return `${location.pathname}${location.search}${location.hash}`;
    },
    announcer: () => { const el = announcerEl(); return el ? clean(el.textContent) : null; },
    shellOnly: () => state.shellOnly,
    nuxtError() {
      const app = nuxtApp();
      try {
        const e = app && app.payload ? app.payload.error : null;
        return e ? { status: Number(e.statusCode || e.status) || 0, message: String(e.statusMessage || e.message || '') } : null;
      } catch (x) {
        return null;
      }
    },
    // The page's state for a wait. Still: the document loaded, no request in flight, no navigation of the
    // app in progress, no frame asked for, no finite animation or transition running, the page wired up
    // when it can be, and 40 ms of quiet (no frame, no change of the DOM), with a frame after the last
    // input or 100 ms of nothing.
    state() {
      const t = now();
      const js = jsOn();
      const app = js && (nuxtMarked() || !!vueRoot() || vueShell());
      const wired = js ? wiredUp() : false;
      const animations = runningAnimations();
      const sinceFrame = state.lastFrame ? t - state.lastFrame : t;
      const sinceMutation = state.lastMutation ? t - state.lastMutation : t;
      const sinceInput = state.lastInput ? t - state.lastInput : t;
      const frameAfterInput = state.lastFrame > state.lastInput;
      const busy = [];
      if (document.readyState !== 'complete') busy.push(`the document is ${document.readyState}`);
      if (app && !wired) busy.push('the app has not wired the page up yet');
      if (state.navPending) busy.push('a navigation of the app is in progress');
      if (state.inFlight) busy.push(`${state.inFlight} request${state.inFlight > 1 ? 's' : ''} in flight`);
      if (state.pending.size) busy.push(`${state.pending.size} frame${state.pending.size > 1 ? 's' : ''} asked for`);
      if (animations.length) busy.push(`running: ${animations.slice(0, 3).join(', ')}`);
      if (sinceMutation < 40) busy.push('the page changed in the last 40 ms');
      if (sinceFrame < 40) busy.push('a frame ran in the last 40 ms');
      if (!frameAfterInput && sinceInput < 100) busy.push('no frame since the last input');
      return {
        now: t,
        doc: state.doc,
        url: location.href,
        route: lib.route(),
        title: document.title,
        readyState: document.readyState,
        js,
        app,
        nuxt: nuxtMarked(),
        wired,
        inFlight: state.inFlight,
        nav: { starts: state.navStarts, ends: state.navEnds, pending: state.navPending },
        frames: state.frames,
        animations,
        announcer: lib.announcer(),
        busy,
        still: busy.length === 0,
      };
    },
    firstHeading() {
      const h = document.querySelector('h1');
      return h ? clean(h.textContent) : null;
    },
    alerts() {
      return [...document.querySelectorAll('[role="alert"]')].filter((e) => !e.closest('.nuxt-route-announcer')).map((e) => clean(e.textContent)).filter(Boolean);
    },
    pageText() {
      return clean(document.body && document.body.innerText);
    },
  };

  window.__webshipVue = { lib };
}

module.exports = { appProbe };
