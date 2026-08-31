# Sources

Captured 2026-08-12.

## Authoritative

| Source                                                                         | Supports                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `getsentry/sentry-options-automator` `README.md` → "Deleting an Option"        | the three-step order; `Trigger: Revert` label; automator-as-source-of-truth                                                         |
| `src/sentry/runner/commands/configoptions.py` → `_validate_options`            | unregistered option raises `UnknownOption`, is reported and returns exit 2                                                          |
| `src/sentry/runner/commands/configoptions.py` → `sync`                         | iterates `options.filter(FLAG_AUTOMATOR_MODIFIABLE)` only — deregistered options leave orphaned `sentry_option` rows                |
| `src/sentry/runner/commands/configoptions.py` → `_attempt_update`              | the "set to current default, then change the default" pattern behind step 1's second variant                                        |
| `src/sentry/features/manager.py` → `FeatureManager.add`                        | FLAGPOLE features auto-register `feature.<name>` with default `{}` and `FLAG_AUTOMATOR_MODIFIABLE`                                  |
| `src/sentry/features/manager.py` → `FeatureManager.has`                        | fallback chain ending at `settings.SENTRY_FEATURES[name]`, set from the `default=` kwarg                                            |
| `getsentry/sentry-options-automator` `.github/workflows/sentry-validation.yml` | PR check compares base-vs-PR errors; `options-drift` job hard-fails on push to `main`; `Trigger: Override Options Validation` label |
| `getsentry/sentry-options-automator` repo tree                                 | `options/default/flagpole.yaml` is the only flagpole file; options are split across `options/default/` and `options/regions/*/`     |

## Decisions

- Single inline `SKILL.md`, no `references/` — one ordered procedure with a small failure matrix; splitting it would add lookups without adding branches.
- Mechanism included alongside the order. The automator README states the order but not why, and the why is what prevents an agent from "optimizing" the sequence.
- Scoped to the legacy DB-backed options path. The file-based `sentry-options` platform validates values against fetched schemas instead of the in-code registry; folding both into one skill would blur the failure matrix.

## Gaps

- Whether the in-cluster reconcile runs `configoptions sync` or `patch` is inferred from the README's documented unset-on-removal behavior, not read from the deployment manifest. The GoCD script (`gocd/pipelines/sentry-options.sh`) only generates and applies the ConfigMap.
- No worked example of a real removal PR trio; the skill is procedure-only.
