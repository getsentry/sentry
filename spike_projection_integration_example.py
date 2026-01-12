"""
Example integration of rate limiting into getsentry spike projection tasks.

This file shows how to modify the existing getsentry/tasks/project_spike_limits.py
to use the rate limiter and prevent RateLimitExceeded errors.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Any

from django.core.cache import cache
from django.utils import timezone

from sentry.models.organization import Organization
from sentry.snuba.outcomes import QueryDefinition
from sentry.taskworker.retry import Retry
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

# Import the rate limiter
from spike_projection_rate_limiter import spike_projection_rate_limit

logger = logging.getLogger("getsentry.spike-protection")

# Placeholder namespaces - these should match actual getsentry namespaces
billing_tasks = None  # Replace with actual namespace
billing_long_tasks = None  # Replace with actual namespace


# =============================================================================
# Modified run_spike_projection task with rate limiting
# =============================================================================

@instrumented_task(
    name="getsentry.tasks.run_spike_projection",
    namespace=billing_tasks,
    retry=Retry(times=3),
    processing_deadline_duration=90,
)
def run_spike_projection(org_id: int, project_list: list[int] | None) -> None:
    """
    MODIFIED VERSION: Run spike projection with rate limiting.
    
    This version uses the spike_projection_rate_limit context manager to
    ensure we don't exceed Snuba's concurrent query limits.
    """
    metrics.incr("run_spike_projection.started", sample_rate=1.0)
    
    # Try to acquire a rate limit slot
    with spike_projection_rate_limit() as acquired:
        if not acquired:
            # Could not acquire slot within timeout
            logger.warning(
                "run_spike_projection.slot_not_acquired",
                extra={
                    "organization_id": org_id,
                    "project_count": len(project_list) if project_list else 0,
                },
            )
            metrics.incr("run_spike_projection.skipped_no_slot", sample_rate=1.0)
            
            # Optionally: Retry the task later
            # raise RetryTaskError("Could not acquire rate limit slot")
            
            # Or: Skip gracefully (recommended to avoid cascading failures)
            return
        
        # Slot acquired, proceed with spike projection
        try:
            _run_spike_projection_impl(org_id, project_list)
            metrics.incr("run_spike_projection.completed", sample_rate=1.0)
        except Exception as e:
            logger.exception(
                "run_spike_projection.error",
                extra={"organization_id": org_id, "error": str(e)},
            )
            metrics.incr("run_spike_projection.error", sample_rate=1.0)
            raise


def _run_spike_projection_impl(org_id: int, project_list: list[int] | None) -> None:
    """
    Original spike projection implementation (extracted for clarity).
    
    This is the actual logic that was in run_spike_projection before adding
    rate limiting.
    """
    # Get organization
    try:
        org = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning(
            "run_spike_projection.org_not_found",
            extra={"organization_id": org_id},
        )
        return
    
    # Build query
    three_days = timezone.now() + timedelta(days=3)
    query = QueryDefinition(
        # ... query definition ...
    )
    
    # Run the actual Snuba query (this is what hits the rate limit)
    from getsentry.tasks.project_spike_limits import get_spike_projections
    
    projected_spikes = get_spike_projections(
        org_id=org_id, project_list=project_list, query=query
    )
    
    # Process results
    # ... rest of the original logic ...


# =============================================================================
# Modified calculate_spike_projections with batching
# =============================================================================

# Batch size to prevent spawning too many tasks at once
SPIKE_PROJECTION_ORG_BATCH_SIZE = 25
SPIKE_PROJECTION_BATCH_DELAY_SECONDS = 2


@instrumented_task(
    name="getsentry.tasks.calculate_spike_projections",
    namespace=billing_long_tasks,
    processing_deadline_duration=60,
    retry=Retry(times=3),
)
def calculate_spike_projections(use_batching: bool = True, batch_time: str | None = None) -> None:
    """
    MODIFIED VERSION: Calculate spike projections with batched task spawning.
    
    This version processes organizations in batches to avoid spawning hundreds
    of concurrent tasks at once.
    """
    metrics.incr("calculate_spike_projections.started", sample_rate=1.0)
    
    # Get all active subscriptions (placeholder)
    # subscriptions = get_all_active_subscriptions()
    subscriptions = []  # Replace with actual subscription fetching
    
    if not subscriptions:
        logger.info("calculate_spike_projections.no_subscriptions")
        return
    
    logger.info(
        "calculate_spike_projections.processing",
        extra={"subscription_count": len(subscriptions)},
    )
    
    # Calculate end datetime
    three_days = timezone.now() + timedelta(days=3)
    end_datetime = three_days.isoformat()
    
    # Process subscriptions in batches
    total_batches = (len(subscriptions) + SPIKE_PROJECTION_ORG_BATCH_SIZE - 1) // SPIKE_PROJECTION_ORG_BATCH_SIZE
    
    for batch_idx in range(0, len(subscriptions), SPIKE_PROJECTION_ORG_BATCH_SIZE):
        batch = subscriptions[batch_idx:batch_idx + SPIKE_PROJECTION_ORG_BATCH_SIZE]
        batch_num = (batch_idx // SPIKE_PROJECTION_ORG_BATCH_SIZE) + 1
        
        logger.info(
            "calculate_spike_projections.processing_batch",
            extra={
                "batch_number": batch_num,
                "total_batches": total_batches,
                "batch_size": len(batch),
            },
        )
        
        # Spawn tasks for this batch
        for subscription in batch:
            # Import the actual task here to avoid circular imports
            from getsentry.tasks.project_spike_limits import calculate_spike_projection_for_organization
            
            calculate_spike_projection_for_organization.delay(
                organization_id=subscription.organization_id,
                end_datetime=end_datetime,
            )
        
        # Add delay between batches (except for last batch)
        if batch_num < total_batches:
            logger.debug(
                "calculate_spike_projections.batch_delay",
                extra={"delay_seconds": SPIKE_PROJECTION_BATCH_DELAY_SECONDS},
            )
            time.sleep(SPIKE_PROJECTION_BATCH_DELAY_SECONDS)
    
    metrics.incr(
        "calculate_spike_projections.completed",
        sample_rate=1.0,
        tags={"subscription_count": len(subscriptions)},
    )
    
    logger.info(
        "calculate_spike_projections.completed",
        extra={
            "subscription_count": len(subscriptions),
            "batches_processed": total_batches,
        },
    )


# =============================================================================
# Additional: Monitoring and maintenance tasks
# =============================================================================

@instrumented_task(
    name="getsentry.tasks.monitor_spike_projection_rate_limit",
    namespace=billing_tasks,
    processing_deadline_duration=30,
)
def monitor_spike_projection_rate_limit() -> None:
    """
    Monitoring task to track spike projection rate limit usage.
    
    Can be run periodically (e.g., every minute) to emit metrics about
    the rate limiter's state.
    """
    from spike_projection_rate_limiter import get_current_concurrent_count
    
    concurrent_count = get_current_concurrent_count()
    
    metrics.gauge("spike_projection.concurrent_queries_current", concurrent_count)
    
    # Calculate utilization percentage
    from spike_projection_rate_limiter import MAX_CONCURRENT_SPIKE_QUERIES
    utilization = (concurrent_count / MAX_CONCURRENT_SPIKE_QUERIES) * 100
    metrics.gauge("spike_projection.utilization_percent", utilization)
    
    logger.info(
        "spike_projection.rate_limit_status",
        extra={
            "concurrent_count": concurrent_count,
            "max_concurrent": MAX_CONCURRENT_SPIKE_QUERIES,
            "utilization_percent": utilization,
        },
    )


# =============================================================================
# Fallback: Handle RateLimitExceeded with exponential backoff
# =============================================================================

def run_spike_projection_with_fallback(org_id: int, project_list: list[int] | None) -> None:
    """
    Alternative implementation with exponential backoff as a fallback.
    
    This can be used in addition to rate limiting as a second line of defense.
    """
    from sentry.utils.snuba import RateLimitExceeded
    import random
    
    max_retries = 3
    base_delay = 5  # seconds
    
    for attempt in range(max_retries):
        try:
            with spike_projection_rate_limit() as acquired:
                if not acquired:
                    logger.warning(
                        "run_spike_projection.no_slot",
                        extra={"org_id": org_id, "attempt": attempt + 1},
                    )
                    metrics.incr("run_spike_projection.no_slot", sample_rate=1.0)
                    return
                
                _run_spike_projection_impl(org_id, project_list)
                return  # Success
                
        except RateLimitExceeded as e:
            if attempt == max_retries - 1:
                # Last attempt failed
                logger.error(
                    "run_spike_projection.rate_limit_final_failure",
                    extra={
                        "org_id": org_id,
                        "attempts": attempt + 1,
                        "error": str(e),
                    },
                )
                metrics.incr("run_spike_projection.rate_limit_final_failure", sample_rate=1.0)
                raise
            
            # Exponential backoff with jitter
            delay = base_delay * (2 ** attempt) + random.uniform(0, 2)
            logger.warning(
                "run_spike_projection.rate_limit_retry",
                extra={
                    "org_id": org_id,
                    "attempt": attempt + 1,
                    "retry_delay_seconds": delay,
                },
            )
            metrics.incr("run_spike_projection.rate_limit_retry", sample_rate=1.0)
            time.sleep(delay)


# =============================================================================
# Configuration tuning helpers
# =============================================================================

def get_spike_projection_rate_limit_config() -> dict[str, Any]:
    """
    Get current rate limit configuration.
    
    Can be used to expose configuration via admin endpoint or monitoring.
    """
    from spike_projection_rate_limiter import (
        MAX_CONCURRENT_SPIKE_QUERIES,
        SLOT_TIMEOUT,
        SLOT_ACQUISITION_WAIT_TIME,
        get_current_concurrent_count,
    )
    
    return {
        "max_concurrent_queries": MAX_CONCURRENT_SPIKE_QUERIES,
        "slot_timeout_seconds": SLOT_TIMEOUT,
        "max_wait_seconds": SLOT_ACQUISITION_WAIT_TIME,
        "current_concurrent_count": get_current_concurrent_count(),
        "batch_size": SPIKE_PROJECTION_ORG_BATCH_SIZE,
        "batch_delay_seconds": SPIKE_PROJECTION_BATCH_DELAY_SECONDS,
    }
