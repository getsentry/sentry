---
name: migrate-breadcrumb-list
description: Migrates page-navigation breadcrumbs from the legacy `sentry/components/breadcrumbs` component to `@sentry/scraps/breadcrumbList`, splitting one flat crumb array across the TopBar `breadcrumbs` and `title` slots. Use when a page still renders `<Breadcrumbs crumbs={...}/>`, when parent crumbs and the page title need separating into two TopBar slots, when `Layout.Title` double-renders the page name, when a migrated crumb needs to keep the project or date selection, or when working through the BreadcrumbList migration backlog. Trigger on "migrate breadcrumbs", "migrate to BreadcrumbList", "replace sentry/components/breadcrumbs", "split breadcrumbs into TopBar slots", "BreadcrumbList.Title", "the page title renders twice", "preservePageFilters". Not for event breadcrumbs (`sentry/types/breadcrumbs`, the issue-detail timeline), and not for the route-driven SettingsBreadcrumb system.
---

# Migrate page breadcrumbs to BreadcrumbList

Migrate `$0` (a file, a view directory, or the next unmigrated call site when omitted) off `sentry/components/breadcrumbs`.

## The transformation

Legacy passes one flat array in which the **last** crumb is the current page (the component strips its `to` automatically). The new API splits that across two TopBar slots.

```tsx
// Old — one array, leaf included
<Breadcrumbs crumbs={[{label: t('Monitors'), to: basePath}, {label: monitor.name}]} />

// New — parents in one slot, the current page in the other
<Fragment>
  <TopBar.Slot name="breadcrumbs">
    <BreadcrumbList items={[{type: 'link', label: t('Monitors'), to: basePath}]} />
  </TopBar.Slot>
  <TopBar.Slot name="title">
    <BreadcrumbList.Title item={{type: 'page-title', label: monitor.name}} />
  </TopBar.Slot>
</Fragment>
```

`BreadcrumbList.Title` renders **no heading**. The `title` outlet already wraps its children in `<Heading as="h1">` — verify with `grep -n 'Heading as="h1"' static/app/views/navigation/topBar.tsx`. Never wrap `BreadcrumbList.Title` in a `Heading`, and never nest the `breadcrumbs` slot inside the `title` slot. Both mistakes are invisible: the outlet and the title item both use `variant="inherit"`, so a nested heading looks identical and only fails an a11y audit.

## ⚠️ `preservePageFilters` survives a spread

The prop does not exist on `BreadcrumbItemLinkProps`. As a **direct literal** it is caught:

```tsx
// error TS2353: 'preservePageFilters' does not exist in type 'LinkBreadcrumbItem'
items={[{type: 'link', label: 'Issues', to: '/issues/', preservePageFilters: true}]}
```

Through a **spread it compiles clean** — and spreading legacy crumbs is the migration idiom:

```tsx
// Compiles. Ships a page that silently drops project/environment/date filters on click.
.map(crumb => ({type: 'link' as const, ...crumb}))
```

Excess-property checking only applies to fresh object literals, so a `Crumb` carrying `preservePageFilters` passes straight through to `<Link>`, which ignores it. No type error, no failing test. **Destructure explicitly instead of spreading**, then rebuild the query.

Note the stakes. A crumb that loses the flag does not merely fail to carry filters — it **clears** them. `PageFiltersContainer` reconciles its store against the URL on navigation, and an absent `project` reads as an empty selection rather than "unchanged". Replicating the flag is not polish; skipping it changes what the destination shows.

```tsx
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';

// Preserve all six — project, environment, statsPeriod, start, end, utc.
// A legacy `to` is often a bare pathname string; restructure it into an
// object, as there is nowhere to hang a query otherwise.
const preserveAll = {
  pathname: makeReleasesPathname({organization, path: '/'}),
  query: extractSelectionParameters(location.query),
};

// Preserve some — spread, then override. Clearing `start`/`end` is required
// whenever you set `statsPeriod`, or an absolute range and a relative period
// both travel and the destination picks one.
const preserveSome = {
  pathname: makeReleasesPathname({organization, path: '/'}),
  query: {
    ...extractSelectionParameters(location.query),
    statsPeriod: '24h',
    start: undefined,
    end: undefined,
  },
};
```

