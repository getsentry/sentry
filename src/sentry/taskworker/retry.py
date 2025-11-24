from __future__ import annotations

from enum import Enum
from multiprocessing.context import TimeoutError

from sentry_protos.taskbroker.v1.taskbroker_pb2 import (
    ON_ATTEMPTS_EXCEEDED_DEADLETTER,
    ON_ATTEMPTS_EXCEEDED_DISCARD,
    OnAttemptsExceeded,
    RetryState,
)

from sentry.taskworker.state import current_task
from sentry.utils import metrics


class RetryTaskError(Exception):
    """
    Exception that tasks can raise to indicate that the current task activation
    should be retried.
    """


class NoRetriesRemainingError(RetryTaskError):
    """
    Exception that is raised by retry helper methods to signal to tasks that
    the current attempt is terminal and there won't be any further retries.
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


def retry_task(exc: Exception | None = None, raise_on_no_retries: bool = True) -> None:
    """
    Helper for triggering retry errors.
    If all retries have been consumed, this will raise a
    sentry.taskworker.retry.NoRetriesRemaining
    """
    current = current_task()
    if current and not current.retries_remaining:
        metrics.incr("taskworker.retry.no_retries_remaining")
        if raise_on_no_retries:
            raise NoRetriesRemainingError()
        else:
            return
    raise RetryTaskError()


class Retry:
    """Used with tasks to define the retry policy for a task"""

    def __init__(
        self,
        *,
        times: int = 1,
        on: tuple[type[BaseException], ...] | None = None,
        ignore: tuple[type[BaseException], ...] | None = None,
        times_exceeded: LastAction = LastAction.Discard,
        delay: int | None = None,
    ):
        self._times = times
        self._allowed_exception_types: tuple[type[BaseException], ...] = on or ()
        self._denied_exception_types: tuple[type[BaseException], ...] = ignore or ()
        self._times_exceeded = times_exceeded
        self._delay = delay

    def max_attempts_reached(self, state: RetryState) -> bool:
        # We subtract one, as attempts starts at 0, but `times`
        # starts at 1.
        return state.attempts >= (self._times - 1)

    def should_retry(self, state: RetryState, exc: Exception) -> bool:
        # If there are no retries remaining we should not retry
        if self.max_attempts_reached(state):
            return False

        # Explicit RetryTaskError with attempts left.
        if isinstance(exc, RetryTaskError):
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
            delay_on_retry=self._delay,
        )
