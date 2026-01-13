# N+1 Query Fix Summary

## Issue
The `process_uptime_backlog` task was experiencing N+1 queries for `DetectorState` when processing multiple buffered uptime check results. Each result processed caused a separate database query for the same detector's state.

## Root Cause
1. The `process_uptime_backlog` task processes multiple uptime check results in a loop
2. Each result calls `process_result_internal` → `handle_active_result` → `process_detectors`
3. Each `process_detectors` call creates a new `DetectorHandler` instance
4. Each `DetectorHandler` creates a new `DetectorStateManager` instance
5. Each `DetectorStateManager` queries `DetectorState` from the database via `bulk_get_detector_state`
6. Result: N queries for the same detector when processing N results

## Solution
Implemented thread-local caching for `DetectorState` queries in `DetectorStateManager`:

### Changes Made

#### 1. Added Thread-Local Cache (`stateful.py`)
```python
# Thread-local storage for detector state cache
_thread_local = threading.local()

def get_detector_state_cache() -> dict[int, dict[DetectorGroupKey, DetectorState]]:
    """Get the thread-local detector state cache."""
    if not hasattr(_thread_local, "detector_state_cache"):
        _thread_local.detector_state_cache = {}
    return _thread_local.detector_state_cache

def clear_detector_state_cache():
    """Clear the thread-local detector state cache."""
    if hasattr(_thread_local, "detector_state_cache"):
        _thread_local.detector_state_cache = {}
```

#### 2. Updated `bulk_get_detector_state` Method
The method now:
- Checks thread-local cache before querying database
- Returns cached results if all requested keys are in cache
- Updates cache after database queries
- Marks non-existent keys in cache to avoid re-querying

#### 3. Updated `process_uptime_backlog` Task (`tasks.py`)
```python
@instrumented_task(...)
def process_uptime_backlog(subscription_id: str, attempt: int = 1):
    try:
        _process_uptime_backlog_impl(subscription_id, attempt)
    finally:
        # Clear thread-local cache to prevent memory leaks
        clear_detector_state_cache()
```

### Benefits
- **Reduces database queries**: From O(n) to O(1) when processing n results for the same detector
- **Thread-safe**: Uses thread-local storage, so different threads don't interfere
- **Memory-safe**: Cache is cleared after task completion
- **Minimal performance impact**: In-memory dictionary lookups are extremely fast
- **Backward compatible**: No changes to public APIs or method signatures

## Performance Impact
For a backlog with 5 results:
- **Before**: 5+ `DetectorState` queries (N+1 pattern)
- **After**: 1 `DetectorState` query (first access only)

This represents an 80-90% reduction in database queries for typical backlog processing scenarios.

## Testing
Added comprehensive test coverage:
- `TestDetectorStateCaching`: Unit tests for cache behavior
- `test_uses_detector_state_cache_for_multiple_results`: Integration test for backlog processing

## Files Modified
1. `src/sentry/workflow_engine/handlers/detector/stateful.py`
   - Added thread-local cache infrastructure
   - Updated `bulk_get_detector_state` to use cache

2. `src/sentry/uptime/consumers/tasks.py`
   - Added cache cleanup to task
   - Refactored task implementation

3. `tests/sentry/workflow_engine/handlers/detector/test_stateful.py`
   - Added `TestDetectorStateCaching` test class

4. `tests/sentry/uptime/consumers/test_tasks.py`
   - Added integration test for cache usage
