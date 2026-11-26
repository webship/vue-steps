<p align="center"><img src="https://raw.githubusercontent.com/webship/vue-steps/2.0.x/assets/logo.svg" alt="Vue logo" width="96"></p>

# vue-steps

Cucumber step definitions for Vue apps, Nuxt first, for [webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD
browser automation harness built on Playwright and Cucumber-js.

A Nuxt page arrives as the server's HTML; the app's scripts then wire it up in the browser (hydration). Until they
have, the page's links load whole pages and its buttons do nothing yet. After that, the app changes its views inside
the page, fetches each view's data during the navigation, sends a form in place, and shows its error page when a view
fails. The steps wait for each of those to end, on the app's own signals, never for a fixed time:

- the app's own state: Nuxt no longer hydrating (`useNuxtApp().isHydrating`), or a Vue app mounted;
- its router's navigations: Nuxt's `page:loading:start` and `page:loading:end`, or Vue Router's guards in an app
  without Nuxt;
- the document: a change of view keeps it, a whole page load brings a new one (told apart without counting on a
  request: the app fetches a view's code ahead for the links on the screen);
- the requests in flight (a view's data, a form sent in place), the frames asked for and the animations and
  transitions running.

The same steps run in a browser with JavaScript and in one without: a form's step waits for the answer of the request
the app sends in place in the one, and for the page the posted form loads in the other.

No step phrase names the framework: a scenario reads `When I use the "Posts" link`, `When I send the form with the
"Send" button` and `Then the form should have been turned down with "…"`.

CI makes the demo (Nuxt's official starter with the pages of [`demo/`](demo/)), builds it, serves it with its own
server, and runs the whole suite against it twice in a browser with JavaScript and twice in one without, then the
assertions that must fail in each; see [`.github/workflows/test.yml`](.github/workflows/test.yml).

## Wiring the page up

A page with a Vue app is waited on until the app has wired it up: Nuxt's own flag (`isHydrating` turning false), or,
in an app without Nuxt, the mount of the app (Vue marks the element it mounts in the browser `data-v-app`; an app
rendered on the server and hydrated keeps only its element's own app, which the steps read too). Every step that acts (using a link,
sending a form) waits for it first, as a click before then loads a whole page; `Given the page is wired up` waits for
it on purpose. A page without an app, and every page in a browser without JavaScript, have nothing to wait for: the
steps go on, and say so in the run's log.

A view Nuxt draws in the browser only (`routeRules: { '/client-only': { ssr: false } }`) arrives as an empty element:
`Then the page should have been drawn in the browser only` says so, and without JavaScript such a page stays empty.

## From nothing to a green run

What the machine needs: git, Node.js 24 or later with npm, and Docker to make and serve the demo (or a Nuxt app that
is built and served already).

**1. An app.** Any Nuxt app works (step 5 points the suite at it). To start, make the demo with this repository's
script: it runs Nuxt's create tool (`nuxi init --template minimal`), puts the pages of `demo/` over the starter, and
builds it, in a Node.js container; then serve it with its own server:

```bash
git clone https://github.com/webship/vue-steps.git
cd vue-steps
npm run demo:build
npm run demo:serve
```

The demo answers at `http://127.0.0.1:3000`: a home page with a counter, an about page, posts loaded from the server,
a contact form, and a page drawn in the browser only. Leave the server running in its own terminal. It has no
accounts: the steps need none.

**2. A test project**, in another folder:

```bash
mkdir vue-tests && cd vue-tests
npm init -y
npm install --save-dev webship-js @webship-js/vue-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the
`npm test` scripts, and installs Chromium.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack, the
tags that keep the lanes of this repository out of a normal run, and the address of the app.

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/vue-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    // Work in progress, the assertions that must fail and the scenarios of a browser without JavaScript stay out.
    tags: 'not @wip and not @must-fail and not @no-javascript',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://127.0.0.1:3000',
      // Browser errors are reported, not failed: a form turned down shows one ("Failed to load resource: 422").
      javascript: { mode: 'warn', levels: ['error'] },
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
    },
  },
};
```

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A link changes the view in place, and the new view is announced
    Given I am on "/"
    When I use the "Posts" link
    Then the view should have changed in place
    And the new view should be announced as "Posts"

  Scenario: A message too short is turned down
    Given I am on "/contact"
    When I fill in "Your name" with "Ada"
    And I fill in "Your message" with "Too short"
    And I send the form with the "Send" button
    Then the form should have been turned down with "Your message needs at least 10 characters."
```

**5. Run it.** Set `LAUNCH_URL` to the address of the app:

```bash
LAUNCH_URL=http://127.0.0.1:3000 npm test
```

A green first run prints every step, the browser error of the refused message (reported, not failed:
`mode: 'warn'`), then the summary (the starter feature of `npx init-webship-js` and the two scenarios above, passed)
and the HTML report it wrote:

```
[webship-js] JavaScript errors during "A message too short is turned down" (mode=warn):
  1. [console.error] Failed to load resource: the server responded with a status of 422 (Unprocessable Entity)

3 scenarios (3 passed)
11 steps (11 passed)
0m03.272s (executing steps: 0m03.238s)
[webship-js] HTML report → …/vue-tests/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they also ship in the package, under
`node_modules/@webship-js/vue-steps/tests/features/`): together they use every step of the pack, against the demo.

### On an app of your own

Point `LAUNCH_URL` at the address the app is served at, and write the features from what its pages show: links and
buttons by the names a person reads, forms by their buttons, views by their titles and addresses.

- **A browser without JavaScript:** set `javaScriptEnabled: false` in `contextOptions` of `playwright.config.ts`
  (this repository does it from `JAVASCRIPT=off`) and run the scenarios that hold without it. The same steps wait
  for whole page loads there.
- **webship-js's own steps** (`I press "…"`, `I click "…"`) do not wait for the app. Tag a scenario
  `@still-after-steps`, and after each of its steps the pack waits for the page to be still, on a page with an app;
  or follow such a step with `When I wait for the page to be still`.
- **The route announcer** is Nuxt's `<NuxtRouteAnnouncer />`, which the starter's `app.vue` renders. An app without it
  has no announcer, and `the new view should be announced as "…"` says so.

### What the suite tests

The features of this repository run every step of the pack against the demo, in CI on every change, in a browser with
JavaScript and in one without:

- the app wiring the page up, a page drawn in the browser only, and a count that changes in place;
- views: a link that changes the view in place, the announcement of the new view's title, the link of the current
  view, the view's address, a view with data of its own and the browser's back, data loaded again, a link whose view
  the app redirects, and the new pages a browser without JavaScript loads;
- the contact form: a message taken, one turned down with its message, sent in place with JavaScript and leading to a
  new page without it;
- the error pages of a missing post and of an address the app does not know.

Not tested: layouts of the app's own, middleware other than a redirect, server components and islands, lazy
hydration, and the development server.

## Requirements

- Node.js 24 or later
- A webship-js 2.0 test project, webship-js 2.0.18 or later
- A Nuxt app, built and served (proven on Nuxt 4.7 with Vue 3.5 and Vue Router 5.5); or a Vue app mounted in the
  browser, for the steps that do not need Nuxt's own signals

## Install

```bash
npm install --save-dev @webship-js/vue-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`, after webship-js's own:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/vue-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the app:

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://app.example.com',
   },
   ```

3. Write a feature from what the app shows:

```gherkin
Feature: Signing in
  Scenario: A wrong password is turned down
    Given I am on "/login"
    When I fill in "Email" with "ada@example.com"
    And I fill in "Password" with "wrong"
    And I send the form with the "Log in" button
    Then the form should have been turned down with "Wrong email or password"
```

Run `npx cucumber-js --dry-run` once: it reports any undefined or ambiguous step before a browser opens.

## Test users

None. The demo has no sign-in, and the steps need no account (an app's own sign-in form is sent with the steps of the
pack, like any other form). `cucumber.js` lists no accounts and no scenario signs in:

```json
{}
```

## What is included

| File | Steps | Covers |
| --- | --- | --- |
| `vue-page.steps.js` | 4 | The app wiring the page up (waited for, or asserted), a page drawn in the browser only, and the wait for the page to be still; the opt-in `@still-after-steps`. |
| `vue-views.steps.js` | 7 | A link used and the browser's back, each to its end; how the last navigation ended (in place, or a new page); the announcement of the new view; the link of the current view; the view's address; the wait for a view's data. |
| `vue-forms.steps.js` | 4 | A form sent with a button, in either mode; whether it went through, or was turned down and why; how it was sent. |
| `vue-errors.steps.js` | 1 | An error page: its status, its first heading and its message. |
| `vue-helpers.js` | | Shared plumbing for the files above and for your own steps: the wait budgets, the poll on the page, the app wiring the page up, the page being still, following a navigation to its end, finding a link or a button by its name, the failure messages (which name the lane without JavaScript). It registers no step. |
| `vue-probe.js` | | The page side: put into every page before its own scripts, it keeps an id for each document, the frames the page asks for, its requests in flight, its inputs and changes, whether the server's HTML held the page, and, once the app has wired the page up, the navigations of its router. It registers no step. |
| `demo/` | | The pages of the demo app (MIT, this pack's own), put over Nuxt's starter by `.github/scripts/build-demo.sh`; the Webship Workspace's plugin builds the same demo from them. |

webship-js's own steps still go to an address (`Given I am on "/posts"`), read the page (`I should see "…"`), fill in
fields and press keys: this pack adds the app's own views, its forms and their waits.

## How the steps find things and wait

- **By the name a person reads.** A link or a button by its accessible name (its text, or its label), as Playwright
  computes it: exactly, then without regard to case, then by its start (three characters or more); never a part in
  the middle. A form's button among the buttons of the page's forms.
- **Wired up first.** Every step that acts waits for the app to wire the page up, when the page has an app and the
  browser runs JavaScript.
- **A navigation to its end, never by a request.** In place: the app's router started and ended its navigation
  (Nuxt's `page:loading:start` and `page:loading:end`), the announcer, when there is one, holds the new title, and
  the page is still. A whole page: a new document has loaded and, when it can be, been wired up.
- **A form in either mode.** After the click, whichever comes first: the request the app sends in place (its answer,
  then the page still), or a page load (through the server's redirects). A button the app handles in the page,
  sending nothing, ends when the page is still. A form went through when its answer is not a refusal and the page
  shows no alert; it was turned down when its answer is a 4xx or the page shows an alert (`role="alert"`).
- **Still:** no page load, no request in flight, no navigation of the app in progress, no frame asked for, no finite
  animation or transition running, the page wired up when it can be, and 40 ms of quiet with a frame after the last
  input (or 100 ms of nothing).
- **Then steps wait for what they expect,** up to the step's budget (`minWaitTime.page`, at least 10 seconds), looking
  every 50 milliseconds from Node.js.
- **Failures say what was found,** and a failure in a browser without JavaScript says so: `Expected the page to be
  wired up, but the browser has JavaScript off.`

### Notes on waits

What the app does that a test must wait past, found by recording it in a real browser:

- **Wired up in one frame.** Nuxt's flag turns false, the app's element gets its Vue app and the route announcer
  appears together, a few tens of milliseconds after the page has loaded. The announcer is not in the server's HTML.
- **The announcer follows the page's title, not the navigation.** Nuxt's announcer says `document.title` each time the
  page's head is rendered, on the first load too, and the title changes a few milliseconds after the router's
  `page:loading:end`. The steps read it once the navigation has ended, never as its end.
- **A view's data is fetched during the navigation**, before the new view is shown and announced. A view's code is
  fetched ahead for the links on the screen, so a click often sends no request at all.
- **The focus stays where it was.** After a change of view the focus stays on the link that was clicked, or goes to the
  page when that link is gone: the app does not move it.
- **An error page has no announcer.** Nuxt's error page is drawn without the app's own layout (`app.vue`), so the
  announcer is not there.
- **A redirect is one navigation of several addresses.** When a route middleware sends an address on to another, the
  router runs its guards again for the new one, and Nuxt calls `page:loading:start` for each address but
  `page:loading:end` once, when the last has loaded. The steps count the addresses the router marks as redirected
  (`redirectedFrom`) as part of the navigation they belong to, and with Vue Router alone they count them once.

### Findings

Found while writing the steps; not reported upstream yet (the owner decides).

- **A stale announcement on an error page reached inside the app.** A missing post reached inside the app (a
  navigation whose view throws a 404) shows Nuxt's error page in the same document, while the route announcer still
  says the title of an earlier view ("Home"), not the error's. Loaded directly, the error page has no announcer at all.

## Steps

One example of each step; the JSDoc block above each definition holds five.

### `vue-page.steps.js` (4)

- `Given the page is wired up`
- `Then the page should be wired up`
- `Then the page should have been drawn in the browser only`
- `When I wait for the page to be still`

### `vue-views.steps.js` (7)

- `When I use the "Posts" link`
- `When I return to the previous view`
- `Then the view should have changed in place`
- `Then the new view should be announced as "Posts"`
- `Then the "Posts" link should be marked current`
- `Then the view's address should be "/posts"`
- `When I wait for the view's data to arrive`

### `vue-forms.steps.js` (4)

- `When I send the form with the "Send" button`
- `Then the form should have gone through`
- `Then the form should have been turned down with "Your message needs at least 10 characters."`
- `Then the form should have been sent in place`

### `vue-errors.steps.js` (1)

- `Then the view should be the 404 error page`

## Phrases shared with other packs

None of this pack's phrases matches one of webship-js (`npm run test:examples` checks it), nor one of the 57 step packs
published so far, and none of their examples matches one of this pack's steps. The Svelte and Next.js packs speak of
the same things in words of their own ("taken over the page", "follow the … link in the app", "without a full page
reload"), so the pack loads beside any of them.

## Nuxt's own tests and this pack

Nuxt's own suite (`test/basic.test.ts` and `test/e2e`, MIT) builds its test apps and drives them with Playwright,
waiting for a page with `useNuxtApp()._route` and `isHydrating`, as this pack does. Its groups, and the features that
cover the same ground on a real app:

| Nuxt's own suite | In this pack |
| --- | --- |
| `pages`: rendering a route, and moving between routes | `views.feature`: a link that changes the view in place, the view's address, the browser's back |
| `nuxt links`: `aria-current`, the active classes, prefetching | `views.feature`: the link of the current view; the steps never count on a prefetch request |
| `errors`: the error page, `createError`, a status mapped to the response | `errors.feature`: a missing post and an unknown address, their status and message |
| `composables`: `useFetch`, refreshing data | `views.feature`: a view with data of its own, and data loaded again |
| route rules: `ssr: false` | `page.feature`: a page drawn in the browser only |

Not in this pack: middleware and layouts, islands and server components, lazy hydration, and the development server.

## Testing this package

```bash
npm install
npm run demo:build         # the demo: Nuxt's starter and the pages of demo/, made and built in a Node.js container, in demo-app/
npm run demo:serve &       # served at http://127.0.0.1:3000
npm run test:examples      # the examples and the features against the step patterns
npm run test:paths         # a feature or a scenario named on the command line runs alone
npx cucumber-js --dry-run  # no undefined and no ambiguous step
LAUNCH_URL=http://127.0.0.1:3000 npm test                 # the suite, with JavaScript
LAUNCH_URL=http://127.0.0.1:3000 npm run test:must-fail   # assertions that must fail, each with its message
```

The lane without JavaScript:

```bash
JAVASCRIPT=off CUCUMBER_TAGS='not @wip and not @must-fail and not @needs-javascript' LAUNCH_URL=http://127.0.0.1:3000 npm test
JAVASCRIPT=off MUST_FAIL_TAGS='@must-fail and not @needs-javascript' LAUNCH_URL=http://127.0.0.1:3000 npm run test:must-fail
```

The tags: `@needs-javascript` runs only with JavaScript, `@no-javascript` only without (not `@javascript`, which
webship-js reads as "fail the scenario on any browser error"). In CI each lane names its reports
(`cucumber_report-javascript-off.json`, `must-fail-javascript-off.json`), so a failure of one is never read as the
other's.

`tests/must-fail/` holds scenarios that assert something that is not true of the demo. `npm run test:must-fail` runs
them and checks that each one fails at its last step, with the message it announces and a hint: a step that cannot
fail proves nothing. It runs them with a wait of 3 seconds (`COMPONENT_WAIT_MS`), since each of them waits its whole
budget.

`LAUNCH_URL` points the suite at another address; `npx cucumber-js tests/features/forms.feature` runs one feature;
`FEATURES` runs a subset too; `CUCUMBER_TAGS=@critical` runs the smoke lane; `HEADLESS=false` shows the browser.

The suite leaves the demo as it found it: the demo keeps nothing (the contact form only answers).

## The demo

The demo is made, not kept as a whole in this repository. [`.github/scripts/build-demo.sh`](.github/scripts/build-demo.sh)
runs Nuxt's create tool, `nuxi init --template minimal` (nuxi 4.1.0), puts the pages of [`demo/`](demo/) over the
starter, and runs `npm install` and `npm run build`, in a Node.js 24 container pinned by its digest, into `demo-app/`;
[`.github/scripts/serve-demo.sh`](.github/scripts/serve-demo.sh) serves the build with its own server
(`node .output/server/index.mjs`).

- The starter is Nuxt's own, released under the MIT licence by the Nuxt team (https://github.com/nuxt/starter): it is
  made at each build, and nothing of it is in this repository.
- The pages of `demo/` are this pack's own (MIT): a home page with a counter, an about page, posts from a server route
  (`useFetch`, `refresh()`, `createError` for a missing post, and a route middleware that sends `/posts/latest` on to
  the latest post), a contact form that works without JavaScript and is sent in place with it, and a page drawn in
  the browser only.
- Nuxt's own suite and its examples (MIT) were read, to learn what the framework does that a test must wait for;
  nothing of them is in this repository.

## How the steps were written

Everything a step relies on was seen in a real browser first, on the built demo: when the app wires a page up and what
it renders then, what a change of view and a whole page load each change, the order of the router's hooks, the
requests of a view and of a form with JavaScript and without, the announcer's text and when it changes, where the
keyboard focus goes. The steps were written from that, and are proven on Nuxt 4.7 with Vue 3.5 and Vue Router 5.5, in
English, with Chromium, with JavaScript and without.

## License

MIT (see `LICENSE`).

## Logo

The Vue logo is the Vue team's, designed by Evan You, from github.com/vuejs/art, under CC BY-NC-SA 4.0
(https://creativecommons.org/licenses/by-nc-sa/4.0/). It is not covered by this package's MIT licence.
