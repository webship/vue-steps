'use strict';

// The app's views: a link used and the browser's back, each to its end (a change of view inside the
// app, or a whole page load, told apart by the document, never by a request: the app fetches a view's
// code ahead for the links on the screen, and its data during the navigation), the route announcer,
// the link of the current view, the view's address, and its data.

const { When, Then } = require('@cucumber/cucumber');
const h = require('./vue-helpers');

const withoutHash = (url) => String(url || '').split('#')[0];

async function linkByName(world, name) {
  const found = await h.byRoleAndName(world, 'link', name);
  if (!found.locator) {
    throw await h.laneFailure(world, `Expected a link named "${name}" on the page, but there is none.`, {
      found: `the links here: ${h.listed(found.names, 20)}`,
      hint: 'a link is named by its text, or its label; the name is matched from its start.',
    });
  }
  return found.locator;
}

/** How a step's navigation ended, for a failure message. */
function stillBusy(s) {
  return `the address is ${s.url || '(unknown)'}; route announcer: "${s.announcer || ''}"; still busy: ${(s.busy || []).join('; ') || 'nothing'}`;
}

/**
 * Use a link of the app, by its name, and wait for the navigation to end: a change of view inside the app
 * (the app's router started and ended its navigation, the route announcer holds the new title, the page
 * is still), or a whole page load (the new page loaded, and wired up when it can be). The step first
 * waits for the app to wire the page up, as a click before then loads a whole page.
 *
 * Example #1: When I use the "Posts" link
 * Example #2: When I use the "About" link
 * Example #3: And I use the "Contact" link
 * Example #4: When we use the "Home" link
 * Example #5: When I use the "Invoices" link
 */
When(/^(?:I |we )?use the "([^"]*)" link$/, async function (name) {
  await h.beforeActing(this);
  const link = await linkByName(this, name);
  const before = await h.pageState(this);
  const href = await link.evaluate((a) => a.href || '').catch(() => '');
  const sameAddress = !!href && withoutHash(href) === withoutHash(before && before.url);
  try {
    await link.click({ timeout: h.budget(this) });
  } catch (e) {
    throw h.friendly({ action: 'click', target: `the link "${name}"`, cause: e, hint: 'it may be covered by another part of the page, or not on the screen.' });
  }
  const nav = await h.followNavigation(this, before, sameAddress);
  if (nav.kind === 'none') {
    throw await h.laneFailure(this, `Using the link "${name}" did not end a navigation in ${Math.round(h.budget(this) / 1000)} s.`, {
      found: `${stillBusy(nav.state || {})}${href ? ` (the link goes to ${href})` : ''}`,
      hint: 'the app may have stopped the navigation (a guard of its router), or the view it goes to failed to load.',
    });
  }
});

/**
 * Go back with the browser, and wait for the navigation to end, a change of view inside the app or a
 * whole page load, as using a link does.
 *
 * Example #1: When I return to the previous view
 * Example #2: And I return to the previous view
 * Example #3: When we return to the previous view
 * Example #4: Then I return to the previous view
 * Example #5: Given I return to the previous view
 */
When(/^(?:I |we )?return to the previous view$/, async function () {
  await h.beforeActing(this);
  const before = await h.pageState(this);
  try {
    await this.page.goBack({ waitUntil: 'commit', timeout: h.budget(this) });
  } catch (e) {
    throw h.friendly({ action: 'go back', target: 'the previous view', cause: e, hint: 'the browser may have no page before this one in the scenario.' });
  }
  const nav = await h.followNavigation(this, before, false);
  if (nav.kind === 'none') {
    throw await h.laneFailure(this, 'Going back did not end a navigation.', {
      found: stillBusy(nav.state || {}),
      hint: 'this may be the first page the scenario opened: there is no page before it.',
    });
  }
});

/**
 * How the last navigation of the pack's steps ended: a change of view in place (the same document: the
 * page did not load again, and what it held in the browser stays), or a new page loaded.
 *
 * Example #1: Then the view should have changed in place
 * Example #2: Then a new page should have loaded
 * Example #3: And the view should have changed in place
 * Example #4: But a new page should have loaded
 * Example #5: Then the view should have changed in place
 */
Then(/^(the view should have changed in place|a new page should have loaded)$/, async function (how) {
  const nav = this.vueNavigation;
  const wanted = how === 'the view should have changed in place' ? 'app' : 'whole';
  if (!nav) {
    throw await h.laneFailure(this, 'Expected a navigation of the scenario, but none of its steps made one.', {
      hint: 'navigate with "I use the "..." link" or "I return to the previous view" first.',
    });
  }
  if (nav.kind === wanted) return;
  const said = { app: 'changed the view in place', whole: 'loaded a new page', none: 'did not end' };
  throw await h.laneFailure(this, `Expected the last navigation to have ${wanted === 'app' ? 'changed the view in place' : 'loaded a new page'}, but it ${said[nav.kind] || nav.kind}.`, {
    found: `from ${nav.from} to ${nav.to}`,
    hint: wanted === 'app' ? 'a link to another site, a page the app has not wired up, or a browser without JavaScript loads a new page.' : 'a page the app has wired up changes its view in place.',
  });
});

