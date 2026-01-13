# Fix Verification for Dataset.Sessions KeyError

## Issue
When creating a crash-free rate alert with `dataset: "sessions"`, a KeyError was raised:
```
KeyError: <Dataset.Sessions: 'sessions'>
```

## Root Cause
The `query_datasets_to_type` mapping in `src/sentry/incidents/logic.py` was missing an entry for `Dataset.Sessions`.

Additionally, the `QUERY_TYPE_VALID_DATASETS` mapping in `src/sentry/snuba/snuba_query_validator.py` only included `Dataset.Metrics` for `CRASH_RATE` type, not `Dataset.Sessions`.

## Error Flow
1. User sends POST request with `"dataset": "sessions"`
2. `AlertRuleSerializer.validate()` is called
3. `SnubaQueryValidator._validate_query()` executes line:
   ```python
   query_type = data.setdefault("query_type", query_datasets_to_type[dataset])
   ```
4. `dataset` is `Dataset.Sessions` enum
5. **KeyError** because `Dataset.Sessions` not in `query_datasets_to_type`

## Solution
Added two mappings:

### 1. src/sentry/incidents/logic.py
```python
query_datasets_to_type = {
    Dataset.Events: SnubaQuery.Type.ERROR,
    Dataset.Transactions: SnubaQuery.Type.PERFORMANCE,
    Dataset.PerformanceMetrics: SnubaQuery.Type.PERFORMANCE,
    Dataset.Sessions: SnubaQuery.Type.CRASH_RATE,  # ← ADDED
    Dataset.Metrics: SnubaQuery.Type.CRASH_RATE,
    Dataset.EventsAnalyticsPlatform: SnubaQuery.Type.PERFORMANCE,
}
```

### 2. src/sentry/snuba/snuba_query_validator.py
```python
QUERY_TYPE_VALID_DATASETS = {
    SnubaQuery.Type.ERROR: {Dataset.Events},
    SnubaQuery.Type.PERFORMANCE: {
        Dataset.Transactions,
        Dataset.PerformanceMetrics,
        Dataset.EventsAnalyticsPlatform,
    },
    SnubaQuery.Type.CRASH_RATE: {Dataset.Sessions, Dataset.Metrics},  # ← ADDED Dataset.Sessions
}
```

## Verification
- Both `Dataset.Sessions` and `Dataset.Metrics` now map to `CRASH_RATE` type
- Both are validated as valid datasets for crash rate alerts
- The original user request will now work correctly

## Test Evidence
Existing tests in `tests/sentry/snuba/test_tasks.py` already expect this behavior:
- Line 589: `SnubaQuery.Type.CRASH_RATE: { Dataset.Sessions: {...} }`
- Line 816: `if dataset == Dataset.Sessions:`

These tests prove that the codebase already expects Sessions dataset to work with crash rate alerts.
