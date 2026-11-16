import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dependencyVersion,
  isRelease,
  pinSentryApi,
  planBump,
  readConfig,
} from './bump-sentry-api.js';

// The shape of getsentry/toolkit's pnpm-workspace.yaml.
const workspace = `packages:
  - "packages/*"

catalog:
  "@sentry/api": 2.6.0
  "@sentry/core": 10.0.0

minimumReleaseAgeExclude:
  - "@sentry/api@2.6.0"
  - "@sentry/core"
`;

test('pins the catalog and the release-age exclusion together', () => {
  const {current, workspace: pinned} = pinSentryApi(workspace, '9.8.7');
  assert.equal(current, '2.6.0');
  assert.match(pinned, /^ {2}"@sentry\/api": 9\.8\.7$/m);
  assert.match(pinned, /^ {2}- "@sentry\/api@9\.8\.7"$/m);
  assert.equal(pinned.split('9.8.7').length - 1, 2);
  // Nothing else changes.
  assert.equal(pinned.replaceAll('9.8.7', current), workspace);
});

test('fails when a catalog entry is missing or repeated', () => {
  const withoutExclusion = workspace.replace(/^ +- "@sentry\/api@.*\n/m, '');
  assert.throws(
    () => pinSentryApi(withoutExclusion, '9.8.7'),
    /minimumReleaseAgeExclude/
  );
  const repeated = workspace.replace(/^( +"@sentry\/api": .*\n)/m, '$1$1');
  assert.throws(() => pinSentryApi(repeated, '9.8.7'), /found 2/);
});

test('reads an exact dependency pin', () => {
  assert.equal(
    dependencyVersion(JSON.stringify({dependencies: {'@sentry/api': '2.7.0'}})),
    '2.7.0'
  );
  assert.equal(
    dependencyVersion(JSON.stringify({devDependencies: {'@sentry/api': '2.7.0'}})),
    '2.7.0'
  );
  assert.throws(
    () => dependencyVersion(JSON.stringify({dependencies: {'@sentry/api': '^2.7.0'}})),
    /exact/
  );
  assert.throws(() => dependencyVersion('{}'), /found none/);
});

test('accepts only stable releases', () => {
  assert.equal(isRelease('2.5.1'), true);
  assert.equal(isRelease('3.0.0-rc.0'), false);
  assert.equal(isRelease(''), false);
});

test('keeps one bump PR on the newest release', () => {
  const latest = '2.6.0';
  assert.equal(planBump({latest, main: '2.6.0'}), 'none');
  assert.equal(planBump({latest, main: '2.5.0'}), 'open');
  assert.equal(planBump({latest, main: '2.5.0', branch: '2.6.0'}), 'none');
  assert.equal(planBump({latest, main: '2.5.0', branch: '2.5.3'}), 'update');
  assert.equal(
    planBump({latest, main: '2.5.0', branch: '2.5.3', foreignCommits: 1}),
    'keep'
  );
});

test('accepts only known pins and modes', () => {
  assert.equal(
    readConfig({BUMP_PIN: 'catalog', BUMP_MODE: 'rolling-pr'}).mode,
    'rolling-pr'
  );
  assert.equal(readConfig({BUMP_PIN: 'dependency', BUMP_MODE: 'merge'}).mode, 'merge');
  assert.throws(() => readConfig({BUMP_PIN: 'lockfile', BUMP_MODE: 'merge'}), /BUMP_PIN/);
  assert.throws(() => readConfig({BUMP_PIN: 'toString', BUMP_MODE: 'merge'}), /BUMP_PIN/);
  assert.throws(() => readConfig({BUMP_PIN: 'catalog'}), /BUMP_MODE/);
});

test('commits as github-actions[bot] unless the caller names an author', () => {
  const config = {BUMP_PIN: 'dependency', BUMP_MODE: 'merge'};
  assert.equal(readConfig(config).author.name, 'github-actions[bot]');
  assert.deepEqual(
    readConfig({
      ...config,
      BUMP_AUTHOR_NAME: 'bot[bot]',
      BUMP_AUTHOR_EMAIL: '1+bot[bot]@example.com',
    }).author,
    {name: 'bot[bot]', email: '1+bot[bot]@example.com'}
  );
});
