---
name: lint-fix
description: Fix violations of an eslintPluginScraps rule across the codebase. Use when asked to "fix lint violations", "apply a lint rule", "fix scraps rule errors", "roll out a lint rule", "enforce a rule codebase-wide", or "fix design system lint". Covers manual fixes, autofix, batching, and codemod strategies for large-scale rollouts.
---

Fix violations of rule `$0` on files matching `$1`.

## Arguments

- `$0` — Rule name (e.g., `use-semantic-token`, `no-core-import`)
- `$1` — File or glob pattern (e.g., `static/app/components/`, `static/app/views/alerts/`)

## Step 1: Understand the Rule

Before fixing violations, know what the fix looks like. Load [references/fix-patterns.md](references/fix-patterns.md) for per-rule fix details:

| Rule                         | Has autofix? | Fix reference                                                                                     |
| ---------------------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| `no-core-import`             | Yes          | [fix-patterns.md](references/fix-patterns.md) §no-core-import                                     |
| `no-token-import`            | No           | [fix-patterns.md](references/fix-patterns.md) §no-token-import                                    |
| `use-semantic-token`         | No           | [fix-patterns.md](references/fix-patterns.md) + [token-taxonomy.md](references/token-taxonomy.md) |
| `restrict-jsx-slot-children` | No           | [fix-patterns.md](references/fix-patterns.md) §restrict-jsx-slot-children                         |

For `use-semantic-token` violations, you MUST load [references/token-taxonomy.md](references/token-taxonomy.md) to know which token category to use for each CSS property.

## Step 2: Assess Scale

Count violations before choosing a strategy:

```bash
pnpm exec eslint --rule '@sentry/scraps/$0: error' "$1" 2>&1 | tail -5
```

The last line shows the count (e.g., "42 problems (42 errors, 0 warnings)").

**Tip**: Running eslint on all of `static/app/` can take 2+ minutes. Narrow scope to a subdirectory first.

## Step 3: Choose Strategy

### Auto-fixable rule (any scale)

```bash
pnpm exec eslint --fix --rule '@sentry/scraps/$0: error' "$1"
```

Always review the diff after `--fix` before committing. If the rule is partially auto-fixable, run `--fix` first, then manually fix remaining violations.

### Under 100 violations — manual agent fix

1. Run eslint on target path
2. Fix violations 5-10 files at a time
3. Re-run after each batch to verify
4. Repeat until clean

### 100-500 violations — batched fix

1. Split target into subdirectories (e.g., `static/app/views/`, `static/app/components/`)
2. Fix one subdirectory at a time
3. Commit after each batch for reviewable PRs
4. Re-run count after each batch to track progress

### 500+ violations — codemod or staged rollout

- **Mechanical transforms**: write a temporary jscodeshift codemod or a targeted script using `@typescript-eslint/typescript-estree`
- **Import-path rules**: `--fix` usually handles these at any scale
- **Complex transforms**: enable the rule as `warn` first, fix in batches across multiple PRs

## Fix Workflow (tight loop)

1. Run: `pnpm exec eslint --rule '@sentry/scraps/$0: error' "$1"`
2. Fix violations in reported files
3. Re-run on changed files to verify
4. Expand scope, repeat

## Coordinating Large Changes

- Split PRs to **~50 changed files** based on ownership rules in @.github/CODEOWNERS.
- PR title convention: `fix(lint): enforce @sentry/scraps/$0 for <codeowner>`
- If the rule is new and not yet in `eslint.config.ts`, **fix all violations first**, then enable the rule in a follow-up PR
- Run pre-commit on changed files before committing:
  ```bash
  .venv/bin/pre-commit run --files <file1> [file2 ...]
  ```

## Verification

After all fixes:

```bash
pnpm exec eslint --rule '@sentry/scraps/$0: error' static/app/ 2>&1 | tail -5
```

Should report 0 problems.
