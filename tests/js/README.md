# Application test support

This directory is the private `@sentry-internal/sentry-test` workspace package.
It owns Sentry test helpers, fixtures, Jest configuration, environments, mocks,
the runner, and their dependencies. Billing support is a separate workspace in
`getsentry-test`.

The root owns shared test tooling. It declares the workspace aliases
`sentry-test`, `sentry-fixture`, and `getsentry-test`, so existing imports remain
unchanged. The Sentry helpers and fixtures are exports of the same package.
Add an export in `package.json` when adding a helper or fixture.

The test packages depend on the apps they exercise. The apps do not depend on
these test packages. The Jest resolver loads test-support imports in app specs
from the root's dependencies, and other imports from their owning workspace.
Icons and Scraps keep independent test configurations and dependencies.

Application specs stay alongside their source. Each app has a scoped `test`
script and config that use the root's `sentry-test` binary, which pnpm makes available to
workspace scripts. Test support and lint packages also have scoped test scripts;
Icons and Scraps use their own Jest configurations.

The root `test` command invokes these scripts through pnpm. The root `test-ci`
command keeps one Jest process for application, test-support, and lint suites so
CI discovery and sharding remain unchanged. It runs Icons and Scraps separately.
Coverage and sharding still use paths relative to the repository root.
`createJestConfig.ts` owns the shared setup and config factory. Each package's
`jest.config` calls this factory with its test directory. This package's
`jest.config.mjs` selects only `tests/js` suites.
The CLI defaults to `tests/js/jest.config.ci.mjs` for the full CI test run;
`--config` selects another config.
The snapshot command selects `tests/js/jest.config.snapshots.ts`.

Scripts can call the runner without letting Jest exit the calling process:

```js
import {run} from 'sentry-test/runner';

process.exitCode = await run(['--ci', '--runInBand']);
```

Run a single app's tests with `pnpm --filter @sentry-internal/app test`, or use
`@sentry-internal/gs-app` and `@sentry-internal/gs-admin` for billing and admin.

Snapshot browser setup uses the package's Playwright dependency:

```sh
pnpm --filter @sentry-internal/sentry-test exec playwright install chromium
```
