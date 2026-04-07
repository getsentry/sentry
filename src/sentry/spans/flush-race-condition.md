# Flush Race Condition: Silent Span Loss in `done_flush_segments`

## Problem Statement

The span buffer has three phases:

1. **`flush_segments`** (flusher process): Reads segment data from Redis (set contents, counters, queue scores).
2. **Kafka production** (flusher process): Produces the read segments to Kafka.
3. **`done_flush_segments`** (flusher process): Cleans up Redis keys (deletes the set, counters, redirect map entries, and removes the queue entry).

Meanwhile, **`process_spans`** (consumer process) continuously writes new spans to Redis for any segment, including ones currently being flushed.

The race: if `process_spans` adds new spans to a segment between step 1 (read) and step 3 (cleanup), `done_flush_segments` deletes those new spans. They were never read by `flush_segments` and never produced to Kafka, so they are permanently lost. There is no outcome tracked for them.

### Constraints

- The queue key (`span-buf:q:{shard}`) and segment data keys (`span-buf:s:{project_id:trace_id}:span_id`) are in **different Redis Cluster slots**. Cross-slot atomic operations are not possible.
- Segment data keys (set, `ic`, `ibc`, `hrs`) all share the `{project_id:trace_id}` slot, so they CAN be operated on atomically via Lua.
- `add-buffer.lua` (called by `process_spans`) is atomic per-slot. It modifies the set, `ic`, `ibc`, and `hrs` atomically. The queue ZADD happens separately in Python afterwards.
- The flusher must tolerate crashes. If the flusher dies between `flush_segments` and `done_flush_segments`, data must not be lost.

## Possible Options

### Option 1: Conditional ZREM via queue score comparison

Capture queue scores during `flush_segments` (using `ZRANGEBYSCORE ... WITHSCORES`). In `done_flush_segments`, a Lua script atomically checks whether the score is still the same and only removes the queue entry if so. If the score changed, skip all cleanup for that segment.

**Drawbacks:**

- Only narrows the race window, does not eliminate it. After the conditional ZREM succeeds, new spans can still arrive before the data deletion pipeline runs. Those spans are added to the set (which then gets deleted) and re-added to the queue, but the set data is lost.
- The queue score is updated non-atomically with respect to `add-buffer.lua` (ZADD happens in a separate Python pipeline after the Lua script). So there is a window where `add-buffer.lua` has already added spans and incremented `ic`, but the queue score has not yet been updated. The conditional ZREM would see the old score, succeed, and proceed to delete data that includes new spans.

### Option 2: Two-phase conditional cleanup (score + ingested count)

Same as Option 1 for the queue (conditional ZREM on score), plus a second Lua script on the segment data slot that atomically checks `ic` (ingested count) and only deletes the set/counters if `ic` hasn't changed since `flush_segments` captured it.

Since `ic` and the set are in the same Redis Cluster slot, and `add-buffer.lua` updates them atomically, this Lua script cannot interleave with `add-buffer.lua`. `ic` is monotonically increasing, so if it hasn't changed, no `add-buffer.lua` has run for this segment since capture.

**Drawbacks:**

- The `ic` value captured during `flush_segments` is itself read non-atomically relative to other values (set contents, queue scores). While this doesn't cause data loss (a stale `ic` capture only causes false positives / unnecessary re-flushes, never false negatives), it means the system is subtly relying on monotonicity of `ic` and atomicity guarantees that are not obvious from the code.
- Two separate Lua scripts for a single cleanup operation, each on a different slot. The interaction between them has edge cases (e.g., Phase 1 ZREM succeeds, Phase 2 skips because `ic` changed, segment is temporarily not in queue until `process_spans`' ZADD runs).
- Added complexity for something that is conceptually simple ("don't delete data that was written after we read it").

### Option 3: Destructive read at flush time (rename-before-read)

In `flush_segments`, atomically rename the set key to a temporary key (via Lua, same slot), then read from the temporary key. New spans arriving via `process_spans` would create a fresh set. `done_flush_segments` only deletes the temporary key, which nothing else writes to.

**Drawbacks:**

- If the flusher crashes after the rename but before producing to Kafka, the spans in the renamed key are lost. The original set no longer exists, and the temporary key will eventually expire. This violates the crash-safety requirement.
- Requires changes to `add-buffer.lua` or `_load_segment_data` to handle the renamed keys.
- The queue entry, counters (`ic`, `ibc`), `hrs`, and redirect map all need coordinated handling across the rename, adding significant complexity.

### Option 4: Generation counter

`flush_segments` writes a "flush generation" marker for each segment it reads. `add-buffer.lua` checks for this marker and, if present, writes new spans to a new set key (e.g., with the generation appended) instead of the existing one. `done_flush_segments` safely deletes the old set since nothing is writing to it anymore.

**Drawbacks:**

- Adds a check to the hot path (`add-buffer.lua` runs for every incoming span batch). Even a single Redis GET per invocation adds latency to the most performance-sensitive code path.
- Increases the complexity of `add-buffer.lua`, which is already non-trivial (redirect resolution, merge logic, counter management).
- The generation marker itself needs to be in the same slot as the segment data for atomic access, and needs careful TTL management.
- Segment merges (SUNIONSTORE) become more complex when multiple generations of the same segment exist simultaneously.
