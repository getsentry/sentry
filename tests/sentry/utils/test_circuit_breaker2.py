from unittest import TestCase
from unittest.mock import ANY, MagicMock, patch

from redis.client import Pipeline

from sentry.ratelimits.sliding_windows import Quota, RedisSlidingWindowRateLimiter
from sentry.testutils.helpers.datetime import freeze_time
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


@freeze_time()
class CircuitBreakerTest(TestCase):
    def setUp(self) -> None:
        self.config = DEFAULT_CONFIG
        self.breaker = MockCircuitBreaker("dogs_are_great", self.config)

        # Clear all existing keys from redis
        self.breaker.redis_pipeline.flushall()
        self.breaker.redis_pipeline.execute()

    def test_sets_default_values(self):
        breaker = self.breaker

        assert breaker.__dict__ == {
            "key": "dogs_are_great",
            "broken_state_key": "dogs_are_great.circuit_breaker.broken",
            "recovery_state_key": "dogs_are_great.circuit_breaker.in_recovery",
            "error_limit": 200,
            "recovery_error_limit": 20,
            "window": 3600,
            "window_granularity": 180,
            "broken_state_duration": 120,
            "recovery_duration": 7200,
            # These can't be compared with a simple equality check and therefore are tested
            # individually below
            "limiter": ANY,
            "primary_quota": ANY,
            "recovery_quota": ANY,
            "redis_pipeline": ANY,
        }
        assert isinstance(breaker.limiter, RedisSlidingWindowRateLimiter)
        assert isinstance(breaker.primary_quota, Quota)
        assert isinstance(breaker.recovery_quota, Quota)
        assert breaker.primary_quota.__dict__ == {
            "window_seconds": 3600,
            "granularity_seconds": 180,
            "limit": 200,
            "prefix_override": "dogs_are_great.circuit_breaker.ok",
        }
        assert breaker.recovery_quota.__dict__ == {
            "window_seconds": 3600,
            "granularity_seconds": 180,
            "limit": 20,
            "prefix_override": "dogs_are_great.circuit_breaker.recovery",
        }
        assert isinstance(breaker.redis_pipeline, Pipeline)

    @patch("sentry.utils.circuit_breaker2.logger")
    def test_fixes_too_loose_recovery_limit(self, mock_logger: MagicMock):
        config: CircuitBreakerConfig = {
            **DEFAULT_CONFIG,
            "error_limit": 200,
            "recovery_error_limit": 400,
        }
        breaker = MockCircuitBreaker("dogs_are_great", config)

        mock_logger.warning.assert_called_with(
            "Circuit breaker '%s' has a recovery error limit (%d) greater than or equal"
            + " to its primary error limit (%d). Using the stricter error-limit-based"
            + " default (%d) instead.",
            breaker.key,
            400,
            200,
            20,
        )
        assert breaker.recovery_error_limit == 20

    @patch("sentry.utils.circuit_breaker2.logger")
    def test_warns_about_mismatched_state_durations(self, mock_logger: MagicMock):
        config: CircuitBreakerConfig = {
            **DEFAULT_CONFIG,
            "error_limit_window": 600,
            "broken_state_duration": 100,
            "recovery_duration": 200,
        }
        breaker = MockCircuitBreaker("dogs_are_great", config)

        mock_logger.warning.assert_called_with(
            "Circuit breaker '%s' has BROKEN and RECOVERY state durations (%d and %d sec, respectively)"
            + " which together are less than the main error limit window (%d sec). This can lead to the"
            + " breaker getting tripped unexpectedly, until the original spike in errors clears the"
            + " main time window.",
            breaker.key,
            100,
            200,
            600,
        )
