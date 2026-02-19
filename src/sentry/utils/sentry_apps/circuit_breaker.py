import logging
import time
from collections.abc import Generator
from contextlib import contextmanager
from typing import NotRequired

from sentry.ratelimits.sliding_windows import (
    GrantedQuota,
    Quota,
    RequestedQuota,
)
from sentry.utils import metrics
from sentry.utils.circuit_breaker2 import CircuitBreaker, CircuitBreakerConfig, CircuitBreakerState

logger = logging.getLogger(__name__)


class RateBasedCircuitBreakerConfig(CircuitBreakerConfig):
    # Minimum absolute error count in the window before rate check applies
    error_floor: NotRequired[int]
    # Error rate (0.0 to 1.0) threshold — trips when error_count/total_requests >= this
    error_rate_threshold: NotRequired[float]


class RateBasedCircuitBreaker(CircuitBreaker):
    """
    A circuit breaker that trips based on error rate (percentage) with an absolute error floor,
    rather than flat error counts alone.

    Extends the parent CircuitBreaker by:
    - Adding a parallel total_requests_quota to track all requests (not just errors)
    - Adding record_success() to count successful requests
    - Overriding _get_remaining_error_quota() to require BOTH error_floor AND error_rate_threshold
      before allowing the parent's trip logic to proceed
    - Emitting state transition metrics on OK->BROKEN, BROKEN->RECOVERY, RECOVERY->OK, RECOVERY->BROKEN
    """

    def __init__(self, key: str, config: RateBasedCircuitBreakerConfig) -> None:
        super().__init__(key, config)
        self.error_rate_threshold = config.get("error_rate_threshold", 0.5)
        self.error_floor = config.get("error_floor", 500)

        # Parallel quota tracking total requests, same window/granularity as primary.
        # Limit set extremely high — we never want this quota to "trip" on its own.
        self.total_requests_quota = Quota(
            self.window,
            self.window_granularity,
            999_999_999,
            f"{key}.circuit_breaker.total_requests",
        )

    def record_success(self) -> None:
        """Record a successful request (increments total request count only)."""
        now = int(time.time())
        state_before, _ = self._get_state_and_remaining_time()

        if state_before == CircuitBreakerState.BROKEN:
            return

        self.limiter.use_quotas(
            [RequestedQuota(self.key, 1, [self.total_requests_quota])],
            [GrantedQuota(self.key, 1, [])],
            now,
        )

        # Check for passive state transitions (RECOVERY->OK via TTL expiry)
        state_after, _ = self._get_state_and_remaining_time()
        if state_before != state_after:
            self._emit_state_change_metric(state_before, state_after)

    def record_error(self) -> None:
        """
        An error is also a request — count it in both quotas.
        Emits state change metrics when the breaker trips.
        """
        state_before, _ = self._get_state_and_remaining_time()

        # Count toward total requests first
        if state_before != CircuitBreakerState.BROKEN:
            now = int(time.time())
            self.limiter.use_quotas(
                [RequestedQuota(self.key, 1, [self.total_requests_quota])],
                [GrantedQuota(self.key, 1, [])],
                now,
            )

        # Delegate to parent for error counting + trip logic
        super().record_error()

        # Check for state transitions (OK->BROKEN, RECOVERY->BROKEN)
        state_after, _ = self._get_state_and_remaining_time()
        if state_before != state_after:
            self._emit_state_change_metric(state_before, state_after)

    def _get_remaining_error_quota(
        self, quota: Quota | None = None, window_end: int | None = None
    ) -> int:
        """
        Override: return non-zero (don't trip) unless BOTH conditions are met:
          (a) error_count >= error_floor
          (b) error_rate >= error_rate_threshold
        """
        remaining = super()._get_remaining_error_quota(quota, window_end)

        if quota is None:
            return remaining

        error_count = quota.limit - remaining

        # Condition (a): not enough errors to be confident
        if error_count < self.error_floor:
            return max(remaining, 1)  # prevent parent from tripping

        # Condition (b): check error rate
        now = int(time.time())
        window_end_time = window_end or now
        _, total_grants = self.limiter.check_within_quotas(
            [
                RequestedQuota(
                    self.key,
                    self.total_requests_quota.limit,
                    [self.total_requests_quota],
                )
            ],
            window_end_time,
        )
        total_used = self.total_requests_quota.limit - total_grants[0].granted
        if total_used == 0:
            return max(remaining, 1)

        error_rate = error_count / total_used
        if error_rate < self.error_rate_threshold:
            return max(remaining, 1)  # rate not high enough — don't trip

        return 0  # both conditions met — signal to parent to trip the breaker

    def _emit_state_change_metric(
        self, from_state: CircuitBreakerState, to_state: CircuitBreakerState
    ) -> None:
        transition = f"{from_state.value}_to_{to_state.value}"
        metrics.incr(
            "sentry_app.webhook.circuit_breaker.state_change",
            tags={"key": self.key, "transition": transition},
            sample_rate=1.0,
        )
        logger.info(
            "sentry_app.webhook.circuit_breaker.state_change",
            extra={"key": self.key, "from_state": from_state.value, "to_state": to_state.value},
        )


@contextmanager
def circuit_breaker_tracking(
    breaker: RateBasedCircuitBreaker | None,
) -> Generator[None]:
    """Track request outcome: record_error on Exception, record_success on normal exit.

    Handles the None case as a no-op so callers don't need nullcontext().
    """
    if breaker is None:
        yield
        return
    try:
        yield
    except Exception:
        breaker.record_error()
        raise
    else:
        breaker.record_success()
