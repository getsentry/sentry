# Fix for RuntimeError: dictionary changed size during iteration in Arroyo MetricsBuffer

## Issue Reference
Fixes SENTRY-5DEZ

## Problem Description

The Sentry monitor consumer experienced a `RuntimeError: dictionary changed size during iteration` when processing high-throughput check-ins. This occurred due to a race condition in Arroyo's `MetricsBuffer` class.

### Root Cause

1. **Concurrent Kafka Delivery Callbacks**: Kafka delivery callbacks execute asynchronously on separate threads
2. **Unprotected Dictionary Modifications**: Callbacks invoke `__metrics_delivery_callback` which modifies `__produce_counters`
3. **Concurrent Iteration**: While one thread iterates `__produce_counters` in `__flush_metrics`, another callback mutates it
4. **No Synchronization**: `__flush_metrics` iterates `dict.items()` without protecting against concurrent modification
5. **Python RuntimeError**: Python raises RuntimeError when dictionary size changes during iteration

### Reproduction Scenario

```
- Start monitor consumer with high throughput check-ins
- Multiple Kafka producers emit messages asynchronously
- Delivery callbacks fire concurrently, calling __metrics_delivery_callback
- One callback's __throttled_record triggers __flush_metrics
- Another concurrent callback modifies __produce_counters dictionary
- RuntimeError raised in for loop iterating over dict.items()
```

## Solution

Added a monkey patch in `src/sentry/monkey/__init__.py` to make Arroyo's `MetricsBuffer` thread-safe.

### Implementation Details

1. **Per-instance Locks**: Uses `WeakKeyDictionary` to store locks for each `MetricsBuffer` instance, preventing memory leaks when instances are garbage collected

2. **Atomic Dictionary Swap**: The patched `flush()` method:
   - Acquires the lock
   - Atomically swaps out `__counters` and `__timers` with new empty dictionaries
   - Releases the lock
   - Iterates over the swapped dictionaries outside the lock to avoid blocking

3. **Protected Modifications**: Both `incr_counter()` and `incr_timer()` methods now acquire the lock before modifying their respective dictionaries

### Code Changes

**File: `src/sentry/monkey/__init__.py`**
- Added `_patch_arroyo_metrics_buffer()` function
- Patches `MetricsBuffer.flush`, `MetricsBuffer.incr_counter`, and `MetricsBuffer.incr_timer`
- Handles the case where Arroyo is not installed gracefully

**File: `tests/sentry/monkey/test_arroyo_metrics_buffer.py`**
- Comprehensive thread-safety tests
- Tests concurrent `incr_counter` and `flush` operations
- Tests concurrent `incr_timer` and `flush` operations
- Tests the specific Kafka callback scenario from the bug report
- Verifies per-instance locking
- Ensures metrics are still flushed correctly after patching

## Testing

The fix includes comprehensive tests that:
1. Simulate the exact concurrency scenario from the bug report
2. Run hundreds of concurrent operations across multiple threads
3. Verify no `RuntimeError` occurs
4. Ensure metrics are still correctly flushed
5. Verify per-instance locking works correctly

## Benefits

1. **Prevents RuntimeError**: Eliminates the race condition causing dictionary mutation during iteration
2. **Thread-safe**: All operations on `MetricsBuffer` are now thread-safe
3. **Non-blocking**: Metric sending happens outside the lock to avoid blocking other threads
4. **Memory-safe**: Uses `WeakKeyDictionary` to prevent memory leaks
5. **Transparent**: No changes required to existing code using `MetricsBuffer`

## Compatibility

- Works with any version of Arroyo that has the `MetricsBuffer` class
- Gracefully handles cases where Arroyo is not installed
- Backward compatible with existing code

## Future Considerations

This fix is a temporary workaround. The ideal solution would be for Arroyo to implement thread-safety directly in the `MetricsBuffer` class. This patch can be removed once Arroyo is updated with built-in thread-safety.
