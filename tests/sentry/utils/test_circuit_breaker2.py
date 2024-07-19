from sentry.utils.circuit_breaker2 import CircuitBreaker, CircuitBreakerConfig

# Note: These need to be relatively big. If the limit is too low, the RECOVERY quota isn't big
# enough to be useful, and if the window is too short, redis (which doesn't seem to listen to the
# @freezetime decorator) will expire the state keys.
DEFAULT_CONFIG: CircuitBreakerConfig = {
    "error_limit": 200,
    "error_limit_window": 3600,  # 1 hr
    "broken_state_duration": 120,  # 2 min
}


class MockCircuitBreaker(CircuitBreaker):
    """
    A circuit breaker with extra methods useful for mocking state.

    To understand the methods below, it helps to understand the sliding window rate limiter which
    powers the circuit breaker. Details can be found in
    .venv/lib/python3.11/site-packages/sentry_redis_tools/sliding_windows_rate_limiter.py, but
    TL;DR, quota usage during the time window is tallied in buckets ("granules"), and as time passes
    the window slides forward one granule at a time. To be able to mimic this, most of the methods
    here operate at the granule level.
    """
