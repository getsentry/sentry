# @sentry/icons

Sentry's icon set as a single SVG spritesheet with a typed React binding.

```tsx
import {Icon} from '@sentry/icons';

<Icon name="add" />
<Icon name="chevron" direction="down" size={24} />
```

## How it works

- `src/*.svg` is the source of truth: raw exports from Figma, kebab-case
  file names. Icon variants are separate files (`bookmark.svg`,
  `bookmark-solid.svg`); directional rotation is not baked into files —
  use the `direction` prop.
- `pnpm --filter @sentry/icons build` runs every source through
  [svgo](https://svgo.dev) (`svgo.config.mjs`) and regenerates the two
  committed artifacts:
  - `src/sprite.generated.svg` — one `<symbol>` per icon, id = file name.
  - `src/names.generated.ts` — the `IconName` union and per-icon viewBoxes.
- `<Icon name>` renders `<svg><use href={spriteUrl#name}/></svg>`. The
  sprite resolves through `new URL(..., import.meta.url)`, which Vite and
  Rspack both emit as a hashed static asset. The sprite must be served
  same-origin (`<use>` cannot load cross-origin documents).

## Adding or updating an icon

1. Export the icon from Figma as SVG into `src/<name>.svg`.
2. Run `pnpm --filter @sentry/icons build` and commit the sources along
   with the regenerated artifacts.

## Notes

- The package is framework-config free on purpose: no emotion, no theme,
  no Sentry app imports. Sentry-specific sizing tokens and color variants
  live in the app-side wrapper.
- Icons inherit `currentColor`; multicolor icons (brand logos) keep their
  explicit fills.

<!-- ponytail: ships TS source only; add a dist build + publishing setup when a consumer outside this repo exists -->
