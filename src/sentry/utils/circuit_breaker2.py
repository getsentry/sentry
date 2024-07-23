"""
NOTE: This is a replacement for the current circuit breaker implementation, which is why it is
`circuit_breaker2`. It's first going to be used for the Seer similarity service, then once we're
confident it works we can replace use of the original for the severity service with use of this one
and get rid of the old one, at which point this can lose the `2`.
"""

import logging
from enum import Enum
from typing import NotRequired, TypedDict

from django.conf import settings

from sentry.ratelimits.sliding_windows import Quota, RedisSlidingWindowRateLimiter

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

    # See `CircuitBreakerConfig` class for config options
    breaker = CircuitBreaker("squirrel_chasing", config)

    def get_top_dogs(payload):
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
    to prevent calls to it. In that case, the original `breaker` object can be imported alongside
    `get_top_dogs` or reinstantiated with the same config - it has no state of its own, instead
    relying on redis-backed rate limiters and redis itself to track error count and breaker status.
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

        self.limiter = RedisSlidingWindowRateLimiter()
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
