# Call-site inventory

Regenerate the classification rather than trusting a list — this migration's own PRs invalidate any table of paths. The hard rows below are the part that cannot be regenerated.

## Contents

- [Classify](#classify)
- [Hard rows](#hard-rows)
- [Wrapper consumer map](#wrapper-consumer-map)

## Classify

```bash
cd "$(git rev-parse --show-toplevel)"
EXCLUDE='components/breadcrumbs.spec.tsx|events/eventDrawer.tsx|groupDistributionCrumbs.tsx|widgetBuilderSlideout.tsx'
for f in $(grep -rl "from 'sentry/components/breadcrumbs'" static/app | grep -Ev "$EXCLUDE" | sort); do
  printf '%-70s jsx=%s h1=%s LT=%s titleSlot=%s styled=%s\n' "${f#static/app/}" \
    "$(grep -c '<Breadcrumbs' "$f")" "$(grep -c 'as="h1"' "$f")" \
    "$(grep -c 'Layout.Title' "$f")" "$(grep -c 'TopBar.Slot name="title"' "$f")" \
    "$(grep -c 'styled(Breadcrumbs)' "$f")"
done
```

Read the fingerprint as:

| Fingerprint                             | Shape                                                   |
| --------------------------------------- | ------------------------------------------------------- |
| `titleSlot>0`, `LT=0`, `h1=0`           | **A1** or **A2** — check what the slot's first child is |
| `LT>0`                                  | **B**                                                   |
| `h1>0`                                  | **E**                                                   |
| `titleSlot=0`, `jsx>0`, exported symbol | **C** — count consumers below                           |
| `jsx=0`, `styled=0`                     | the type-only adapter                                   |
| `jsx=0`, `styled=1`                     | **A1** via a `styled(Breadcrumbs)` alias                |

To separate A1 from A2, look at the element inside the slot. `<Breadcrumbs` or a JSX-valued variable is A1; a component name is A2 and the caller's slot must be deleted.

```bash
f=static/app/views/automations/new.tsx
ln=$(grep -n 'TopBar.Slot name="title"' "$f" | head -1 | cut -d: -f1)
sed -n "$((ln+1))p" "$f"
```

A file absent from the fingerprint output is already migrated. Do not re-add it.

## Hard rows

Four files cost far more than their fingerprint suggests.

### `views/performance/breadcrumb.tsx` — blocked, do last

Type-only, and it looks like a one-file delete. It is not. `getTabCrumbs()` returns `Crumb[]` that flows:

```
performance/breadcrumb.tsx  getTabCrumbs()
  → performance/transactionSummary/header.tsx
  → {...headerProps}
  → insights/pages/{frontend,backend,mobile}/*PageHeader.tsx   (3 shims)
  → insights/pages/domainViewHeader.tsx   additionalBreadCrumbs?: Crumb[]  ← public prop
```

Six files, three shapes. Deleting the adapter first breaks `header.tsx` and surfaces the chain at typecheck with no guidance on whether to expand scope or revert. Do these four as one PR, after everything else. Confirm the chain still holds before starting:

```bash
grep -rn 'getTabCrumbs\|additionalBreadCrumbs' static/app --include='*.tsx'
```

`getTransactionSummaryParentCrumbs` in the same file is already the new-style builder — the migration deletes `getTabCrumbs` around it, it does not rewrite both.

### `views/explore/components/breadcrumb.tsx` — hardest file in the set

`ExploreBreadcrumb`, four consumers: `explore/{metrics,spans,logs}/content.tsx` and `explore/replays/list.tsx`. Each one gates the _title source_ on the same boolean that gates the trail, so the title is branch-dependent and step 3 has no single answer. Each also carries sibling nodes in the title slot (a `FeatureBadge`, a tooltip) that have no home in the new API.

Hoist the ternary above both slots and give each branch its own `BreadcrumbList.Title`. Migrating only the true branch nests `breadcrumbs` inside `title`.

The wrapper's own crumb builder uses four independent `if`s, so an unrecognized dataset yields a single unlinked leaf. After dropping the leaf, `items` is empty and the trail renders nothing — which is correct here. Do not invent a parent.

### `views/insights/pages/domainViewHeader.tsx` — the Shape B exception

No leaf crumb: `crumbs[0]` is a linked parent, and `Layout.Title` is `{headerTitle || domainTitle}`. Applying "`Layout.Title` wins" mechanically produces the same string as both a parent link and the heading, where today the page renders one heading. Keep the `crumbs.length > 1` guard as a condition on the `breadcrumbs` slot. `additionalBreadCrumbs` is a public prop — retyping it is what unblocks the row above.

### `views/preprod/install/buildInstallHeader.tsx` — three branches, one component

Three separate `TopBar.Slot name="title"` blocks with three different crumb arrays, plus a `styled(Breadcrumbs)` alias to delete. Each branch needs its own title decision, and the pending branch's label is a row of `Placeholder`s with no representable form — see `title-item.md`. Mirror `views/dashboards/dashboardBreadcrumbTitle.tsx`'s one-early-return-per-state structure.

## Wrapper consumer map

Shape C wrappers and their consumers. Re-derive with `grep -rl '<SymbolName' static/app --include='*.tsx' | grep -v spec.tsx`.

| Wrapper                                                   | Consumers                                                                          |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `components/profiling/profilingBreadcrumbs.tsx`           | `profileHeader.tsx`, `continuousProfileHeader.tsx`                                 |
| `views/alerts/builder/builderBreadCrumbs.tsx`             | `views/alerts/edit.tsx`                                                            |
| `views/detectors/components/forms/common/breadcrumbs.tsx` | `newDetectorLayout.tsx`, `editDetectorLayout.tsx`                                  |
| `views/discover/breadcrumb.tsx`                           | `views/discover/results/resultsHeader.tsx`                                         |
| `views/explore/components/breadcrumb.tsx`                 | `metrics/content.tsx`, `spans/content.tsx`, `logs/content.tsx`, `replays/list.tsx` |

Two answer keys worth copying rather than re-deriving:

- **An unlinked leaf that must become a link.** `views/detectors/components/uptime/details.tsx` has `{label: t('Uptime Monitor')}` with no `to`. The destination is not in that file, but `views/detectors/components/details/common/header.tsx` already links `getDetectorTypeLabel(detector.type)` → `makeMonitorTypePathname(organization.slug, detector.type)` for exactly this crumb.
- **A spec that renders a wrapper with no TopBar at all.** `components/profiling/profilingBreadcrumbs.spec.tsx` cannot work as written once the wrapper owns two slots. See `tests.md`.

## Never migrated

| File                                                                  | Why it stays                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `components/breadcrumbs.spec.tsx`                                     | The legacy component's own spec; goes when the component does |
| `components/events/eventDrawer.tsx` (`NavigationCrumbs`)              | Renders outside the page `<h1>` and needs a `<nav>` landmark  |
| `views/issueDetails/groupDistributions/groupDistributionCrumbs.tsx`   | Consumes `NavigationCrumbs`                                   |
| `views/dashboards/widgetBuilder/components/widgetBuilderSlideout.tsx` | `<Breadcrumbs as="nav">` inside a slide-over panel            |

`BreadcrumbList` renders a bare `<ol>` with no landmark mode, so those three are blocked on a component capability. `views/settings/components/settingsBreadcrumb/` is a separate route-driven system that derives crumbs from `useRoutes()` and receives titles via a context side-effect.
