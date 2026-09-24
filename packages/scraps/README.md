# Scraps package

## Add an export

The `exports` field in [package.json](./package.json) is the publish manifest.
Each entry points to built JavaScript and declarations. Add an entry only when
its runtime and type dependencies belong to the package or are declared as
dependencies.

[entries.json](./entries.json) lists the Sentry source files copied into the
temporary build directory. The local build, sync, and verification scripts live
in [scripts](./scripts). The package's `files` list includes `dist`, while npm
also includes package metadata, this README, and the license. Verification
checks that the scripts are absent from the tarball.

The [Sentry MDX stories](../../static/app/components/core) document the broader
in-app design system. Their `@sentry/scraps` imports do not imply that the same
subpaths are in this package. For example, the hotkey story uses `Hotkey` and
`Kbd`, but the package exports only `Kbd`. Check `exports` before adding a
story's import to a package consumer.

The [Scraps contribution guide](../../static/app/components/core/overview/contributing.mdx)
identifies Figma as the source of truth for design tokens. This package copies
the generated Sentry token files; change tokens through that source process.

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
