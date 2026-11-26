'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It puts the page side of the pack
// (vue-probe.js) into every page the World opens, records the status of each page the browser loads, and
// holds the plumbing the steps use and that a project can require for its own steps: the wait budgets,
// the poll on the page, waiting for the app to wire the page up, waiting for the page to be still,
// following a navigation to its end, finding a link or a button by the name a person reads, and the
// failure messages.
//
// The waits are the point of the pack. A Nuxt page arrives as the server's HTML; the app then wires it up
// in the browser (until then its links load whole pages and its buttons do nothing yet). After that, the
// app moves between views inside the page, fetches each view's data, sends a form in place, and moves
// things with frames and transitions. The steps wait for each of those to end, on the page's own
// signals: the app's own state (Nuxt's isHydrating, or a mounted Vue app), its router's navigations
// (Nuxt's page:loading hooks, or Vue Router's guards), the id of the document (so a navigation inside
// the app is told from a whole load without counting on a request), the requests in flight, the frames
// asked for and the animations running. No step sleeps for a fixed time.
//
// Everything builds on webship-js's own helpers (`onNewPage`, `friendly`, `failure`) so the steps fail
// the way the core webship-js steps do.

const webship = require('webship-js/tests/step-definitions/webship');
const { appProbe } = require('./vue-probe');

const { friendly, failure, onNewPage } = webship;

/** The page side as a script: it installs `window.__webshipVue`. */
const PROBE = `(${appProbe.toString()})();`;

// Every page the World opens gets the probe before its own scripts run, and every document it loads
// leaves its status and address for the steps that read an error page or a form sent with a page load.
if (typeof onNewPage === 'function') {
  onNewPage(async (world, page) => {
    try { await page.addInitScript(PROBE); } catch (e) { /* a closed page needs nothing */ }
    page.on('request', (request) => {
      try {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) world.vueLoadStarted = Date.now();
      } catch (e) { /* a page that closed meanwhile */ }
    });
    page.on('response', (response) => {
      try {
        const request = response.request();
        if (request.isNavigationRequest() && response.frame() === page.mainFrame()) {
          world.vueDocuments = (world.vueDocuments || []).concat([{ url: response.url(), status: response.status(), method: request.method(), at: Date.now() }]).slice(-10);
          world.vueDocument = world.vueDocuments[world.vueDocuments.length - 1];
        }
      } catch (e) { /* a page that closed meanwhile */ }
    });
  });
}

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 10 seconds. Kept below
 * webship-js's 45 second step timeout. COMPONENT_WAIT_MS sets it outright (the run of the assertions
 * that must fail uses a short one: each of them waits its whole budget).
 */
function budget(world) {
  const fixed = Number(process.env.COMPONENT_WAIT_MS);
  if (Number.isFinite(fixed) && fixed > 0) return Math.min(fixed, 40000);
  const page = world && world.minWaitTime && world.minWaitTime.page;
  return Math.min(Math.max(page || 0, 10000), 40000);
}

