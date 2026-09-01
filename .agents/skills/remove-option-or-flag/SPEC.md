# Remove Option or Flag Specification

## Intent

Encode the fixed three-PR order for deleting a Sentry option or FlagPole feature flag once its rollout is finished, and the failure modes that follow from getting the order wrong. The order is not arbitrary: it is forced by `configoptions` validation, by `configoptions sync` only iterating registered options, and by what each kind falls back to when its automator value disappears.

## Scope

In scope:

- Deleting an automator-modifiable option (`src/sentry/options/defaults.py`)
- Deleting a FlagPole feature flag (`src/sentry/features/temporary.py`)
- Collapsing the gated call sites and deleting the code the losing branch reached
- Removing the corresponding values from `sentry-options-automator`
- Diagnosing unregistered-option and drift failures caused by a wrong-order removal

Out of scope:

- Adding an option or flag — use the `feature-flags` skill and the automator README
- Changing a value or rollout percentage (a single automator PR, no ordering constraint)
- Options with `FLAG_PRIORITIZE_DISK` or without `FLAG_AUTOMATOR_MODIFIABLE` — those come from ops config
- The newer `getsentry/sentry-options` platform (`option-values/`, schema-in-service-repo)

## Users And Trigger Context

- Common user requests: "remove this feature flag", "the flag is at 100%, clean it up", "delete this option", "why is the automator complaining about an unregistered option"
- Should not trigger for: registering a new flag, adjusting a rollout, flag checks in tests, Flagr/legacy flag systems

## Runtime Contract

- Required first actions: confirm the option/flag is automator-managed and locate every read (sentry, getsentry, static) and every set (all automator region files)
- Required outputs: an ordered PR plan naming which repo each PR targets and what must be deployed before the next merges
- Non-negotiable constraints: usage removed before value; value removed before registration; deployed, not merged, gates each step; region divergence, drift, and validation-gate overrides are surfaced to the user for a decision, never resolved by the agent
- Expected bundled files loaded at runtime: none — `SKILL.md` is self-contained

## Source And Evidence Model

Authoritative sources: see `SOURCES.md`. The behavioral claims are anchored in sentry source (`configoptions.py`, `features/manager.py`) and automator CI config, not in prose docs, because the prose docs state the order without the mechanism.

Data that must not be stored:

- Region directory names that identify single-tenant customers
- Option values containing credentials

## Validation

- Lightweight: the ordering table and failure matrix match `src/sentry/runner/commands/configoptions.py` (`_validate_options`, `sync`) and `src/sentry/features/manager.py` (`add`)
- Deeper: a real removal lands with a green automator run and no `[DRIFT]`/unregistered entries in `#feed-options-automator`

## Known Limitations

- Covers the legacy DB-backed options path only; the file-based `sentry-options` platform has a different validation surface
- Automator file layout (`options/default/`, `options/regions/`) is verified against `main` as of 2026-08-12 and is not machine-checked here
- Cannot verify deploy completion; the agent must confirm rollout externally

## Maintenance Notes

- Update `SKILL.md` when `configoptions` validation semantics change, when per-region flagpole files appear, or when the automator adds/renames revert or override labels
- Update `SOURCES.md` when a cited file moves or its behavior changes
