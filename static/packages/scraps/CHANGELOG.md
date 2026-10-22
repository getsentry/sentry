# Changelog

## 0.2.0

#### Features

- Adds `theme.tokens.dataviz.sequential.magma.series5`, `series6`, and `series7` color scales for heatmaps in light and dark themes. ([#126947](https://github.com/getsentry/sentry/pull/126947))
- Updates `theme.tokens.syntax.ansi` colors to match Figma, including distinct cyan colors and revised light-mode yellows. ([#126948](https://github.com/getsentry/sentry/pull/126948))

#### Fixes

- Fixes `@sentry/scraps/theme` imports throwing `process is not defined` in apps built with Vite or webpack 5. ([#127595](https://github.com/getsentry/sentry/pull/127595))

#### Improvements

- Adds `Button`, `LinkButton`, `ButtonBar`, `InfoTip`, `InfoText`, `Checkbox`, `Chip`, `Disclosure`, `SegmentedControl`, `Alert`, and generic badges to `@sentry/scraps`. ([#127639](https://github.com/getsentry/sentry/pull/127639))
- Adds `Tooltip` and shared overlay helpers to `@sentry/scraps`, with support for server rendering without a document. ([#127630](https://github.com/getsentry/sentry/pull/127630))
- Adds `Image`, `DescriptionList`, `Prose`, `Radio`, `StatusIndicator`, and `Hotkey` to `@sentry/scraps`. ([#127628](https://github.com/getsentry/sentry/pull/127628))
- Adds `Link` and `ExternalLink` to `@sentry/scraps`, rendering native links without a router and supporting custom routing through `LinkBehaviorContext`. ([#127423](https://github.com/getsentry/sentry/pull/127423))
- Improves TypeScript declarations so consumers no longer need a global `React` namespace. ([#127532](https://github.com/getsentry/sentry/pull/127532))
- Adds `Backdrop`, `EmptyState`, `RevealOnHover`, `Slider`, `Slot`, `Switch`, and the theme, datetime, `renderToString`, and `useScrollLock` utilities to `@sentry/scraps`. ([#127513](https://github.com/getsentry/sentry/pull/127513))
- Removes the circular dependency between `Separator` and layout components while preserving their public APIs and rendering behavior. ([#127222](https://github.com/getsentry/sentry/pull/127222))

## 0.1.0

- Publish the first curated Scraps entries for themes, tokens, layout, typography, separators, quotes, loaders, inline code, and keyboard key labels.
