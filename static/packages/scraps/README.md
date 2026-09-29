# Scraps

Scraps is the implementation of FSL, Sentry's design system. It contains the
components, themes, and design tokens used to build Sentry's product interface.

The source code is open, but FSL is designed for Sentry and is not intended for
use in other products. This package is not a general-purpose design system.

## Development in Sentry

The package source lives in [src](./src). Component stories remain in the app.

Move components and their tests into `src` as they become isolated. The
[Scraps contribution guide](../../app/components/core/overview/contributing.mdx)
covers component contributions and the Figma process for changing design tokens.

Run package checks from the repository root:

```sh
pnpm --dir static/packages/scraps test
pnpm --dir static/packages/scraps typecheck
```

To check package imports through the Sentry app's aliases, run the app
integration test:

```sh
pnpm test-ci static/app/components/core/scraps.spec.tsx
```
