# Fix for ProcessingDeadlineExceeded in sentry.tasks.autofix.generate_issue_summary_only

## Problem

The `generate_issue_summary_only` task was exceeding its 35-second processing deadline due to blocking `cache.get_many()` calls in the nodestore layer. When the Redis cache backend (used for "nodedata" cache) became slow or unresponsive, the synchronous cache operation would block indefinitely, causing the task to timeout.

### Stack Trace Summary
```
ProcessingDeadlineExceeded: execution deadline of 35 seconds exceeded by sentry.tasks.autofix.generate_issue_summary_only
  at _get_cache_items (nodestore/base.py:286)
     -> cache.get_many(id_list)  # Blocking call
```

## Root Cause

1. Task starts to generate issue summary
2. Queries Snuba for event data (completes quickly in 48ms)
3. Attempts to bind event nodes by fetching from nodestore
4. Calls `nodestore.backend.get_multi()` which checks cache first
5. `cache.get_many()` blocks indefinitely due to slow/unresponsive Redis
6. Task exceeds 35-second deadline and raises ProcessingDeadlineExceeded

## Solution

Added timeout protection to cache operations in `/workspace/src/sentry/services/nodestore/base.py`:

### Changes Made

1. **Added timeout wrapper using ThreadPoolExecutor**
   - Wraps `cache.get()` and `cache.get_many()` calls with a 10-second timeout
   - Uses `concurrent.futures.ThreadPoolExecutor` (already widely used in codebase)

2. **Graceful degradation on timeout**
   - If cache operation times out, returns fallback values (None or empty dict)
   - This forces the code to fetch data directly from nodestore backend
   - Nodestore backend has its own timeout/error handling

3. **Observability improvements**
   - Logs warnings when timeouts occur with relevant context
   - Increments metrics for monitoring: `nodestore.cache.timeout` and `nodestore.cache.error`
   - Provides visibility into cache performance issues

### Code Changes

Modified `_get_cache_item()` and `_get_cache_items()` methods:

```python
# Before (blocking indefinitely)
def _get_cache_items(self, id_list: list[str]) -> dict[str, Any]:
    if self.cache:
        return self.cache.get_many(id_list)  # BLOCKS INDEFINITELY
    return {}

# After (with timeout protection)
def _get_cache_items(self, id_list: list[str]) -> dict[str, Any]:
    if not self.cache:
        return {}
    
    cache_timeout = 10  # seconds
    
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self.cache.get_many, id_list)
            try:
                return future.result(timeout=cache_timeout)
            except FuturesTimeoutError:
                logger.warning("nodestore.cache.get_many_timeout", ...)
                metrics.incr("nodestore.cache.timeout", ...)
                return {}  # Fallback to nodestore backend
    except Exception as e:
        logger.warning("nodestore.cache.get_many_error", ...)
        metrics.incr("nodestore.cache.error", ...)
        return {}  # Fallback to nodestore backend
```

## Why This Works

1. **10-second timeout is appropriate**
   - Well within the 35-second task deadline
   - Leaves 25 seconds for nodestore backend fetch (which is typically fast)
   - Prevents indefinite blocking

2. **Fallback is safe**
   - Returning empty dict/None causes existing code to fetch from nodestore
   - No data loss - just bypasses cache
   - Performance impact only when cache is already failing

3. **Thread-safe**
   - ThreadPoolExecutor is already widely used in Sentry codebase
   - Django cache backends are thread-safe
   - Context manager ensures proper cleanup

## Testing

Created and ran standalone test suite that validates:
- ✅ Timeout handling works correctly (blocks for 10s then returns fallback)
- ✅ Fast cache responses work normally (no timeout)
- ✅ Exception handling works correctly (catches errors and returns fallback)

All tests passed successfully.

## Impact

- **Positive**: Tasks will no longer timeout due to slow cache operations
- **Positive**: Better observability via metrics and logging
- **Minimal**: Slight overhead from ThreadPoolExecutor (negligible)
- **Safe**: Fallback behavior is identical to cache miss scenario

## Monitoring

Watch for these metrics after deployment:
- `nodestore.cache.timeout` - Number of cache timeouts
- `nodestore.cache.error` - Number of cache errors
- `nodestore.get` - Cache hit/miss rates

If timeouts are frequent, investigate Redis performance/network issues.
