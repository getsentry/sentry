---
name: migrate-container-queries
description: Guide for migrating viewport media queries (@media, useMedia) to container queries in Sentry's frontend. Use when migrating responsive layout to container queries, replacing @media/useMedia, refactoring styled responsive components to Container/Flex/Grid primitives, or working on the DE container-query migration.
---

# Container Query Migration Guide

Migrate viewport-based responsive logic (`@media` + `useMedia`) to container queries so components respond to their own available space instead of the raw viewport.

> **Always do a visual check.** After every migration, resize the _element_ (not just the window) and confirm the layout is identical and flips at the intended width. A good way to narrow an element without touching the window is to open a resizable panel next to it — e.g. drag out the Seer explorer sidebar, which squeezes the middle content. The token scales differ, so a mechanical swap that compiles can still render wrong.

## Approach: refactor first, swap second

Stop at the first rung that fits. Prefer replacing hand-rolled CSS with primitives over a mechanical token swap.

| Rung                   | When                                                                                                    | Do                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Primitive props     | The `@media` only flips layout (`flex-direction`, `display`, `grid-template`, gap, visibility, width)   | Delete the styled component; use `Container`/`Flex`/`Grid`/`Stack` responsive props (`direction={{xs: 'column', md: 'row'}}`)                   |
| 2. `@container` swap   | CSS can't be a prop (descendant selectors, pseudo-elements, `font-size`, complex `grid-template-areas`) | Keep the styled component; swap `@media` → `@container`, `theme.breakpoints.*` → `theme.container.*`                                            |
| 3. Container-scoped JS | Width is read in JS to branch rendering                                                                 | Replace `useMedia(...)` with `useResponsivePropValue({...})` for a threshold boolean, or `useContainerBreakpoint()` to branch on the active key |
| 4. Leave as `useMedia` | Genuine media feature, not width                                                                        | Do nothing — these do not migrate                                                                                                               |

## ⚠️ Convert to the nearest container scale

Breakpoint and container scales have **different keys and different pixel values** — this is not a rename. **MAP BY PIXEL VALUE, NOT BY KEY:** `breakpoints.sm` does NOT become `container.sm`. Reusing the same key is the #1 migration bug.

`theme.breakpoints` (viewport / `@media`), base `2xs`:

| `2xs` | `xs`  | `sm`  | `md`  | `lg`   | `xl`   | `2xl`  |
| ----- | ----- | ----- | ----- | ------ | ------ | ------ |
| 0px   | 500px | 800px | 992px | 1200px | 1440px | 2560px |

`theme.container` (container / `@container`), base `zero`:

| `zero` | `3xs` | `2xs` | `xs`  | `sm`  | `md`  | `lg`  | `xl`  | `2xl` | `3xl`  | `4xl`  | `5xl`  |
| ------ | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------ | ------ | ------ |
| 0px    | 320px | 384px | 448px | 512px | 576px | 640px | 768px | 896px | 1024px | 1152px | 1280px |

**Rule:** take the old breakpoint's pixel value and pick the `container` token whose pixel value is _nearest_ to it — not the token with the same name. `breakpoints.sm` is 800px, so it maps to `container.xl` (768px), not `container.sm` (512px). Then confirm with a visual check: the container is often narrower than the viewport, so the nearest-px token is a starting point, not a guarantee.

## Genuine viewport width → `screen:` keys, not `useMedia`

When layout truly must follow the _window_ (not the component's room), don't keep `useMedia` — use a `screen:`-prefixed responsive prop, which resolves against the viewport on the `theme.breakpoints` scale: `direction={{zero: 'column', 'screen:lg': 'row'}}`. Bare keys and `screen:` keys can mix on one prop. Prefer bare (container) keys; reach for `screen:` only when the viewport genuinely drives the layout.

## Keep `useMedia` only for non-width media features

Width — container or viewport — has a prop/hook path above. Leave `useMedia` in place only for:
`prefers-color-scheme`, `prefers-reduced-motion`, `hover`, `pointer`, `max-height` / height-based, `resolution`, `print`.

## container-type: only when no query container is in scope

**Default: don't add one.** Bare keys and `@container` already resolve against the nearest ancestor container, and product views have one: `ContentStack` (`#main`, `views/organizationLayout/index.tsx`) wraps the routed `<Outlet />` with `containerType="inline-size"`; `topBar` and `#modal-portal` cover their own subtrees. Add `container-type` only when a subtree must respond to _its own_ width rather than the page's — then:

- Use `inline-size` (width only). `size` also queries height, which collapses content unless height is set elsewhere.
- In a reusable component that may already sit inside a container, make it conditional to avoid a redundant one — `containerType={hasParentQueryContainer ? 'normal' : 'inline-size'}` via `useHasContainerQuery()` (see `components/core/breadcrumbList/breadcrumbList.tsx`).

## Examples

### Rung 1 — styled `@media` → primitive props (preferred)

```tsx
// Old — delete the styled component
const Row = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column;
  }
`;

// New
import {Flex} from '@sentry/scraps/layout';
<Flex direction={{xs: 'column', sm: 'row'}} gap="md">
```

### Rung 2 — `@media` → `@container` (when it can't be a prop)

```tsx
// Old
@media (max-width: ${p => p.theme.breakpoints.md}) { ... }

// New — swap at-rule AND scale; md breakpoint (992px) → nearest container token by px
// is 3xl (1024px), NOT theme.container.md by matching key
@container (max-width: ${p => p.theme.container['3xl']}) { ... }
```

### Rung 3 — `useMedia` (width) → container-scoped JS

Both helpers below read the nearest query container (call from a descendant of one) and re-render as it crosses a breakpoint. A single `max-width` boolean is cleanest as a responsive value; reach for the active key only when you branch on the key itself.

```tsx
// Old
const isNarrow = useMedia(`(max-width: ${theme.breakpoints.sm})`);

// New — resolve a responsive boolean against the container, same mobile-first
// cascade as CSS. A max-width query is "on by default, off past the threshold",
// so name only the threshold key. Map by pixel value: breakpoints.sm (800px) →
// nearest container token is xl (768px).
import {useResponsivePropValue} from '@sentry/scraps/layout';

const isNarrow = useResponsivePropValue({zero: true, xl: false});
// below xl → true, at/above xl → false — one key on each side, nothing to enumerate.
```

Reach for `useContainerBreakpoint()` instead only when you branch on the key
itself (e.g. picking one of several layouts), not a single threshold. It returns
the container's active key (`'zero'` … `'5xl'`) — don't compare it with
`=== 'zero'` for a max-width case: that fires only below 320px and drops the
320–768px range the original query treated as narrow.

## Migration Checklist

Took the lowest rung that fits (above). Then verify the gotchas:

- [ ] Mapped to the `container` token with the nearest pixel value, not the same name — e.g. `breakpoints.sm` → `container.xl`, not `container.sm`
- [ ] For width read in JS, used `useResponsivePropValue({...})` for a threshold boolean; reserved `useContainerBreakpoint()` for branching on the key — never `=== 'zero'` to mean "narrow" (that's only <320px)
- [ ] Routed genuine viewport-width cases to `screen:` keys; kept `useMedia` only for non-width media features
- [ ] Added `container-type` only when a subtree needs its own; used `inline-size`
- [ ] Confirmed a query-container ancestor exists (`@container` silently no-ops without one)
- [ ] **Visual check:** resized the element and confirmed identical output flipping at the intended width
