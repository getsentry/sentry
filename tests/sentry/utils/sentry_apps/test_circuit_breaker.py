import time
from typing import Any
from unittest import TestCase
from unittest.mock import patch

from sentry.ratelimits.sliding_windows import (
    GrantedQuota,
    Quota,
    RequestedQuota,
)
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.circuit_breaker2 import CircuitBreakerState
from sentry.utils.sentry_apps.circuit_breaker import (
    RateBasedCircuitBreaker,
    RateBasedCircuitBreakerConfig,
)

DEFAULT_RATE_CONFIG: RateBasedCircuitBreakerConfig = {
    "error_limit": 10000,
    "error_limit_window": 3600,  # 1 hr
    "broken_state_duration": 120,  # 2 min
    "error_floor": 100,
    "error_rate_threshold": 0.5,
}


class MockRateBasedCircuitBreaker(RateBasedCircuitBreaker):
    """Test helper with state manipulation methods, following MockCircuitBreaker pattern."""

    def _set_breaker_state(
        self, state: CircuitBreakerState, seconds_left: int | None = None
    ) -> None:
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

    def _add_quota_usage(
        self,
        quota: Quota,
        amount_used: int,
        granule_or_window_end: int | None = None,
    ) -> None:
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
class RateBasedCircuitBreakerTest(TestCase):
    def setUp(self) -> None:
        self.config = DEFAULT_RATE_CONFIG
        self.breaker = MockRateBasedCircuitBreaker("test_webhook_app", self.config)
        # Clear all existing keys from redis
        self.breaker.redis_pipeline.flushall()
        self.breaker.redis_pipeline.execute()

    def test_low_error_count_below_floor_does_not_trip(self) -> None:
        """Even at 100% error rate, if error count < floor, don't trip."""
        # Record 50 errors (below floor of 100), 0 successes = 100% error rate
        for _ in range(50):
            self.breaker.record_error()

        assert self.breaker.should_allow_request() is True
        state, _ = self.breaker._get_state_and_remaining_time()
        assert state == CircuitBreakerState.OK

    def test_high_error_count_low_rate_does_not_trip(self) -> None:
        """If error count >= floor but rate < threshold, don't trip."""
        # Record 900 successes first, then 100 errors = 100/1000 = 10% error rate.
        # Successes must be recorded first to ensure the rate stays below 50%
        # throughout error recording. error_floor=100, threshold=50%.
        for _ in range(900):
            self.breaker.record_success()
        for _ in range(100):
            self.breaker.record_error()

        assert self.breaker.should_allow_request() is True
        state, _ = self.breaker._get_state_and_remaining_time()
        assert state == CircuitBreakerState.OK

    def test_both_conditions_met_trips_to_broken(self) -> None:
        """When error_count >= floor AND error_rate >= threshold, trip to BROKEN."""
        # 200 errors + 100 successes = 200/300 = 66.7% error rate (> 50% threshold)
        # 200 errors > 100 floor
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

        # Move to RECOVERY (simulate broken_state_duration expiry)
        self.breaker._set_breaker_state(CircuitBreakerState.RECOVERY)
        assert self.breaker.should_allow_request() is True

        # Move back to OK (simulate recovery_duration expiry)
        self.breaker._set_breaker_state(CircuitBreakerState.OK)
        assert self.breaker.should_allow_request() is True

    def test_recovery_to_broken_on_recovery_errors(self) -> None:
        """During RECOVERY, exceeding recovery_error_limit re-trips to BROKEN."""
        self.breaker._set_breaker_state(CircuitBreakerState.RECOVERY)
        state, _ = self.breaker._get_state_and_remaining_time()
        assert state == CircuitBreakerState.RECOVERY

        # The recovery_error_limit is error_limit // 10 = 1000.
        # Record enough errors to exceed recovery limit at high rate.
        recovery_limit = self.breaker.recovery_error_limit
        for _ in range(recovery_limit + 1):
            self.breaker.record_error()

        state, _ = self.breaker._get_state_and_remaining_time()
        assert state == CircuitBreakerState.BROKEN

    def test_record_success_increments_total_count(self) -> None:
        """record_success() should increment total request count."""
        self.breaker.record_success()

        now = int(time.time())
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

    @patch("sentry.utils.sentry_apps.circuit_breaker.metrics")
    def test_state_change_metrics_emitted(self, mock_metrics: Any) -> None:
        """State transition metrics should be emitted on OK->BROKEN."""
        # Trip the breaker: 200 errors out of 300 total = 66.7% rate, 200 > 100 floor
        for _ in range(100):
            self.breaker.record_success()
        for _ in range(200):
            self.breaker.record_error()

        mock_metrics.incr.assert_any_call(
            "sentry_app.webhook.circuit_breaker.state_change",
            tags={
                "key": "test_webhook_app",
                "transition": "circuit_okay_to_circuit_broken",
            },
            sample_rate=1.0,
        )

    def test_record_success_noop_when_broken(self) -> None:
        """record_success() should return early when BROKEN."""
        self.breaker._set_breaker_state(CircuitBreakerState.BROKEN)
        self.breaker.record_success()  # Should not raise

        # Verify no total requests were counted
        now = int(time.time())
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
