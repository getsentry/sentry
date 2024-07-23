"""
NOTE: This is a replacement for the current circuit breaker implementation, which is why it is
`circuit_breaker2`. It's first going to be used for the Seer similarity service, then once we're
confident it works we can replace use of the original for the severity service with use of this one
and get rid of the old one, at which point this can lose the `2`.
"""

import logging
from enum import Enum
from typing import NotRequired, TypedDict

logger = logging.getLogger(__name__)


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
