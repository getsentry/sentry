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
