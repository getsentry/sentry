# Arroyo MetricsBuffer Thread-Safety Fix

## Problem

The Sentry application encountered a `RuntimeError: dictionary changed size during iteration` error in Arroyo's `MetricsBuffer.flush()` method. This occurred when:

1. The Arroyo StreamProcessor's stuck detector thread detected the main thread was unresponsive
2. It called `MetricsBuffer.incr_counter()` to record the "arroyo.consumer.stuck" metric
3. It then called `MetricsBuffer.flush()` to send metrics
4. While `flush()` was iterating over `self.__counters.items()`, other threads (DogStatsd threads) concurrently modified the same dictionary
5. Python's runtime detected this concurrent modification and raised `RuntimeError`

## Root Cause

Arroyo's `MetricsBuffer` class (in `arroyo/processing/processor.py`) is not thread-safe:

```python
# Original implementation (simplified)
class MetricsBuffer:
    def __init__(self, metrics):
        self.__timers = {}
        self.__counters = {}
        self.metrics = metrics
    
    def incr_counter(self, metric, value):
        self.__counters[metric] = self.__counters.get(metric, 0) + value
    
    def incr_timer(self, metric, value):
        self.__timers[metric] = value
    
    def flush(self):
        for metric, value in self.__timers.items():  # NOT THREAD-SAFE
            self.metrics.timing(metric, value)
        for metric, value in self.__counters.items():  # NOT THREAD-SAFE
            self.metrics.increment(metric, value)
        self.__reset()
```

The issue is that these dictionaries can be modified by any thread calling `incr_counter()` or `incr_timer()` while `flush()` is iterating over them.

## Solution

Since Arroyo is an external dependency, we cannot directly modify its code. Instead, we implemented a monkey patch in `src/sentry/monkey/__init__.py` that:

1. **Adds per-instance locks**: Uses a `WeakKeyDictionary` to store a lock for each `MetricsBuffer` instance, preventing memory leaks when instances are garbage collected.

2. **Protects dictionary modifications**: Wraps `incr_counter()` and `incr_timer()` with locks to ensure atomic updates.

3. **Safely flushes metrics**: In the patched `flush()` method:
   - Acquires the lock
   - Atomically swaps the dictionaries with new empty ones
   - Releases the lock
   - Iterates over the swapped-out dictionaries (now safe from concurrent modification)
   - Sends metrics to the backend

4. **Uses double-checked locking**: The lock acquisition itself is thread-safe, preventing race conditions when creating locks for new instances.

## Implementation Details

### File: `src/sentry/monkey/__init__.py`

The monkey patch is automatically applied when Sentry imports, before any Arroyo code runs (via `__import__("sentry.monkey")` in `src/sentry/__init__.py`).

Key aspects of the implementation:

- **WeakKeyDictionary**: Prevents memory leaks by allowing `MetricsBuffer` instances to be garbage collected
- **Lock granularity**: Per-instance locks avoid contention between different `MetricsBuffer` instances
- **Minimal lock holding**: Locks are released before sending metrics to avoid blocking other threads during I/O
- **Double-checked locking**: Ensures only one lock is created per instance even under high concurrency

### Testing

Tests are provided in `tests/sentry/monkey/test_arroyo_metrics_buffer.py`:

1. `test_concurrent_flush_and_increment`: Verifies no errors with 10 threads doing 100 operations each
2. `test_concurrent_timer_and_flush`: Similar test for timer metrics
3. `test_all_metrics_eventually_sent`: Ensures no metrics are lost due to the patch
4. `test_flush_clears_buffers`: Verifies proper cleanup after flush

A standalone verification script is also provided in `verify_arroyo_patch.py` for manual testing.

## Impact

- **Fixes**: The `RuntimeError: dictionary changed size during iteration` that occurred intermittently in production
- **Performance**: Minimal overhead - locks are only held during dictionary operations, not during metric transmission
- **Compatibility**: The patch gracefully handles the case where Arroyo is not installed
- **Safety**: Uses weak references to prevent memory leaks

## Related Files

- `src/sentry/monkey/__init__.py` - The monkey patch implementation
- `tests/sentry/monkey/test_arroyo_metrics_buffer.py` - Test suite
- `verify_arroyo_patch.py` - Standalone verification script
- `src/sentry/utils/kafka.py` - Uses Arroyo's StreamProcessor
- `src/sentry/runner/commands/run.py` - Entry point for consumers that use Arroyo

## Verification

To verify the fix is working:

1. Run the test suite: `python3 -m pytest tests/sentry/monkey/test_arroyo_metrics_buffer.py -v`
2. Run the standalone verification: `python3 verify_arroyo_patch.py`
3. Check that the monkey patch is applied: Import `sentry.monkey` and verify no ImportError

## Future Considerations

- Consider upstreaming this fix to the Arroyo project
- Monitor for any performance impact in production
- Watch for Arroyo updates that might make this patch unnecessary
