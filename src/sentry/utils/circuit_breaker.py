"""
NOTE: This circuit breaker implementation is deprecated and is slated to eventually be removed. Use
the `CircuitBreaker` class found in `circuit_breaker2.py` instead.
"""

from collections.abc import Callable
from typing import ParamSpec, TypedDict, TypeVar

from django.core.cache import cache

from sentry import ratelimits as ratelimiter
from sentry.utils import metrics

# TODO: Right now this circuit breaker is based on count of consecutive errors. We should consider
# whether basing it on percentage of failed requests would be better.

DEFAULT_ERROR_LIMIT = 30
ERROR_COUNT_CACHE_KEY = lambda key: f"circuit_breaker:{key}-error-count"
PASSTHROUGH_RATELIMIT_KEY = lambda key: f"circuit_breaker:{key}-passthrough"


class CircuitBreakerPassthrough(TypedDict, total=True):
    limit: int
    window: int


class CircuitBreakerTripped(Exception):
    pass


class CircuitBreakerConfig(TypedDict, total=False):
    # The number of consecutive failures within a given window required to trigger the circuit breaker
    error_limit: int
    # The window of time in which those errors must happen
    error_limit_window: int
    # Allow a configurable subset of function calls to bypass the circuit breaker, for the purposes
    # of determining when the service is healthy again and requests to it can resume.
    allow_passthrough: bool
    # The number of function calls allowed to bypass the circuit breaker every
    # `passthrough_interval` seconds
    passthrough_attempts_per_interval: int
    # The window of time, in seconds, during which to allow `passthrough_attempts_per_interval`
    # calls to bypass the circuit breaker
    passthrough_interval: int


CIRCUIT_BREAKER_DEFAULTS = CircuitBreakerConfig(
    error_limit=DEFAULT_ERROR_LIMIT,
    error_limit_window=3600,  # 1 hour
    allow_passthrough=False,
    passthrough_interval=15,  # 15 sec
    passthrough_attempts_per_interval=1,
)

# TODO: Once we're on python 3.12, we can get rid of these and change the first line of the
# signature of `with_circuit_breaker` to
#   def with_circuit_breaker[T, **P](
P = ParamSpec("P")
T = TypeVar("T")


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


def with_circuit_breaker(
    key: str,
    callback: Callable[P, T],
    custom_config: CircuitBreakerConfig | None = None,
) -> T:
    """
    Attempts to call the given callback, subject to a circuit breaker which will prevent the
    callback from being called if has previously errored too many times in a row.

    If the breaker has been tripped, raises a `CircuitBreakerTripped` exception. If the callback is
    called, and errors, increments the error count before allowing the error to bubble up to this
    function's caller. Otherwise, simply returns the callback's result.

    Can optionally allow a subset of requests to bypass the circuit breaker, as a way to determine
    whether the service has recovered. Once one of these requests succeeds, the circuit breaker will
    be reset to its untripped state and the error count will be reset to 0.

    Note: The callback MUST NOT handle and then silently swallow exceptions, or else they won't
    count towards the ciruit-breaking. In other words, this function should be used - along with an
    `except CircuitBreakerTripped` block - inside the try-except wrapping the callback call:

        try:
            with_circuit_breaker("fire", play_with_fire, config)
            # or, if the callback takes arguments:
            # with_circuit_breaker("fire", lambda: play_with_fire(fuel_type="wood"), config)
        except CircuitBreakerTripped:
            logger.log("Once burned, twice shy. No playing with fire for you today. Try again tomorrow.")
        except BurnException:
            logger.log("Ouch!")

    The threshold for tripping the circuit breaker and whether to allow bypass requests (and if so,
    how many) can be set in the `config` argument. See the `CircuitBreakerConfig` class and
    `CIRCUIT_BREAKER_DEFAULTS`.
    """
    config: CircuitBreakerConfig = {**CIRCUIT_BREAKER_DEFAULTS, **(custom_config or {})}
    error_count_key = ERROR_COUNT_CACHE_KEY(key)

    if _should_call_callback(key, error_count_key, config):
        return _call_callback(error_count_key, config["error_limit_window"], callback)
    else:
        raise CircuitBreakerTripped


def _should_call_callback(
    key: str,
    error_count_key: str,
    config: CircuitBreakerConfig,
) -> bool:
    error_count = _get_or_set_error_count(error_count_key, config["error_limit_window"])
    if error_count < config["error_limit"]:
        return True

    # Limit has been exceeded, check if we should allow any requests to pass through
    if config["allow_passthrough"]:
        should_bypass = not ratelimiter.backend.is_limited(
            PASSTHROUGH_RATELIMIT_KEY(key),
            limit=config["passthrough_attempts_per_interval"],
            window=config["passthrough_interval"],
        )
        if should_bypass:
            metrics.incr(f"circuit_breaker.{key}.bypassed")
            return True

    metrics.incr(f"circuit_breaker.{key}.throttled")
    return False


def _call_callback(error_count_key: str, error_limit_window: int, callback: Callable[P, T]) -> T:
    try:
        result = callback()
    except Exception:
        _update_error_count(error_count_key, error_limit_window)
        raise
    else:
        _update_error_count(error_count_key, error_limit_window, reset=True)
        return result


def _update_error_count(
    error_count_key: str,
    error_limit_window: int,
    reset: bool = False,
) -> None:
    """
    Increment the count at the given key, unless `reset` is True, in which case, reset the count to 0.
    """
    if reset:
        new_count = 0
    else:
        new_count = _get_or_set_error_count(error_count_key, error_limit_window) + 1

    cache.set(error_count_key, new_count, error_limit_window)


def _get_or_set_error_count(error_count_key: str, error_limit_window: int) -> int:
    error_count = cache.get_or_set(error_count_key, default=0, timeout=error_limit_window)
    assert error_count is not None
    return error_count
