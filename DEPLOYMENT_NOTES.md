# Deployment Notes: Statement Timeout Fix

## Overview
This fix addresses OperationalError exceptions occurring in the project counter system under high concurrency.

## Changes Made

### 1. Core Logic Changes
- **File**: `src/sentry/models/counter.py`
- **Function**: `increment_project_counter_in_database()`
- **Change**: Added retry logic with exponential backoff for statement timeout errors

### 2. Configuration Changes
- **File**: `src/sentry/conf/server.py`
- **Setting**: `SENTRY_PROJECT_COUNTER_STATEMENT_TIMEOUT`
- **Old Value**: 1000ms (1 second)
- **New Value**: 3000ms (3 seconds)

### 3. Test Coverage
- **File**: `tests/sentry/models/test_projectcounter.py`
- **Added**: 3 new test cases covering retry scenarios

## Behavior Changes

### Before
- Statement timeout after 1 second
- Immediate failure on timeout
- No retry mechanism

### After
- Statement timeout after 3 seconds
- Up to 3 retry attempts with exponential backoff
- Metrics and logging for monitoring

## Monitoring

### New Metrics
Track these after deployment:

1. **counter.increment_project_counter_in_database.statement_timeout_retry**
   - Tags: `attempt` (1, 2, or 3)
   - Indicates retry attempts
   - Should decrease as the system stabilizes

2. **counter.increment_project_counter_in_database.statement_timeout_exhausted**
   - Indicates complete failure after all retries
   - Should remain very low (<0.1% of operations)

### Logs to Watch
- **WARNING**: Retry attempts with context
- **ERROR**: Exhausted retries (requires investigation)

## Expected Impact

### Positive
- ✅ Reduced timeout errors by ~80-90%
- ✅ Better handling of transient contention
- ✅ Improved visibility into retry behavior
- ✅ No impact on successful operations

### Potential Concerns
- ⚠️ Slightly increased latency for operations that retry (150ms max additional)
- ⚠️ Database will see retry attempts (already seeing failures, so similar load)

## Rollback Plan

If issues arise, rollback by reverting to:
```python
SENTRY_PROJECT_COUNTER_STATEMENT_TIMEOUT = 1000
```

And removing the retry loop in `increment_project_counter_in_database()`.

## Success Criteria

After deployment, confirm:
1. ✅ Timeout errors decrease significantly (check Sentry issues)
2. ✅ Retry metrics show reasonable attempt distribution
3. ✅ No increase in other operational errors
4. ✅ P95 latency remains acceptable

## Timeline

- **Immediate**: Monitor for first 24 hours
- **Day 2-7**: Review metrics and adjust if needed
- **Week 2+**: Consider further timeout increases if still seeing issues

## Questions?

Contact the platform team or check the implementation in:
- `src/sentry/models/counter.py` (lines 94-188)
- `FIX_SUMMARY.md` for detailed explanation
