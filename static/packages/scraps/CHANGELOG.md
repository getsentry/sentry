# Changelog

## 0.5.0

### New Features ✨

#### Scraps

- Virtualize long DropdownMenu lists by @priscilawebdev in [#130390](https://github.com/getsentry/sentry/pull/130390)
- Add useVirtualCollection to window React Aria collections by @priscilawebdev with @sentry-junior in [#130388](https://github.com/getsentry/sentry/pull/130388)
- Let menu option details hold links by @JoshuaKGoldberg in [#128590](https://github.com/getsentry/sentry/pull/128590)

#### Settings

- Simplify the settings-v3 secondary navigation header by @priscilawebdev with @sentry-junior in [#130883](https://github.com/getsentry/sentry/pull/130883)
- Indent settings v3 navigation with a leading slot by @priscilawebdev in [#128511](https://github.com/getsentry/sentry/pull/128511)

### Bug Fixes 🐛

#### Drawer

- Handle non-Element targets in click-outside listener by @TkDodo with @sentry in [#130329](https://github.com/getsentry/sentry/pull/130329)
- Keep the Seer divider beneath open drawers by @priscilawebdev with @sentry-junior in [#129148](https://github.com/getsentry/sentry/pull/129148)

#### Scraps

- Revert the transparent button label selector change by @natemoo-re and @priscilawebdev with @sentry-junior in [#130945](https://github.com/getsentry/sentry/pull/130945)
- Opt search inputs out of password manager autofill by @trevor-e and @claude in [#130710](https://github.com/getsentry/sentry/pull/130710)
- Constrain DropdownMenu wrapper width by @evanpurkhiser in [#130798](https://github.com/getsentry/sentry/pull/130798)
- Respect CodeBlock wrapping on the code element by @evanpurkhiser in [#130488](https://github.com/getsentry/sentry/pull/130488)
- Use String coercion for density line-height tokens by @natemoo-re with @sentry in [#129849](https://github.com/getsentry/sentry/pull/129849)
- Read link colors from the current theme by @priscilawebdev in [#129161](https://github.com/getsentry/sentry/pull/129161)

#### Other

- (forms) Stack FieldGroup rows in narrow containers by @natemoo-re and @JPeer264 with @sentry-junior in [#130446](https://github.com/getsentry/sentry/pull/130446)
- (invite-members) Make the invite modal usable on mobile by @sentry-junior in [#130113](https://github.com/getsentry/sentry/pull/130113)
- (scope) Keep internal APIs private by @natemoo-re in [#129476](https://github.com/getsentry/sentry/pull/129476)
- (settings) Match org menu project stars to the project filter by @priscilawebdev and @claude with @sentry-junior in [#130192](https://github.com/getsentry/sentry/pull/130192)
- (tables) Keep a resized column's handle under the pointer by @JoshuaKGoldberg in [#128521](https://github.com/getsentry/sentry/pull/128521)
- (ui) Replace question mark icons with info icons by @TkDodo in [#130015](https://github.com/getsentry/sentry/pull/130015)

### Internal Changes 🔧

#### Hotkeys

- Upgrade TanStack Hotkeys and drop the zoom workaround by @KevinVandy and @TkDodo in [#129309](https://github.com/getsentry/sentry/pull/129309)
- Use TanStack Hotkeys and add devtools by @TkDodo in [#129176](https://github.com/getsentry/sentry/pull/129176)

#### Scraps

- Centralize pagination with navigation context by @natemoo-re in [#129534](https://github.com/getsentry/sentry/pull/129534)
- Split DropdownMenu list into smaller modules by @priscilawebdev in [#130594](https://github.com/getsentry/sentry/pull/130594)
- Remove CompactSelect virtualization metrics by @priscilawebdev in [#130588](https://github.com/getsentry/sentry/pull/130588)
- Make radio group items type-safe by @TkDodo in [#130231](https://github.com/getsentry/sentry/pull/130231)
- Extract Tabs into scraps by @TkDodo in [#130448](https://github.com/getsentry/sentry/pull/130448)
- Make checkbox group items type-safe by @TkDodo in [#130232](https://github.com/getsentry/sentry/pull/130232)
- Move the form system into the package by @natemoo-re with @sentry-junior in [#130251](https://github.com/getsentry/sentry/pull/130251)
- Move component docs next to their package components by @natemoo-re with @sentry-junior in [#130087](https://github.com/getsentry/sentry/pull/130087)
- Extract the complete modal by @TkDodo in [#129847](https://github.com/getsentry/sentry/pull/129847)
- Extract DropdownMenu with app link behavior by @natemoo-re in [#129521](https://github.com/getsentry/sentry/pull/129521)
- Extract PictureInPicture with app styling adapters by @natemoo-re in [#129589](https://github.com/getsentry/sentry/pull/129589)
- Extract CompactSelect and CompositeSelect by @natemoo-re in [#129596](https://github.com/getsentry/sentry/pull/129596)
- Extract clipboard button with app feedback by @natemoo-re and @priscilawebdev in [#129520](https://github.com/getsentry/sentry/pull/129520)
- Replace defined helpers with null checks by @natemoo-re in [#129685](https://github.com/getsentry/sentry/pull/129685)
- Give NumberInput and NumberDragInput their own entry by @billyvg, @claude and @TkDodo in [#127111](https://github.com/getsentry/sentry/pull/127111)
- Isolate CodeBlock and Prism in their own entry point by @natemoo-re in [#129522](https://github.com/getsentry/sentry/pull/129522)
- Extract legacy Select and virtual rows by @natemoo-re in [#129523](https://github.com/getsentry/sentry/pull/129523)
- Extract drawer and slide-over panel by @TkDodo in [#129163](https://github.com/getsentry/sentry/pull/129163)
- Move useMedia into package by @TkDodo in [#129294](https://github.com/getsentry/sentry/pull/129294)
- Move useOnClickOutside into scraps by @TkDodo in [#129170](https://github.com/getsentry/sentry/pull/129170)
- Replace unreachable helper with satisfies never by @TkDodo in [#129044](https://github.com/getsentry/sentry/pull/129044)

#### Other

- (deps) Bump sentry-javascript to 11.12.0 and rrweb to 2.46.0 by @gggritso with @sentry-junior in [#130930](https://github.com/getsentry/sentry/pull/130930)
- (tests) Run workspace suites in isolation by @TkDodo and @natemoo-re in [#127351](https://github.com/getsentry/sentry/pull/127351)
- (ui) Let tab links own focus and navigation by @TkDodo in [#130055](https://github.com/getsentry/sentry/pull/130055)

### Other

- deps(ui): Upgrade rspack to 2.3.1 and swc packages by @scttcper and @claude in [#129407](https://github.com/getsentry/sentry/pull/129407)
- deps(ui): Upgrade oxlint to 1.90 and oxfmt to 0.75 by @scttcper and @claude in [#129397](https://github.com/getsentry/sentry/pull/129397)

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
