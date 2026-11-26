#!/usr/bin/env node
'use strict';

// Runs the scenarios of tests/must-fail/ and checks that every one of them
// FAILS, at its last step, with the message its description announces
// ("Fails with: ..."), and that the message carries a hint.
//
// A step that cannot fail proves nothing. Each scenario here asserts something
// that is not true on the demo site; the steps before the last one must pass.
// The scenarios leave the site as they found it (it is static: every change
// lives in the browser of the scenario). They carry the tag @must-fail, which
// the default run of cucumber.js leaves out. MUST_FAIL_TAGS narrows the run:
// MUST_FAIL_TAGS="@must-fail and not @wip" leaves out a scenario being written.
//
// Usage: node tests/check-must-fail.js   (the site of cucumber.js must be up)

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
// The lane in the report's name (JAVASCRIPT=off runs the browser without JavaScript), so the report of
// one lane is never read as the other's.
const reportName = process.env.JAVASCRIPT === 'off' ? 'must-fail-javascript-off' : 'must-fail';
const report = path.join(root, 'tests', 'reports', `${reportName}.json`);
const features = fs.readdirSync(path.join(root, 'tests', 'must-fail')).filter((file) => file.endsWith('.feature')).map((file) => `tests/must-fail/${file}`);

fs.rmSync(report, { force: true });
spawnSync('npx', ['cucumber-js', '--config', 'cucumber.js'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, FEATURES: features.join(','), CUCUMBER_TAGS: process.env.MUST_FAIL_TAGS || '@must-fail', REPORT_NAME: reportName, COMPONENT_WAIT_MS: process.env.COMPONENT_WAIT_MS || '3000', WEBSHIP_REPORT_DISABLE: '1', WEBSHIP_SCREENSHOT_ON_FAILED: 'false' },
});

if (!fs.existsSync(report)) {
  console.error('The must-fail run wrote no report: cucumber-js did not start.');
  process.exit(1);
}

const strip = (text) => String(text || '').replace(/\u001b\[[0-9;]*m/g, '');
const problems = [];
let count = 0;
for (const feature of JSON.parse(fs.readFileSync(report, 'utf8'))) {
  for (const scenario of feature.elements || []) {
    count += 1;
    const where = `${feature.uri}:${scenario.line} "${scenario.name}"`;
    const wanted = (strip(scenario.description).match(/Fails with:\s*(.+)/) || [])[1];
    const steps = (scenario.steps || []).filter((step) => !step.hidden);
    const last = steps[steps.length - 1];
    const earlier = steps.slice(0, -1).filter((step) => step.result.status !== 'passed');
    if (!wanted) { problems.push(`${where}: no "Fails with:" line in its description.`); continue; }
    if (earlier.length) { problems.push(`${where}: an earlier step did not pass (${earlier[0].keyword}${earlier[0].name}: ${earlier[0].result.status}) ${strip(earlier[0].result.error_message).split('\n')[0]}`); continue; }
    if (!last || last.result.status !== 'failed') { problems.push(`${where}: its last step ${last ? last.result.status : 'is missing'}; it must fail.`); continue; }
    const message = strip(last.result.error_message);
    if (!message.includes(wanted.trim())) { problems.push(`${where}: failed, but not with "${wanted.trim()}":\n      ${message.split('\n').slice(0, 3).join('\n      ')}`); continue; }
    if (!/Hint:/.test(message)) { problems.push(`${where}: the failure carries no hint:\n      ${message.split('\n')[0]}`); continue; }
    console.log(`  fails as it must: ${scenario.name}\n      ${message.split('\n')[0].trim()}`);
  }
}

if (!count) problems.push('No must-fail scenario ran.');
if (problems.length) {
  console.error(`\n${problems.length} problem(s) in ${count} must-fail scenario(s):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`\n${count} must-fail scenarios${process.env.JAVASCRIPT === 'off' ? ' (JavaScript off)' : ''}, each failed at its last step with the announced message and a hint.`);
