# Scraps Review Sources

## Inventory

| Source                                     | Trust                  | Contribution                                                                                    |
| ------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                | authoritative          | Sentry review, testing, security, and skill guidance                                            |
| `.agents/skills/skill-writer/`             | authoritative          | script-backed layout, argument handling, portability, specification, and validation conventions |
| `.agents/skills/triage-frontend-issues/`   | strong prior art       | classify-plan-confirm-mutate safety boundary                                                    |
| `.agents/skills/gh-review-requests/`       | prior art              | `gh`-backed JSON helper structure                                                               |
| GitHub REST pull request files API         | authoritative external | canonical filenames, rename metadata, patch, and changed-line counts                            |
| GitHub GraphQL `markFileAsViewed` mutation | authoritative external | viewed-state mutation and variable types                                                        |
| `getsentry/sentry` PR 124573               | representative example | large Scraps migration classification baseline                                                  |

## Decisions

| Decision                                       | Status   | Reason                                                                                       |
| ---------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| Keep the `scraps-review` name                  | adopted  | implementation is specific to Scraps paths and migration patterns                            |
| Restrict execution to `getsentry/sentry`       | adopted  | known-noise and destination rules are repository-specific                                    |
| Use structured GitHub file metadata            | adopted  | avoids parsing quoted `diff --git` paths and exposes rename/change metadata                  |
| Classify before requesting mutation approval   | adopted  | prevents implicit skill activation from changing reviewer state                              |
| Bind approval to the head SHA and noise set    | adopted  | rerunning after approval must not act on new PR changes                                      |
| Fail closed on unavailable patches             | adopted  | ambiguous files must remain reviewable                                                       |
| Parse JavaScript or TypeScript with a compiler | deferred | normalized static module declarations cover the current migration shape with less complexity |
| Support arbitrary design-system migrations     | rejected | the current rules would be unsafe outside Scraps component moves                             |

## Coverage

| Area                                    | Status                           |
| --------------------------------------- | -------------------------------- |
| static import module-path changes       | covered                          |
| side-effect import module-path changes  | covered                          |
| static re-export module-path changes    | covered                          |
| semantic binding changes                | covered                          |
| multiple destination components         | covered                          |
| pure renames and unavailable patches    | covered                          |
| PR-controlled GraphQL values            | covered                          |
| partial mutation failures               | covered with mocked subprocesses |
| stale approval and truncated file lists | covered                          |
| dynamic imports                         | intentionally substantive        |
| live GitHub mutation                    | intentionally not tested         |

## Changelog

- 2026-09-16: Created the source record for the initial skill and narrowed it to large `getsentry/sentry` Scraps migrations.
