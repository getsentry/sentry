# Plan: Task-Based Retry for Out-of-Order Uptime Results

**NOTE TO REVIEWER**: Feel free to edit this document and add feedback. Mark your feedback as `FEEDBACK: <your comments>` so I can find and address it.

---

## Problem

In production with multiprocessing mode, uptime results are frequently processed out of order when the consumer backlogs. This causes:

- False missed check detections
- Unnecessary backfill misses created

### Root Cause

- Arroyo's multiprocessing mode uses a shared worker pool across all partitions
- Multiple batches from the same Kafka partition can be processed concurrently by different workers
- No partition-to-process affinity, so results from the same subscription (consecutive minutes) can overlap in processing
- Example: 4:01 result processed by Worker A before 4:00 result processed by Worker B

### Why Not Other Solutions?

- **batched-parallel mode**: Not enough throughput, we need multiprocessing
- **Separate retry topic**: Still needs parallelism, creates cascading backlog issues
- **Horizontal scaling**: Operational complexity, doesn't fundamentally solve the ordering problem

## Goal

Implement a task-based retry mechanism that:

1. Buffers out-of-order results in Redis temporarily
2. Schedules Celery tasks to retry processing after brief delays
3. Uses exponential backoff to allow gaps to fill naturally
4. Falls back to normal backfill after maximum retry attempts
5. Prevents duplicate task scheduling with race condition handling
6. Tracks backlog size via delta metrics

## Solution Overview

When a result arrives out of order (gap detected), instead of immediately backfilling:

1. Store result in Redis sorted set for this subscription (key = scheduled_check_time_ms)
2. Schedule a Celery task with 10-second delay (if not already scheduled)
3. Task processes buffered results serially in time order
4. If gaps remain, reschedule task with backoff: 10s → 20s → 30s → 60s → 60s
5. Reset backoff if any results processed successfully
6. After 3 minutes total wait, give up and allow normal backfill

### Key Design Points

**Redis Data Structure:**

- Per-subscription sorted set: `uptime:backlog:{subscription_id}`
- Score = scheduled_check_time_ms
- Value = JSON serialized CheckResult
- TTL = 60 minutes FEEDBACK: This should be increased whenever we add a value here.

**Task Scheduling Flag:**

- Key: `uptime:backlog_task:{subscription_id}`
- Value: "1"
- TTL: 5 minutes (longer than max backoff)
- Prevents duplicate task scheduling
- Includes race condition handling (double-check after clearing)

**Backoff Strategy:**

```
Attempt 1: 10 seconds  (10s total)
Attempt 2: 20 seconds  (30s total)
Attempt 3: 30 seconds  (60s total)
Attempt 4: 60 seconds  (120s total)
Attempt 5: 60 seconds  (180s total)
After 5th: Stop retrying and process as normal, including backfilling misses
```

**Reset backoff to 10s if ANY results processed successfully**

**Circuit Breaker:**

- If sorted set reaches 10 items → bypass retry mechanism.
- Process everything immediately, allowing normal backfill
- Prevents unbounded buffer growth during extreme backlogs

## Implementation Strategy

### Breaking Into Small PRs

**PR1: Infrastructure Setup (Foundation)**

- Add Redis key helpers to `utils.py`
- Add helper functions for backoff calculation
- Add tests for utilities
- No consumer changes, no behavior changes
- **Goal**: Set up building blocks

**PR2: Extract Core Processing Logic (Refactor)**

- Extract processing logic from `handle_result()` into `_process_result_internal()`
- This method contains everything AFTER the queue check
- Update `handle_result()` to call `_process_result_internal()`
- Add tests to verify no behavior change
- **Goal**: Enable task to reuse processing logic without recursion

**PR3: Add Retry Task (Task Implementation)**

- Add `process_uptime_backlog` task to `tasks.py`
- Task calls `_process_result_internal()` directly (skips queue check)
- Add task tests
- Task is complete but not yet triggered by consumer
- **Goal**: Task logic is ready and tested

**PR4: Add Queueing Logic (Enable Feature)**

- Add `should_queue_for_retry()` and `queue_result_for_retry()` to consumer
- Integrate queue check into `handle_result()`
- Add feature flag: `organizations:uptime-backlog-retry`
- Add consumer tests
- **Goal**: Complete feature, ready for rollout

**PR5: Monitoring & Observability (Optional)**

# FEEDBACK: Is this just stuff for me to do? As in setting up the dashboards? You can drop this if so. If this is adding metrics in code, that should be done as we go along.

