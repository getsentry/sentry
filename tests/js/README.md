# Application test support

This directory is the private `@sentry-internal/sentry-test` workspace package.
It owns Sentry test helpers, fixtures, Jest configuration, environments, mocks,
the runner, and their dependencies. Billing support is a separate workspace in
`getsentry-test`.

The root owns application test execution. It declares the workspace aliases
`sentry-test`, `sentry-fixture`, and `getsentry-test`, so existing imports remain
unchanged. The Sentry helpers and fixtures are exports of the same package.
Add an export in `package.json` when adding a helper or fixture.

The test packages depend on the apps they exercise. The apps do not depend on
these test packages. The Jest resolver loads test-support imports in app specs
from the root's dependencies, and other imports from their owning workspace.
Icons and Scraps keep independent test configurations and dependencies.

Application specs stay alongside their source. The root `test`, `test-ci`, and
`snapshots` commands use the package's `sentry-test` CLI. CI test discovery,
coverage, and sharding still use paths relative to the repository root.
The CLI defaults to `tests/js/jest.config.ts`; `--config` selects another config.
The snapshot command selects `tests/js/jest.config.snapshots.ts`.

Scripts can call the runner without letting Jest exit the calling process:

```js
import {run} from 'sentry-test/runner';

process.exitCode = await run(['--ci', '--runInBand']);
```

The root is a consumer in the workspace graph. `includeWorkspaceRoot: true`
allows affected selection to reach its test command when an app or test-support
package changes. The root also declares the admin app for this purpose.

Snapshot browser setup uses the package's Playwright dependency:

```sh
pnpm --filter @sentry-internal/sentry-test exec playwright install chromium
```
