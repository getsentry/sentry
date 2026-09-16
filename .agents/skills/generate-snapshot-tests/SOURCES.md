# Generate Snapshot Tests Sources

## Source Inventory

| Source                                                                                   | Trust                    | Contribution                                                                   | Constraints                                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `tests/js/sentry-test/snapshots/snapshot-framework.ts`                                   | Authoritative            | `it.snapshot`, `.each`, options, automatic scenario expansion                  | Current branch API                                                                           |
| `tests/js/sentry-test/snapshots/snapshotScenarios.ts` and `snapshotScenarios.spec.ts`    | Authoritative            | Automatic themes, default `3xl`, container crossing, exact normalized features | Current branch API and tests                                                                 |
| `tests/js/sentry-test/snapshots/snapshotProviders.tsx`                                   | Authoritative            | Automatic ThemeProvider and OrganizationContext                                | Current branch implementation                                                                |
| `tests/js/sentry-test/snapshots/snapshotContainer.tsx`                                   | Authoritative            | Query width, capture bounds, and automatic gutter                              | Current branch implementation                                                                |
| `tests/js/sentry-test/snapshots/snapshot.ts` and `snapshot-setup.ts`                     | Authoritative            | SSR-to-Playwright pipeline, interaction behavior, shims, no-hydration boundary | Current branch implementation                                                                |
| `tests/js/sentry-test/snapshots/snapshotLocator.ts` and `snapshotLocator.spec.ts`        | Authoritative            | Exact semantic locator descriptors and unique-match requirement                | Current branch API and tests                                                                 |
| `tests/js/sentry-test/snapshots/snapshot-image-metadata.ts`                              | Authoritative            | Optional user metadata and generated metadata boundary                         | Current branch types                                                                         |
| `static/app/components/core/alert/alert.snapshots.tsx` and `switch/switch.snapshots.tsx` | Representative           | Compact `.each` and named visual states                                        | Consumer examples, not normative API                                                         |
| `static/app/components/core/chip/chip.snapshots.tsx`                                     | Representative           | Semantic hover and active interactions                                         | Consumer example                                                                             |
| `static/app/views/preprod/snapshots/main/snapshotsToolbar.snapshots.tsx`                 | Representative           | Meaningful containers and render context                                       | Consumer example                                                                             |
| `static/AGENTS.md` and repository `AGENTS.md`                                            | Authoritative convention | Frontend testing, imports, commands, and repository constraints                | Local guidance                                                                               |
| Previous revision of `.agents/skills/generate-snapshot-tests/SKILL.md`                   | Superseded input         | Earlier scenario, SSR, fixture, and anti-pattern coverage                      | Stale manual theme/context, breakpoint, selector, and metadata recipes intentionally omitted |

## Decisions

- **Adopted:** inline-guidance shape; every run needs the same compact workflow and API facts.
- **Adopted:** named visual scenarios, automatic themes/providers, default `3xl`, explicit meaningful containers, exact features, semantic exact locators, `.each`, and minimal SSR mocks.
- **Replaced:** manual ThemeProvider loops, manual OrganizationContext fixtures, breakpoint helpers, raw CSS selector recipes, and metadata-for-naming recipes.
- **Narrowed:** mocks to deterministic SSR boundaries; imports and tags to local-neighbor conventions.
- **Deferred:** no runtime reference files, scripts, eval corpus, or framework changes.

## Coverage

| Area                                 | Evidence                                            | Status  |
| ------------------------------------ | --------------------------------------------------- | ------- |
| Happy path and prop states           | Framework types; Alert and Switch consumers         | Covered |
| Context, feature, and theme behavior | Providers and scenario tests                        | Covered |
| Responsive containers                | Scenario tests and SnapshotsToolbar consumer        | Covered |
| Hover and active interactions        | Locator API/tests and Chip consumer                 | Covered |
| SSR failures and workarounds         | Renderer, setup, and global Tooltip mock            | Covered |
| Migration from prior guidance        | Superseded detailed skill compared with current API | Covered |

## Adaptation And Gaps

The superseded skill intended to make snapshots broad and SSR-safe. This revision preserves scenario analysis, state coverage, and minimal mocking while replacing recipes now owned by the framework. No source text or structure is copied as a runtime template.

No high-impact source gap remains for the current branch. Further retrieval was stopped because framework implementation, types, focused tests, representative consumers, local guidance, and the superseded input cover the requested runtime decisions.
