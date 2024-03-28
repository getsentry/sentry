from datetime import datetime

from django.core.cache import cache

from sentry.utils import metrics

DEFAULT_ERROR_LIMIT = 100
ERROR_COUNT_CACHE_KEY = lambda key: f"circuit_breaker:{key}-error-count"
PASSTHROUGH_COUNT_CACHE_KEY = lambda key: f"circuit_breaker:{key}-passthrough"


def circuit_breaker_activated(
    key: str,
    error_limit: int = DEFAULT_ERROR_LIMIT,
    passthrough_limit: int | None = None,
) -> bool:
    """
    Activates the circuit breaker if the error count for a cache key exceeds the error limit.

    The circuit breaker can allow a certain number of requests to pass through per minute, defined by
    the passthrough limit if provided.
    """
    failure_count = cache.get(ERROR_COUNT_CACHE_KEY(key), 0)
    if failure_count < error_limit:
        return False  # not blocked

    # Limit has been exceeded, check if we should allow any requests to pass through
    if passthrough_limit:
        passthrough_count, start_time = cache.get(
            PASSTHROUGH_COUNT_CACHE_KEY(key), (0, datetime.now())
        )

        # If the last event allowed through was more than a minute ago, reset the clock
        if (datetime.now() - start_time).total_seconds() > 60:
            passthrough_count = 0
            start_time = datetime.now()

        if passthrough_count < passthrough_limit:
            cache.set(PASSTHROUGH_COUNT_CACHE_KEY(key), (passthrough_count + 1, start_time), 60)
            metrics.incr(f"circuit_breaker.{key}.bypassed")
            return False  # not blocked

    metrics.incr(f"circuit_breaker.{key}.throttled")
    return True  # blocked
