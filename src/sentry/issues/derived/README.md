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

Missing JSON keys use the feature default; explicit invalid values fail decoding.
Optional `None` remains valid where declared (including closed-issue progress).
Codec and aggregator failures raise `DerivedDataError`, retaining their original
cause and identifying the stage, feature or aggregator, and action entry when available.
These errors indicate a failed computation, not proof that the stored row is corrupt.

- A failed processing batch writes neither state nor cursor. Earlier completed
  batches remain committed; action-log entries remain available for replay.
- Inline and asynchronous processing report the failure and stop that attempt.
  Synchronous processing raises. Replay and validation batches continue other groups;
  a failed group is neither counted as successful nor immediately rescheduled.
  Database and infrastructure errors retain their existing failure behavior.
- Serialization omits unreadable derived data for that group. Status checks report
  an error rather than alignment. Progress sorting gives unknown strings the lowest
  rank in both Python and SQL; filters do not classify them as a known state.
- Reads never repair data. The debug endpoint preserves cursor/hash metadata and
  reports stored-state and replay errors separately, within its existing replay limit.

There is no persistent failure state or quarantine. Later actions, manual tasks,
and scheduled stale-row sweeps can attempt the group again. Hash freshness alone
does not establish correctness, and corruption of a current-hash row does not
automatically make it eligible for stale-row healing.

## Production response

1. **Locate and contain.** Inspect `issues.derived.feature_error` logs for group,
   cursor, stored/current pipeline hashes, stage, feature/aggregator, entry ID, and
   chained cause. The metric of the same name is tagged only by operation and stage.
   Group failures by deployment/hash and feature to distinguish isolated bad data
   from a rollout regression. For widespread failures, stop the offending rollout
   or disable its consumer. If scheduled repair/check work amplifies the incident,
   set `issues.derived.heal-enabled=False`; this stops new scheduler fanout, not
   already queued work or incremental processing. Keep recording actions.
2. **Fix the cause before replay.** A decode failure may need a compatible reader
   or writer fix; replay is sufficient only when the log and current code can
   reconstruct valid state. Aggregate/encode failures need a regression test and
   a deterministic code or historical-payload compatibility fix. Do not silently
   skip the offending action or substitute a default for an invalid value. Bump
   affected feature versions when computed outputs change. Support old/new stored
   representations during rollout; the hash does not gate readers. Roll back only
   to code that can read values already written.
3. **Rebuild a small sample.** In the affected region's production shell, use the
   existing full-replay task after deploying the fix:

   ```python
   from sentry.issues.derived.tasks import generate_group_derived_data

   generate_group_derived_data.delay(group_id=affected_group_id)
   ```

   Start without resume arguments. Replay builds a replacement and uses the
   existing promotion guards; do not delete the live row, reset its cursor, edit
   the action log, or repeatedly enqueue the same failing replay. Soft invalidation
   only marks a row stale and is not a read quarantine.

4. **Verify, then expand.** Confirm task completion, decode the rebuilt row, and run
   `check_derived_data` against the current pipeline; require `CheckPassed` (a timeout
   or invalidated check is inconclusive). Confirm the original consumer works and
   feature-error rates fall. For confirmed project-wide damage, use
   `generate_project_derived_data.delay(project_id=affected_project_id, stale_only=False)`
   in controlled waves, watching queue depth and database load. `stale_only=True`
   misses corrupt current-hash rows. Recheck samples and restore any incident switches.
