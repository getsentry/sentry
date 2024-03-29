from typing import TypedDict

from django.core.cache import cache

from sentry import ratelimits as ratelimiter
from sentry.utils import metrics

DEFAULT_ERROR_LIMIT = 30
ERROR_COUNT_CACHE_KEY = lambda key: f"circuit_breaker:{key}-error-count"
PASSTHROUGH_RATELIMIT_KEY = lambda key: f"circuit_breaker:{key}-passthrough"


class CircuitBreakerPassthrough(TypedDict, total=True):
    limit: int
    window: int


def circuit_breaker_activated(
    key: str,
    error_limit: int = DEFAULT_ERROR_LIMIT,
    passthrough_data: CircuitBreakerPassthrough | None = None,
) -> bool:
    """
    Activates the circuit breaker if the error count for a cache key exceeds the error limit.

    The circuit breaker can allow a certain number of requests to pass through per minute, defined by
    the passthrough limit if provided.
    """
    failure_count = cache.get_or_set(ERROR_COUNT_CACHE_KEY(key), default=0, timeout=60 * 60) or 0
    if failure_count < error_limit:
        return False  # not blocked

    # Limit has been exceeded, check if we should allow any requests to pass through
    if passthrough_data:
        if not ratelimiter.backend.is_limited(
            PASSTHROUGH_RATELIMIT_KEY(key),
            limit=passthrough_data["limit"],
            window=passthrough_data["window"],
        ):
            metrics.incr(f"circuit_breaker.{key}.bypassed")
            return False  # not blocked

    metrics.incr(f"circuit_breaker.{key}.throttled")
    return True  # blocked
