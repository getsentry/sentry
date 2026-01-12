# Spike Projection Rate Limiting Fix - Deployment Guide

## Overview

This fix addresses the `RateLimitExceeded` error in spike projection tasks by implementing distributed rate limiting to control concurrent Snuba queries.

## Problem

The `getsentry.get_spike_projections` referrer was making 159 concurrent queries, exceeding Snuba's limit of 100, causing `RateLimitExceeded` errors and affecting customers.

## Solution Components

### 1. Rate Limiter Implementation (`spike_projection_rate_limiter.py`)

A Redis-based distributed rate limiter that:
- Limits concurrent spike projection queries to 50 (well below the 100 limit)
- Uses atomic cache operations for thread-safe concurrency control
- Automatically releases slots after 5 minutes to prevent stuck counters
- Provides context manager interface for easy integration
- Includes comprehensive metrics and logging

### 2. Task Integration (`spike_projection_integration_example.py`)

Modified versions of:
- `run_spike_projection`: Wraps query execution with rate limiting
- `calculate_spike_projections`: Adds batch processing with delays
- Monitoring and configuration helpers

### 3. Tests (`spike_projection_rate_limiter_test.py`)

Comprehensive test suite covering:
- Basic acquisition/release
- Concurrent access
- Load testing
- Edge cases
- Integration scenarios

## Deployment Steps

### Phase 1: Add Rate Limiter (Low Risk)

1. **Add the rate limiter module to getsentry:**
   ```bash
   cp spike_projection_rate_limiter.py getsentry/utils/spike_projection_rate_limiter.py
   ```

2. **Run tests to verify:**
   ```bash
   pytest getsentry/utils/spike_projection_rate_limiter_test.py -v
   ```

3. **Deploy** (no behavior change yet, just adding the module)

### Phase 2: Integrate Rate Limiting (Gradual Rollout)

1. **Modify `run_spike_projection` task in `getsentry/tasks/project_spike_limits.py`:**

   ```python
   from getsentry.utils.spike_projection_rate_limiter import spike_projection_rate_limit
   
   @instrumented_task(...)
   @with_metrics
   def run_spike_projection(org_id: int, project_list: list[int] | None) -> None:
       with spike_projection_rate_limit() as acquired:
           if not acquired:
               logger.warning("run_spike_projection.slot_not_acquired", ...)
               metrics.incr("run_spike_projection.skipped_no_slot")
               return  # Skip gracefully
           
           # Original implementation
           ...
   ```

2. **Add feature flag for gradual rollout (optional but recommended):**

   ```python
   from sentry import features
   
   def run_spike_projection(org_id: int, project_list: list[int] | None) -> None:
       if features.has("organizations:spike-projection-rate-limit", org_id):
           with spike_projection_rate_limit() as acquired:
               if not acquired:
                   return
               _run_spike_projection_impl(org_id, project_list)
       else:
           # Old behavior
           _run_spike_projection_impl(org_id, project_list)
   ```

3. **Deploy with feature flag disabled**

4. **Enable for small percentage of orgs, monitor metrics**

5. **Gradually increase to 100%**

### Phase 3: Add Batch Processing (Further Optimization)

1. **Modify `calculate_spike_projections` to process in batches:**

   ```python
   SPIKE_PROJECTION_ORG_BATCH_SIZE = 25
   SPIKE_PROJECTION_BATCH_DELAY_SECONDS = 2
   
   def calculate_spike_projections(...):
       subscriptions = get_all_active_subscriptions()
       
       # Process in batches
       for batch_idx in range(0, len(subscriptions), SPIKE_PROJECTION_ORG_BATCH_SIZE):
           batch = subscriptions[batch_idx:batch_idx + SPIKE_PROJECTION_ORG_BATCH_SIZE]
           
           for subscription in batch:
               calculate_spike_projection_for_organization.delay(...)
           
           # Delay between batches
           if batch_idx + SPIKE_PROJECTION_ORG_BATCH_SIZE < len(subscriptions):
               time.sleep(SPIKE_PROJECTION_BATCH_DELAY_SECONDS)
   ```

2. **Deploy and monitor**

## Configuration

### Rate Limiter Settings

Located in `spike_projection_rate_limiter.py`:

```python
MAX_CONCURRENT_SPIKE_QUERIES = 50  # Maximum concurrent queries
SLOT_TIMEOUT = 300                  # Auto-release after 5 minutes
SLOT_ACQUISITION_WAIT_TIME = 60     # Max wait time for a slot
SLOT_RETRY_INTERVAL = 1.0          # Seconds between retries
```

### Batch Processing Settings

Located in `spike_projection_integration_example.py`:

```python
SPIKE_PROJECTION_ORG_BATCH_SIZE = 25        # Orgs per batch
SPIKE_PROJECTION_BATCH_DELAY_SECONDS = 2   # Delay between batches
```

### Tuning Guidelines

