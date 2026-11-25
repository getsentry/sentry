---
name: lint-fix
description: Fix existing violations of a custom oxlint rule from eslintPluginSentry or eslintPluginScraps. Use when asked to "fix lint violations", "roll out a lint rule", "burn down an incubator rule", "fix the suppression backlog", or "enforce a rule codebase-wide".
---

Fix violations of rule `$0` on files matching `$1`.

## Arguments

- `$0`: full rule key, e.g. `@sentry/scraps/no-manual-table` or `@sentry/prefer-nuqs`
- `$1`: repository-relative path prefix, e.g. `static/app/views/alerts/`

Linting runs through `pnpm run lint:js`, which always applies the committed config and rejects rule overrides (`-A`, `-W`, `-D`, `--config`). To find a rule's violations, the rule has to be in the config.

## Step 1: Find Where the Rule Stands

Search for `$0` in `oxlint.config.ts` and `oxlint.base.ts`:

| Where the rule is                                    | Its violations                                                                                    | Next                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `incubator` at the top of `oxlint.config.ts`         | Capped per file in `oxlint-suppressions.json` (`static/app/`, `static/gsApp/`, `static/gsAdmin/`) | Step 2                                                                                                                                                                          |
| Not in either config (only in the plugin's `index`)  | Unreported                                                                                        | Register it first, following Step 3 of the `lint-new` skill. More violations than this PR will fix → incubator and enroll. Few enough to fix now → enable it as a regular rule. |
| Anywhere else (`base`, top-level `rules`, overrides) | None: `pnpm run lint:js` already fails CI on them                                                 | Nothing to fix                                                                                                                                                                  |

## Step 2: Understand the Fix

The rule's error message names the replacement. For anything it leaves open, read the rule source and the `valid` cases in its spec:

- Scraps: `static/oxlint/eslintPluginScraps/src/rules/<camelName>.ts` and `<camelName>.spec.ts`
- Sentry: `static/oxlint/eslintPluginSentry/<camelName>.ts` and `<camelName>.spec.ts`

[references/fix-patterns.md](references/fix-patterns.md) has worked fixes for some Scraps rules. For `use-semantic-token`, you MUST load [references/token-taxonomy.md](references/token-taxonomy.md).

The rule is autofixable when its `meta` sets `fixable`.

## Step 3: List the Violations

**Incubator rule.** `pnpm run lint:js` hides violations the budgets cover, so list them with the backlog instead:

```bash
pnpm run lint:suppressions --backlog --rule $0 | grep '^$1'     # file:line:col rule message
pnpm run lint:suppressions --backlog --rule $0 | grep -c '^$1'  # count
```

The backlog takes no path and scans the whole repository (about 30 seconds), so filter its output. Narrow to one file with `--file <path>`, or get JSON with `--json`.

**Regular rule** (just enabled for a small fix):

```bash
pnpm run lint:js $1
```

## Step 4: Choose a Strategy

| Violations in scope | Strategy                                                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any, autofixable    | `pnpm run lint:js --fix $1`. This applies every autofixable rule on those files, not only `$0`, so review the diff. Fix whatever it leaves by hand.                                     |
| Under 100           | Fix by hand, 5-10 files at a time, re-listing after each batch                                                                                                                          |
| 100-500             | Split `$1` into subdirectories and fix one per batch or PR                                                                                                                              |
| 500+                | A throwaway codemod for mechanical transforms (`oxc-parser` from the repo root parses to the AST oxlint rules see), or several PRs split by owner while the rule stays in the incubator |

## Step 5: Lower the Budgets

Only for incubator rules. Once violations are fixed, the budgets for those files are stale, and `pnpm run lint:suppressions --ci` fails CI on stale budgets your change made. Lower them:

```bash
pnpm run lint:suppressions --prune
```

Commit the updated `oxlint-suppressions.json` files. A successful `pnpm run lint:js --fix <paths>` already lowers budgets for the files it checked, but run `--prune` anyway before you commit.

## Step 6: Graduate the Rule

Only when the backlog for `$0` is empty everywhere, not just under `$1`:

1. Move `$0` out of `incubator.rules` into the regular config (where follows the `lint-new` skill's Step 3 table). Move any `off` entries for it in `incubator.overrides` to matching regular `overrides`.
2. Run `pnpm run lint:suppressions --prune`; it drops the rule's remaining budget entries.

## Verify

Done when all of these pass:

```bash
pnpm run lint:js $1
pnpm run lint:suppressions --ci                                   # incubator rules
pnpm run lint:suppressions --backlog --rule $0 | grep -c '^$1'     # 0
pnpm run typecheck
```

## Coordinating Large Changes

- Split PRs to **~50 changed files**, grouped by owner in `.github/CODEOWNERS`.
- PR title: `fix(lint): Fix $0 violations for <owner>`.
- Each PR carries its own pruned `oxlint-suppressions.json` changes.
