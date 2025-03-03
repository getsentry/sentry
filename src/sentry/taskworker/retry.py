from __future__ import annotations

from enum import Enum
from multiprocessing.context import TimeoutError

from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    ON_ATTEMPTS_EXCEEDED_DEADLETTER,
    ON_ATTEMPTS_EXCEEDED_DISCARD,
    OnAttemptsExceeded,
    RetryState,
)


class RetryError(Exception):
    """
    Exception that tasks can raise to indicate that the current task activation
    should be retried.
    """


class LastAction(Enum):
    Deadletter = 1
    Discard = 2

    def to_proto(self) -> OnAttemptsExceeded.ValueType:
        if self == LastAction.Deadletter:
            return ON_ATTEMPTS_EXCEEDED_DEADLETTER
        if self == LastAction.Discard:
            return ON_ATTEMPTS_EXCEEDED_DISCARD
        raise ValueError(f"Unknown LastAction: {self}")


class Retry:
    """Used with tasks to define the retry policy for a task"""

    def __init__(
        self,
        *,
        times: int = 1,
        on: tuple[type[BaseException], ...] | None = None,
        ignore: tuple[type[BaseException], ...] | None = None,
        times_exceeded: LastAction = LastAction.Deadletter,
    ):
        self._times = times
        self._allowed_exception_types: tuple[type[BaseException], ...] = on or ()
        self._denied_exception_types: tuple[type[BaseException], ...] = ignore or ()
        self._times_exceeded = times_exceeded

    def should_retry(self, state: RetryState, exc: Exception) -> bool:
        # No more attempts left.
        # We subtract one, as attempts starts at 0, but `times`
        # starts at 1.
        if state.attempts >= (self._times - 1):
            return False

        # Explicit RetryError with attempts left.
        if isinstance(exc, RetryError):
            return True

        # No retries for types on the ignore list
        if isinstance(exc, self._denied_exception_types):
            return False

        # In the retry allow list or processing deadline is exceeded
        # When processing deadline is exceeded, the subprocess raises a TimeoutError
        if isinstance(exc, (TimeoutError, self._allowed_exception_types)):
            return True

        return False

    def initial_state(self) -> RetryState:
        return RetryState(
            attempts=0,
            max_attempts=self._times,
            on_attempts_exceeded=self._times_exceeded.to_proto(),
        )
