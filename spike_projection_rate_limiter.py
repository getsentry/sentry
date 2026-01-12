"""
Spike Projection Rate Limiting Implementation

This module provides rate limiting for spike projection queries to prevent
exceeding Snuba's concurrent query limits.

Usage:
    Add this to getsentry/tasks/project_spike_limits.py or import it there.
"""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from typing import TYPE_CHECKING

from django.core.cache import cache

from sentry.utils import metrics

if TYPE_CHECKING:
    from collections.abc import Generator

logger = logging.getLogger(__name__)

# Configuration
MAX_CONCURRENT_SPIKE_QUERIES = 50  # Stay well below Snuba's 100 limit
SLOT_TIMEOUT = 300  # 5 minutes - slots auto-release if task crashes
SLOT_ACQUISITION_WAIT_TIME = 60  # Maximum time to wait for a slot
SLOT_RETRY_INTERVAL = 1.0  # Seconds between slot acquisition retries

# Cache keys
SPIKE_PROJECTION_COUNTER_KEY = "spike_projection:concurrent_queries"
SPIKE_PROJECTION_LOCK_PREFIX = "spike_projection:lock:"


class SpikeProjectionRateLimiter:
    """
    Distributed rate limiter for spike projection queries using Redis.
    
    Limits the number of concurrent spike projection tasks to prevent
    overwhelming Snuba with too many concurrent queries.
    """

    def __init__(
        self,
        max_concurrent: int = MAX_CONCURRENT_SPIKE_QUERIES,
        timeout: int = SLOT_TIMEOUT,
        max_wait: int = SLOT_ACQUISITION_WAIT_TIME,
        retry_interval: float = SLOT_RETRY_INTERVAL,
    ):
        self.max_concurrent = max_concurrent
        self.timeout = timeout
        self.max_wait = max_wait
        self.retry_interval = retry_interval

    def _get_counter_key(self) -> str:
        """Get the cache key for the concurrent query counter."""
        return SPIKE_PROJECTION_COUNTER_KEY

    def _increment_counter(self) -> int | None:
        """
        Atomically increment the concurrent query counter.
        
        Returns:
            Current count after increment, or None if increment failed.
        """
        key = self._get_counter_key()
        
        try:
            # Try to increment existing counter
            current = cache.get(key)
            if current is None:
                # Counter doesn't exist, try to create it
                if cache.add(key, 1, timeout=self.timeout):
                    metrics.incr("spike_projection.counter.initialized", sample_rate=1.0)
                    return 1
                # Someone else created it, get the new value
                current = cache.get(key)
            
            if current is not None and current < self.max_concurrent:
                # Use incr for atomic increment
                new_value = cache.incr(key, 1)
                return new_value
            
            return None
        except Exception as e:
            logger.exception(
                "spike_projection.counter.increment_error",
                extra={"error": str(e)},
            )
            metrics.incr("spike_projection.counter.increment_error", sample_rate=1.0)
            return None

    def _decrement_counter(self) -> None:
        """Atomically decrement the concurrent query counter."""
        key = self._get_counter_key()
        
        try:
            current = cache.get(key)
            if current is not None and current > 0:
                cache.decr(key, 1)
                metrics.gauge("spike_projection.concurrent_queries", current - 1)
        except Exception as e:
            logger.exception(
                "spike_projection.counter.decrement_error",
                extra={"error": str(e)},
            )
            metrics.incr("spike_projection.counter.decrement_error", sample_rate=1.0)

    def acquire_slot(self) -> bool:
        """
        Try to acquire a slot for running a spike projection query.
        
        Waits up to max_wait seconds for a slot to become available.
        
        Returns:
            True if slot was acquired, False if timeout or max concurrent reached.
        """
        start_time = time.time()
        
        while True:
            current_count = self._increment_counter()
            
            if current_count is not None and current_count <= self.max_concurrent:
                # Successfully acquired slot
                elapsed = time.time() - start_time
                metrics.incr("spike_projection.slot.acquired", sample_rate=1.0)
                metrics.timing("spike_projection.slot.wait_time", elapsed * 1000)
                metrics.gauge("spike_projection.concurrent_queries", current_count)
                
                logger.info(
                    "spike_projection.slot.acquired",
                    extra={
                        "concurrent_count": current_count,
                        "wait_time_ms": elapsed * 1000,
                    },
                )
                return True
            
            # Check if we've exceeded wait time
            elapsed = time.time() - start_time
            if elapsed >= self.max_wait:
                metrics.incr("spike_projection.slot.wait_timeout", sample_rate=1.0)
                logger.warning(
                    "spike_projection.slot.wait_timeout",
                    extra={
                        "wait_time_ms": elapsed * 1000,
                        "max_wait_ms": self.max_wait * 1000,
                        "max_concurrent": self.max_concurrent,
                    },
                )
                return False
            
            # Wait before retrying
            time.sleep(self.retry_interval)

    def release_slot(self) -> None:
        """Release a previously acquired slot."""
        self._decrement_counter()
        metrics.incr("spike_projection.slot.released", sample_rate=1.0)
        logger.debug("spike_projection.slot.released")

    @contextmanager
    def limit(self) -> Generator[bool, None, None]:
        """
        Context manager for rate-limited spike projection execution.
        
        Usage:
            with rate_limiter.limit() as acquired:
                if acquired:
                    # Run spike projection query
                    ...
                else:
                    # Slot not acquired, handle gracefully
                    ...
        """
        acquired = self.acquire_slot()
        try:
            yield acquired
        finally:
            if acquired:
                self.release_slot()


# Global rate limiter instance
_rate_limiter = SpikeProjectionRateLimiter()


@contextmanager
def spike_projection_rate_limit() -> Generator[bool, None, None]:
    """
    Convenience function for rate-limiting spike projection queries.
    
    Usage in run_spike_projection task:
        with spike_projection_rate_limit() as acquired:
            if not acquired:
                logger.warning("Could not acquire slot, skipping")
                return
            
            # Run spike projection
            projected_spikes = get_spike_projections(...)
    """
    with _rate_limiter.limit() as acquired:
        yield acquired


def get_current_concurrent_count() -> int:
    """Get the current number of concurrent spike projection queries."""
    count = cache.get(SPIKE_PROJECTION_COUNTER_KEY, 0)
    return count if isinstance(count, int) else 0


def reset_concurrent_count() -> None:
    """
    Reset the concurrent query counter.
    
    This should only be used for maintenance or if the counter gets stuck.
    """
    cache.delete(SPIKE_PROJECTION_COUNTER_KEY)
    metrics.incr("spike_projection.counter.reset", sample_rate=1.0)
    logger.warning("spike_projection.counter.reset")
