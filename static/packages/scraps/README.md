# Scraps

Scraps owns the isolated design-system components, themes, tokens, and tests in
[src](./src). The remaining components and their MDX stories live in
[the app](../../app/components/core).

## Use package sources in Sentry

TypeScript, Rspack, Jest, and Figma resolve `@sentry/scraps/*` from `src` first,
then fall back to `static/app/components/core/*` for unmigrated modules. The
app keeps the exact `@sentry/scraps/text` alias on the core barrel while it still
exports `Prose`. The core `code` and `hotkey` barrels also remain in the app.
These barrels re-export migrated implementations from the package.

Move components and their tests into `src` as they become isolated. Stories
remain in the app. Once all components are migrated, remove the core fallback
and use a workspace dependency.

The [Scraps contribution guide](../../app/components/core/overview/contributing.mdx)
identifies Figma as the source of truth for design tokens. Change tokens through
that source process.

## Test the package

From the repository root:

```sh
pnpm --dir static/packages/scraps test
pnpm --dir static/packages/scraps typecheck
```

Tests import `render` and `renderHook` from `test/env`; both include the default
light-theme provider. Jest setup and the copied `getEmotionRules` helper also
live under `test/env`. No Sentry providers or test aliases are used.
