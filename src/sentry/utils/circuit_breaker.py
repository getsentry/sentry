from django.core.cache import cache

from sentry import ratelimits as ratelimiter
from sentry.utils import metrics

DEFAULT_ERROR_LIMIT = 30
ERROR_COUNT_CACHE_KEY = lambda key: f"circuit_breaker:{key}-error-count"
PASSTHROUGH_RATELIMIT_KEY = lambda key: f"circuit_breaker:{key}-passthrough"


def circuit_breaker_activated(
    key: str,
    error_limit: int = DEFAULT_ERROR_LIMIT,
    passthrough_data: list | None = None,
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
    if passthrough_data:
        if not ratelimiter.backend.is_limited(
            PASSTHROUGH_RATELIMIT_KEY(key),
            limit=passthrough_data[0],
            window=passthrough_data[1],
        ):
            metrics.incr(f"circuit_breaker.{key}.bypassed")
            return False  # not blocked

    metrics.incr(f"circuit_breaker.{key}.throttled")
    return True  # blocked