/** White space collapsed, typographic quotes made plain: the way the steps compare texts. */
function norm(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A list for a failure message: `"a", "b"` or `(none)`. */
function listed(values, max) {
  const items = [...new Set((values || []).map(norm).filter(Boolean))];
  const limit = max || 12;
  if (!items.length) return '(none)';
  const shown = items.slice(0, limit).map((v) => `"${v}"`).join(', ');
  return items.length > limit ? `${shown} and ${items.length - limit} more` : shown;
}

/** Shorten a text for a message. */
function excerpt(text, max) {
  const clean = norm(text);
  const limit = max || 160;
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Put the probe into the current page when it is not there (a page opened before this pack was loaded,
 * or a browser without JavaScript, where an init script does not run). */
async function ensureProbe(world) {
  let there = false;
  try {
    there = await world.page.evaluate(() => !!(window.__webshipVue && window.__webshipVue.lib));
  } catch (e) {
    there = false;
  }
  if (!there) {
    try { await world.page.evaluate(PROBE); } catch (e) { /* the page is navigating: the next call retries */ }
  }
}

/** Run a function of the page side's library: `call(world, 'firstHeading')`. */
async function call(world, name, ...args) {
  await ensureProbe(world);
  return world.page.evaluate(([fn, list]) => window.__webshipVue.lib[fn](...list), [name, args]);
}

/** The page side's state, or null while the page is between two documents. */
async function pageState(world) {
  try {
    await ensureProbe(world);
    return await world.page.evaluate(() => (window.__webshipVue ? window.__webshipVue.lib.state() : null));
  } catch (e) {
    return null;
  }
}

/**
 * Look at the page every 50 ms, from Node (a timer in the page would be counted by webship-js as pending
 * work), until `check` returns a value with `done: true` or the time is up. `check` gets the page side's
 * state (null between two documents). Returns the last value it gave.
 */
async function poll(world, check, timeout) {
  const deadline = Date.now() + timeout;
  let last = { done: false };
  for (;;) {
    const state = await pageState(world);
    let value = null;
    try { value = await check(state); } catch (e) { value = { done: false, error: e.message }; }
    if (value) last = value;
    if (value && value.done) return value;
    if (Date.now() + 50 >= deadline) return last;
    await sleep(50);
  }
}

/** Is the browser of this scenario without JavaScript? The lane of the suite, named in its failures. */
async function lane(world) {
  try {
    const js = await call(world, 'jsOn');
    return js ? 'JavaScript on' : 'JavaScript off';
  } catch (e) {
    return 'unknown';
  }
}

/** A failure that names the lane when the browser runs without JavaScript, so a failure of that lane is
 * never read as one of the other. */
async function laneFailure(world, message, details) {
  const which = await lane(world);
  const more = { ...(details || {}) };
  if (which === 'JavaScript off') more.found = `${more.found ? `${more.found}; ` : ''}this run's browser has JavaScript off`;
  return failure(world.page, message, more);
}

/**
 * Wait until the app has wired the page up, when it can: a page with a Vue app, in a browser with
 * JavaScript. Returns what it found: `wired`, `app` (the page has an app to wire it up), `js`.
 */
async function wiredUp(world, timeout) {
  const result = await poll(world, (s) => ({ done: !!s && (!s.app || !s.js || s.wired) && s.readyState !== 'loading', state: s }), timeout || budget(world));
  const s = result.state || {};
  return { wired: !!(s.app && s.js && s.wired), app: !!s.app, js: s.js !== false, done: result.done, state: s };
}

/** A line in the run's log: the scenario's own (cucumber's `log`), else the console. */
function note(world, text) {
  try {
    if (world && typeof world.log === 'function') { world.log(text); return; }
  } catch (e) { /* no log in this World */ }
  console.log(`[vue-steps] ${text}`);
}

/** Wait for the app to wire the page up before a step acts on it; a page without an app or a browser
 * without JavaScript is not waited on, and the log says so once per document. */
async function beforeActing(world) {
  const w = await wiredUp(world);
  const s = w.state || {};
  if (!w.app || !w.js) {
    world.vueNoted = world.vueNoted || new Set();
    if (s.doc && !world.vueNoted.has(s.doc)) {
      world.vueNoted.add(s.doc);
      note(world, !w.js ? 'This browser has JavaScript off: the steps do not wait for the app to wire the page up.' : `${s.url || 'The page'} has no app to wire it up, and the steps do not wait for one.`);
    }
  }
  return w;
}

/** Wait until the page is still (see vue-probe.js). Returns the last state; never fails. */
async function still(world, timeout) {
  return poll(world, (s) => ({ done: !!s && s.still, state: s }), timeout || Math.min(budget(world), 5000));
}

/** Escape a text for a regular expression. */
function escapeRe(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The element of a role and a name, the way a person names it (Playwright's accessible name): an exact
 * name, then without regard to case, then a name that starts with the text (three characters or more);
 * never a part in the middle. The first one on the screen wins. `scope` narrows the search (a locator).
 * Returns `{ locator, names }`; `locator` is null when there is none.
 */
async function byRoleAndName(world, role, name, scope) {
  const root = scope || world.page;
  const clean = norm(name);
  const tries = [
    { name: clean, exact: true },
    { name: new RegExp(`^\\s*${escapeRe(clean)}\\s*$`, 'i') },
  ];
  if (clean.length >= 3) tries.push({ name: new RegExp(`^\\s*${escapeRe(clean)}`, 'i') });
  for (const options of tries) {
    const all = root.getByRole(role, options);
    const count = await all.count();
    for (let i = 0; i < count; i += 1) {
      const one = all.nth(i);
      if (await one.isVisible().catch(() => false)) return { locator: one, names: [] };
    }
    if (count) return { locator: all.first(), names: [] };
  }
  return { locator: null, names: await namesOf(root, role) };
}

/** The accessible names of the elements of a role (30 at most), the way the steps match them. */
async function namesOf(root, role) {
  const all = root.getByRole(role);
  const count = Math.min(await all.count().catch(() => 0), 30);
  const names = [];
  for (let i = 0; i < count; i += 1) {
    const snap = await all.nth(i).ariaSnapshot({ timeout: 1000 }).catch(() => '');
    const m = String(snap).split('\n')[0].match(/^- [a-z]+ "((?:[^"\\]|\\.)*)"/);
    if (m) names.push(m[1].replace(/\\"/g, '"'));
  }
  return names;
}

/**
 * Follow what a step started to its end:
 *  - a change of view inside the app: the same document, a navigation of the app's router started and
 *    ended (Nuxt's page:loading hooks, Vue Router's guards) or a new route, the route announcer (when the
 *    app has one) holding the new title, and the page still;
 *  - a whole page load: a new document, loaded, wired up when it can be, and still.
 * `sameAddress`: the step went to the address the page is on already. Returns `{ kind: 'app' | 'whole' |
 * 'none', state }`.
 */
async function followNavigation(world, before, sameAddress) {
  const result = await poll(world, (s) => {
    if (!s) return { done: false };
    if (s.doc !== before.doc) {
      const ready = s.readyState === 'complete' && (!s.app || !s.js || s.wired);
      return { done: ready && s.still, kind: 'whole', state: s };
    }
    const ended = s.nav.ends > before.nav.ends && !s.nav.pending;
    const moved = s.route !== before.route || s.url !== before.url;
    const announced = s.announcer === null || norm(s.announcer) === norm(s.title);
    if (moved || ended || sameAddress) return { done: (moved || sameAddress || ended) && !s.nav.pending && announced && s.still, kind: 'app', state: s };
    return { done: false, kind: 'none', state: s };
  }, budget(world));
  const kind = result.done ? result.kind : 'none';
  world.vueNavigation = { kind, from: before.url, to: result.state ? result.state.url : before.url, doc: result.state ? result.state.doc : before.doc, at: Date.now() };
  return { kind, done: !!result.done, state: result.state || before };
}

module.exports = {
  PROBE,
  budget,
  norm,
  listed,
  excerpt,
  sleep,
  ensureProbe,
  call,
  pageState,
  poll,
  lane,
  laneFailure,
  wiredUp,
  beforeActing,
  note,
  still,
  escapeRe,
  byRoleAndName,
  namesOf,
  followNavigation,
  failure: (page, message, details) => failure(page, message, details),
  friendly: (input, cause) => friendly(input, cause),
};
