# Icons

This private workspace package contains SVG icons and their shared defaults.
It exports TypeScript source and has no JavaScript build step. Consumers must process
TypeScript and JSX.

```tsx
import {IconAdd} from '@sentry/icons/iconAdd';
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
reference. Runtime imports still use the source exports; no JavaScript is built.
Run `pnpm run typecheck` to check the full project in dependency order.
