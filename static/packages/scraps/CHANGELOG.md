# Changelog

## 0.4.0

### New Features ✨

#### Components

- Add split panel by @natemoo-re in [#128834](https://github.com/getsentry/sentry/pull/128834)
- Add menu by @natemoo-re in [#128833](https://github.com/getsentry/sentry/pull/128833)
- Add spinner by @natemoo-re in [#128817](https://github.com/getsentry/sentry/pull/128817)

#### Other

- (scraps) Add `ToggleCard` component by @natemoo-re in [#128676](https://github.com/getsentry/sentry/pull/128676)

### Internal Changes 🔧

- (scraps) Extract toast provider and API by @TkDodo in [#129033](https://github.com/getsentry/sentry/pull/129033)

## 0.3.0

### Bug Fixes 🐛

- (button-bar) Stop clamping dropdown menus in table headers by @sentry-junior in [#128430](https://github.com/getsentry/sentry/pull/128430)
- (menu) Stop clipping tag and pill labels in menu items by @sentry-junior in [#128425](https://github.com/getsentry/sentry/pull/128425)
- (overlay) Ignore overflow ancestors inside the real containing block by @sentry-junior in [#128429](https://github.com/getsentry/sentry/pull/128429)

### Internal Changes 🔧

#### Scraps

- Isolate input and textarea controls by @natemoo-re in [#128649](https://github.com/getsentry/sentry/pull/128649)
- Isolate table and resize controls by @natemoo-re in [#128651](https://github.com/getsentry/sentry/pull/128651)
- Isolate form presentation components by @natemoo-re in [#128650](https://github.com/getsentry/sentry/pull/128650)

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
