# Icons

This package contains Sentry's SVG icons and their shared defaults. It is
published to npm because `@sentry/scraps` depends on it.

```tsx
import {IconAdd} from '@sentry/icons/add';
import {IconDefaultsProvider} from '@sentry/icons/useIconDefaults';

<IconDefaultsProvider size="sm">
  <IconAdd aria-label="Add" />
</IconDefaultsProvider>;
```

Use explicit package subpaths. There is no root export. Icons without a variant
use `currentColor`. Variants require an Emotion theme with `tokens.content` keys
matching the icon variants; `muted` uses `secondary`. The `warning` variant uses
`tokens.graphics.warning.vibrant`.

This package must not import scraps, application code, or application assets.
React and Emotion are peer dependencies. Seer animation uses framer-motion.

Run `pnpm --filter @sentry/icons typecheck` and `pnpm --filter @sentry/icons test`
to check the package independently.

Typechecking emits declarations and declaration maps into the ignored `.types`
directory. The app consumes these declarations through a TypeScript project
reference. Inside this repository, runtime imports use the source files listed in
`exports`. Run `pnpm run typecheck` to check the full project in dependency order.

## Build and pack

```sh
pnpm --dir static/packages/icons pack --pack-destination .artifacts
```

The `prepack` hook builds JavaScript and declarations into `dist` with
[Rslib](./rslib.config.mjs). Only `dist`, the package manifest, README, and
license ship. When packed, `publishConfig.exports` replaces `exports`, so the
published package points at `dist`. When you add an icon, add its subpath to
both maps; a package test checks that they match.

## Prepare a release

Run the `Release` GitHub workflow and select the `static/packages/icons`
workspace. Leave the version blank to use the workspace's automatic versioning
policy. Craft uses conventional commits to choose the next version and update
[CHANGELOG.md](./CHANGELOG.md). To override the version, enter an exact version
or `major`, `minor`, `patch`, or `auto`.

The first release must use `0.1.0`, since published `@sentry/scraps` versions
already depend on `@sentry/icons@0.1.0`. Without a previous `icons@` tag,
automatic versioning would start from `0.0.0`.

Release `@sentry/icons` before a `@sentry/scraps` release that needs new icons.
Scraps pins the workspace version of icons when it is packed.
