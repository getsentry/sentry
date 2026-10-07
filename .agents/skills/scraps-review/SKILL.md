---
name: scraps-review
description: Filter large Sentry Scraps design-system migration PRs for review by separating mechanical import-path changes, generated baseline updates, snapshot mocks, and pure renames from substantive destination-component and logic changes. Use when asked to review a large "ref(scraps)" PR, a "move component into Scraps" PR, or to filter Scraps migration noise. Do not use for general refactors or migrations outside getsentry/sentry.
allowed-tools: Bash
disable-model-invocation: true
argument-hint: '[getsentry/sentry PR number or URL]'
---

# Scraps Review

Classify files in a large `getsentry/sentry` Scraps migration, confirm the proposed noise set with the user, mark the approved files as viewed, and report the substantive files left to review.

This skill uses Claude-specific invocation metadata and `$ARGUMENTS`; invoke it manually on other Agent Skills hosts.

**Requires**: authenticated `gh` and `uv` CLIs.

## 1. Resolve the PR

Accept a `getsentry/sentry` PR number or full URL from `$ARGUMENTS`. With no argument, the script resolves the pull request for the current branch. Ask for a PR only if that lookup fails.

Do not run this workflow against another repository or a PR that is not a large Scraps design-system migration.

## 2. Classify without mutation

Run from this skill directory so bundled paths remain skill-root-relative:

```bash
uv run scripts/classify_pr_files.py [<pr>]
```

The non-interactive script emits JSON to stdout and exits nonzero on fatal or partial mutation failure. It does not modify GitHub state unless `--mark-viewed` is explicitly supplied.

Successful and partial results use this shape:

```json
{
  "status": "success",
  "repository": "getsentry/sentry",
  "pr": 12345,
  "head_sha": "abc123...",
  "approval_token": "def456...",
  "summary": {
    "total": 139,
    "noise": 128,
    "substantive": 11,
    "marked_viewed": 0,
    "failed_to_mark": 0
  },
  "substantive": [{"path": "...", "classification": "substantive", "reason": "..."}],
  "noise": [{"path": "...", "classification": "noise", "reason": "..."}],
  "failed_to_mark": []
}
```

Fatal failures emit `{"status": "error", "error": "..."}` and exit nonzero. The script does not emit progress output or expose `gh` stderr.

Classification reasons:

| Reason                    | Classification | Meaning                                                              |
| ------------------------- | -------------- | -------------------------------------------------------------------- |
| `import-path-only`        | noise          | import or re-export declarations differ only by module path          |
| `known-noise-file`        | noise          | generated codeowners baseline or snapshot mock                       |
| `pure-rename`             | noise          | GitHub reports a rename with zero changed lines                      |
| `destination-dir`         | substantive    | file is in a component directory being moved into `components/core/` |
| `patch-unavailable`       | substantive    | GitHub omitted the patch, so the script fails closed                 |
| `has-substantive-changes` | substantive    | changes are not a recognized mechanical migration                    |

## 3. Confirm the mutation

Show the user the noise files and substantive files with their reasons and the count summary. Retain the `approval_token`, then ask whether to mark that exact proposed noise set as viewed.

Do not run the mutation command until the user explicitly approves the displayed set. Approval applies only to that classification result.

## 4. Mark the approved files

After approval, rerun the same PR with:

```bash
uv run scripts/classify_pr_files.py [<pr>] --mark-viewed --approval-token <token>
```

The token binds approval to the PR head SHA and exact noise-path set. If the PR or classification changed, stop and show the new classification for fresh approval. The mutation uses GraphQL variables for PR-controlled paths and is idempotent: marking an already viewed file leaves it viewed.

If `status` is `partial`, report every path in `failed_to_mark`; do not claim the batch succeeded. Rerun only after resolving the reported GitHub CLI or permission failure.

## 5. Report

Show the substantive files as a table with the reason column. End with the total, noise, substantive, marked, and failed counts.

Do not perform the substantive code review unless the user also asks for it.

## Fallback

If classification fails, use `gh pr diff <pr> --repo getsentry/sentry` to classify files manually with the table above. Treat ambiguous files as substantive.

If marking fails, leave the files unmodified and report the failure. Do not construct an inline GraphQL mutation or interpolate a filename into a shell command.
