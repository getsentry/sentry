# Fix for Statement Timeout in Project Counter

## Issue Summary

The Sentry project counter was experiencing `OperationalError: canceling statement due to statement timeout` errors under high concurrency. The error occurred in the `sentry_projectcounter` table during `INSERT ... ON CONFLICT` operations when generating short IDs for new groups/events.

### Root Cause

1. **Aggressive Timeout**: Statement timeout was set to only 1000ms (1 second)
2. **Index Contention**: Under high load, multiple workers attempting to update the same counter rows caused index tuple insertion delays
3. **No Retry Logic**: When timeout occurred, the operation failed immediately without any retry attempts

### Example Error
```
OperationalError: canceling statement due to statement timeout
CONTEXT: while inserting index tuple (10255,235) in relation "sentry_projectcounter"
```

## Solution Implemented

### 1. Added Retry Logic with Exponential Backoff

Modified `increment_project_counter_in_database()` to retry up to 3 times on statement timeout:
- **Attempt 1**: Immediate execution
- **Attempt 2**: Retry after 50ms if timeout
- **Attempt 3**: Retry after 100ms if timeout
- **Final attempt**: Retry after 200ms if timeout, or fail

The retry logic:
- Only retries on statement timeout errors (not other operational errors)
- Uses exponential backoff to reduce contention
- Logs warnings for each retry and errors for exhausted retries
- Tracks metrics for monitoring

### 2. Increased Statement Timeout

Changed `SENTRY_PROJECT_COUNTER_STATEMENT_TIMEOUT` from 1000ms to 3000ms (3 seconds):
- Provides more headroom for operations under high concurrency
- Still protects against runaway queries
- Reduces frequency of timeout errors

### 3. Added Comprehensive Monitoring

Added metrics tracking:
- `counter.increment_project_counter_in_database.statement_timeout_retry` (with attempt tag)
- `counter.increment_project_counter_in_database.statement_timeout_exhausted`

Added logging:
- Warning logs for each retry attempt with context
- Error logs when all retries are exhausted

## Code Changes

### Files Modified

1. **src/sentry/models/counter.py**
   - Added retry loop in `increment_project_counter_in_database()`
   - Added `_is_statement_timeout_error()` helper function
   - Added logging and metrics
   - Imported `logging`, `time`, `OperationalError`

2. **src/sentry/conf/server.py**
   - Changed `SENTRY_PROJECT_COUNTER_STATEMENT_TIMEOUT` from 1000 to 3000

3. **tests/sentry/models/test_projectcounter.py**
   - Added test for successful retry after timeout
   - Added test for exhausted retries
   - Added test for non-timeout errors (no retry)

## Benefits

1. **Resilience**: System can now handle transient contention issues gracefully
2. **Visibility**: Metrics and logging provide insight into retry behavior
3. **Performance**: Exponential backoff reduces contention during retries
4. **Backward Compatible**: Changes are transparent to callers

## Testing

The implementation includes comprehensive unit tests that verify:
- Retry logic works correctly for timeout errors
- Non-timeout errors are not retried
- Exponential backoff delays are calculated correctly
- Metrics and logging are tracked properly
- All retries are exhausted before final failure

## Monitoring Recommendations

After deployment, monitor these metrics:
- `counter.increment_project_counter_in_database.statement_timeout_retry` - Should decrease over time
- `counter.increment_project_counter_in_database.statement_timeout_exhausted` - Should remain very low

If these metrics remain high, consider:
- Further increasing the statement timeout
- Investigating database performance/indexing
- Reviewing project counter contention patterns
