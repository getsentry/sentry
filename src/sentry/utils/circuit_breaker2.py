"""
NOTE: This is a replacement for the current circuit breaker implementation, which is why it is
`circuit_breaker2`. It's first going to be used for the Seer similarity service, then once we're
confident it works we can replace use of the original for the severity service with use of this one
and get rid of the old one, at which point this can lose the `2`.
"""

from enum import Enum


class CircuitBreakerState(Enum):
    OK = "circuit_okay"
    BROKEN = "circuit_broken"
    RECOVERY = "recovery"
