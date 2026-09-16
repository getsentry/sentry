---
name: scraps-review
description: Filter scraps migration PRs for review by classifying files as noise (import-only, pure renames, codeowners baseline, snapshot mocks) vs substantive, marking noise as viewed on GitHub, and reporting what's left. Use when reviewing a "move X into scraps" PR, "ref(scraps)" PR, scraps migration, or any PR with bulk import path changes. Trigger on "review scraps PR", "filter scraps noise", "mark imports as viewed", "scraps migration review".
allowed-tools: Bash
---

# Scraps Review

Classify files in a scraps migration PR as noise or substantive, mark noise as viewed on GitHub, and report substantive files for review.

**Requires**: `gh` CLI authenticated, `uv` for script execution.

## Step 1: Identify the PR

Accept a PR number or full GitHub URL from `$ARGUMENTS` or ask:

> Which PR should I review? (number or URL)

## Step 2: Classify and mark

```bash
uv run .agents/skills/scraps-review/scripts/classify_pr_files.py <pr> --mark-viewed
```

If the PR is in a different repo, pass `--repo owner/repo` or let the script extract it from the URL.

### Script output

```json
{
  "summary": {
    "total": 139,
    "noise": 128,
    "substantive": 11,
    "marked_viewed": 128
  },
  "substantive": [
    {
      "path": "static/app/components/core/dropdownMenu/index.tsx",
      "classification": "substantive",
      "reason": "destination-dir"
    }
  ],
  "noise": [
    {
      "path": "static/app/components/actions/archive.tsx",
      "classification": "noise",
      "reason": "import-only"
    }
  ]
}
```

Classification reasons:

| Reason                    | Meaning                                        |
| ------------------------- | ---------------------------------------------- |
| `import-only`             | all hunks are import path swaps or blank lines |
| `known-noise-file`        | codeowners baseline, snapshot mocks            |
| `destination-dir`         | inside the `components/core/` target directory |
| `pure-rename`             | git rename with no content diff                |
| `has-substantive-changes` | real logic changes beyond imports              |

## Step 3: Report

Show the substantive files as a table with the reason column. End with the count summary.

| File                                                   | Reason                  |
| ------------------------------------------------------ | ----------------------- |
| `static/app/components/core/dropdownMenu/index.tsx`    | destination-dir         |
| `static/app/components/dropdownMenu/index.stories.tsx` | has-substantive-changes |

## Fallback

If the script fails, classify manually:

1. `gh pr diff <pr> --repo getsentry/sentry` to get the diff.
2. For each file, check whether all added/removed lines are import statements.
3. Files inside the `components/core/` destination directory are always substantive.
4. Get the PR node ID with `gh pr view <pr> --repo getsentry/sentry --json id --jq .id`.
5. Mark noise via GraphQL: `gh api graphql -f query='mutation { markFileAsViewed(input: {pullRequestId: "<id>", path: "<path>"}) { pullRequest { id } } }'`