**If you see high `skipped_no_slot` metrics:**
- Increase `MAX_CONCURRENT_SPIKE_QUERIES` (e.g., to 60 or 70, but keep below 100)
- Increase `SLOT_ACQUISITION_WAIT_TIME` to allow more wait time
- Decrease `SPIKE_PROJECTION_ORG_BATCH_SIZE` to spawn tasks more gradually

**If you still see RateLimitExceeded errors:**
- Decrease `MAX_CONCURRENT_SPIKE_QUERIES` (e.g., to 40)
- Increase `SPIKE_PROJECTION_BATCH_DELAY_SECONDS` to slow down task spawning
- Check for other referrers hitting the same storage_key

## Monitoring

### Key Metrics to Watch

1. **Rate Limit Metrics:**
   - `spike_projection.slot.acquired` - Successful slot acquisitions
   - `spike_projection.slot.released` - Slot releases
   - `spike_projection.slot.wait_timeout` - Tasks that couldn't acquire slots
   - `spike_projection.concurrent_queries` - Current concurrent count (gauge)
   - `spike_projection.utilization_percent` - Percentage of max capacity used

2. **Task Metrics:**
   - `run_spike_projection.started` - Tasks started
   - `run_spike_projection.completed` - Tasks completed successfully
   - `run_spike_projection.skipped_no_slot` - Tasks skipped due to no slot
   - `run_spike_projection.error` - Task errors

3. **Snuba Metrics:**
   - Monitor `getsentry.get_spike_projections` concurrent query count in Snuba
   - Should stay below 50 consistently

### Dashboards

Create a dashboard with:
- Concurrent query count over time
- Rate limit utilization percentage
- Skipped task rate
- Task completion rate
- RateLimitExceeded error count (should drop to zero)

### Alerts

Set up alerts for:
- `spike_projection.slot.wait_timeout > 10% of tasks` - Capacity issue
- `run_spike_projection.error rate > 5%` - General task failures
- `getsentry.get_spike_projections concurrent queries > 80` - Approaching limit

## Rollback Plan

If issues occur:

1. **Immediate rollback:**
   - Disable feature flag if using gradual rollout
   - Redeploy previous version of task code

2. **Clear stuck counter:**
   ```python
   from getsentry.utils.spike_projection_rate_limiter import reset_concurrent_count
   reset_concurrent_count()
   ```

3. **Emergency bypass:**
   - Set `MAX_CONCURRENT_SPIKE_QUERIES = 1000` (effectively disabling limit)
   - Redeploy

## Testing in Staging

Before production deployment:

1. **Run unit tests:**
   ```bash
   pytest getsentry/utils/spike_projection_rate_limiter_test.py -v
   ```

2. **Run integration tests:**
   - Trigger spike projection batch manually
   - Monitor concurrent query count in staging Snuba
   - Verify queries stay below limit

3. **Load test:**
   - Manually trigger multiple spike projection batches
   - Verify rate limiting works under load
   - Check for any deadlocks or stuck counters

## Success Criteria

The fix is successful when:

1. ✅ No `RateLimitExceeded` errors for `getsentry.get_spike_projections`
2. ✅ Concurrent query count stays below 50 consistently
3. ✅ `skipped_no_slot` rate < 5% of total tasks
4. ✅ Spike projections complete within normal time windows
5. ✅ No increase in task failures or errors

## Post-Deployment

1. **Monitor for 48 hours:**
   - Watch all metrics closely
   - Check Sentry for any new errors
   - Verify customer impact is eliminated

2. **Tune configuration if needed:**
   - Adjust `MAX_CONCURRENT_SPIKE_QUERIES` based on actual usage
   - Optimize batch sizes and delays

3. **Document learnings:**
   - Update runbooks
   - Share results with team

## Support

For issues or questions:
- Check monitoring dashboard
- Review logs in Sentry
- Use `get_spike_projection_rate_limit_config()` to inspect current state
- Contact the billing/spike protection team

## Files Delivered

1. `SPIKE_PROJECTION_FIX.md` - Detailed technical documentation
2. `spike_projection_rate_limiter.py` - Rate limiter implementation
3. `spike_projection_integration_example.py` - Integration code examples
4. `spike_projection_rate_limiter_test.py` - Comprehensive test suite
5. `SPIKE_PROJECTION_DEPLOYMENT.md` - This deployment guide

## Timeline Estimate

- Phase 1 (Add module): 1 day
- Phase 2 (Integrate with gradual rollout): 3-5 days
- Phase 3 (Add batching): 1-2 days
- Total: ~1 week for full deployment

## Risk Assessment

- **Low Risk:** Adding the rate limiter module (Phase 1)
- **Medium Risk:** Integrating rate limiting (Phase 2) - mitigated by gradual rollout
- **Low Risk:** Adding batch processing (Phase 3) - further optimization

With gradual rollout and comprehensive monitoring, this fix can be deployed safely with minimal risk to production.
