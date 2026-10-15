# Scraps Review Specification

## Intent

Reduce review noise in large `getsentry/sentry` pull requests that move an existing design-system component into Scraps. Preserve reviewer attention for destination components and any changes that are not provably mechanical.

## Scope

In scope:

- Large `ref(scraps)` pull requests in `getsentry/sentry`.
- Mechanical import and re-export module-path changes.
- Pure Git renames, generated codeowners baseline changes, and snapshot mocks.
- Marking a user-approved noise set as viewed through GitHub.

Out of scope:

- General refactors, dependency migrations, or repositories other than `getsentry/sentry`.
- Deciding that an unavailable or ambiguous patch is noise.
- Reviewing the substantive files unless separately requested.
- Mutating GitHub state without explicit approval of the displayed file set.

## Users And Trigger Context

- Primary users: engineers reviewing large Scraps component migrations.
- Common requests: "review this ref(scraps) PR", "filter the imports in this Scraps migration", and "mark the mechanical files viewed".
- Should not trigger for: ordinary design-system implementation, non-Scraps migrations, small PRs, or general code review.

## Runtime Contract

- Classify without mutation first.
- Treat only structurally matched module-path substitutions and explicit known files as noise.
- Treat destination components, missing patches, malformed metadata, and all ambiguous changes as substantive.
- Display the proposed classification and obtain approval before marking files viewed.
- Bind approval to the PR head SHA and exact noise-path set; reject stale approvals.
- Compare the fetched file count with GitHub's `changedFiles` metadata and reject truncated results.
- Use GraphQL variables for all PR-controlled values.
- Report partial mutation failures by path and exit nonzero.

## Source And Evidence Model

Authoritative sources:

- GitHub pull request file metadata and GraphQL API behavior.
- Current large `ref(scraps)` pull requests in `getsentry/sentry`.
- Repository guidance in `AGENTS.md` and `.agents/skills/skill-writer/`.

Data that must not be stored:

- GitHub credentials or tokens.
- Customer data or identifying customer information.
- Raw private repository content outside the requested PR.

## Reference Architecture

- `SKILL.md` contains the runtime workflow, confirmation boundary, output handling, and fallback.
- `agents/openai.yaml` disables implicit Codex invocation to match the Claude-side mutation policy.
- `scripts/classify_pr_files.py` fetches structured PR file metadata, classifies files, and optionally marks approved noise files viewed.
- `scripts/classify_pr_files_tests.py` contains deterministic classifier and mutation-safety tests.
- `SOURCES.md` records source-backed decisions and known gaps.

## Validation

- Run `uv run scripts/classify_pr_files_tests.py` from the skill directory.
- Run the shared `skill-writer` structural validator against this directory.
- Run the skill scanner and applicable repository lint hooks.
- Exercise read-only classification against a representative large Scraps PR.
- Never use a live mutation as a validation step.

Acceptance gates:

- Semantic import changes remain substantive.
- Path-only imports and re-exports are noise.
- All destination component directories remain substantive.
- Incomplete file lists and PR changes during classification abort without mutation.
- Missing patches and malformed metadata fail closed.
- PR-controlled paths are passed as GraphQL variables, not query or shell syntax.
- Partial mutations are visible by path and produce a nonzero exit status.
- Stale or mismatched approval tokens abort without mutation.

## Known Limitations

- The classifier intentionally supports only `getsentry/sentry` Scraps migrations.
- GitHub can omit patches for large or binary files; those files remain substantive.
- Import classification is line-oriented and recognizes static imports, side-effect imports, and re-exports with literal module paths. Dynamic imports remain substantive.
- Claude and Codex invocation-control metadata is provider-specific; other hosts must invoke the skill manually.
- Known generated files are identified by explicit paths and must be narrowed if those paths begin containing reviewable logic.

## Maintenance Notes

- Update import normalization and tests together when migration formatting changes.
- Add a known-noise path only after confirming the entire path contains mechanical output.
- Keep mutation confirmation and fail-closed behavior non-negotiable.
- Revalidate against recent Scraps migrations when GitHub CLI or API behavior changes.