- Add dashboards for backlog metrics
- Add alerts for circuit breaker, timeout rates
- Documentation

### Key Insight: Avoiding Recursion

The task MUST NOT call `handle_result()` because that would re-trigger the queue check, causing infinite loops or weird rescheduling.

**Solution**: Extract core processing logic into `_process_result_internal()`:

- Takes result, detector, subscription, metric_tags
- Contains: record_check_metrics, mode handling, EAP production, last_update_ms update
- Does NOT contain: dedup check, backfill detection, queue check
  FEEDBACK: I think it should still contain the de-dupe check (as in, result["scheduled_check_time_ms"] <= last_update_ms), just in case anything changed and the timestamp moved ahead.
  FEEDBACK: I think it has backfill detection too? Although depends what you mean. It should perform a backfill if there are gaps

**Flow:**

```
Main Consumer: handle_result()
  ├─> Dedup check
  ├─> Backfill detection (if gaps found, create backfills)
  ├─> Queue check (should_queue_for_retry?)
  │   └─> YES: queue_result_for_retry(), RETURN
  │   └─> NO: continue
  └─> _process_result_internal()  ← Core processing

Task: process_uptime_backlog()
  └─> _process_result_internal()  ← Same core processing, skips queue logic
```

FEEDBACK: Isn't backfill detection meant to be after `_process_result_internal`? Actually, I think it should just remain where it is inside of `_process_result_internal`.

## Critical Files to Modify

1. **`src/sentry/uptime/utils.py`** - Add helper functions for Redis keys
2. **`src/sentry/uptime/tasks.py`** - Add `process_uptime_backlog` task
3. **`src/sentry/uptime/consumers/results_consumer.py`** - Add queueing logic to `handle_result()`
4. **`tests/sentry/uptime/consumers/test_results_consumer.py`** - Add integration tests
5. **`tests/sentry/uptime/test_tasks.py`** - Add task tests

## Metrics to Track

- `uptime.backlog.added` - Counter, incremented when result queued
- `uptime.backlog.removed` - Counter, incremented when result processed from queue
- `uptime.backlog.task_scheduled` - Counter, incremented when task scheduled
- `uptime.backlog.cleared` - Counter, incremented when queue fully drained
- `uptime.backlog.timeout` - Counter, incremented when giving up after max backoff
- `uptime.backlog.circuit_breaker` - Counter, incremented when buffer reaches 100
- `uptime.backlog.gap_detected` - Counter, incremented when task finds gap
- `uptime.backlog.rescheduling` - Counter, incremented when task reschedules

**Calculated metric (in dashboard):**

```
current_backlog_size = sum(uptime.backlog.added) - sum(uptime.backlog.removed)
```

## Edge Cases Handled

1. **Subscription deleted during retry** - Task checks if subscription exists, clears queue if not
2. **Redis failures** - Graceful degradation: if queueing fails, fall through to normal processing
3. **Task scheduling race condition** - Double-check queue after clearing flag
4. **Buffering mode** - Once subscription has backlog, ALL results (even in-order) must be queued
5. **Circuit breaker** - Prevents unbounded buffer growth during extreme backlogs
6. **Backoff reset** - Successful processing resets backoff, optimizes for common case
7. **TTL expiration** - Backlog keys expire after 10 minutes, prevents stale data
8. **Multiple task instances** - Task flag prevents concurrent execution, zrange is atomic

## Rollout Strategy

1. **Phase 1: Deploy with feature flag OFF**
   - Add feature flag: `organizations:uptime-backlog-retry`
   - Deploy code, monitor for issues

2. **Phase 2: Enable for small orgs**
   - Enable for 1-2 test organizations
   - Monitor metrics for 24-48 hours
   - Verify backlog queuing works, no data loss

3. **Phase 3: Gradual rollout**
   - Enable for 10% of organizations
   - Increase to 50%, then 100%
   - Monitor `uptime.backlog.*` metrics

4. **Phase 4: Remove feature flag**
   - After stable for 2+ weeks, remove flag
   - Make retry mechanism permanent

## Success Metrics

- **Reduction in false misses**: Compare backfill rate before/after
- **Improved ordering**: Monitor `uptime.backlog.cleared` (successful gap fills)
- **Low timeout rate**: `uptime.backlog.timeout` should be <5% of `uptime.backlog.added`
- **Circuit breaker rare**: `uptime.backlog.circuit_breaker` should be rare (<0.1%)
- **Fast processing**: Average queue size (via delta metrics) should be 1-2 items

