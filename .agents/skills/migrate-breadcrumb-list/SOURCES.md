# Sources

## Authoritative

- `components/core/breadcrumbList/` — authoritative for the item unions and every prop. The types win over the story.
- `components/core/breadcrumbList/breadcrumbList.mdx` — authoritative for composition and editorial rules (copy-vs-menu, always-present pagination).
- `views/navigation/topBar.tsx` — slot names, and the `<Heading as="h1">` that makes the title outlet the page heading.
- Reference migrations: getsentry/sentry#120729 (conversations), #120794 (trace view), #123128 (transaction summary), #121282 (dashboards actions), #123569 (replay actions). #122697 removed the migration flag; the earlier PRs' flag forks are dead patterns.
- Ten already-migrated call sites in `static/app/views/`, enumerated in `SKILL.md`.

## Decisions

- **Guidance is inline, not a component prop.** A `pageFilters` prop on `BreadcrumbItemLinkProps` was designed and rejected: four real call sites cannot express themselves in an enum (whole-query-minus-N keys, inheriting from an `EventView`, and a drawer-tab crumb that is not page navigation), and an escape hatch would defeat the forcing function. A `pageFilterQuery` helper was also built and dropped — at the converted call site its diff was equivalent to the spread it replaced.
- **Page-filter policy is treated as settled.** Whether a given crumb _should_ carry filters is a product decision. The skill teaches how to replicate existing behaviour, not how to choose.
- **`references/evidence/` was not created.** The two cold runs below are summarised here instead; their findings are already promoted into rules, and the skill has a defined end of life.

## Iteration

Two cold runs, each a fresh agent given only the skill and one target file, in an isolated worktree.

| Run | Target                                             | Shape | Cost                              | Surfaced                                                                                                                                                                     |
| --- | -------------------------------------------------- | ----- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `explore/releases/detail/header/releaseHeader.tsx` | A1    | 13 tool calls, 4 on the spec      | The `disableLink` trap; a checklist grep that flagged its own recommended fix; `LinkButton` rendering `<a role="button">`; a fixture field gating an action out of existence |
| 2   | `insights/crons/components/monitorHeader.tsx`      | B     | 22 tool calls, ~14 on orientation | Step 6 producing an empty bordered strip; Shape B/C ambiguity; the page-filter example leading with an override; a missing `ProjectsStore` import path                       |

Deltas applied: Shape A split into A1/A2; Shape E added; `disableLink` promoted to a checklist item; the checklist rewritten as greps; the page-filter example reordered to show pass-through first; `call-site-inventory.md` made a conditional read.

Run 2 also found a regression introduced by run 1's fix — the step 6 "add as sibling" branch, added because run 1 read the instruction as unconditional, was wrong for a wrapper left holding only slots.

## Gaps

- No cold run against Shape C, the hardest shape (`explore/components/breadcrumb.tsx`, four consumers with branch-dependent titles).
- The overflow collapse cannot be tested in jsdom, so no run has exercised it.
- Reachability, not file counts, determines whether a call-site inconsistency is user-visible; the inventory records shapes but not reachability.
- Choosing the title on a Shape B or Shape C page is a judgement the skill can frame but not decide — it supplies a priority order and answer keys, not a rule.
- `select-projects` has no production consumer, so its guidance is untested by use.

## Maintenance

- Update `SKILL.md` when the item unions gain or lose a type, when a TopBar slot is added or renamed, or when a shape category stops matching what is left in the tree.
- Delete the `preservePageFilters` section once no legacy importer still passes the prop: `grep -rln "preservePageFilters: true" static/app --include='*.tsx'`.
- Prune `references/call-site-inventory.md` as rows land. **When it empties and the legacy-importer count reaches 4, delete this skill** — it exists to retire a migration, and outliving that migration is how it rots.
