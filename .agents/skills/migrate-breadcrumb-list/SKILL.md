---
name: migrate-breadcrumb-list
description: Migrates legacy page-navigation breadcrumbs to @sentry/scraps/breadcrumbList and the required typed title on TopBar.Slot name="breadcrumbs". Use for "migrate breadcrumbs", "replace sentry/components/breadcrumbs", "BreadcrumbList.Title", duplicate page titles, or preserving page filters during breadcrumb migration. Not for event breadcrumbs, issue-detail timeline entries, or a redesign of Settings route assembly.
---

# Migrate page breadcrumbs to BreadcrumbList

Migrate the requested file or view directory. If no target is supplied, inspect the remaining legacy importers and select a page-navigation call site.

## The transformation

Separate parent links from the current page title. Pass both through one public slot:

```tsx
// Legacy: one array, including the current page.
<Breadcrumbs crumbs={[{label: t('Monitors'), to: basePath}, {label: monitor.name}]} />

// Current: required typed title, optional parent breadcrumbs.
<TopBar.Slot
  name="breadcrumbs"
  title={{type: 'page-title', label: monitor.name}}
  items={[{type: 'link', label: t('Monitors'), to: basePath}]}
/>
```

For a page without parents, omit `items`. The `title` prop is still required.

`TopBar.Slot name="breadcrumbs"` rejects children. It renders `items` through `BreadcrumbList` and internally routes the parents and title to separate outlets. `BreadcrumbList.Title` supplies the single `<h1>`. For both title types, only the displayed label is inside the heading; graphics and controls render outside it. An editable title replaces the heading with a labelled input during editing. Do not wrap the title component in another heading. Use it directly only when composing outside TopBar. Do not add a public `TopBar.Slot name="title"`, `Layout.Title`, or a second page heading; those public title APIs were removed.

Read `static/app/views/navigation/topBar.tsx` and `static/app/components/core/breadcrumbList/` before editing. Prefer the current implementation over old migration examples.

## Preserve page filters explicitly

`preservePageFilters` is not a breadcrumb item prop. A fresh object literal rejects it, but spreading a legacy crumb can compile while silently dropping filters:

```tsx
// Do not carry legacy fields through a spread.
.map(crumb => ({type: 'link' as const, ...crumb}))
```

Destructure the fields and rebuild the destination. Missing URL filters can clear the destination's project selection; they do not mean "unchanged".

```tsx
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';

const to = {
  pathname: basePath,
  // project, environment, statsPeriod, start, end, utc
  query: extractSelectionParameters(location.query),
};
```

When overriding `statsPeriod`, also clear `start` and `end`. When the old destination already has a query, preserve its explicit values:

```tsx
const destination = {
  ...oldTo,
  query: {...extractSelectionParameters(location.query), ...oldTo.query},
};
```

Keep a bare pathname when the old crumb did not preserve filters. Do not change filter policy as part of migration.

## API map

| Surface                                      | Accepted items                   |
| -------------------------------------------- | -------------------------------- |
| `TopBar.Slot.items` / `BreadcrumbList.items` | `link`, `select`                 |
| `TopBar.Slot` breadcrumbs `title`            | `page-title`, `editable-title`   |
| `BreadcrumbList.Title` `item`                | Same `BreadcrumbTitleItem` union |

- `page-title` requires a string `label`. Use `labelTooltip`, `leadingGraphic`, `pagination`, and `trailingActions` for supporting content.
- `editable-title` requires `value`, `onChange`, and `'aria-label'`.
- `link` requires `label` and either `to` for internal navigation or `externalHref` for an external link that opens in a new tab.
- `select` accepts `options`, `value`, and `onChange` for parent breadcrumbs only. Settings also uses it for team and integration menus. A separate icon button opens the menu on click. Supply `label` to retain the name during server search, and `leadingGraphic` for its icon. `search`, `loading`, and `onOpenChange` pass through to the selector. Supply `to` to render the label as a navigation link; without it the label is plain text. The current page title cannot be a selector.
- Trailing actions support `copy`, `menu`, `badge`, and `button`. A selector is a `select` parent item, not a trailing action.
- There are no title-level `help`, `badge`, `href`, `status`, or `titleGuide` props. Use `labelTooltip` for help and documentation links, and a trailing `badge` action for feature badges. Keep the title label plain text.

Import public components from `@sentry/scraps/breadcrumbList` and `@sentry/scraps/badge`. The breadcrumb barrel exports `BreadcrumbList`, `BreadcrumbListProps`, and `BreadcrumbTitleItem`. Import `BreadcrumbListProps` directly for parent item types (`BreadcrumbListProps['items']`); do not infer them with `React.ComponentProps<typeof BreadcrumbList>`.

