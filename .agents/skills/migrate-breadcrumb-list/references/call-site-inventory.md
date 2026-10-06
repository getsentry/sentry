# Find migration work

Regenerate the inventory before editing. A file can already use the typed title API while still rendering legacy parent breadcrumbs.

## Search and classify

Prefer native code search. When unavailable:

```bash
rg -l "from 'sentry/components/breadcrumbs'" static/app static/gsApp
```

Read each match and its consumers. Classify its current structure:

| Structure                                      | Migration                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Legacy parents beside a typed breadcrumbs slot | Move only the parent trail into the existing slot's children; preserve its title         |
| Legacy crumb array containing the current page | Split the leaf into the required typed `title` and pass only parents to `BreadcrumbList` |
| Shared wrapper that renders the slot           | Change its consumers in the same patch; remove wrapping slots                            |
| Conditional saved-query and landing headers    | Preserve a complete title and parent trail in each branch                                |
| Legacy `Crumb[]` builder                       | Trace all consumers before changing its return type                                      |
| Navigation outside TopBar                      | Check landmark and layout needs before replacing it                                      |

Public `TopBar.Slot name="title"` and `Layout.Title` are removed. Treat them as legacy input only if encountered on an older branch, never as the output of migration.

## Remaining cases to inspect

These paths were verified during the typed-title API update; recheck them instead of treating this as a fixed backlog:

- `static/app/views/preprod/buildDetails/header/buildDetailsHeaderContent.tsx`: legacy breadcrumbs plus a typed title. Preserve the build metadata and page actions.
- `static/app/views/preprod/buildComparison/header/buildCompareHeaderContent.tsx`: legacy breadcrumbs and comparison metadata. Determine the current page label from the full header.
- `static/app/views/insights/pages/domainViewHeader.tsx`: a typed `headerTitle` or domain-name fallback, plus legacy parent breadcrumbs. Preserve the existing parent length guard; do not duplicate the domain name.
- `static/app/views/performance/breadcrumb.tsx`: legacy `Crumb[]` flows through header props into the domain header. Search `getTabCrumbs` and `additionalBreadCrumbs` and migrate the connected consumers together.
- `static/app/views/insights/crons/components/monitorHeader.tsx`: legacy category crumbs beside a typed monitor title. Keep the monitor name as the title and resolve real destinations for parent categories.

The Discover, Explore saved-query, dashboard, and preprod install headers are useful migrated examples. Inspect current code; old notes about their public `title` slots no longer apply.

## Retain separate navigation when needed

- `static/app/components/breadcrumbs.spec.tsx` tests the legacy component while it remains in use.
- `static/app/components/events/eventDrawer.tsx` renders navigation outside the page title.
- `static/app/views/issueDetails/groupDistributions/groupDistributionCrumbs.tsx` supplies crumbs for that separate navigation.

`BreadcrumbList` renders an `<ol>` without a navigation landmark. Preserve any landmark required by these callers; do not migrate them solely to lower the importer count.

Settings uses route-driven `SettingsBreadcrumb` and a title context. Its page headers accept typed titles and optional parent items, but the legacy-component migration does not require replacing its route assembly.
