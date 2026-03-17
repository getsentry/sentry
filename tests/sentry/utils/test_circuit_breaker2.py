import time
from typing import Any
from unittest import TestCase
from unittest.mock import ANY, MagicMock, patch

import time_machine
from django.conf import settings
from redis.client import Pipeline

from sentry.ratelimits.sliding_windows import (
    GrantedQuota,
    Quota,
    RedisSlidingWindowRateLimiter,
    RequestedQuota,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.circuit_breaker2 import CircuitBreaker, CircuitBreakerConfig, CircuitBreakerState

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

    To understand the methods below, it helps to understand the `RedisSlidingWindowRateLimiter`
    which powers the circuit breaker. Details can be found in
    https://github.com/getsentry/sentry-redis-tools/blob/d4f3dc883b1137d82b6b7a92f4b5b41991c1fc8a/sentry_redis_tools/sliding_windows_rate_limiter.py,
    (which is the implementation behind the rate limiter) but TL;DR, quota usage during the time
    window is tallied in buckets ("granules"), and as time passes the window slides forward one
    granule at a time. To be able to mimic this, most of the methods here operate at the granule
    level.
    """

    def _set_breaker_state(
        self, state: CircuitBreakerState, seconds_left: int | None = None
    ) -> None:
        """
        Adjust redis keys to force the breaker into the given state. If no remaining seconds are
        given, puts the breaker at the beginning of its time in the given state.
        """
        now = int(time.time())

        if state == CircuitBreakerState.OK:
            self._delete_from_redis([self.broken_state_key, self.recovery_state_key])

        elif state == CircuitBreakerState.BROKEN:
            broken_state_timeout = seconds_left or self.broken_state_duration
            broken_state_end = now + broken_state_timeout
            recovery_timeout = broken_state_timeout + self.recovery_duration
            recovery_end = now + recovery_timeout

            self._set_in_redis(
                [
                    (self.broken_state_key, broken_state_end, broken_state_timeout),
                    (self.recovery_state_key, recovery_end, recovery_timeout),
                ]
            )

        elif state == CircuitBreakerState.RECOVERY:
            recovery_timeout = seconds_left or self.recovery_duration
            recovery_end = now + recovery_timeout

            self._delete_from_redis([self.broken_state_key])
            self._set_in_redis([(self.recovery_state_key, recovery_end, recovery_timeout)])

        assert self._get_state_and_remaining_time() == (
            state,
            (
                None
                if state == CircuitBreakerState.OK
                else (
                    broken_state_timeout
                    if state == CircuitBreakerState.BROKEN
                    else recovery_timeout
                )
            ),
        )

    def _add_quota_usage(
        self,
        quota: Quota,
        amount_used: int,
        granule_or_window_end: int | None = None,
    ) -> None:
        """
        Add to the usage total of the given quota, in the granule or window ending at the given
        time. If a window (rather than a granule) end time is given, usage will be added to the
        final granule.

        If no end time is given, the current time will be used.
        """
        now = int(time.time())
        window_end_time = granule_or_window_end or now

        self.limiter.use_quotas(
            [RequestedQuota(self.key, amount_used, [quota])],
            [GrantedQuota(self.key, amount_used, [])],
            window_end_time,
        )

    def _delete_from_redis(self, keys: list[str]) -> Any:
        for key in keys:
            self.redis_pipeline.delete(key)
        return self.redis_pipeline.execute()


@freeze_time()
class CircuitBreakerTest(TestCase):
    def setUp(self) -> None:
        self.config = DEFAULT_CONFIG
        self.breaker = MockCircuitBreaker("dogs_are_great", self.config)

        # Clear all existing keys from redis
        self.breaker.redis_pipeline.flushall()
        self.breaker.redis_pipeline.execute()

    def test_sets_default_values(self) -> None:
        breaker = self.breaker

        assert breaker.__dict__ == {
            "key": "dogs_are_great",
            "metrics_key": "dogs_are_great",
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
            # Rate-based fields default to disabled
            "error_rate_threshold": None,
            "error_floor": None,
            "total_requests_quota": None,
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

    def test_metrics_key_defaults_to_key(self) -> None:
        breaker = MockCircuitBreaker("dogs_are_great", DEFAULT_CONFIG)
        assert breaker.metrics_key == "dogs_are_great"

    @patch("sentry.utils.circuit_breaker2.metrics.incr")
    def test_metrics_key_override_used_in_metrics(self, mock_metrics_incr: MagicMock) -> None:
        config: CircuitBreakerConfig = {**DEFAULT_CONFIG, "metrics_key": "system.webhook"}
        breaker = MockCircuitBreaker("sentry_app.12345", config)
        assert breaker.key == "sentry_app.12345"
        assert breaker.metrics_key == "system.webhook"

        # Cache keys still use the per-app key
        assert "sentry_app.12345" in breaker.broken_state_key

        # Metrics use the system-level key
        breaker._set_breaker_state(CircuitBreakerState.BROKEN)
        breaker.should_allow_request()
        mock_metrics_incr.assert_called_with("circuit_breaker.system.webhook.request_blocked")

    @patch("sentry.utils.circuit_breaker2.logger")
    def test_fixes_too_loose_recovery_limit(self, mock_logger: MagicMock) -> None:
        config: CircuitBreakerConfig = {
            **DEFAULT_CONFIG,
            "error_limit": 200,
            "recovery_error_limit": 400,
        }

        for settings_debug_value, expected_log_function in [
            (True, mock_logger.error),
            (False, mock_logger.warning),
        ]:
            settings.DEBUG = settings_debug_value
            breaker = MockCircuitBreaker("dogs_are_great", config)

            expected_log_function.assert_called_with(
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
    def test_rejects_partial_rate_config(self, mock_logger: MagicMock) -> None:
        for settings_debug_value, expected_log_function in [
            (True, mock_logger.error),
            (False, mock_logger.warning),
        ]:
            settings.DEBUG = settings_debug_value

            partial_config: CircuitBreakerConfig = {
                **DEFAULT_CONFIG,
                "error_floor": 100,
            }  # missing error_rate_threshold
            breaker = MockCircuitBreaker("dogs_are_great", partial_config)

            expected_log_function.assert_called_with(
                "Circuit breaker '%s' requires both 'error_rate_threshold' and 'error_floor' to "
                "enable rate-based mode, but only one was provided. Falling back to count-based "
                "tripping.",
                "dogs_are_great",
            )
            assert breaker.error_rate_threshold is None
            assert breaker.error_floor is None
            assert breaker.total_requests_quota is None
            assert breaker._rate_based is False
            expected_log_function.reset_mock()

    @patch("sentry.utils.circuit_breaker2.logger")
    def test_fixes_mismatched_state_durations(self, mock_logger: MagicMock) -> None:
        config: CircuitBreakerConfig = {
            **DEFAULT_CONFIG,
            "error_limit_window": 600,
            "broken_state_duration": 100,
            "recovery_duration": 200,
        }
        for settings_debug_value, expected_log_function in [
            (True, mock_logger.error),
            (False, mock_logger.warning),
        ]:
            settings.DEBUG = settings_debug_value
            breaker = MockCircuitBreaker("dogs_are_great", config)

            expected_log_function.assert_called_with(
                "Circuit breaker '%s' has BROKEN and RECOVERY state durations (%d and %d sec, respectively)"
                + " which together are less than the main error limit window (%d sec). This can lead to the"
                + " breaker getting tripped unexpectedly, until the original spike in errors clears the"
                + " main time window. Extending RECOVERY period to %d seconds, to give the primary quota time"
                + " to clear.",
                breaker.key,
                100,
                200,
                600,
                500,
            )
            assert breaker.recovery_duration == 500


@freeze_time()
class RecordErrorTest(TestCase):
    def setUp(self) -> None:
        self.config = DEFAULT_CONFIG
        self.breaker = MockCircuitBreaker("dogs_are_great", self.config)

        # Clear all existing keys from redis
        self.breaker.redis_pipeline.flushall()
        self.breaker.redis_pipeline.execute()

    def test_increments_error_count(self) -> None:
        config = self.config
        breaker = self.breaker

        # The breaker starts with a clean slate
        assert breaker._get_remaining_error_quota() == config["error_limit"]

        breaker.record_error()

        # The error has been tallied
        assert breaker._get_remaining_error_quota() == config["error_limit"] - 1

    def test_no_error_recorded_in_broken_state(self) -> None:
        breaker = self.breaker

        breaker._set_breaker_state(CircuitBreakerState.BROKEN)
        breaker._add_quota_usage(breaker.primary_quota, breaker.error_limit)

        # Because we're in the BROKEN state, we start with the main quota maxed out and the
        # RECOVERY quota yet to be used
        assert breaker._get_remaining_error_quota(breaker.primary_quota) == 0
        assert (
            breaker._get_remaining_error_quota(breaker.recovery_quota)
            == breaker.recovery_error_limit
        )

        breaker.record_error()

        # Neither quota is incremented
        assert breaker._get_remaining_error_quota(breaker.primary_quota) == 0
        assert (
            breaker._get_remaining_error_quota(breaker.recovery_quota)
            == breaker.recovery_error_limit
        )

    @patch("sentry.utils.circuit_breaker2.logger")
    def test_logs_a_warning_in_broken_state(self, mock_logger: MagicMock) -> None:
        breaker = self.breaker

        seconds_ellapsed_since_circuit_break = 2
        breaker._set_breaker_state(
            CircuitBreakerState.BROKEN,
            seconds_left=breaker.broken_state_duration - seconds_ellapsed_since_circuit_break,
        )

        breaker.record_error()

        # No log - we just switched into BROKEN state, and even though we're not supposed to land in
        # the `record_error` method in that state, there's a small buffer to account for race
        # conditions
        assert mock_logger.warning.call_count == 0

        seconds_ellapsed_since_circuit_break = 20
        breaker._set_breaker_state(
            CircuitBreakerState.BROKEN,
            seconds_left=breaker.broken_state_duration - seconds_ellapsed_since_circuit_break,
        )

        breaker.record_error()

        # Now we do log a warning, because at this point we can no longer blame a race condition -
        # it's been too long since the circuit broke
        mock_logger.warning.assert_called_with(
            "Attempt to record circuit breaker error while circuit is in BROKEN state",
            extra={"key": "dogs_are_great", "time_in_state": 20},
        )

    @patch("sentry.utils.circuit_breaker2.metrics.incr")
    @patch("sentry.utils.circuit_breaker2.logger")
    def test_handles_hitting_max_errors_in_non_broken_state(
        self, mock_logger: MagicMock, mock_metrics_incr: MagicMock
    ):
        config = self.config
        breaker = self.breaker
        now = int(time.time())

        for state, quota, limit in [
            (CircuitBreakerState.OK, breaker.primary_quota, breaker.error_limit),
            (CircuitBreakerState.RECOVERY, breaker.recovery_quota, breaker.recovery_error_limit),
        ]:
            breaker._set_breaker_state(state)
            breaker._add_quota_usage(quota, limit - 1)
            assert breaker._get_remaining_error_quota(quota) == 1
            assert breaker._get_controlling_quota() == quota

            breaker.record_error()

            # Hitting the limit puts us into the BROKEN state
            assert breaker._get_remaining_error_quota(quota) == 0
            assert breaker._get_controlling_quota() is None
            assert breaker._get_state_and_remaining_time() == (
                CircuitBreakerState.BROKEN,
                breaker.broken_state_duration,
            )
            mock_logger.warning.assert_called_with(
                "Circuit breaker '%s' error limit hit",
                "dogs_are_great",
                extra={
                    "current_state": state,
                    "error_limit": limit,
                    "error_limit_window": config["error_limit_window"],
                },
            )
            mock_metrics_incr.assert_called_with(
                "circuit_breaker.dogs_are_great.error_limit_hit",
                sample_rate=1.0,
                tags={"current_state": state.value},
            )

            # Now jump to one second after the BROKEN state has expired to see that we're in
            # RECOVERY
            with time_machine.travel(now + breaker.broken_state_duration + 1, tick=False):
                assert breaker._get_controlling_quota() is breaker.recovery_quota
                assert breaker._get_state_and_remaining_time() == (
                    CircuitBreakerState.RECOVERY,
                    breaker.recovery_duration - 1,
                )

    @patch("sentry.utils.circuit_breaker2.logger")
    def test_stays_in_current_state_if_redis_call_changing_state_fails(
        self, mock_logger: MagicMock
    ):
        breaker = self.breaker

        for current_state, quota, limit, seconds_left in [
            # The case where the current state is the BROKEN state isn't included here because the
            # switch from BROKEN state to RECOVERY state happens passively (by `broken_state_key`
            # expiring), rather than through an active call to redis
            (
                CircuitBreakerState.OK,
                breaker.primary_quota,
                breaker.error_limit,
                None,
            ),
            (
                CircuitBreakerState.RECOVERY,
                breaker.recovery_quota,
                breaker.recovery_error_limit,
                1231,
            ),
        ]:
            breaker._set_breaker_state(current_state, seconds_left)
            breaker._add_quota_usage(quota, limit - 1)
            assert breaker._get_remaining_error_quota(quota) == 1
            assert breaker._get_controlling_quota() == quota

            with patch(
                "sentry.utils.circuit_breaker2.CircuitBreaker._set_in_redis", side_effect=Exception
            ):
                breaker.record_error()

            # We've recorded the error, but the state hasn't changed
            assert breaker._get_remaining_error_quota(quota) == 0
            assert breaker._get_controlling_quota() == quota
            assert breaker._get_state_and_remaining_time() == (current_state, seconds_left)
            mock_logger.exception.assert_called_with(
                "Couldn't set state-change keys in redis for circuit breaker '%s'",
                breaker.key,
                extra={"current_state": current_state},
            )


@freeze_time()
class ShouldAllowRequestTest(TestCase):
    def setUp(self) -> None:
        self.config = DEFAULT_CONFIG
        self.breaker = MockCircuitBreaker("dogs_are_great", self.config)

        # Clear all existing keys from redis
        self.breaker.redis_pipeline.flushall()
        self.breaker.redis_pipeline.execute()

    def test_allows_request_in_non_broken_state_with_quota_remaining(self) -> None:
        breaker = self.breaker

        for state, quota, limit in [
            (CircuitBreakerState.OK, breaker.primary_quota, breaker.error_limit),
            (CircuitBreakerState.RECOVERY, breaker.recovery_quota, breaker.recovery_error_limit),
        ]:
            breaker._set_breaker_state(state)
            breaker._add_quota_usage(quota, limit - 5)
            assert breaker._get_remaining_error_quota(quota) == 5

            assert breaker.should_allow_request() is True

    @patch("sentry.utils.circuit_breaker2.metrics.incr")
    def test_blocks_request_in_non_broken_state_with_no_quota_remaining(
        self, mock_metrics_incr: MagicMock
    ):
        breaker = self.breaker

        for state, quota, limit in [
            (CircuitBreakerState.OK, breaker.primary_quota, breaker.error_limit),
            (CircuitBreakerState.RECOVERY, breaker.recovery_quota, breaker.recovery_error_limit),
        ]:
            breaker._set_breaker_state(state)
            breaker._add_quota_usage(quota, limit)
            assert breaker._get_remaining_error_quota(quota) == 0

            assert breaker.should_allow_request() is False
            mock_metrics_incr.assert_called_with(
                f"circuit_breaker.{self.breaker.key}.request_blocked"
            )
            mock_metrics_incr.reset_mock()

    @patch("sentry.utils.circuit_breaker2.metrics.incr")
    def test_blocks_request_in_BROKEN_state(self, mock_metrics_incr: MagicMock) -> None:
        breaker = self.breaker

        breaker._set_breaker_state(CircuitBreakerState.BROKEN)

        assert breaker.should_allow_request() is False
        mock_metrics_incr.assert_called_with(
            f"circuit_breaker.{self.breaker.key}.request_blocked",
        )

    @patch("sentry.utils.circuit_breaker2.logger")
    def test_allows_request_if_redis_call_fails(self, mock_logger: MagicMock) -> None:
        breaker = self.breaker

        with patch(
            "sentry.utils.circuit_breaker2.CircuitBreaker._get_from_redis", side_effect=Exception
        ):
            assert breaker.should_allow_request() is True
            mock_logger.exception.assert_called_with(
                "Couldn't get state from redis for circuit breaker '%s'", breaker.key
            )


# --- Rate-based circuit breaker tests ---

DEFAULT_RATE_CONFIG: CircuitBreakerConfig = {
    "error_limit": 10000,
    "error_limit_window": 3600,  # 1 hr
    "broken_state_duration": 120,  # 2 min
    "error_floor": 100,
    "error_rate_threshold": 0.5,
}


@freeze_time()
class RateBasedCircuitBreakerTest(TestCase):
    def setUp(self) -> None:
        self.config = DEFAULT_RATE_CONFIG
        self.breaker = MockCircuitBreaker("test_rate_breaker", self.config)

        # Clear all existing keys from redis
        self.breaker.redis_pipeline.flushall()
        self.breaker.redis_pipeline.execute()

    def test_sets_rate_based_defaults(self) -> None:
        breaker = self.breaker
        assert breaker._rate_based is True  # derived from total_requests_quota being set
        assert breaker.error_rate_threshold == 0.5
        assert breaker.error_floor == 100
        assert breaker.total_requests_quota is not None
        assert breaker.total_requests_quota.__dict__ == {
            "window_seconds": 3600,
            "granularity_seconds": 180,
            "limit": 2_000_000_000,
            "prefix_override": "test_rate_breaker.circuit_breaker.total_requests",
        }

    def test_low_error_count_below_floor_does_not_trip(self) -> None:
        """Even at 100% error rate, if error count < floor, don't trip."""
        for _ in range(50):
            self.breaker.record_error()

        assert self.breaker.should_allow_request() is True
        state, _ = self.breaker._get_state_and_remaining_time()
        assert state == CircuitBreakerState.OK

    def test_high_error_count_low_rate_does_not_trip(self) -> None:
        """If error count >= floor but rate < threshold, don't trip."""
        for _ in range(900):
            self.breaker.record_success()
        for _ in range(100):
            self.breaker.record_error()

        assert self.breaker.should_allow_request() is True
        state, _ = self.breaker._get_state_and_remaining_time()
        assert state == CircuitBreakerState.OK

    def test_both_conditions_met_trips_to_broken(self) -> None:
        """When error_count >= floor AND error_rate >= threshold, trip to BROKEN."""
        for _ in range(100):
            self.breaker.record_success()
        for _ in range(200):
            self.breaker.record_error()

        state, _ = self.breaker._get_state_and_remaining_time()
        assert state == CircuitBreakerState.BROKEN
        assert self.breaker.should_allow_request() is False

    def test_broken_to_recovery_to_ok_lifecycle(self) -> None:
        """Test the full BROKEN -> RECOVERY -> OK lifecycle."""
        self.breaker._set_breaker_state(CircuitBreakerState.BROKEN)
        assert self.breaker.should_allow_request() is False

        self.breaker._set_breaker_state(CircuitBreakerState.RECOVERY)
        assert self.breaker.should_allow_request() is True

        self.breaker._set_breaker_state(CircuitBreakerState.OK)
        assert self.breaker.should_allow_request() is True

    def test_recovery_to_broken_on_recovery_errors(self) -> None:
        """During RECOVERY, exceeding recovery_error_limit re-trips to BROKEN."""
        self.breaker._set_breaker_state(CircuitBreakerState.RECOVERY)
        state, _ = self.breaker._get_state_and_remaining_time()
        assert state == CircuitBreakerState.RECOVERY

        recovery_limit = self.breaker.recovery_error_limit
        for _ in range(recovery_limit + 1):
            self.breaker.record_error()

        state, _ = self.breaker._get_state_and_remaining_time()
        assert state == CircuitBreakerState.BROKEN

    def test_record_success_increments_total_count(self) -> None:
        """record_success() should increment total request count."""
        self.breaker.record_success()

        now = int(time.time())
        assert self.breaker.total_requests_quota is not None
        _, grants = self.breaker.limiter.check_within_quotas(
            [
                RequestedQuota(
                    self.breaker.key,
                    self.breaker.total_requests_quota.limit,
                    [self.breaker.total_requests_quota],
                )
            ],
            now,
        )
        total_used = self.breaker.total_requests_quota.limit - grants[0].granted
        assert total_used == 1

    def test_record_error_increments_both_counts(self) -> None:
        """record_error() should increment both error and total request counts."""
        self.breaker.record_error()

        now = int(time.time())
        # Check total requests
        assert self.breaker.total_requests_quota is not None
        _, total_grants = self.breaker.limiter.check_within_quotas(
            [
                RequestedQuota(
                    self.breaker.key,
                    self.breaker.total_requests_quota.limit,
                    [self.breaker.total_requests_quota],
                )
            ],
            now,
        )
        total_used = self.breaker.total_requests_quota.limit - total_grants[0].granted
        assert total_used == 1

        # Check error count
        _, error_grants = self.breaker.limiter.check_within_quotas(
            [
                RequestedQuota(
                    self.breaker.key,
                    self.breaker.primary_quota.limit,
                    [self.breaker.primary_quota],
                )
            ],
            now,
        )
        errors_used = self.breaker.primary_quota.limit - error_grants[0].granted
        assert errors_used == 1

    def test_record_success_noop_when_broken(self) -> None:
        """record_success() should return early when BROKEN."""
        self.breaker._set_breaker_state(CircuitBreakerState.BROKEN)
        self.breaker.record_success()

        now = int(time.time())
        assert self.breaker.total_requests_quota is not None
        _, grants = self.breaker.limiter.check_within_quotas(
            [
                RequestedQuota(
                    self.breaker.key,
                    self.breaker.total_requests_quota.limit,
                    [self.breaker.total_requests_quota],
                )
            ],
            now,
        )
        total_used = self.breaker.total_requests_quota.limit - grants[0].granted
        assert total_used == 0

    def test_record_success_noop_when_not_rate_based(self) -> None:
        """record_success() should be a no-op for count-based breakers."""
        count_breaker = MockCircuitBreaker("count_only", DEFAULT_CONFIG)
        count_breaker.redis_pipeline.flushall()
        count_breaker.redis_pipeline.execute()

        count_breaker.record_success()
        assert count_breaker.total_requests_quota is None
