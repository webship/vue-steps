'use strict';

// Forms, in both modes with one phrase. With JavaScript, an app sends a form in place: a request of its
// own (Nuxt's $fetch, or a library's), its answer shown in the page. Without JavaScript, or for a form
// the app leaves to the browser, the browser posts the form and loads the page it is answered with (the
// server may send it back to the form, with the answer in the address). The step waits for whichever
// happens, and records it for the assertions.

const { When, Then } = require('@cucumber/cucumber');
const h = require('./vue-helpers');

/**
 * Send a form with one of its buttons, by the button's name, and wait for what it brings: the answer of
 * the request the app sends in place, and the page still after it; or the page a posted form loads
 * (through the server's redirects, wired up by the app when it can be). A button the app handles in the
 * page without sending anything ends when the page is still.
 *
 * Example #1: When I send the form with the "Send" button
 * Example #2: When I send the form with the "Save" button
 * Example #3: And I send the form with the "Subscribe" button
 * Example #4: When we send the form with the "Log in" button
 * Example #5: When I send the form with the "Search" button
 */
When(/^(?:I |we )?send the form with the "([^"]*)" button$/, async function (name) {
  await h.beforeActing(this);
  const found = await h.byRoleAndName(this, 'button', name, this.page.locator('form'));
  if (!found.locator) {
    throw await h.laneFailure(this, `Expected a button named "${name}" in a form of the page, but there is none.`, {
      found: `the buttons of the page's forms: ${h.listed(found.names, 30)}`,
      hint: 'a button is named by its text, or its label; the name is matched from its start.',
    });
  }
  if (await found.locator.isDisabled().catch(() => false)) {
    throw await h.laneFailure(this, `Could not send the form with the "${name}" button: it is disabled.`, {
      hint: 'the form may need something first (a field filled in), or be sending already.',
    });
  }
  const before = await h.pageState(this);
  const seq = await h.call(this, 'seq');
  const clicked = Date.now();
  try {
    await found.locator.click({ timeout: h.budget(this) });
  } catch (e) {
    throw h.friendly({ action: 'click', target: `the "${name}" button`, cause: e, hint: 'it may be covered by another part of the page.' });
  }
  const result = await h.poll(this, async (s) => {
    if (!s) return { done: false };
    if (s.doc !== before.doc) {
      const ready = s.readyState === 'complete' && (!s.app || !s.js || s.wired);
      return { done: ready && s.still, mode: 'whole', state: s };
    }
    const sent = (await h.call(this, 'requestsSince', seq)).filter((r) => r.method !== 'GET');
    if (sent.length) {
      const last = sent[sent.length - 1];
      return { done: sent.every((r) => r.end) && s.still, mode: 'place', status: last.status, body: last.body, state: s };
    }
    // A page load on its way: the old page stays on the screen until the answer comes.
    if (this.vueLoadStarted >= clicked) return { done: false, mode: 'whole', state: s };
    // Nothing sent and nothing loaded: the app handled the button in the page.
    return { done: s.still && Date.now() - clicked > 300, mode: 'none', state: s };
  }, h.budget(this));
  if (!result.done) {
    const s = result.state || {};
    throw await h.laneFailure(this, `Sending the form with the "${name}" button did not end in ${Math.round(h.budget(this) / 1000)} s.`, {
      found: `still busy: ${(s.busy || []).join('; ') || 'nothing'}`,
      hint: 'the server may not answer the form, or the page it sends to may fail to load.',
    });
  }
  let status = result.status;
  let statuses = status === undefined ? [] : [status];
  if (result.mode === 'whole') {
    // The posted form's answer and the pages it sent to: 303 then 200, when the server sends the browser
    // back to the form with the answer in its address.
    statuses = (this.vueDocuments || []).filter((d) => d.at >= clicked).map((d) => d.status);
    status = statuses.length ? statuses[0] : undefined;
    this.vueNavigation = { kind: 'whole', from: before.url, to: result.state.url, doc: result.state.doc, at: Date.now() };
  }
  const alerts = await h.call(this, 'alerts').catch(() => []);
  this.vueForm = { mode: result.mode, status, statuses, body: result.body || '', alerts, button: name, at: Date.now() };
});

/** The last form a step of the pack sent, or a failure that says to send one first. */
async function lastForm(world) {
  if (world.vueForm) return world.vueForm;
  throw await h.laneFailure(world, 'Expected a form the scenario sent, but none of its steps sent one.', {
    hint: 'send it with "I send the form with the "..." button" first.',
  });
}

