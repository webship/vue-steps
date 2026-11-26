'use strict';

// Error pages. An address the app does not know, or a view whose data is missing, shows the app's error
// page: loaded with its status, or reached inside the app (a navigation whose view threw an error). The
// step reads the status (the page load's, when the page came by one; the app's own error, when it has
// one) and the first heading, and the message when one is given.

const { Then } = require('@cucumber/cucumber');
const h = require('./vue-helpers');

const withoutHash = (url) => String(url || '').split('#')[0];

/**
 * The view is the app's error page for a status: its first heading carries the status (Nuxt's error page
 * shows it, as most do), the page loaded with that status when it came by a page load, the app's own
 * error says it when the app has one (Nuxt's payload), and the page says the message, when one is given.
 * The step waits for it.
 *
 * Example #1: Then the view should be the 404 error page
 * Example #2: Then the view should be the 404 error page saying "Post not found"
 * Example #3: And the view should be the 500 error page saying "Internal Server Error"
 * Example #4: Then the view should be the 403 error page
 * Example #5: Then the view should be the 404 error page saying "Page not found"
 */
Then(/^the view should be the (\d{3}) error page(?: saying "([^"]*)")?$/, async function (code, message) {
  const result = await h.poll(this, async (s) => {
    if (!s || s.readyState === 'loading' || (s.nav && s.nav.pending)) return { done: false };
    const heading = await h.call(this, 'firstHeading');
    const text = message ? await h.call(this, 'pageText') : '';
    const appError = await h.call(this, 'nuxtError').catch(() => null);
    const doc = this.vueDocument;
    const nav = this.vueNavigation;
    // The status of the page load is known when the page on the screen is the one it brought.
    const known = !!doc && withoutHash(doc.url) === withoutHash(s.url) && !(nav && nav.kind === 'app' && nav.at > doc.at);
    const loadOk = !known || String(doc.status) === code;
    const appOk = !appError || String(appError.status) === code;
    const headingOk = !!heading && heading.includes(code);
    const messageOk = !message || h.norm(text).toLowerCase().includes(h.norm(message).toLowerCase());
    return { done: loadOk && appOk && headingOk && messageOk, heading, known, status: known ? doc.status : null, appError, messageOk, state: s };
  }, h.budget(this));
  if (result.done) return;
  const what = [];
  if (result.known && String(result.status) !== code) what.push(`the page loaded with the status ${result.status}`);
  if (result.appError && String(result.appError.status) !== code) what.push(`the app's error is a ${result.appError.status}`);
  if (!result.heading || !result.heading.includes(code)) what.push(result.heading ? `its first heading says "${h.excerpt(result.heading, 60)}"` : 'it has no first heading');
  if (message && !result.messageOk) what.push(`it does not say "${message}"`);
  throw await h.laneFailure(this, `Expected the view to be the ${code} error page${message ? ` saying "${message}"` : ''}, but ${what.join(', and ') || 'it is not'}.`, {
    found: `${result.state ? result.state.url : 'the page'}${result.known ? '' : ' (reached inside the app: the status of no page load says it)'}`,
    hint: 'an error page shows the status in its first heading and the message under it; an error page of the app\'s own may word them differently.',
  });
});
