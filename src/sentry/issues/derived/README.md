# Derived issue features

This package maintains per-Group derived state (`GroupDerivedData`) via a pipeline of `Feature`s and aggregators (`features.py`, `framework.py`, `aggregators.py`).

Changing a feature or aggregator does **not** update every Group at once. Plan for a window where old and new values coexist.

## Pipeline freshness

- The pipeline’s identity is `pipeline_hash`: the feature set, each feature’s `version`, and `Pipeline._version`.
- `GroupDerivedData` rows whose hash does not match the current pipeline are regenerated automatically eventually.
- Until regeneration finishes, some Groups still hold values from the previous pipeline.

Verify all Groups are on a new enough hash via **TODO**.

## Designing features

Keep stored values small and bounded. Prefer “last N of X” over “all X” so outlier Groups cannot inflate storage or regeneration cost.

## Adding, removing, or changing features

- Add — Safe to read immediately if `default` is correct for existing Groups. If not, ship the feature, but only depend on computed values once relevant rows are on the new hash (see verify above).
- Remove — Safe if nothing still reads the feature.
- Change computation — Bump the feature’s `version` so `pipeline_hash` changes. For non-trivial semantic changes, prefer a new feature and switch consumers over; otherwise production stays mixed (old vs new) until full regeneration. Do not bump `version` for refactors that do not change outputs.

## Writing aggregators

Aggregators must be deterministic: same state and entry always produce the same outputs.

- No I/O (database, network, filesystem, clocks, environment, and similar).
- No randomness.
- Use aggregator-oriented APIs or in-module helpers only. Avoid imports not meant for aggregators; they often smuggle side effects and break determinism.
- Prefer clarity. Also keep common paths fast, especially when `scope` is large (`Scope.ALL` or many entry types). Aggregators must be efficient.

## Corruption policy

Missing JSON keys use feature defaults; explicit invalid values fail decoding.
Optional `None` remains valid where declared. `DerivedDataError` identifies the
stage, feature/aggregator, and action entry when available, retaining the cause.
It means computation failed, not necessarily that the stored row is corrupt.

- Failed batches write neither state nor cursor; earlier batches stay committed.
  Keep the action log intact for replay. Never skip an action or replace an invalid
  value with a default to make processing succeed.
- Inline/async processing reports the failure and stops that attempt. Synchronous
  calls raise. Replay/check batches count errors and continue with other groups;
  failed groups are not immediately rescheduled. Infrastructure errors propagate.
- Reads omit unreadable derived data, report failed status checks as errors, and
  use the existing unknown-progress sort rank. Only successfully serialized rows
  count as served. The debug endpoint reports stored/replayed failures separately.
- Status reconciliation reports an error and publishes no correction if status
  decoding fails on either the initial check or the recheck.
- There is no failure state or quarantine. Later actions and stale-row sweeps may
  retry. A current hash only means pipeline versions match, not that the cursor is caught
  up; replay checks verify only through that cursor. Current-hash stuck groups need
  explicit recovery. Lag detection is tracked in [ISWF-3533](https://linear.app/getsentry/issue/ISWF-3533).

## Rollout and recovery

Stricter validators must deploy with or after failure containment. Keep readers
compatible with both stored formats while versions coexist; hashes do not gate
reads. Action payload changes must also tolerate old workers: new fields or enum
values can fail action construction during a rolling deploy. Roll back only to
code that can read the data and actions already written.

1. **Locate and contain.** Use `issues.derived.feature_error` metrics (operation,
   stage, feature, aggregator) and logs (group, cursor, hashes, entry, cause).
   Stop a bad rollout or disable its consumer. If scheduled repair/check work
   amplifies failures, `issues.derived.heal-enabled=False` stops new scheduler
   fanout, not queued work or incremental processing. Keep recording actions.
2. **Choose the repair.** Bad stored values can be repaired by full replay without
   a code change if the log and current code can reconstruct valid state. Decode
   errors alone do not prove this. For a code or historical-payload incompatibility,
   fix it with a regression test before replaying. Do not repeatedly enqueue a
   replay that still fails.
3. **Ensure catch-up.** Every computation fix, including an aggregator crash fix,
   needs a recovery plan: bump the affected feature's version for broad regeneration,
   or explicitly replay all known affected groups. A bump makes every row on the
   previous pipeline hash stale, including healthy rows; targeted replay is cheaper
   for a small known set. Do not assume a new action will arrive.
4. **Replay a sample, verify, expand.** Use the existing task in the affected region:

   ```python
   from sentry.issues.derived.tasks import generate_group_derived_data

   generate_group_derived_data.delay(group_id=affected_group_id)
   ```

   Start without resume arguments; keep the live row and cursor so promotion guards
   apply. Confirm the rebuilt cursor reaches the intended log position, require
   `check_derived_data` to return `CheckPassed`, and check the original consumer.
   A timeout or invalidated check is inconclusive. Expand in controlled waves,
   watching errors, queue depth, and database load. For confirmed project-wide
   damage, use `generate_project_derived_data.delay(project_id=..., stale_only=False)`;
   stale-only repair misses corrupt current-hash rows. Restore incident switches
   after verification. Reads never initiate repairs.
