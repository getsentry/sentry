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

    def _clear_quota(self, quota: Quota, window_end: int | None = None) -> list[int]:
        """
        Clear usage of the given quota up until the end of the given time window. If no window end
        is given, clear the quota up to the present.

        Returns the list of granule values which were cleared.
        """
        now = int(time.time())
        window_end_time = window_end or now
        granule_end_times = self._get_granule_end_times(quota, window_end_time)
        num_granules = len(granule_end_times)
        previous_granule_values = [0] * num_granules

        current_total_quota_used = quota.limit - self._get_remaining_error_quota(
            quota, window_end_time
        )
        if current_total_quota_used != 0:
            # Empty the granules one by one, starting with the oldest.
            #
            # To empty each granule, we need to add negative quota usage, which means we need to
            # know how much usage is currently in each granule. Unfortunately, the limiter will only
            # report quota usage at the window level, not the granule level. To get around this, we
            # start with a window ending with the oldest granule. Any granules before it will have
            # expired, so the window usage will equal the granule usage.ending in that granule will
            # have a total usage equal to that of the granule.
            #
            # Once we zero-out the granule, we can move the window one granule forward. It will now
            # consist of expired granules, the granule we just set to 0, and the granule we care
            # about. Thus the window usage will again match the granule usage, which we can use to
            # empty the granule. We then just repeat the pattern until we've reached the end of the
            # window we want to clear.
            for i, granule_end_time in enumerate(granule_end_times):
                granule_quota_used = quota.limit - self._get_remaining_error_quota(
                    quota, granule_end_time
                )
                previous_granule_values[i] = granule_quota_used
                self._add_quota_usage(quota, -granule_quota_used, granule_end_time)

            new_total_quota_used = quota.limit - self._get_remaining_error_quota(
                quota, window_end_time
            )
            assert new_total_quota_used == 0

        return previous_granule_values

    def _get_granule_end_times(
        self, quota: Quota, window_end: int, newest_first: bool = False
    ) -> list[int]:
        """
        Given a quota and the end of the time window it's covering, return the timestamps
        corresponding to the end of each granule.
        """
        window_duration = quota.window_seconds
        granule_duration = quota.granularity_seconds
        num_granules = window_duration // granule_duration

        # Walk backwards through the granules
        end_times_newest_first = [
            window_end - num_granules_ago * granule_duration
            for num_granules_ago in range(num_granules)
        ]

        return end_times_newest_first if newest_first else list(reversed(end_times_newest_first))

    def _set_granule_values(
        self,
        quota: Quota,
        values: list[int | None],
        window_end: int | None = None,
    ) -> None:
        """
        Set the usage in each granule of the given quota, for the time window ending at the given
        time.

        If no ending time is given, the current time is used.

        The list of values should be ordered from oldest to newest and must contain the same number
        of elements as the window has granules. To only change some of the values, pass `None` in
        the spot of any value which should remain unchanged. (For example, in a two-granule window,
        to only change the older granule, pass `[3, None]`.)
        """
        window_duration = quota.window_seconds
        granule_duration = quota.granularity_seconds
        num_granules = window_duration // granule_duration

        if len(values) != num_granules:
            raise Exception(
                f"Exactly {num_granules} granule values must be provided. "
                + "To leave an existing value as is, include `None` in its spot."
            )

        now = int(time.time())
        window_end_time = window_end or now

        previous_values = self._clear_quota(quota, window_end_time)

        for i, granule_end_time, value in zip(
            range(num_granules), self._get_granule_end_times(quota, window_end_time), values
        ):
            # When we cleared the quota above, we set each granule's value to 0, so here "adding"
            # usage is actually setting usage
            if value is not None:
                self._add_quota_usage(quota, value, granule_end_time)
            else:
                self._add_quota_usage(quota, previous_values[i], granule_end_time)

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
    def test_fixes_mismatched_state_durations(self, mock_logger: MagicMock):
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

    def test_increments_error_count(self):
        config = self.config
        breaker = self.breaker

        # The breaker starts with a clean slate
        assert breaker._get_remaining_error_quota() == config["error_limit"]

        breaker.record_error()

        # The error has been tallied
        assert breaker._get_remaining_error_quota() == config["error_limit"] - 1

    def test_no_error_recorded_in_broken_state(self):
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
    def test_logs_a_warning_in_broken_state(self, mock_logger: MagicMock):
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

    @patch("sentry.utils.circuit_breaker2.logger")
    def test_handles_hitting_max_errors_in_non_broken_state(self, mock_logger: MagicMock):
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

    def test_allows_request_in_non_broken_state_with_quota_remaining(self):
        breaker = self.breaker

        for state, quota, limit in [
            (CircuitBreakerState.OK, breaker.primary_quota, breaker.error_limit),
            (CircuitBreakerState.RECOVERY, breaker.recovery_quota, breaker.recovery_error_limit),
        ]:
            breaker._set_breaker_state(state)
            breaker._add_quota_usage(quota, limit - 5)
            assert breaker._get_remaining_error_quota(quota) == 5

            assert breaker.should_allow_request() is True

    def test_blocks_request_in_non_broken_state_with_no_quota_remaining(self):
        breaker = self.breaker

        for state, quota, limit in [
            (CircuitBreakerState.OK, breaker.primary_quota, breaker.error_limit),
            (CircuitBreakerState.RECOVERY, breaker.recovery_quota, breaker.recovery_error_limit),
        ]:
            breaker._set_breaker_state(state)
            breaker._add_quota_usage(quota, limit)
            assert breaker._get_remaining_error_quota(quota) == 0

            assert breaker.should_allow_request() is False

    def test_blocks_request_in_BROKEN_state(self):
        breaker = self.breaker

        breaker._set_breaker_state(CircuitBreakerState.BROKEN)

        assert breaker.should_allow_request() is False

    @patch("sentry.utils.circuit_breaker2.logger")
    def test_allows_request_if_redis_call_fails(self, mock_logger: MagicMock):
        breaker = self.breaker

        with patch(
            "sentry.utils.circuit_breaker2.CircuitBreaker._get_from_redis", side_effect=Exception
        ):
            assert breaker.should_allow_request() is True
            mock_logger.exception.assert_called_with(
                "Couldn't get state from redis for circuit breaker '%s'", breaker.key
            )
