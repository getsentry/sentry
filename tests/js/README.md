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
Icons, Scraps, and Search Syntax keep independent test configurations and dependencies.

Application specs stay alongside their source. Each app has a scoped `test`
script and config that use the root's `sentry-test` binary, which pnpm makes available to
workspace scripts. Test support and lint packages also have scoped test scripts;
Icons, Scraps, and Search Syntax use their own Jest configurations.

The root `test-all` command invokes these scripts through pnpm with watch mode
disabled. The root `test-ci` command runs each workspace's test script in a
separate Jest process, with up to two workspaces in parallel. Both commands
exclude the root package, which owns the combined `test` watcher.

Standalone package tests run once after the app, lint, and test-support workspaces.
CI runs standalone package tests only on shard 0.

CI discovers one global test list for application, test-support, and lint suites.
Each workspace's config selects its own files from the same shard assignment.
Icons and Scraps use `runOnFirstShard` from `scripts/jestSingleShard.js` to run
their complete suites only on shard 0. Local and unsharded CI runs include both
packages. Balance reports are written separately per workspace under
`.artifacts/jest-balance/` and combined by CI. Coverage and sharding use paths
relative to the repository root.
`createJestConfig.ts` owns the shared setup and config factory. Each package's
`jest.config` calls this factory with its test directory. This package's
`jest.config.mjs` selects only `tests/js` suites.
The CLI defaults to `tests/js/jest.config.ci.mjs` for combined test discovery;
`--config` selects another config.
The snapshot command selects `tests/js/jest.config.snapshots.ts`.

Run a single app's tests once with
`pnpm --filter @sentry-internal/app test --watch=false`, or use
`@sentry-internal/gs-app` and `@sentry-internal/gs-admin` for billing and admin.
Omit `--watch=false` to keep the watcher running.

Snapshot browser setup uses the package's Playwright dependency:

```sh
pnpm --filter @sentry-internal/sentry-test exec playwright install chromium
```