/**
 * The route announcer, the live region the app keeps for screen readers, says the title of the view a
 * navigation came to (matched exactly, then without regard to case, then from its start). Nuxt's
 * announcer says the page's title each time the page's head is rendered: the step reads it once the
 * navigation has ended, and waits for it.
 *
 * Example #1: Then the new view should be announced as "Posts"
 * Example #2: Then the new view should be announced as "About"
 * Example #3: And the new view should be announced as "Moving between pages"
 * Example #4: Then the new view should be announced as "Home"
 * Example #5: Then the new view should be announced as "Invoices"
 */
Then(/^the new view should be announced as "([^"]*)"$/, async function (title) {
  const want = h.norm(title).toLowerCase();
  const result = await h.poll(this, (s) => {
    if (!s || s.announcer === null || s.announcer === undefined) return { done: false, state: s };
    const said = h.norm(s.announcer).toLowerCase();
    return { done: !s.nav.pending && (said === want || (want.length >= 3 && said.startsWith(want))), state: s };
  }, h.budget(this));
  if (result.done) return;
  const s = result.state || {};
  throw await h.laneFailure(this, s.announcer === null || s.announcer === undefined
    ? `Expected the new view to be announced as "${title}", but the page has no route announcer.`
    : `Expected the new view to be announced as "${title}", but the announcer says "${h.excerpt(s.announcer, 80)}".`, {
    found: `the page's title is "${s.title || ''}"`,
    hint: s.announcer === null || s.announcer === undefined ? 'the announcer is the app\'s own (Nuxt\'s <NuxtRouteAnnouncer />); it is there once the app has wired the page up, and an error page has none.' : 'the announcer says the title of the view each time the page\'s head is rendered.',
  });
});

/**
 * A link marks the view a person is on (`aria-current="page"`, on the link or on the list item of the
 * navigation that holds it): the link of the current view in a navigation. The step waits for it.
 *
 * Example #1: Then the "Posts" link should be marked current
 * Example #2: Then the "Home" link should be marked current
 * Example #3: And the "About" link should be marked current
 * Example #4: Then the "Invoices" link should be marked current
 * Example #5: Then the "Settings" link should be marked current
 */
Then(/^the "([^"]*)" link should be marked current$/, async function (name) {
  const deadline = Date.now() + h.budget(this);
  for (;;) {
    const link = (await h.byRoleAndName(this, 'link', name)).locator;
    const marked = link && await link.evaluate((a) => {
      const holder = a.closest('[aria-current]');
      return !!holder && holder.getAttribute('aria-current') === 'page' && (holder === a || (holder.tagName === 'LI' && holder.contains(a)));
    }).catch(() => false);
    if (marked) return;
    if (Date.now() + 50 >= deadline) break;
    await h.sleep(50);
  }
  const current = await this.page.locator('[aria-current]').evaluateAll((els) => els.map((e) => `${(e.textContent || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()} (${e.getAttribute('aria-current')})`)).catch(() => []);
  throw await h.laneFailure(this, `Expected the link "${name}" to be marked current, but it is not.`, {
    found: `the links marked current: ${h.listed(current)}`,
    hint: 'the link of the current view carries aria-current="page" (a router link does), or the list item that holds it does.',
  });
});

/**
 * The address of the view the app shows, as its router has it (the path and query), once no navigation
 * is in progress: "/posts", "/posts/2", "/contact?sent=Ada". The step waits for it.
 *
 * Example #1: Then the view's address should be "/posts"
 * Example #2: Then the view's address should be "/posts/2"
 * Example #3: And the view's address should be "/"
 * Example #4: Then the view's address should be "/contact?sent=Ada"
 * Example #5: Then the view's address should be "/invoices"
 */
Then(/^the view's address should be "([^"]*)"$/, async function (address) {
  const want = String(address).trim();
  const result = await h.poll(this, (s) => ({ done: !!s && !s.nav.pending && decodeURIComponent(s.route) === decodeURIComponent(want), state: s }), h.budget(this));
  if (result.done) return;
  const s = result.state || {};
  throw await h.laneFailure(this, `Expected the view's address to be "${want}", but it is "${s.route || '(unknown)'}".`, {
    found: `the page's address is ${s.url || '(unknown)'}`,
    hint: 'the address is the route the app shows: its path and query, without the site\'s own address.',
  });
});

/**
 * Wait for the view's data to arrive: the requests of the page answered (the data a view fetches as it
 * opens, or loads again), no navigation in progress, and the page still. Nothing about a fixed time.
 *
 * Example #1: When I wait for the view's data to arrive
 * Example #2: And I wait for the view's data to arrive
 * Example #3: When we wait for the view's data to arrive
 * Example #4: Then I wait for the view's data to arrive
 * Example #5: Given I wait for the view's data to arrive
 */
When(/^(?:I |we )?wait for the view's data to arrive$/, async function () {
  const result = await h.poll(this, (s) => ({ done: !!s && !s.inFlight && !s.nav.pending && s.still, state: s }), h.budget(this));
  if (result.done) return;
  const s = result.state || {};
  throw await h.laneFailure(this, `Expected the view's data to arrive, but the page was still waiting after ${Math.round(h.budget(this) / 1000)} s.`, {
    found: (s.busy || []).join('; ') || 'the page was between two documents',
    hint: 'a request that never answers keeps a view waiting: look at the network of the run, or the server\'s log.',
  });
});
