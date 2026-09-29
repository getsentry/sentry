# Scraps package

## Add an export

The `exports` field in [package.json](./package.json) is the publish manifest.
Each entry points to built JavaScript and declarations. Add an entry only when
its runtime and type dependencies belong to the package or are declared as
dependencies.

The package owns its source in [src](./src). The build and verification scripts
live in [scripts](./scripts). The package's `files` list includes `dist`, while npm
also includes package metadata, this README, and the license. Verification
checks that the scripts are absent from the tarball.

The [Sentry MDX stories](../../static/app/components/core) document the broader
in-app design system. Their `@sentry/scraps` imports do not imply that the same
subpaths are in this package. For example, the hotkey story uses `Hotkey` and
`Kbd`, but the package exports only `Kbd`. Check `exports` before adding a
story's import to a package consumer.

The [Scraps contribution guide](../../static/app/components/core/overview/contributing.mdx)
identifies Figma as the source of truth for design tokens. The generated theme
and token files live in this package; change tokens through that source process.

## Use package sources in Sentry

TypeScript, Rspack, Jest, and Figma resolve `@sentry/scraps/*` from `src` first,
then fall back to `static/app/components/core/*` for unmigrated modules. The
app keeps the exact `@sentry/scraps/text` alias on the core barrel while it still
exports `Prose`. The core `code` and `hotkey` barrels also remain in the app.
These barrels re-export migrated implementations from the package.

Move components and their tests into `src` as they become isolated. Stories
remain in the app. Once all components are migrated, remove the core fallback
and use a workspace dependency.

## Test the package

Run the isolated component suite and its typecheck from the repository root:

```sh
pnpm --dir packages/scraps test
pnpm --dir packages/scraps typecheck
```

Tests import `render` and `renderHook` from `test/env`; both include the default
light-theme provider. Jest setup and the copied `getEmotionRules` helper also
live under `test/env`. No Sentry providers or test aliases are used.

## Verify the package

From the repository root, run:

```sh
pnpm --dir packages/scraps verify
```

The command builds and packs the package, typechecks each public subpath in a
consumer without Sentry aliases or globals, imports every subpath, and server
renders representative components in both themes.

Consumers provide Emotion's `ThemeProvider` with `lightTheme` or `darkTheme`.
The package does not include application providers, global CSS, or fonts. Only
the subpaths in `exports` are supported.

## Prepare a release

Add a nonempty `## <version>` section to [CHANGELOG.md](./CHANGELOG.md), then
run the `Prepare Scraps release` GitHub workflow with that version. The initial
entry is `0.1.0`. Craft's `simple` policy rejects a release without a matching
entry.

Craft creates a `scraps-releases/<version>` branch and opens a request in
`getsentry/publish`. The package workflow verifies that branch and uploads its
npm tarball. A release manager must approve the request before Craft publishes.
The Sentry Docker release uses the root `.craft.yml`.