Preserve nothing by leaving the bare pathname alone — that is what a crumb _without_ the flag did, and migrating one is not an occasion to start preserving. When the crumb already has a `to` object, merge rather than replace: `{...to, query: {...extractSelectionParameters(location.query), ...to.query}}`.

Find the call sites that still pass it: `grep -rln "preservePageFilters: true" static/app --include='*.tsx'`.

## Which API takes what

|                                      | Accepts                                                                                                                     | Shape             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `<BreadcrumbList items={...}/>`      | `'link'` (`label: string`, `to`, `leadingGraphic?`), `'select-projects'`                                                    | array             |
| `<BreadcrumbList.Title item={...}/>` | `'page-title'` (`label: string`, `labelTooltip?`, `leadingGraphic?`, `pagination?`, `trailingActions?`), `'editable-title'` | **single object** |

Title actions are a third union — one object, or an array whose absent entries are `null`:

| `trailingActions`  | Required fields                                                 |
| ------------------ | --------------------------------------------------------------- |
| `{type: 'copy'}`   | `text`, `label`                                                 |
| `{type: 'menu'}`   | `items`, `triggerLabel`                                         |
| `{type: 'button'}` | `element`, typed `ReactElement<ButtonProps \| LinkButtonProps>` |

Import is always `import {BreadcrumbList} from '@sentry/scraps/breadcrumbList'` — an alias onto `static/app/components/core/`. The barrel exports only `BreadcrumbList` and the type `BreadcrumbTitleItem`. `type: 'link'` requires `label: string` and a non-null `to`; `leadingGraphic` is optional.

## Pick the call-site shape

Classify before editing — the shapes need different amounts of work, and three of them touch more than one file.

| Shape  | Pattern                                                                                                                                              | Extra work                                                                                                                                                                                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1** | `<Breadcrumbs>` inside `TopBar.Slot name="title"`                                                                                                    | Pure split _of the slots_. A JSX leaf label may still need full decomposition — see `references/title-item.md`. Note the element is sometimes assigned to a variable first (`automations/detail.tsx`) or aliased through `styled(Breadcrumbs)` (`preprod/install/buildInstallHeader.tsx`), so `<Breadcrumbs` may not appear inside the slot |
| **A2** | A **wrapper component** rendered inside the caller's `title` slot                                                                                    | **Two-site edit.** The wrapper returns the two-slot `Fragment`; the caller's wrapping `title` slot must be deleted, or `breadcrumbs` nests inside `title` and parent links render into the `<h1>`                                                                                                                                           |
| **B**  | `<Breadcrumbs>` in `Layout.HeaderContent` beside `Layout.Title`                                                                                      | Fixes a live double-render. `Layout.Title` wins the title; the displaced leaf is usually a category descriptor (e.g. "Cron Monitor") that wants a real `to` not yet in the file. **Exception below**                                                                                                                                        |
| **C**  | Exported wrapper consumed by other pages — **only** when a consumer wraps it in a `title` slot; an exported header that owns its own slots is B or E | Every consumer changes in the same PR. Per consumer: hoist any surrounding ternary above the slot, delete the wrapping slot, and place or drop every sibling node in that slot                                                                                                                                                              |
| **E**  | `<Breadcrumbs>` beside a raw `<Heading as="h1">`                                                                                                     | Delete the local heading, or the page ships two `<h1>`s                                                                                                                                                                                                                                                                                     |

**If no row fits, do not force one.** The table describes the headers present when this skill was written. Classify by what the file _has_ — a `Layout.Title`, a raw heading, a wrapping title slot, an exported wrapper — and follow the closest row. If a header is structured unlike any of them, ask before restructuring it rather than guessing, and add a row here once the shape is settled.

`views/performance/breadcrumb.tsx` is type-only (`import type {Crumb}`, no JSX). Its work is deleting a legacy adapter, and it is blocked — see `references/call-site-inventory.md`.

**Shape B has one exception with no leaf crumb at all**, where applying "`Layout.Title` wins" mechanically renders the same text twice — see `references/call-site-inventory.md`.

