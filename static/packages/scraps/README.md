# Scraps

Scraps is the implementation of Sentry's design system. It contains the components, themes, and design tokens used to build Sentry's product interface.

The source code is open, but the system is designed for Sentry and is not intended for use in other products. This package is not a general-purpose design system.

## Development in Sentry

The package source lives in [src](./src). Component docs (`.mdx`) sit next to their components and render in the app's Scraps viewer; `.npmignore` and the build config keep them out of the published package.

Move components, their tests, and their docs into `src` as they become isolated. The [Scraps contribution guide](../../app/components/core/overview/contributing.mdx) covers component contributions and the Figma process for changing design tokens.

Run package checks from the repository root:

```sh
pnpm --dir static/packages/scraps test
pnpm --dir static/packages/scraps typecheck
```

Typechecking checks source and tests together and emits declarations into the
ignored `.types` directory. The app uses these declarations through a TypeScript
project reference. Run `pnpm run typecheck` to check the full project in
dependency order. The release build continues to use `dist`.

To check package imports through the Sentry app's aliases, run the app integration test:

```sh
pnpm test-ci static/app/components/core/scraps.spec.tsx
```

## Build and pack

```sh
pnpm --dir static/packages/scraps pack --pack-destination .artifacts
```

The `prepack` hook builds JavaScript and declarations with
[Rslib](./rslib.config.mjs), including from a clean checkout. Only `dist`, the
package manifest, README, and license ship.

The `exports` field in [package.json](./package.json) defines the published API.
Import from its explicit subpaths, including `@sentry/scraps/code/inlineCode`
and `@sentry/scraps/hotkey/kbd`. The package has no root export; unlisted module
paths remain private.
Add an entry only when its runtime and type dependencies belong to the package
or are declared dependencies. Both `Hotkey` and `Kbd` are isolated and exported
from `@sentry/scraps/hotkey`; `Kbd` also has its own `@sentry/scraps/hotkey/kbd`
entry point. App stories cover more components than this API. Published consumers
have no fallback to app components.

Consumers provide Emotion's `ThemeProvider` with `lightTheme` or `darkTheme`.
The package does not include application providers, global CSS, or fonts.

## Date and duration formatting

Import date presentation, preferences, and formatting from one entry:

```tsx
import {DateTime, formatDateTime} from '@sentry/scraps/dateTime';
import {getDuration} from '@sentry/scraps/duration';

formatDateTime(date, {timezone: 'America/New_York', timeOnly: true});
getDuration(65, {precision: 1, style: 'short'}); // "1.1min"
<DateTime date={date} timeOnly />;
```

Without configuration, dates use UTC and a 12-hour clock. Applications can call
`configureDateTime` before rendering with timezone and clock getters and an
optional change subscription. Plain formatters read those getters on each call;
React consumers subscribe to the same source. `DateTimeProvider` overrides
preferences for a React subtree; pass explicit options to plain formatters when
formatting for that subtree.

`configureTranslation` from `@sentry/scraps/translation` registers `t`, `tn`,
and `pgettext` once for formatter localization. Translations resolve at call
time, so changing the active locale does not leave cached duration labels.

## Prepare a release

Run the `Release` GitHub workflow and select the `static/packages/scraps` workspace.
Leave the version blank to use the workspace's automatic versioning policy.
Craft uses conventional commits to choose the next version and update
[CHANGELOG.md](./CHANGELOG.md). To override the version, enter an exact version
or `major`, `minor`, `patch`, or `auto`.
