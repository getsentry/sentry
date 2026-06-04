# Concurrency and Runtime Bugs

## Table of Contents

- [Overview](#overview)
- [Real Examples](#real-examples)
- [Root Cause Analysis](#root-cause-analysis)
- [Fix Patterns](#fix-patterns)
- [Detection Checklist](#detection-checklist)

## Overview

**23 issues, 38,443 events, 1,320 affected users.** Shared mutable state accessed from multiple threads without synchronization, unimplemented code paths hit in production, and list/index access without bounds checking. While lower in issue count, these bugs are persistent -- they fire continuously once triggered and are difficult to reproduce in testing.

Three sub-patterns:

1. **Dict mutation during iteration** -- One thread iterates a dict while another thread adds/removes keys (RuntimeError, 14 issues)
2. **Index out of range** -- List access without bounds checking (IndexError, 5 issues)
3. **Unimplemented code paths** -- NotImplementedError from search expressions or features not yet handled (4 issues)

## Real Examples

### Example 1: Dictionary changed size during iteration (SENTRY-5BYB) -- unresolved

**28,712 events | 0 users**

In-app frames:

```python
# sentry/utils/pubsub.py -- publish()
# Called from:
# sentry/monitors/consumers/monitor_consumer.py -- _process_checkin()
# sentry/utils/outcomes.py -- track_outcome()
# RuntimeError: dictionary changed size during iteration
```

**Root cause:** A `KafkaPublisher` instance has an internal dictionary of futures or topics. The `publish()` method iterates over this dict while another thread concurrently adds new entries. The monitor consumer processes check-ins and calls `track_outcome()` which publishes to Kafka -- in a multi-threaded consumer, multiple check-ins can be processed concurrently.

**Fix:**

```python
# Snapshot keys before iteration:
for key in list(self._futures.keys()):
    future = self._futures.get(key)
    if future is not None and future.done():
        self._futures.pop(key, None)

# Or use a lock:
with self._lock:
    done = [k for k, v in self._futures.items() if v.done()]
    for k in done:
        del self._futures[k]
```

### Example 2: IndexError in rate limiting (SENTRY-401M) -- resolved

**1,065 events | 353 users**

In-app frames:

```python
# sentry/ratelimits/redis.py -- is_limited_with_value()
result = pipeline.execute()
# ...
count = result[idx]  # IndexError: list index out of range
```

Called from:

```python
# sentry/ratelimits/utils.py -- above_rate_limit_check()
is_limited, current_count = backend.is_limited_with_value(key, limit, window)
```

**Root cause:** The Redis pipeline returns fewer results than expected. This can happen if the Redis connection is interrupted mid-pipeline, or if the pipeline commands were partially executed.

**Fix:**

```python
results = pipeline.execute()
if len(results) <= idx:
    logger.warning("ratelimit.pipeline_incomplete", extra={"expected": idx + 1, "got": len(results)})
    return False, 0  # Default to not rate-limited
count = results[idx]
```

**Actual fix:** Resolved -- pipeline results are now validated before access.

### Example 3: Process startup timeout (SENTRY-48Q3) -- unresolved

**2,773 events | 0 users**

In-app frames:

```python
# sentry/spans/consumers/process/flusher.py -- _wait_for_process_to_become_healthy()
if not process.is_alive():
    raise RuntimeError(
        f"process {idx} (shards {shards}) didn't start up in {timeout} seconds"
    )
```

**Root cause:** The span processing consumer spawns child processes for sharding. Under load, a child process may take longer than the configured 120-second timeout to start up, causing the parent to raise RuntimeError.

**Fix:**

```python
# Increase timeout or make it configurable:
timeout = options.get("spans.process.startup_timeout", 300)
# Or implement retry logic:
for attempt in range(max_retries):
    if process.is_alive():
        break
    time.sleep(backoff)
else:
    logger.error("process.startup_timeout", extra={"idx": idx, "shards": shards})
    # Graceful degradation instead of crash
```

## Root Cause Analysis

| Pattern                           | Frequency | Typical Trigger                                      |
| --------------------------------- | --------- | ---------------------------------------------------- |
| Dict mutation during iteration    | Very High | Multi-threaded consumers, publishers                 |
| List index out of range           | Medium    | Redis pipeline incomplete results, empty collections |
| Process startup timeout           | Medium    | High-load conditions, resource contention            |
| Unimplemented search expressions  | Low       | New query syntax not yet handled                     |
| Shared module-level mutable state | Low       | Global registries without locks                      |

## Fix Patterns

### Pattern A: Copy before iteration

```python
# Snapshot the dict keys before iterating:
for key in list(shared_dict.keys()):
    process(shared_dict.get(key))
```

### Pattern B: Use threading.Lock for shared state

```python
import threading

class Publisher:
    def __init__(self):
        self._futures = {}
        self._lock = threading.Lock()

    def publish(self, key, value):
        with self._lock:
            self._futures[key] = produce(value)

    def cleanup(self):
        with self._lock:
            done = [k for k, v in self._futures.items() if v.done()]
            for k in done:
                del self._futures[k]
```

### Pattern C: Bounds checking before index access

```python
# Instead of:
value = results[idx]

# Use:
if idx < len(results):
    value = results[idx]
else:
    logger.warning("unexpected_result_count", extra={"expected": idx + 1, "got": len(results)})
    value = default
```

### Pattern D: Implement all code paths before enabling features

```python
# Instead of:
raise NotImplementedError("Haven't handled all search expressions yet")

# Use:
logger.warning("search.unhandled_expression", extra={"expression": expr})
return default_result  # Graceful fallback
```

## Detection Checklist

Scan the code for these patterns:

- [ ] Any `for key in dict:` where the dict is accessible from multiple threads -- is it copied first?
- [ ] Any module-level or class-level mutable dicts/lists that are modified at runtime
- [ ] Any `dict.pop()`, `dict[key] = value`, or `del dict[key]` on shared state without a lock
- [ ] Any list index access `list[idx]` -- is the index bounds-checked?
- [ ] Any `pipeline.execute()` result access -- is the result list length validated?
- [ ] Any `raise NotImplementedError` -- is this code reachable in production?
- [ ] Any KafkaPublisher, PubSub, or similar concurrent producer -- is shared state protected?
- [ ] Any child process startup -- is the timeout reasonable under load?
