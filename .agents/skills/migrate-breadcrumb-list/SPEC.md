# Migrate Breadcrumb List Specification

## Intent

Give an agent a reliable path for moving a page off the legacy `sentry/components/breadcrumbs` component to `@sentry/scraps/breadcrumbList`, splitting one flat crumb array across the TopBar `breadcrumbs` and `title` slots. The dominant failure mode this skill guards against is silent regression: `preservePageFilters` carried through a spread compiles and drops page filters, a surviving `Layout.Title` or raw `<h1>` double-renders the page name, and a wrapper migrated in place nests the `breadcrumbs` slot inside the page heading. None of the three produce a type error or a failing test.

## Scope

In scope: the 22 files importing `sentry/components/breadcrumbs` that render a page-navigation trail, including the wrapper components consumed by several pages and the type-only adapter that feeds them.

Out of scope: event breadcrumbs (`sentry/types/breadcrumbs` and `components/events/breadcrumbs/`, the issue-detail timeline — an unrelated feature that shares the word); the route-driven `SettingsBreadcrumb` system; and the three landmark call sites that render outside the page `<h1>` and need a `<nav>` that `BreadcrumbList` has no mode for. Building new capabilities on the component itself is also out of scope.

## Non-negotiable Constraints

- Never spread a legacy `Crumb` into a typed item. Destructure the fields you want; excess-property checking does not apply through a spread.
- After migrating a file it must contain exactly one `TopBar.Slot name="title"`, zero `as="h1"`, and zero `Layout.Title`.
- Never nest the `breadcrumbs` slot inside the `title` slot, and never wrap `BreadcrumbList.Title` in a `Heading`.
- The legacy-importer count floors at 4. Driving it to 0 destroys a `<nav>` landmark.
- Do not add a feature-flag fork. `ui-migration-breadcrumbs` and `useHasNewBreadcrumbs()` no longer exist.

## Sources

- `components/core/breadcrumbList/` — authoritative for the item unions and every prop. The types win over the story.
- `components/core/breadcrumbList/breadcrumbList.mdx` — authoritative for composition and editorial rules (copy-vs-menu, always-present pagination).
- `views/navigation/topBar.tsx` — slot names, and the `<Heading as="h1">` that makes the title outlet the page heading.
- Reference migrations: getsentry/sentry#120729 (conversations), #120794 (trace view), #123128 (transaction summary), #121282 (dashboards actions), #123569 (replay actions). #122697 removed the migration flag; the earlier PRs' flag forks are dead patterns.
- Ten already-migrated call sites in `static/app/views/`, enumerated in `SKILL.md`.

## Known Limitations

- Overflow collapse is a container query and cannot be tested in jsdom; the skill routes it to a manual resize check.
- Choosing the title on a Shape B or Shape C page is a judgement the skill can frame but not decide — it supplies a priority order and answer keys, not a rule.
- `references/call-site-inventory.md` names specific files and is invalidated by this migration's own PRs. It leads with a regeneration command for that reason.
- `select-projects` has no production consumer, so its guidance is untested by use.

## Maintenance

- Update `SKILL.md` when the item unions gain or lose a type, when a TopBar slot is added or renamed, or when a shape category stops matching what is left in the tree.
- Delete the `preservePageFilters` section once no legacy importer still passes the prop: `grep -rln "preservePageFilters: true" static/app --include='*.tsx'`. Six remain.
- Prune `references/call-site-inventory.md` as rows land. When it empties and the count reaches 4, delete this skill.
- Update `SPEC.md` when intent, scope, the non-negotiable constraints, or the sources change.
