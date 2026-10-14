# Scraps

Scraps is the implementation of Sentry's design system. It contains the components, themes, and design tokens used to build Sentry's product interface.

The source code is open, but the system is designed for Sentry and is not intended for use in other products. This package is not a general-purpose design system.

## Development in Sentry

The package source lives in [src](./src). Component stories remain in the app.

Move components and their tests into `src` as they become isolated. The [Scraps contribution guide](../../app/components/core/overview/contributing.mdx) covers component contributions and the Figma process for changing design tokens.

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
Only the root, theme, tokens, and component barrels are public. Individual
module paths remain private. Shared variant unions are available through type-only
imports from `@sentry/scraps/variants`; existing variant imports from
`@sentry/scraps/theme` remain valid.
Add an entry only when its runtime and type dependencies belong to the package
or are declared dependencies. App stories cover more components than this API;
for example, the hotkey story uses both `Hotkey` and `Kbd`, but only `Kbd` is
isolated. Published consumers have no fallback to app components.

## Verify the package

```sh
pnpm --dir static/packages/scraps verify
```

Verification deletes `dist` before packing to exercise `prepack`, checks the
tarball contents and dependencies, typechecks and imports each public export,
and server renders representative components in both themes.
The verifier compiles a temporary copy of the source-only icons workspace for
the test consumer. It does not change or publish the icons package.

Consumers provide Emotion's `ThemeProvider` with `lightTheme` or `darkTheme`.
The package does not include application providers, global CSS, or fonts.

`Link` renders native anchors by default and supports string destinations or
objects with `pathname`, `search`, `query`, and `hash`. A `query` object overrides
`search`. Supply `LinkBehaviorContextProvider` to use a client router. Sentry's
`SentryLinkBehaviorProvider` supplies routing, URL normalization, and preloading.
Router options such as `replace`, `state`, and `preventScrollReset` are passed to
the supplied component; native anchors use browser navigation.

## Prepare a release

Run the `Release` GitHub workflow and select the `static/packages/scraps` workspace.
Leave the version blank to use the workspace's automatic versioning policy.
Craft uses conventional commits to choose the next version and update
[CHANGELOG.md](./CHANGELOG.md). To override the version, enter an exact version
or `major`, `minor`, `patch`, or `auto`.
