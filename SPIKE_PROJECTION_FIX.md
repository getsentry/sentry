# Fix for RateLimitExceeded: Spike Projection Concurrent Query Limit

## Problem Summary

The `getsentry.get_spike_projections` referrer is exceeding Snuba's concurrent query limit (100 queries), with 159 concurrent queries being attempted. This occurs because:

1. `start_spike_projection_batch` triggers `calculate_spike_projections`
2. This spawns many `calculate_spike_projection_for_organization` tasks (one per subscription/organization)
3. Each organization task spawns `run_spike_projection` tasks
4. Each `run_spike_projection` task makes a Snuba query
5. All these tasks run concurrently, overwhelming Snuba's rate limits

## Root Cause

The cascading `delay()` calls create unbounded concurrency:
- No rate limiting on task spawning
- No concurrency control on Snuba queries
- No batching or throttling mechanism

## Solution: Add Semaphore-Based Rate Limiting

### Implementation Approach

Add a distributed semaphore or simple rate limiting to control how many `run_spike_projection` tasks execute concurrently.

### Option 1: Task-Level Throttling (Recommended)

Use Redis-based distributed locking to limit concurrent execution:

```python
from django.core.cache import cache
import time

# In getsentry/tasks/project_spike_limits.py

# Maximum number of concurrent spike projection queries
MAX_CONCURRENT_SPIKE_QUERIES = 50  # Stay well below the 100 limit

def acquire_spike_projection_slot(timeout=300):
    """
    Acquire a slot to run spike projection query.
    Returns True if acquired, False if limit reached.
    """
    cache_key = "spike_projection_concurrent_queries"
    
    # Try to increment the counter
    for _ in range(10):  # Retry a few times
        current = cache.get(cache_key, 0)
        if current >= MAX_CONCURRENT_SPIKE_QUERIES:
            return False
        
        # Try to atomically increment
        # Use add() for atomic increment with expiry
        new_value = cache.incr(cache_key, 1) if cache.get(cache_key) else cache.add(cache_key, 1, timeout=timeout)
        if new_value and new_value <= MAX_CONCURRENT_SPIKE_QUERIES:
            return True
        
        time.sleep(0.1)  # Back off
    
    return False

def release_spike_projection_slot():
    """Release a spike projection query slot."""
    cache_key = "spike_projection_concurrent_queries"
    current = cache.get(cache_key, 0)
    if current > 0:
        cache.decr(cache_key, 1)

@instrumented_task(
    name="getsentry.tasks.run_spike_projection",
    namespace=billing_tasks,
    retry=Retry(times=3),
    processing_deadline_duration=90,
)
@with_metrics
def run_spike_projection(org_id: int, project_list: list[int] | None) -> None:
    # Try to acquire a slot
    max_wait_time = 60  # Wait up to 60 seconds
    start_time = time.time()
    
    while not acquire_spike_projection_slot():
        if time.time() - start_time > max_wait_time:
            logger.warning(
                "run_spike_projection.slot_wait_timeout",
                extra={"org_id": org_id, "wait_time": max_wait_time}
            )
            metrics.incr("run_spike_projection.slot_wait_timeout", sample_rate=1.0)
            # Skip this run rather than failing
            return
        
        time.sleep(1)  # Wait before retrying
    
    try:
        # Original logic
        org = Organization.objects.get(id=org_id)
        query = QueryDefinition(...)
        
        projected_spikes = get_spike_projections(
            org_id=org_id, project_list=project_list, query=query
        )
        
        # Process results...
        
    finally:
        # Always release the slot
        release_spike_projection_slot()
```

### Option 2: Batch Processing with Controlled Concurrency

Process organizations in smaller batches with delays:

