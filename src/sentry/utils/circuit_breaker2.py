"""
NOTE: This is a replacement for the current circuit breaker implementation, which is why it is
`circuit_breaker2`. It's first going to be used for the Seer similarity service, then once we're
confident it works we can replace use of the original for the severity service with use of this one
and get rid of the old one, at which point this can lose the `2`.
"""

import logging
import time
from enum import Enum
from typing import Any, Literal, NotRequired, TypedDict, overload

from django.conf import settings

from sentry.ratelimits.sliding_windows import (
    GrantedQuota,
    Quota,
    RedisSlidingWindowRateLimiter,
    RequestedQuota,
)
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# XXX: If either of these values changes, the `CircuitBreakerConfig` docstrings
# need to be updated
# How many times stricter to be with the error limit during recovery
DEFAULT_RECOVERY_STRICTNESS = 10
# How many times the length of the error window to make the recovery window
DEFAULT_RECOVERY_WINDOW_MULTIPLIER = 2


class CircuitBreakerState(Enum):
    OK = "circuit_okay"
    BROKEN = "circuit_broken"
    RECOVERY = "recovery"


class CircuitBreakerConfig(TypedDict):
    # The number of errors within the given time period necessary to trip the breaker
    error_limit: int
    # The time period, in seconds, over which we're tracking errors
    error_limit_window: int
    # How long, in seconds, to stay in the BROKEN state (blocking all requests) before entering the
    # RECOVERY phase
    broken_state_duration: int
    # The number of errors within the given time period necessary to trip the breaker while in
    # RECOVERY. Will be set automatically to 10% of `error_limit` if not provided.
    recovery_error_limit: NotRequired[int]
    # The length, in seconds, of each time bucket ("granule") used by the underlying rate limiter -
    # effectively the resolution of the time window. Will be set automatically based on
    # `error_limit_window` if not provided.
    error_limit_window_granularity: NotRequired[int]
    # How long, in seconds, to stay in the RECOVERY state (allowing requests but with a stricter
    # error limit) before returning to normal operation. Will be set to twice `error_limit_window`
    # if not provided.
    recovery_duration: NotRequired[int]


