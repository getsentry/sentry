---
name: remove-option-or-flag
description: Remove a Sentry option or FlagPole feature flag whose rollout is finished, in the correct PR order across sentry, getsentry, and sentry-options-automator. Use when deleting an option from defaults.py, removing a flag from temporary.py, cleaning up a flag that reached 100%, unsetting a value in the options automator, or diagnosing an automator run that reports an unregistered option. Trigger on "remove this feature flag", "delete this option", "clean up the flag", "the flag is fully rolled out", "deprecate an option", "unregistered option", "options drift on main".
---

# Remove a Sentry Option or Feature Flag

Removal takes **three PRs in a fixed order**, each deployed — not merely merged — before the next one merges. sentry and getsentry roll out region-by-region via GoCD; the automator runs its own pipeline. Wrong order either flips production behavior or turns the automator red on `main` for everyone.

FlagPole flags follow the same order for the same reason: registering a flag auto-registers an option `feature.<flag-name>` with `FLAG_AUTOMATOR_MODIFIABLE` ([manager.py](https://github.com/getsentry/sentry/blob/master/src/sentry/features/manager.py)), so flags travel the identical `configoptions` path as options.

## Order

| #   | Repo                     | Change                                                              | Merge only after                     |
| --- | ------------------------ | ------------------------------------------------------------------- | ------------------------------------ |
| 1   | sentry / getsentry       | Collapse every read to the outcome that won; delete the dead branch | —                                    |
| 2   | sentry-options-automator | Remove the value / flag block from YAML                             | step 1 deployed to **all** regions   |
| 3   | sentry                   | Remove the registration (`defaults.py` / `temporary.py`)            | step 2 deployed, automator run green |

Step 1 is usually **two PRs** when a flag is read in both `static/` and `src/` — frontend and backend are not atomically deployed. That is the repo-wide rule in AGENTS.md, not an options-specific one; "step 1 deployed" therefore means both PRs are out.

## Step 0 — preconditions

| Check                         | Command / location                                                        | What it means                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Is it automator-managed?      | Option has `FLAG_AUTOMATOR_MODIFIABLE` in `defaults.py`; flags always are | Options with `FLAG_PRIORITIZE_DISK` or without `FLAG_AUTOMATOR_MODIFIABLE` come from ops config, not this workflow |
| Should it be deleted at all?  | A flag gating a plan/tier entitlement is permanent                        | Move `manager.add(...)` from `temporary.py` to `permanent.py`; keep the automator entry                            |
| Where is it read?             | `rg -n '<name>' src/ static/ tests/` in sentry **and** getsentry          | Every hit is step-1 work, including `with self.feature(...)` in tests                                              |
| Where is it set, and to what? | Automator **at HEAD**: `rg -n '<name>' options/`                          | Every hit is step-2 work; together they are the outcome step 1 collapses to                                        |

## Step 1 — collapse the call sites

Read the value from automator `main` at HEAD — not from the rollout PR, the ticket, or the registered default; it may have moved since.

**Stop and ask the user** if either holds. Report the values you found and let them decide — do not pick a value and proceed:

- **Regions disagree.** `options/default/` and the region files hold different values, so there is no single rolled-out outcome to collapse to. Which one wins, or whether the option should stay, is a product decision.
- **The option is drifted** (`[DRIFT]` in the automator run). The live value differs from the file, so the file is not the truth. Someone changed it through another channel, and the why matters before anything is deleted.

Otherwise collapse each call site to the outcome that won. Do not leave the value behind as an `if True` or a lone constant — that is the dead code the flag was supposed to retire. Two safe variants:

- **Collapse the branch** (default). Delete the `options.get(...)` / `features.has(...)` / `organization.features.includes(...)` condition, keep the branch that won, delete the branch that lost.
- **Move the value into the registered default first.** Change `default=` in `defaults.py` to the rolled-out value and deploy that before step 2, then collapse the call sites. Use when the option must stay readable during a longer transition.

Doing neither is the common mistake: step 2 then changes production behavior.

### Sweep what the collapse orphans

The losing branch is rarely the only thing that dies. Delete:

- functions, components, serializers, and hooks reached only from the losing branch
- tests for the old path, plus `with self.feature(...)` blocks and mocked responses that now assert nothing
- fixtures, analytics events, styles, and types used only by the old path
- feature-gated route entries and navigation items

The gate for step 2 is only that **no read of the option remains**. If the sweep is large, land the collapse first and the deletions right behind it — a follow-up PR that touches no reads does not affect the ordering.

## Step 2 — remove the value from the automator

What removal actually falls back to:

| Kind          | Falls back to                                                                                                                              | Risk if usage still exists                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Option        | registered default in `src/sentry/options/defaults.py`                                                                                     | prod reverts to the pre-rollout default              |
| FlagPole flag | auto-registered `{}` → FlagPole abstains → `settings.SENTRY_FEATURES[name]`, i.e. the `default=` kwarg on `manager.add` (normally `False`) | **flag turns off for everyone**, not "stays at 100%" |

Check every file that sets it:

- Options: `options/default/<file>.yaml` **and every** `options/regions/*/<file>.yaml`. Region values clobber the default, so a leftover region entry keeps the option set there and breaks step 3.
- Flags: only `options/default/flagpole.yaml`. There are no per-region flagpole files.
- Watch for a `default=True` on the flag registration — that keeps it on after the YAML is gone.

Merge, then confirm the deploy is green in `#feed-options-automator` before step 3.

## Step 3 — remove the registration

Delete the `options.register(...)` line from `defaults.py`, or the `manager.add(...)` line from `temporary.py`. For an `api_expose=True` flag this also drops it from the org serializer's `features` array, so any surviving frontend check silently evaluates false rather than erroring — which is why step 1's frontend PR must already be deployed.

## Failure modes

| Symptom                                                                                 | Cause                                                                                                                                    | Fix                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[ERROR] ... unregistered` in automator CI; `options-drift` job red on automator `main` | registration removed while values still in the automator                                                                                 | land the step-2 removal; `Trigger: Override Options Validation` unblocks an unrelated PR meanwhile, but it bypasses the gate — ask the user first |
| Value stuck in `sentry_option` with no way to unset                                     | same inversion — `configoptions sync` only iterates _registered_ `FLAG_AUTOMATOR_MODIFIABLE` options, so nothing can ever delete the row | re-register the option, let the automator unset it, then remove the registration                                                                  |
| Behavior flipped right after the automator PR                                           | step 2 landed before step 1 finished deploying everywhere                                                                                | revert the automator PR — `Trigger: Revert` label                                                                                                 |
| Automator PR CI green but `main` red after merge                                        | the PR check only fails on errors _new_ vs. its base; the push-to-`main` drift job fails on any error                                    | fix the pre-existing error, or land the missing step                                                                                              |