```python
# In getsentry/tasks/project_spike_limits.py

# Add batch size configuration
SPIKE_PROJECTION_BATCH_SIZE = 25  # Process 25 orgs at a time
SPIKE_PROJECTION_BATCH_DELAY = 5  # Wait 5 seconds between batches

@instrumented_task(
    name="getsentry.tasks.calculate_spike_projections",
    namespace=billing_long_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=3),
)
def calculate_spike_projections(use_batching: bool = True, batch_time: str | None = None) -> None:
    subscriptions = get_all_active_subscriptions()
    
    # Split into smaller batches
    subscription_batches = [
        subscriptions[i:i + SPIKE_PROJECTION_BATCH_SIZE]
        for i in range(0, len(subscriptions), SPIKE_PROJECTION_BATCH_SIZE)
    ]
    
    for batch_index, batch in enumerate(subscription_batches):
        # Process batch
        for subscription in batch:
            calculate_spike_projection_for_organization.delay(
                organization_id=subscription.organization_id,
                end_datetime=three_days.isoformat(),
            )
        
        # Add delay between batches (except for last batch)
        if batch_index < len(subscription_batches) - 1:
            time.sleep(SPIKE_PROJECTION_BATCH_DELAY)
```

### Option 3: Exponential Backoff with Retry on RateLimitExceeded

Catch the rate limit exception and retry with backoff:

```python
from sentry.utils.snuba import RateLimitExceeded
import random

@instrumented_task(
    name="getsentry.tasks.run_spike_projection",
    namespace=billing_tasks,
    retry=Retry(times=5),  # Increase retry count
    processing_deadline_duration=120,  # Extend deadline
)
@with_metrics
def run_spike_projection(org_id: int, project_list: list[int] | None) -> None:
    max_retries = 3
    base_delay = 5  # Start with 5 second delay
    
    for attempt in range(max_retries):
        try:
            # Original logic
            org = Organization.objects.get(id=org_id)
            query = QueryDefinition(...)
            
            projected_spikes = get_spike_projections(
                org_id=org_id, project_list=project_list, query=query
            )
            
            # Process results...
            return  # Success
            
        except RateLimitExceeded as e:
            if attempt == max_retries - 1:
                # Last attempt failed, log and re-raise
                logger.error(
                    "run_spike_projection.rate_limit_exceeded_final",
                    extra={"org_id": org_id, "attempts": attempt + 1}
                )
                raise
            
            # Exponential backoff with jitter
            delay = base_delay * (2 ** attempt) + random.uniform(0, 2)
            logger.warning(
                "run_spike_projection.rate_limit_exceeded_retry",
                extra={
                    "org_id": org_id,
                    "attempt": attempt + 1,
                    "retry_delay": delay
                }
            )
            metrics.incr("run_spike_projection.rate_limit_retry", sample_rate=1.0)
            time.sleep(delay)
```

## Recommended Solution

**Use Option 1 (Task-Level Throttling) with Option 2 (Batch Processing):**

1. **Add Redis-based semaphore** to limit concurrent `run_spike_projection` tasks to 50 (well below the 100 limit)
2. **Add batch processing** in `calculate_spike_projections` to spread out task spawning over time
3. **Add monitoring** to track slot wait times and timeout rates

## Implementation Steps

1. Add the semaphore functions to `getsentry/tasks/project_spike_limits.py`
2. Wrap the `run_spike_projection` task with semaphore acquisition/release
3. Add batch processing to `calculate_spike_projections`
4. Add metrics and logging for monitoring
5. Set `MAX_CONCURRENT_SPIKE_QUERIES = 50` initially and tune based on metrics

## Monitoring

Add these metrics:
- `run_spike_projection.slot_acquired` - Successful slot acquisitions
- `run_spike_projection.slot_wait_timeout` - Timeouts waiting for slots
- `run_spike_projection.concurrent_queries` - Current concurrent query count
- `run_spike_projection.rate_limit_exceeded` - Rate limit exceptions (should drop to zero)

## Testing

1. Monitor `getsentry.get_spike_projections` concurrent query counts in Snuba
2. Verify they stay below 50 consistently
3. Check that spike projections still complete within acceptable time windows
4. Monitor for any `slot_wait_timeout` metrics indicating capacity issues
