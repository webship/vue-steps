'use strict';

// The page and its waits: the app wiring the server's page up, a page drawn in the browser only, the
// page being still. The waits of every other step of the pack build on these.

const { Given, When, Then, AfterStep } = require('@cucumber/cucumber');
const h = require('./vue-helpers');

/**
 * Wait for the app to wire the page up. A Nuxt page arrives as the server's HTML, and the app's scripts
 * then make it the app's in the browser (hydration): until then its links load whole pages and its
 * buttons do nothing yet. The sign is the app's own state: Nuxt no longer hydrating, or a Vue app
 * mounted. A page without an app, or a browser without JavaScript, has nothing to wait for: the step
 * goes on, and the run's log says so.
 *
 * Example #1: Given the page is wired up
 * Example #2: When the page is wired up
 * Example #3: And the page is wired up
 * Example #4: Then the page is wired up
 * Example #5: But the page is wired up
 */
Given(/^the page is wired up$/, async function () {
  const w = await h.beforeActing(this);
  if (w.app && w.js && !w.wired) {
    throw await h.laneFailure(this, 'Expected the app to wire the page up, but it did not.', {
      found: `the page has the app's markup, and the app was not wired up in ${Math.round(h.budget(this) / 1000)} s`,
      hint: 'the app may have failed to start: look at the browser errors of the run (a module that did not load, an error in a plugin or a page\'s setup).',
    });
  }
  await h.still(this);
});

/**
 * The app has wired the page up: the page has a Vue app (Nuxt's, or a mounted one), and it is no
 * longer hydrating. Unlike "the page is wired up", it fails on a page without an app and in a browser
 * without JavaScript.
 *
 * Example #1: Then the page should be wired up
 * Example #2: And the page should be wired up
 * Example #3: Then the page should be wired up
 * Example #4: But the page should be wired up
 * Example #5: Then the page should be wired up
 */
Then(/^the page should be wired up$/, async function () {
  const w = await h.wiredUp(this);
  if (w.wired) return;
  const s = w.state || {};
  throw await h.laneFailure(this, !w.js
    ? 'Expected the page to be wired up, but the browser has JavaScript off.'
    : (!w.app ? 'Expected the page to be wired up, but the page has no app.' : 'Expected the page to be wired up, but the app has not wired it up.'), {
    found: `${s.url || 'the page'}: ${s.nuxt ? 'a Nuxt page' : (s.app ? 'a Vue app\'s page' : 'no app\'s markup')}; route announcer: ${s.announcer === null || s.announcer === undefined ? 'none' : 'there'}`,
    hint: w.app ? 'look at the browser errors of the run: a module that did not load, or an error while the app starts.' : 'the page has none of the markers of an app (Nuxt\'s #__nuxt, a mounted Vue app\'s data-v-app).',
  });
});

/**
 * The page was drawn in the browser only: the server's HTML held an empty element for the app (a route
 * Nuxt renders on the client, `ssr: false`), and the app drew the page in it. Without JavaScript such a
 * page stays empty.
 *
 * Example #1: Then the page should have been drawn in the browser only
 * Example #2: And the page should have been drawn in the browser only
 * Example #3: Then the page should have been drawn in the browser only
 * Example #4: But the page should have been drawn in the browser only
 * Example #5: Then the page should have been drawn in the browser only
 */
Then(/^the page should have been drawn in the browser only$/, async function () {
  const result = await h.poll(this, async (s) => {
    if (!s || s.readyState === 'loading') return { done: false };
    const shell = await h.call(this, 'shellOnly');
    return { done: shell === true, shell, state: s };
  }, h.budget(this));
  if (result.done) return;
  const s = result.state || {};
  throw await h.laneFailure(this, 'Expected the page to have been drawn in the browser only, but the server\'s HTML held it.', {
    found: `${s.url || 'the page'}: ${result.shell === false ? 'the server sent the page rendered' : 'no element for the app was found'}`,
    hint: 'a route is drawn in the browser only when the app turns server rendering off for it (routeRules: { ssr: false }).',
  });
});

/**
 * Wait for the page to be still: no page load in progress, no request in flight, no navigation of the
 * app in progress, no frame asked for, no animation or transition running, the page wired up when it
 * can be, and nothing changed for two frames.
 *
 * Example #1: When I wait for the page to be still
 * Example #2: And I wait for the page to be still
 * Example #3: When we wait for the page to be still
 * Example #4: Then I wait for the page to be still
 * Example #5: Given I wait for the page to be still
 */
When(/^(?:I |we )?wait for the page to be still$/, async function () {
  const result = await h.still(this, h.budget(this));
  if (result.done) return;
  const s = result.state || {};
  throw await h.laneFailure(this, `Expected the page to be still, but it was still busy after ${Math.round(h.budget(this) / 1000)} s.`, {
    found: (s.busy || []).join('; ') || 'the page was between two documents',
    hint: 'an animation without an end, or a request that never answers, keeps a page busy: wait for what a person waits for instead (a text, a field).',
  });
});

// Opt in with the tag @still-after-steps: after every step of the scenario (webship-js's own
// `I press "…"`, `I click "…"` too), wait for the page to be still, on a page with an app. It never
// fails a step: what comes next waits for what it expects anyway.
AfterStep({ tags: '@still-after-steps' }, async function () {
  if (!this.page) return;
  const s = await h.pageState(this);
  if (s && s.app) await h.still(this);
});