## Per-page workflow

1. Inspect the crumb builder, current title, conditions, and wrapper consumers. Use native search tools when available; otherwise use `rg`. Read `references/call-site-inventory.md` for shared builders and remaining migration shapes.
2. Identify the current page name before building parent items. An existing typed title takes precedence. On older branches, inspect the removed `Layout.Title` or raw heading before assuming the last crumb is the title.
3. Build the typed title using `references/title-item.md`. Preserve editing, parent selection, navigation, and analytics behavior. Keep the secondary sidebar's feature badge type in the title too.
4. Build parent items with real destinations. Remove the current page from the trail. A category descriptor may need a real parent URL instead of removal. An empty parent list is valid; do not invent links.
5. Pass `title` and `items` to one `TopBar.Slot name="breadcrumbs"`. Preserve conditions on parent rendering. For branch-dependent titles, let each branch produce a complete slot or title object.
6. If a shared header owns the slot, remove its callers' wrapping slots in the same change. Do not nest slot-producing components inside another breadcrumbs slot.
7. Remove empty `Layout.Header` or `Layout.HeaderContent` wrappers left holding only slots. Retain wrappers that still hold tabs or other visible content.
8. Delete only code made unused by the migration. Do not expand the shared title API to accommodate each legacy decoration. If requested UI is removed, remove tests dedicated only to that UI; retain tests of useful remaining behavior.
9. Verify changed behavior with the existing relevant tests, `pnpm run typecheck`, and `.venv/bin/prek run -q --files <files>`. Read `references/tests.md` before changing the test harness. Inspect remaining legacy references to verify progress without treating a fixed importer count as a target.

For Settings callers, `SettingsPageHeader.title` accepts a string or `BreadcrumbTitleItem`, and its `breadcrumbs` prop accepts additional parent items. Each route can contribute one parent item through `handle.settingsBreadcrumb`. The shared route layout collects entries from all matched routes in order; children add to their ancestors' entries. Use pathless routes to share a parent among related pages. Use full destination templates, including `:orgId`, and explicit `switchTo` destinations for selectors. `SettingsBreadcrumbsProvider` resolves these declarations and passes items downward through `SettingsBreadcrumbsContext`. `BreadcrumbTitle` combines those items with the page's additional items and required title, then renders one TopBar slot. Do not infer destinations from matched paths, register titles upward, or add a fallback title. Keep one explicit title owner per page.

## References

| Open when you need to...                                       | Read                                |
| -------------------------------------------------------------- | ----------------------------------- |
| Locate remaining callers or trace a shared builder             | `references/call-site-inventory.md` |
| Build titles, selectors, badges, tooltips, editing, or actions | `references/title-item.md`          |
| Check the test harness, queries, or responsive behavior        | `references/tests.md`               |

Use `views/detectors/components/details/common/header.tsx` for slot composition, `views/dashboards/dashboardBreadcrumbTitle.tsx` for state-dependent titles, `views/issueDetails/header/issueIdBreadcrumb.tsx` for a typed builder, and `views/settings/components/settingsBreadcrumb/settingsBreadcrumbSelector.tsx` for parent selectors. Paths are under `static/app/`.

## Migration checks

- Every public breadcrumbs slot has a typed `title` and optional `items`, with no JSX children; no public `title` slot or `Layout.Title` remains in the changed code.
- The page has one heading (replaced by a labelled input while editing), and the current page is not repeated in the parent trail.
- Legacy crumbs are not spread into typed items; page-filter destinations preserve the old behavior.
- Decorative leading graphics fit the 16×16 slot. Disable links and interactive tooltips inside that `aria-hidden` slot.
- Feature badges use `trailingActions`, match the sidebar type, and remain outside `leadingGraphic`.
- Rich tooltip content uses `labelTooltip`. Selectors use the `select` parent item.
- Conditional entries in trailing-action arrays use `null`. A lone action is a bare object.
- Check the actual JSX components in `badge` and `button` actions. Their `ReactElement<Props>` annotations do not enforce component identity.
- No empty padded header wrapper or duplicate slot owner remains.
- Tests cover the changed behavior without depending on removed decorations or generated CSS.

## Rollout boundary

Keep changes within the requested view area and its shared consumers. Do not add the removed `ui-migration-breadcrumbs` flag or `useHasNewBreadcrumbs` hook.

The legacy component's tests and navigation outside the page TopBar can remain. Preserve required navigation landmarks. Retire this skill when no page-navigation migration remains, after inspecting the remaining usages rather than using a fixed file count.