`Layout.Title` is already a shim for `TopBar.Slot name="title"` (`grep -n 'export function Title' static/app/components/layouts/thirds.tsx`), which is why Shape B pages double-render today.

## Build `items`

Parents only — the leaf became the title.

```tsx
// Drop crumbs with no destination: `to` is required and non-nullable.
const items = parents.flatMap(c =>
  c.to ? [{type: 'link' as const, label: c.label, to: c.to}] : []
);
```

An empty `items` renders nothing, and that is correct — the title slot still renders. **Do not invent a parent link to avoid it.** If the legacy code gated the trail on a length check, port the condition.

That does not conflict with Shape B's "give the displaced leaf a `to`" — they are different crumbs. A leaf that is the **page name** becomes the title and leaves `items`. A leaf that is a **category descriptor** ("Cron Monitor") is a real parent that was merely unlinked: look for a `make*Pathname` for that category beside the one you already import, and prefer the two-link trail. Drop it only when there is nowhere to point.

## Per-page workflow

1. Read the file. Find the crumb array; note whether its last element has a `to`.
2. Classify the shape. For **A2/C**, `grep -rn '<WrapperName'` now and list every sibling node in each consumer's title slot — consumers are part of this change, not a follow-up. Read `references/call-site-inventory.md` **only** if the file is a wrapper or appears on its hard-rows list; for a plain A1/B/E file the shape table above is enough.
3. **Decide the title before writing anything.** In priority order: (1) `Layout.Title`'s content, (2) a raw `<Heading as="h1">` sibling, (3) the last crumb. If the header renders no heading and the last crumb has no `to`, the last crumb is the title. If the choice is gated on a boolean, hoist that boolean above both slots and give each branch its own `BreadcrumbList.Title` — never migrate one branch. Use `editable-title` if the name is user-editable, else `page-title`.
4. Build the title item. → `references/title-item.md`
5. Build `items` from what remains. Drop the leaf. Drop or re-point crumbs with no `to`. Replace `preservePageFilters`. Port any length guard.
6. Render both slots, `breadcrumbs` then `title`. Wrap them in a `Fragment` when the component returns them directly. Then check what the old wrapper has left: **if a `Layout.Header` or `Layout.HeaderContent` is now left holding only `TopBar.Slot` children, delete it.** Slots render nothing in place, and `Layout.Header` is a real `<Grid as="header">` with padding and a bottom border — leaving it ships an empty bordered strip above the page body. Keep it only if it still has non-slot children, such as `Layout.HeaderTabs`.
7. Delete only what the move orphaned — see the checklist guard below.
8. Fix the specs. → `references/tests.md`
9. Verify: `pnpm run typecheck` (whole project, takes no paths), `.venv/bin/prek run -q --files <files>`, `pnpm test-ci <spec>`, and re-run the count — it must have decreased and still be at or above 4.

Step 3 precedes step 5 because it determines which crumbs are left. Building `items` first ships the leaf twice and forces a redo of both slots.

## References

| Open when you need to                                                                                           | Read                                |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Know what shape a file is, who consumes a wrapper, or what blocks a file                                        | `references/call-site-inventory.md` |
| Build a title whose name is more than a plain string — a badge, tooltip, editable field, pagination, or actions | `references/title-item.md`          |
| Write or fix a spec for a migrated page                                                                         | `references/tests.md`               |

## Reference implementations

Already migrated, simplest first. Each answers one question.

| File                                                                   | Answers                                                                                  |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `views/detectors/components/details/common/header.tsx`                 | The minimal two-slot split                                                               |
| `views/explore/conversations/components/conversationsBreadcrumbs.tsx`  | Replacing `preservePageFilters`; a standalone `copy` action                              |
| `views/performance/transactionSummary/transactionBreadcrumbs.tsx`      | Mapping a shared crumb builder into typed items; `leadingGraphic`; a menu with a submenu |
| `views/performance/newTraceDetails/traceHeader/traceBreadcrumbs.tsx`   | `pagination`; dropping unlinked crumbs with `.flatMap`                                   |
| `views/dashboards/dashboardBreadcrumbTitle.tsx`                        | `editable-title`; one early return per page state                                        |
| `views/explore/replays/detail/header/replayDetailsPageBreadcrumbs.tsx` | The richest title — pagination, `leadingGraphic`, and a nulled action array together     |
| `views/issueDetails/header/issueIdBreadcrumb.tsx`                      | Building a title item outside JSX with `as const satisfies`                              |

