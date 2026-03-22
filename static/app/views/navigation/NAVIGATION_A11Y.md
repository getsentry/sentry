# Navigation ARIA Accessibility Fix (DE-1015)

Lighthouse audit found that navigation items incorrectly use `aria-selected`
(a selection-widget attribute for listboxes/grids/trees). Navigation links must
use `aria-current` instead.

## Required changes

- Primary nav active item → `aria-current="location"`
- Secondary nav active item → `aria-current="page"` (attribute already set in JSX; CSS still keys off `aria-selected`)
- All inactive items → no `aria-selected`, no `aria-current`
- Primary nav "hover-active group" visual state → `data-active-group="true"` (non-semantic, CSS-only)

## Todo

- [x] `primary/useActivateNavigationGroupOnHover.tsx`: remove `aria-selected`, change `aria-current` to `"location"`, add `data-active-group`
- [x] `primary/components.tsx`: forward `data-active-group` instead of `aria-selected` in `sharedLinkProps`; update three CSS blocks (`MobileNavigationLink`, `DesktopNavigationLink`, `DesktopPageFrameNavigationLink`) to swap `&[aria-selected='true']` → `&[data-active-group='true']` and `&[aria-current='page']` → `&[aria-current='location']`
- [x] `secondary/components.tsx`: remove `aria-selected: isActive` from both link-props sites (lines ~441, ~891); update five CSS blocks to swap `&[aria-selected='true']` → `&[aria-current='page']`
- [x] `index.desktop.spec.tsx`: split `assertActiveNavLink` into `assertActivePrimaryNavLink` / `assertActiveSecondaryNavLink`; update `assertInactiveNavLink` to drop `aria-selected` assertion; fix active-link filter for primary nav from `"page"` → `"location"`; update `assertRouteActivatesLinks` to call the right helper per nav level
- [x] `index.mobile.spec.tsx`: add `within` import; add accessibility describe block with tests for primary nav (`aria-current="location"`) and secondary nav (`aria-current="page"`) each marking exactly one link active