class CircuitBreaker:
    """
    A circuit breaker to be used to temporarily block requests to or calls of a service or function
    which is throwing too many errors.

    The breaker has three states: circuit OK, circuit BROKEN, and circuit in RECOVERY. (These states
    respectively correspond to the closed, open, and half-open states of the traditional circuit
    breaker model, but are hopefully easier to keep straight than a model where closed is good and
    open is bad.)

        In a OK state (normal operation), the breaker tracks errors but allows through all requests.
        If the frequency of errors passes a given threshold, it moves to BROKEN state.

        In a BROKEN state, all requests are blocked. Once a set amount of time has passed, it moves
        to RECOVERY state.

        RECOVERY state is identical to OK state, except that the threshold for the circuit breaking
        (moving back into BROKEN state) is much stricter. Once a set amount of time has passed
        without the breaker being tripped, it moves back to OK state.

    The overall idea is to stop hitting a service which seems to be failing, but periodically make
    short attempts to use it in order to be able to resume requests once it comes back up.

    Usage:

    def get_top_dogs(payload):
        # See `CircuitBreakerConfig` class for config options
        breaker = CircuitBreaker(
            settings.SQUIRREL_CHASING_CIRCUIT_BREAKER_KEY,
            options.get("squirrel_chasing.circuit_breaker_config"),
        )

        # Check the state of the breaker before calling the service
        try:
            if breaker.should_allow_request():
                response = call_chase_simulation_service("/hall-of-fame", payload)
            else:
                logger.warning("Request blocked by circuit breaker!")
                return None

        # Call `record_error` only in `except` blocks whose errors should count towards the quota
        except TimeoutError:
            breaker.record_error()
            return "timeout" # or reraise
        except BadInputError:
            return "bad input"
        except Exception:
            breaker.record_error()
            return "unknown error"

        # Call `record_error` for other problems which should count as errors
        if response.status == 500:
            breaker.record_error()
            return f"got {response.status}"

        return format_hof_entries(response)

    The `breaker.should_allow_request()` check can alternatively be used outside of `get_top_dogs`,
    to prevent calls to it. In that case, the circuit breaker must be reinstantiated with the same
    config. This works because the breaker has no state of its own, instead relying on redis-backed
    rate limiters and redis itself to track error count and breaker status.

    Emits a `circuit_breaker.{self.key}.error_limit_hit` DD metic when tripped so activation can be
    easily monitored.
    """

    def __init__(self, key: str, config: CircuitBreakerConfig):
        self.key = key
        self.broken_state_key = f"{key}.circuit_breaker.broken"
        self.recovery_state_key = f"{key}.circuit_breaker.in_recovery"

        self.error_limit = config["error_limit"]
        default_recovery_error_limit = max(self.error_limit // DEFAULT_RECOVERY_STRICTNESS, 1)
        self.recovery_error_limit = config.get("recovery_error_limit", default_recovery_error_limit)

        self.window = config["error_limit_window"]
        self.window_granularity = config.get(
            "error_limit_window_granularity", max(self.window // 20, 5)
        )

        self.broken_state_duration = config["broken_state_duration"]
        self.recovery_duration = config.get(
            "recovery_duration", self.window * DEFAULT_RECOVERY_WINDOW_MULTIPLIER
        )

        self.limiter = RedisSlidingWindowRateLimiter(
            cluster=settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER
        )
        self.redis_pipeline = self.limiter.client.pipeline()

        self.primary_quota = Quota(
            self.window,
            self.window_granularity,
            self.error_limit,
            f"{key}.circuit_breaker.ok",
        )
        self.recovery_quota = Quota(
            self.window,
            self.window_granularity,
            self.recovery_error_limit,
            f"{key}.circuit_breaker.recovery",
        )

        # In the following sanity checks, if we're in dev, throw an error on bad config so it can be
        # fixed permanently. In prod, just warn and fix it ourselves.
        log = logger.error if settings.DEBUG else logger.warning

        if self.recovery_error_limit >= self.error_limit:
            log(
                "Circuit breaker '%s' has a recovery error limit (%d) greater than or equal"
                + " to its primary error limit (%d). Using the stricter error-limit-based"
                + " default (%d) instead.",
                key,
                self.recovery_error_limit,
                self.error_limit,
                default_recovery_error_limit,
            )
            self.recovery_error_limit = default_recovery_error_limit

        # XXX: If we discover we have a config where we want this combo to work, we can consider
        # using the `MockCircuitBreaker._clear_quota` helper, which is currently only used in tests,
        # to clear out the main quota when we switch to the BROKEN state. (It will need tests of its
        # own if so.)
        if self.broken_state_duration + self.recovery_duration < self.window:
            default_recovery_duration = self.window - self.broken_state_duration
            log(
                "Circuit breaker '%s' has BROKEN and RECOVERY state durations (%d and %d sec, respectively)"
                + " which together are less than the main error limit window (%d sec). This can lead to the"
                + " breaker getting tripped unexpectedly, until the original spike in errors clears the"
                + " main time window. Extending RECOVERY period to %d seconds, to give the primary quota time"
                + " to clear.",
                key,
                self.broken_state_duration,
                self.recovery_duration,
                self.window,
                default_recovery_duration,
            )
            self.recovery_duration = default_recovery_duration

    def record_error(self) -> None:
        """
        Record a single error towards the breaker's quota, and handle the case where that error puts
        us over the limit.
        """
        now = int(time.time())
        state, seconds_left_in_state = self._get_state_and_remaining_time()

        if state == CircuitBreakerState.BROKEN:
            assert seconds_left_in_state is not None  # mypy appeasement

            # If the circuit is BROKEN, and `should_allow_request` is being used correctly, requests
            # should be blocked and we shouldn't even be here. That said, maybe there was a race
            # condition, so make sure the circuit hasn't just been tripped before crying foul.
            seconds_elapsed_in_state = self.broken_state_duration - seconds_left_in_state
            if seconds_elapsed_in_state > 5:
                logger.warning(
                    "Attempt to record circuit breaker error while circuit is in BROKEN state",
                    extra={"key": self.key, "time_in_state": seconds_elapsed_in_state},
                )
            # We shouldn't have made the request, so don't record the error
            return

        # Even though we're not checking it during RECOVERY, we track errors in the primary quota as
        # well as in the RECOVERY quota because they still happened, and eventually switching back
        # to the okay state doesn't make that untrue
        quotas = (
            [self.primary_quota, self.recovery_quota]
            if state == CircuitBreakerState.RECOVERY
            else [self.primary_quota]
        )
        self.limiter.use_quotas(
            [RequestedQuota(self.key, 1, quotas)], [GrantedQuota(self.key, 1, [])], now
        )

        # If incrementing has made us hit the current limit, switch to the BROKEN state
        controlling_quota = self._get_controlling_quota(state)
        remaining_errors_allowed = self._get_remaining_error_quota(controlling_quota)
        if remaining_errors_allowed == 0:
            logger.warning(
                "Circuit breaker '%s' error limit hit",
                self.key,
                extra={
                    "current_state": state,
                    "error_limit": controlling_quota.limit,
                    "error_limit_window": controlling_quota.window_seconds,
                },
            )
            metrics.incr(
                f"circuit_breaker.{self.key}.error_limit_hit",
                sample_rate=1.0,
                tags={"current_state": state.value},
            )

            # RECOVERY will only start after the BROKEN state has expired, so push out the RECOVERY
            # expiry time. We'll store the expiry times as our redis values so we can determine how
            # long we've been in a given state.
            broken_state_timeout = self.broken_state_duration
            recovery_state_timeout = self.broken_state_duration + self.recovery_duration
            broken_state_expiry = now + broken_state_timeout
            recovery_state_expiry = now + recovery_state_timeout

            # Set reids keys for switching state. While they're both set (starting now) we'll be in
            # the BROKEN state. Once `broken_state_key` expires in redis we'll switch to RECOVERY,
            # and then once `recovery_state_key` expires we'll be back to normal.
            try:
                self._set_in_redis(
                    [
                        (self.broken_state_key, broken_state_expiry, broken_state_timeout),
                        (self.recovery_state_key, recovery_state_expiry, recovery_state_timeout),
                    ]
                )

            # If redis errors, stay in the current state
            except Exception:
                logger.exception(
                    "Couldn't set state-change keys in redis for circuit breaker '%s'",
                    self.key,
                    extra={"current_state": state},
                )

    def should_allow_request(self) -> bool:
        """
        Determine, based on the current state of the breaker and the number of allowable errors
        remaining, whether requests should be allowed through.
        """
        state, _ = self._get_state_and_remaining_time()
        controlling_quota = self._get_controlling_quota(state)

        if (
            state == CircuitBreakerState.BROKEN
            or
            # If there's no remaining quota, in theory we should already be in a broken state. That
            # said, it's possible we could be in a race condition and hit this just as the state is
            # being changed, so just to be safe we also check qouta here.
            self._get_remaining_error_quota(controlling_quota) <= 0
        ):
            metrics.incr(f"circuit_breaker.{self.key}.request_blocked")
            return False

        return True

    def _get_from_redis(self, keys: list[str]) -> Any:
        for key in keys:
            self.redis_pipeline.get(key)
        return self.redis_pipeline.execute()

    def _set_in_redis(self, keys_values_and_timeouts: list[tuple[str, Any, int]]) -> None:
        for key, value, timeout in keys_values_and_timeouts:
            self.redis_pipeline.set(key, value, timeout)
        self.redis_pipeline.execute()

    def _get_state_and_remaining_time(
        self,
    ) -> tuple[CircuitBreakerState, int | None]:
        """
        Return the current state of the breaker (OK, BROKEN, or in RECOVERY), along with the
        number of seconds until that state expires (or `None` when in OK state, as it has no
        expiry).
        """
        now = int(time.time())

        try:
            broken_state_expiry, recovery_state_expiry = self._get_from_redis(
                [self.broken_state_key, self.recovery_state_key]
            )
        except Exception:
            logger.exception("Couldn't get state from redis for circuit breaker '%s'", self.key)

            # Default to letting traffic through so the breaker doesn't become a single point of failure
            return (CircuitBreakerState.OK, None)

        # The BROKEN state key should always expire before the RECOVERY state one, so check it first
        if broken_state_expiry is not None:
            broken_state_seconds_left = int(broken_state_expiry) - now

            # In theory there should always be time left (the key should have expired otherwise),
            # but race conditions/caching/etc means we should check, just to be sure
            if broken_state_seconds_left > 0:
                return (CircuitBreakerState.BROKEN, broken_state_seconds_left)

        if recovery_state_expiry is not None:
            recovery_state_seconds_left = int(recovery_state_expiry) - now
            if recovery_state_seconds_left > 0:
                return (CircuitBreakerState.RECOVERY, recovery_state_seconds_left)

        return (CircuitBreakerState.OK, None)

    @overload
    def _get_controlling_quota(
        self, state: Literal[CircuitBreakerState.OK, CircuitBreakerState.RECOVERY]
    ) -> Quota: ...

    @overload
    def _get_controlling_quota(self, state: Literal[CircuitBreakerState.BROKEN]) -> None: ...

    @overload
    def _get_controlling_quota(self) -> Quota | None: ...

    @overload
    def _get_controlling_quota(self, state: CircuitBreakerState) -> Quota | None: ...

    @overload
    def _get_controlling_quota(self, state: None) -> Quota | None: ...

    def _get_controlling_quota(self, state: CircuitBreakerState | None = None) -> Quota | None:
        """
        Return the Quota corresponding to the given breaker state (or the current breaker state, if
        no state is provided). If the state is question is the BROKEN state, return None.
        """
        controlling_quota_by_state = {
            CircuitBreakerState.OK: self.primary_quota,
            CircuitBreakerState.BROKEN: None,
            CircuitBreakerState.RECOVERY: self.recovery_quota,
        }

        _state = state or self._get_state_and_remaining_time()[0]

        return controlling_quota_by_state[_state]

    def _get_remaining_error_quota(
        self, quota: Quota | None = None, window_end: int | None = None
    ) -> int:
        """
        Get the number of allowable errors remaining in the given quota for the time window ending
        at the given time.

        If no quota is given, in OK and RECOVERY states, return the current controlling quota's
        remaining errors. In BROKEN state, return -1.

        If no time window end is given, return the current amount of quota remaining.
        """
        if not quota:
            quota = self._get_controlling_quota()
            # This is another spot where logically we should never land, but might if we hit a race
            # condition with two errors tripping the circiut breaker nearly simultenously.
            if quota is None:  # BROKEN state
                return -1

        now = int(time.time())
        window_end = window_end or now

        _, result = self.limiter.check_within_quotas(
            [RequestedQuota(self.key, quota.limit, [quota])], window_end
        )

        return result[0].granted