## Intentionally not migrated

Four importers keep the legacy component — its own spec, plus three call sites that render outside the page `<h1>` and need a `<nav>` landmark `BreadcrumbList` has no mode for. **The count floors at 4; driving it to 0 destroys a landmark.** The route-driven `SettingsBreadcrumb` system is out of scope too. Both lists are in `references/call-site-inventory.md`.

## Rollout

The count is the progress state — no scratch file to keep in sync.

```bash
grep -rl "from 'sentry/components/breadcrumbs'" static/app | wc -l
```

Migrate one view area per PR. Split at roughly 50 changed files along ownership boundaries in `@.github/CODEOWNERS`. Title as `ref(<area>): Migrate breadcrumbs to BreadcrumbList`, or `feat(<area>): ...` if page actions moved into the title menu. There is **no feature flag** — `ui-migration-breadcrumbs` and `useHasNewBreadcrumbs()` were deleted, so every page flips for all users on merge. Some older reference PRs still show a flag fork; that pattern is dead code now.

## Migration checklist

Each item is a grep or a compile, because every judgment-shaped check here was one an earlier draft got wrong.

- [ ] No `preservePageFilters:` in the diff, **and** no spread of legacy crumbs into typed items — `grep` for `preservePageFilters:` (with the colon: a bare grep also matches the comment explaining the replacement, so it flags a correct migration) and for `...crumb` inside a `.map` that produces `type: 'link'`. A spread compiles and silently drops page filters.
- [ ] No wrapper is left holding only `TopBar.Slot` children — slots render nothing in place, so a surviving padded/bordered `Layout.Header` becomes an empty strip above the page body.
- [ ] The file has exactly one `TopBar.Slot name="title"`, zero `as="h1"`, zero `Layout.Title` — a survivor of any of these double-renders the page name or ships two `<h1>`s.
- [ ] No `TopBar.Slot name="breadcrumbs"` inside a `name="title"` subtree — nesting renders parent links into the page heading, and looks correct because both use `variant="inherit"`.
- [ ] Every `type: 'link'` has a real `to`. An empty `items` is fine and renders nothing; an invented parent link is not.
- [ ] No `useHasNewBreadcrumbs` or `ui-migration-breadcrumbs` — both are dead repo-wide, so a flag fork can never render.
- [ ] `label` is a plain string. Stringifying a JSX label deletes the badge, tooltip, or copy affordance instead of moving it.
- [ ] Every `IdBadge`/`ProjectBadge` in `leadingGraphic` passes `disableLink` — the slot is `aria-hidden`, and `IdBadge`/`ProjectBadge` render a focusable `<a href>` without it, putting a tabbable link inside a hidden subtree. Typechecks, passes tests, fails an axe audit.
- [ ] `leadingGraphic` avatars pass `avatarSize={16}` with a `<Placeholder width="16px" height="16px"/>` fallback — the slot is a fixed 16×16, so 28px clips and a missing graphic shifts the title as data arrives.
- [ ] A title item built outside JSX ends `as const satisfies BreadcrumbTitleItem` — otherwise `type` widens to `string` and the union stops narrowing.
- [ ] Array `trailingActions` use `null` for absent entries; a lone action is a bare object, not a one-element array.
- [ ] Every touched spec mounts `<TopBar />` inside `<TopBar.Slot.Provider>`, or declares a `breadcrumbs` outlet — a spec stubbing only `title`/`actions`/`feedback` renders no parent crumbs and fails as if the component were broken.
- [ ] The leaf is asserted **absent** from the trail, not just present as the heading.
- [ ] The count decreased and is still at or above 4.

Overflow collapse is deliberately absent from this list — jsdom never evaluates container queries. See `references/tests.md`.
