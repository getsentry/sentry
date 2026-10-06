# Sources

## Authoritative

- `components/core/breadcrumbList/` — authoritative for the item unions and every prop. The types win over the story.
- `components/core/breadcrumbList/breadcrumbList.mdx` — authoritative for composition and editorial rules (copy-vs-menu, always-present pagination).
- `views/navigation/topBar.tsx` — slot names and title outlet layout; `components/core/breadcrumbList/` owns the heading markup.
- Reference migrations: getsentry/sentry#120729 (conversations), #120794 (trace view), #123128 (transaction summary), #121282 (dashboards actions), #123569 (replay actions). #122697 removed the migration flag; the earlier PRs' flag forks are dead patterns.
- Current examples in `static/app/views/` are listed in `SKILL.md`; re-read them before adapting them.
- `tests/js/sentry-test/reactTestingLibrary.tsx` supplies TopBar slot outlets in the default test renderer.

## Decisions

- **Guidance is inline, not a component prop.** A `pageFilters` prop on `BreadcrumbItemLinkProps` was designed and rejected: four real call sites cannot express themselves in an enum (whole-query-minus-N keys, inheriting from an `EventView`, and a drawer-tab crumb that is not page navigation), and an escape hatch would defeat the forcing function. A `pageFilterQuery` helper was also built and dropped — at the converted call site its diff was equivalent to the spread it replaced.
- **Page-filter policy is treated as settled.** Whether a given crumb _should_ carry filters is a product decision. The skill teaches how to replicate existing behaviour, not how to choose.
- **`references/evidence/` was not created.** The two cold runs below are summarised here instead; their findings are already promoted into rules, and the skill has a defined end of life.

## Historical iteration

Two cold runs, each a fresh agent given only the skill and one target file, in an isolated worktree.

| Run | Target                                             | Shape | Cost                              | Surfaced                                                                                                                                                                     |
| --- | -------------------------------------------------- | ----- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `explore/releases/detail/header/releaseHeader.tsx` | A1    | 13 tool calls, 4 on the spec      | The `disableLink` trap; a checklist grep that flagged its own recommended fix; `LinkButton` rendering `<a role="button">`; a fixture field gating an action out of existence |
| 2   | `insights/crons/components/monitorHeader.tsx`      | B     | 22 tool calls, ~14 on orientation | Step 6 producing an empty bordered strip; Shape B/C ambiguity; the page-filter example leading with an override; a missing `ProjectsStore` import path                       |

Deltas applied: Shape A split into A1/A2; Shape E added; `disableLink` promoted to a checklist item; the checklist rewritten as greps; the page-filter example reordered to show pass-through first; `call-site-inventory.md` made a conditional read.

Run 2 also found a regression introduced by run 1's fix — the step 6 "add as sibling" branch, added because run 1 read the instruction as unconditional, was wrong for a wrapper left holding only slots.

## Gaps

- The historical cold runs below have not been repeated against the current single-slot API.
- The overflow collapse cannot be tested in jsdom, so no run has exercised it.
- Reachability, not file counts, determines whether a call-site inconsistency is user-visible; the inventory records shapes but not reachability.
- Choosing a title in mixed legacy or shared headers still requires inspecting the caller and its conditions.
- JSX element prop annotations do not enforce component identity. The documented `badge`/`button` element API remains in the implementation; the proposed props-only replacement has not been implemented.

## Current API correction

- Retained the existing migration scope and reference-backed workflow. This is an update of the existing skill, not a new skill or provider-specific workflow.
- Replaced public two-slot examples with one breadcrumbs slot and a required typed title. Removed the obsolete Layout.Title shim guidance.
- Documented rich labelTooltip content, trailing feature badges, and standard EditableText behavior. Restricted select to parent breadcrumbs. Removed guidance for unsupported title props.
- Corrected the claim that ReactElement<Props> restricts the JSX component. It does not.
- Replaced the stale test setup instructions using the current shared renderer, and removed guidance that would preserve tests solely for deleted decorations.
- Rebuilt the inventory from current imports. Removed already-migrated wrappers from the backlog and replaced fixed importer-count rules with inspection of remaining navigation needs.
- Sources for these corrections: the current breadcrumb item implementations, TopBar, Settings BreadcrumbDropdown, EditableIssueViewHeader, secondary navigation badge definitions, and the default React Testing Library renderer.
- Trigger checks: "migrate breadcrumbs", "replace sentry/components/breadcrumbs", and "preserve page filters during breadcrumb migration" should activate the skill. "Inspect event breadcrumbs", "add a CMDK group", and "redesign Settings routing" should not.
- Other skill references to breadcrumbs were checked. Container-query guidance remains valid; CMDK breadcrumb terminology and backend telemetry breadcrumbs are unrelated to this API.

## Maintenance

- Update the API map and examples when the title/item unions, action shapes, or public TopBar props change.
- Recheck the test renderer before prescribing providers or outlets.
- Rebuild the importer inventory after migrations; do not use a hard-coded count as a completion or deletion condition.
- Retire this migration skill only when the remaining references no longer include page-navigation work and required separate navigation landmarks are preserved.

- Restricted the breadcrumbs slot to typed `items` and `title`; removed arbitrary children. Migrated Settings route links and menus to the shared list, and documented external links and linked parent selectors.