/** Whether the app turned a sent form down: its answer was a 4xx, or the page shows an alert. */
function turnedDown(form) {
  return (form.status >= 400 && form.status < 500) || form.alerts.length > 0;
}

/**
 * The app took the last form a step of the pack sent: its answer was not a refusal (2xx, or a redirect),
 * and the page shows no alert (role="alert") about it.
 *
 * Example #1: Then the form should have gone through
 * Example #2: And the form should have gone through
 * Example #3: Then the form should have gone through
 * Example #4: But the form should have gone through
 * Example #5: Then the form should have gone through
 */
Then(/^the form should have gone through$/, async function () {
  const form = await lastForm(this);
  if (form.mode === 'none') {
    throw await h.laneFailure(this, `Expected the form to have gone through, but the "${form.button}" button sent nothing.`, {
      found: 'the app handled the button in the page: no request, no page load',
      hint: 'a button can change the page without sending the form; the form is sent by its submit button.',
    });
  }
  if (form.status >= 200 && form.status < 400 && !form.alerts.length) return;
  throw await h.laneFailure(this, `Expected the form to have gone through, but ${form.alerts.length ? `the page says "${h.excerpt(form.alerts[0], 100)}"` : `the answer was ${form.status}`}.`, {
    found: form.mode === 'place' ? `the answer of the request sent in place: ${form.status}` : `the pages the posted form loaded: ${form.statuses.join(' then ') || '(none)'}`,
    hint: 'a refused form keeps what was sent and says why in an alert: look at the message, or at the fields it names.',
  });
});

/**
 * The app turned the last form a step of the pack sent down, and says why: its answer was a refusal
 * (4xx), or the page shows an alert (role="alert"); the message given is in the alert (from its start,
 * without regard to case), or in the refusal's answer.
 *
 * Example #1: Then the form should have been turned down with "Your message needs at least 10 characters."
 * Example #2: Then the form should have been turned down with "Your name is required."
 * Example #3: And the form should have been turned down with "Wrong email or password"
 * Example #4: Then the form should have been turned down with "Your message needs"
 * Example #5: Then the form should have been turned down with "This field is required"
 */
Then(/^the form should have been turned down with "([^"]*)"$/, async function (message) {
  const form = await lastForm(this);
  const want = h.norm(message).toLowerCase();
  // The alert may come a little after the answer: read the page's alerts again for a while.
  let alerts = form.alerts;
  const deadline = Date.now() + Math.min(h.budget(this), 5000);
  const says = () => alerts.some((a) => h.norm(a).toLowerCase().startsWith(want) || h.norm(a).toLowerCase().includes(want))
    || (form.status >= 400 && h.norm(form.body).toLowerCase().includes(want));
  while (!(turnedDown({ ...form, alerts }) && says()) && Date.now() < deadline) {
    await h.sleep(50);
    alerts = await h.call(this, 'alerts').catch(() => alerts);
  }
  if (turnedDown({ ...form, alerts }) && says()) return;
  throw await h.laneFailure(this, !turnedDown({ ...form, alerts })
    ? `Expected the form to have been turned down with "${message}", but it went through (${form.status}).`
    : `Expected the form to have been turned down with "${message}", but it says ${h.listed(alerts) === '(none)' ? `nothing in an alert (the answer was ${form.status})` : h.listed(alerts)}.`, {
    found: form.mode === 'place' ? `the answer of the request sent in place: ${form.status}` : `the pages the posted form loaded: ${form.statuses.join(' then ') || '(none)'}`,
    hint: 'the message is the text of the page\'s alert (role="alert"), matched from its start without regard to case.',
  });
});

/**
 * How the last form a step of the pack sent was sent: in place (a request of the app, the page staying
 * as it is), or by the browser, which loaded the page the form was answered with.
 *
 * Example #1: Then the form should have been sent in place
 * Example #2: Then the form should have led to a new page
 * Example #3: And the form should have been sent in place
 * Example #4: But the form should have led to a new page
 * Example #5: Then the form should have been sent in place
 */
Then(/^the form should (have been sent in place|have led to a new page)$/, async function (how) {
  const form = await lastForm(this);
  const wanted = how === 'have been sent in place' ? 'place' : 'whole';
  if (form.mode === wanted) return;
  const said = { place: 'was sent in place', whole: 'led to a new page', none: 'was not sent: the app handled the button in the page' };
  throw await h.laneFailure(this, `Expected the form to ${how}, but it ${said[form.mode] || form.mode}.`, {
    found: `the "${form.button}" button`,
    hint: wanted === 'place' ? 'a form is sent in place when the app has wired the page up and handles the form\'s submit.' : 'without JavaScript a form loads the page it is answered with.',
  });
});