---

# High-Level Summary Document

## What Problem Are We Solving?

In production, our uptime results consumer uses **multiprocessing mode** to handle high throughput (800-1200 results/partition/minute). However, Arroyo's multiprocessing architecture uses a shared worker pool across all Kafka partitions with no partition-to-process affinity.

**Result**: Results from the same subscription (consecutive check times) can be processed by different workers concurrently, leading to out-of-order processing.

**Example**:

- 4:00 result arrives → assigned to Worker B (slow)
- 4:01 result arrives → assigned to Worker A (fast)
- Worker A processes 4:01 first
- System detects gap at 4:00, creates backfill miss
- Worker B finally processes 4:00 (but it's now marked as duplicate/late)
- **User sees false missed check for 4:00**

## Why Not Other Solutions?

1. **batched-parallel mode**: Groups by subscription_id to preserve ordering, but can't keep up with our throughput requirements
2. **Separate retry topic, or re-inserting into topic**: Can create cascading backlog issues
3. **Partition affinity**: Would require modifying Arroyo core, too invasive. Might run into the same problems we've already had trying to run partitions in order.
4. **Horizontal scaling**: Doesn't fundamentally solve ordering

## How Does This Solution Work?

### Core Idea: Buffer and Retry

Instead of immediately creating backfill misses when a gap is detected, we:

1. **Buffer** the out-of-order result in Redis temporarily
2. **Schedule** a Celery task to retry processing after a short delay (10 seconds)
3. **Wait** for the missing result to arrive and be processed
4. **Retry** processing buffered results in correct order
5. **Give up** after 3 minutes and allow normal backfill

### Key Components

**1. Redis Sorted Set (per subscription)**

- Key: `uptime:backlog:{subscription_id}`
- Score: `scheduled_check_time_ms` (for time-ordered retrieval)
- Value: JSON serialized `CheckResult`
- TTL: 10 minutes

**2. Task Scheduling Flag (per subscription)**

- Key: `uptime:backlog_task:{subscription_id}`
- Value: "1" (simple flag)
- TTL: 5 minutes
- Purpose: Prevent duplicate task scheduling

**3. Celery Task: `process_uptime_backlog`**

- Reads buffered results from sorted set
- Processes consecutive results in order
- Stops at gaps and reschedules with backoff
- Gives up after 3 minutes total

**4. Exponential Backoff Strategy**

```
Attempt 1: wait 10 seconds  (10s total)
Attempt 2: wait 20 seconds  (30s total)
Attempt 3: wait 30 seconds  (60s total)
Attempt 4: wait 60 seconds  (120s total)
Attempt 5: wait 60 seconds  (180s total)
After 5th: Give up, process all, allow backfill for any remaining gaps
```

**Reset to 10s if any results processed successfully!**

### Flow Diagrams

**Normal Flow (No Gaps)**

```
Result arrives
  ↓
Dedup check → Skip if duplicate
  ↓
Backfill detection → No gaps
  ↓
Queue check → Not out of order, no backlog exists
  ↓
Process normally → EAP, notifications, state updates
```

**Out-of-Order Flow (4:01 arrives before 4:00)**

```
4:01 Result arrives (expected 4:00)
  ↓
Dedup check → Pass
  ↓
Backfill detection → Gap at 4:00 (but we don't create backfill yet!)
  ↓
Queue check → Out of order!
  ↓
Add to Redis sorted set
  ↓
Schedule task (if not already scheduled)
  ↓
RETURN (don't process 4:01 yet)

---

10 seconds later: Task fires
  ↓
Check queue: [4:01]
  ↓
Check expected: 4:00 (still missing)
  ↓
Gap still exists → Reschedule with 20s backoff
  ↓
RETURN

---

20 seconds later: Task fires again
  ↓
Meanwhile: 4:00 arrived, was queued too (subscription in buffering mode)
  ↓
Check queue: [4:00, 4:01] (time-ordered)
  ↓
Check expected: 4:00 ✓ Match!
  ↓
Process 4:00 → Update last_update_ms to 4:00
  ↓
Check expected: 4:01 ✓ Match!
  ↓
Process 4:01 → Update last_update_ms to 4:01
  ↓
Queue empty → Success! Clear flag
  ↓
DONE (no backfills needed!)
```

**Buffering Mode** (Critical Concept)
Once a subscription enters buffering mode (has items in the sorted set), **ALL** subsequent results for that subscription MUST be queued, even if they arrive in order. This prevents race conditions where some results bypass the queue while others are waiting.

### Safety Mechanisms

**1. Circuit Breaker (10 items)**
If buffer grows to 10 items:

- Bypass retry mechanism entirely
- Process all buffered results immediately
- Allow backfill logic to handle gaps
- Prevents unbounded buffer growth during extreme backlogs

**2. Timeout After 3 Minutes**
If gaps persist after max backoff:

- Process all remaining items
- Allow normal backfill for gaps
- Prevents indefinite queueing

**3. Race Condition Handling**
Task uses double-check pattern when clearing:

```python
if queue.empty():
    clear_flag()
    if queue.not_empty():  # Double-check!
        reschedule_task()
```

**4. Graceful Degradation**
If Redis fails or queueing errors occur, fall through to normal processing (with backfill).

## Code Architecture Changes

### Refactoring to Avoid Recursion

**Problem**: If task calls `processor.handle_result()`, it will re-trigger the queue check, causing infinite loops.

**Solution**: Extract core processing logic into `_process_result_internal()`:

```
handle_result()                    _process_result_internal()
├─ Dedup check                     ├─ Record metrics
├─ Backfill detection              ├─ Mode-specific handling
├─ Queue check                     ├─ EAP production
│  └─ queue_result_for_retry()     └─ Update last_update_ms
└─ _process_result_internal() ──────────┘
                                          ↑
                                          │
Task: process_uptime_backlog() ───────────┘
(calls _process_result_internal directly,
 skips queue check)
```

### PR Breakdown for Incremental Review

**PR1: Infrastructure Setup**

- Add Redis key helpers
- Add backoff calculation functions
- Tests for utilities
- **Safe**: No behavior changes

**PR2: Extract Processing Logic**

- Create `_process_result_internal()` method
- Refactor `handle_result()` to call it
- Tests to verify no behavior change
- **Safe**: Pure refactoring

**PR3: Add Retry Task**

- Implement `process_uptime_backlog` task
- Task calls `_process_result_internal()`
- Tests for task behavior
- **Safe**: Task exists but not triggered yet

**PR4: Enable Queueing**

- Add `should_queue_for_retry()` check
- Add `queue_result_for_retry()` logic
- Integrate into `handle_result()`
- Add feature flag
- **Safe**: Feature flag OFF by default

**PR5: Observability (Optional)**

- Dashboards for backlog metrics
- Alerts for anomalies
- Documentation

## Metrics & Monitoring

### Counter Metrics

- `uptime.backlog.added` - Result queued for retry
- `uptime.backlog.removed` - Result processed from queue
- `uptime.backlog.task_scheduled` - Task scheduled
- `uptime.backlog.cleared` - Queue fully drained (success!)
- `uptime.backlog.timeout` - Gave up after max backoff
- `uptime.backlog.circuit_breaker` - Buffer hit 100 items
- `uptime.backlog.gap_detected` - Task found gap on retry
- `uptime.backlog.rescheduling` - Task rescheduled

### Calculated Metrics (Dashboard)

```
current_backlog_size = sum(backlog.added) - sum(backlog.removed)
success_rate = backlog.cleared / backlog.task_scheduled
timeout_rate = backlog.timeout / backlog.added
```

### Alerts

- High timeout rate (>5% of added) → Gaps not filling, investigate
- Frequent circuit breaker (>0.1%) → Extreme backlogs, consider scaling
- Growing backlog size over time → Consumer falling behind

## Rollout Plan

1. **Deploy with feature flag OFF** → Verify no regressions
2. **Enable for 1-2 test orgs** → Monitor 24-48 hours
3. **Gradual rollout: 10% → 50% → 100%** → Watch metrics
4. **Remove feature flag after 2+ weeks stable**

## Expected Impact

### Before (Current State)

- Out-of-order processing during backlogs
- False missed checks created immediately
- Notifications sent for transient ordering issues
- Users see unreliable uptime data

### After (With Retry Mechanism)

- Out-of-order results buffered temporarily
- 90%+ of gaps fill naturally within 30 seconds (expected)
- Backfill only for true misses (network issues, checker failures)
- Users see accurate uptime data
- Notifications only for real incidents

### Success Criteria

- **50%+ reduction in backfill rate** during backlog periods
- **<5% timeout rate** (most gaps fill before giving up)
- **Average queue size 1-2 items** (fast clearing)
- **Circuit breaker rare** (<0.1% of queued results)
