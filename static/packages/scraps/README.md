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

Components and plain formatters share the same presentation options:

```tsx
import {DateTime, formatDateTime} from '@sentry/scraps/dateTime';
import {getDuration} from '@sentry/scraps/duration';

const date = '2025-01-01T12:00:00Z';
formatDateTime(date, {timezone: 'America/New_York', mode: 'time'});
<DateTime date={date} mode="time" precision="second" />;
getDuration(65, {precision: 1, style: 'short'}); // "1.1min"
getDuration(55, {minimumUnit: 'minute'}); // "1 minute"
```

Dates accept a `Date`, epoch milliseconds, or an ISO timestamp with an explicit
`Z` or UTC offset. Offset-free strings, calendar-only dates, invalid dates, and
unknown timezone identifiers return `Invalid date`.

Use `mode` to choose `dateTime`, `date`, or `time`. Time precision is
`minute`, `second`, or `millisecond`; year display is `auto`, `always`, or
`never`. Set `timezone: 'UTC'` for UTC output and `clock` to `'12'` or
`'24'`. UTC output includes its timezone label by default; `showTimezone`
controls the label explicitly. Formatting-engine types and patterns are private.

Parsing and timezone conversion use a private Temporal ponyfill, without changing
browser globals. Rendering preserves Intl's locale-specific date order, literal
characters, and time punctuation while honoring the configured clock. French
output includes `1 janv. 2025` and `1:05:06,123 PM`; Japanese output includes
`2025年1月1日` and `午後1:05`. These locale conventions replace Moment's fixed
month-first layout. UTC
is labeled `UTC`; other timezone labels follow Intl for the configured locale.
For example, English labels include `GMT+11` for Sydney in January and
`GMT+5:45` for Kathmandu. These may differ from Moment's abbreviations.

Without configuration, dates use UTC and a 12-hour clock. Applications call
`configureFormatting` before rendering with one source. Its `getSnapshot`
returns the same object until preferences change, and `subscribe` notifies
consumers after a new snapshot is ready. Each snapshot contains `timezone`,
`clock`, `locale`, and matching `messages` with `t`, `tn`, and `pgettext`.
The source feeds a Zustand store shared by plain formatters and React consumers.
Plain formatters read its current snapshot; React consumers subscribe to changes.
The cleanup returned by `configureFormatting` disconnects the source and restores
the previous snapshot.

`DateTimeProvider` accepts partial timezone and clock overrides and inherits
unspecified values from its parent. Explicit component or function options win
over defaults. Use `useDateTimeFormatter()` to bind a formatter to the nearest
provider for callbacks and copied text. A free `formatDateTime` call reads
application preferences, without a React subtree's overrides.

`getDuration` accepts seconds and uses the same configured messages. Its
`minimumUnit` is a unit name such as `'millisecond'` or `'minute'`, and its
`style` is `'long'`, `'short'`, or `'narrow'`. The default style is long,
the minimum is one millisecond, and `precision` controls decimal places.
Month and year conversions remain approximate elapsed durations.

## Prepare a release

Run the `Release` GitHub workflow and select the `static/packages/scraps` workspace.
Leave the version blank to use the workspace's automatic versioning policy.
Craft uses conventional commits to choose the next version and update
[CHANGELOG.md](./CHANGELOG.md). To override the version, enter an exact version
or `major`, `minor`, `patch`, or `auto`.
