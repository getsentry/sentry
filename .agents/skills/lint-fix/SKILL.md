---
name: lint-fix
description: Fix existing violations of a custom oxlint rule from eslintPluginSentry or eslintPluginScraps. Use when asked to "fix lint violations" or "fix the suppression backlog".
---

Fix violations of rule `$0` on files matching `$1`.

## Arguments

- `$0`: full rule key, e.g. `@sentry/scraps/no-manual-table` or `@sentry/prefer-nuqs`
- `$1`: repository-relative path prefix, e.g. `static/app/views/alerts/`

If `$0` is empty, ask for the rule. If `$1` is empty, the scope is the whole repository: the commands below then lint and list every file.

Linting runs through `pnpm run lint:js`, which always applies the committed config and rejects rule overrides (`-A`, `-W`, `-D`, `--config`). To find a rule's violations, the rule has to be in the config.

## Step 1: Find Where the Rule Stands

Search for `$0` in `oxlint.config.ts`, `oxlint.base.ts`, and the package configs in `static/packages/*/oxlint.config.ts`. Configs can pull rules in through spread constants from `oxlint.base.ts`: `incubator` enables `@sentry/prefer-fake-timers` and `@sentry/require-fake-timer-cleanup` only through `...fakeTimerRules`. If `$0` only turns up in such a constant, check whether that constant is spread into `incubator`.

| Where the rule is                                                                                      | Its violations                                                                                    | Next                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `incubator` at the top of `oxlint.config.ts`: in `incubator.rules` or enabled in `incubator.overrides` | Capped per file in `oxlint-suppressions.json` (`static/app/`, `static/gsApp/`, `static/gsAdmin/`) | Step 2                                                                                        |
| In no config (only in the plugin's `index`)                                                            | Unreported                                                                                        | Register it first; see below.                                                                 |
| Anywhere else (`base`, top-level `rules`, overrides)                                                   | No existing backlog: `pnpm run lint:js` fails CI on every violation                               | Fix any new violations on your branch (Step 3, regular rule); there is no backlog to clean up |

To register an unconfigured rule, count its violations first: enable it in top-level `rules` in `oxlint.config.ts` and run `pnpm run lint:js`, which prints the total. Then follow Step 3 of the `lint-new` skill:

- Few enough to fix in this PR: keep it as a regular rule.
- More than that: move it to `incubator` and enroll it (Step 4 of `lint-new`, `pnpm run lint:suppressions --enroll --base origin/master`).

## Step 2: Understand the Fix

The rule's error message names the replacement. For anything it leaves open, read the rule source and the `valid` cases in its spec. The plugin index imports each rule from its source file, usually `<camelName>.ts` next to `<camelName>.spec.ts` (some rules share a file, e.g. `emotionRules.ts`):

- Scraps: `static/oxlint/eslintPluginScraps/src/rules/index.ts`
- Sentry: `static/oxlint/eslintPluginSentry/index.ts`

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

A regular rule fails CI on every violation, so it must end up clean across the whole repository, not just under `$1`.

## Step 4: Choose a Strategy

| Violations in scope | Strategy                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any, autofixable    | `pnpm run lint:js --fix $1`. This applies every autofixable rule on those files, not only `$0`, so review the diff. Fix whatever it leaves by hand. |
| Under 100           | Fix by hand, 5-10 files at a time, re-listing after each batch                                                                                      |
| 100-500             | Split `$1` into subdirectories and fix one per batch or PR                                                                                          |
| 500+                | A throwaway codemod for mechanical transforms, or several PRs split by owner while the rule stays in the incubator                                  |

## Step 5: Lower the Budgets

Only for incubator rules. Once violations are fixed, the budgets for those files are stale, and `pnpm run lint:suppressions --ci --base <ref>` fails CI on stale budgets your change made. Lower them:

```bash
pnpm run lint:suppressions --prune
```

Commit the updated `oxlint-suppressions.json` files. A successful `pnpm run lint:js --fix <paths>` already lowers budgets for the files it checked, but run `--prune` anyway before you commit.

## Step 6: Graduate the Rule

Only when the backlog for `$0` is empty everywhere, not just under `$1`:

1. Move every entry for `$0` out of `incubator` into the regular config (where it goes follows the `lint-new` skill's Step 3 table):
   - An entry in `incubator.rules` moves to the regular config.
   - An enabled entry in `incubator.overrides` moves to a regular `overrides` entry with the same `files`. For example, `@sentry/prefer-fake-timers` and `@sentry/require-fake-timer-cleanup` are enabled only through `fakeTimerRules` in the test-files override. Test-only rules go in `testOverride` in `oxlint.base.ts`.
   - An `off` entry in `incubator.overrides` moves to a matching regular `overrides` entry.

   The rule leaves the incubator only when no enabled entry for it remains anywhere in `incubator`.

2. Run `pnpm run lint:suppressions --prune`; it drops the rule's remaining budget entries.

## Verify

Done when all of these pass:

```bash
pnpm run lint:js $1
pnpm run typecheck
.venv/bin/prek run -q --files <changed files>
```

For an incubator rule, also:

```bash
pnpm run lint:suppressions --ci --base origin/master            # without --base, stale budgets only warn
pnpm run lint:suppressions --backlog --rule $0 | grep -c '^$1'   # 0
```

For a regular rule, or after graduating the rule, run `pnpm run lint:js` with no path. `--backlog --rule` only accepts incubator rules.

## Coordinating Large Changes

- Split PRs to **~50 changed files**, grouped by owner in `.github/CODEOWNERS`.
- PR title: `fix(lint): Fix $0 violations for <owner>`.
- Each PR carries its own pruned `oxlint-suppressions.json` changes.
