from __future__ import annotations

from collections.abc import Sequence
from multiprocessing.context import TimeoutError

from sentry_protos.sentry.v1.taskworker_pb2 import RetryState


class RetryError(Exception):
    """
    Exception that tasks can raise to indicate that the current task
    should be retried.
    """


class Retry:
    """Used with tasks to define the retry policy for a task"""

    _times: int
    _allowed_exception_types: Sequence[type] | None
    _denied_exception_types: Sequence[type] | None
    _deadletter: bool | None
    _discard: bool | None

    def __init__(
        self,
        times: int = 1,
        on: Sequence[type] | None = None,
        ignore: Sequence[type] | None = None,
        deadletter: bool | None = None,
        discard: bool | None = None,
    ):
        if discard and deadletter:
            raise AssertionError("You cannot enable both discard and deadletter modes")
        self._times = times
        self._allowed_exception_types = on
        self._denied_exception_types = ignore
        self._deadletter = deadletter
        self._discard = discard

    def should_retry(self, state: RetryState, exc: Exception) -> bool:
        # No more attempts left
        if state.attempts >= self._times:
            return False

        # Explicit RetryError with attempts left.
        if isinstance(exc, RetryError):
            return True

        # No retries for types on the ignore list
        if any(
            isinstance(exc, ignored_exception_type)
            for ignored_exception_type in self._denied_exception_types or []
        ):
            return False

        # In the retry allow list or processing deadline is exceeded
        # When processing deadline is exceeded, the subprocess raises a TimeoutError
        if isinstance(exc, TimeoutError) or (
            any(
                isinstance(exc, allowed_exception_type)
                for allowed_exception_type in self._allowed_exception_types or []
            )
        ):
            return True

        # TODO(taskworker) add logging/assertion for no funny business
        return False

    def initial_state(self) -> RetryState:
        return RetryState(
            attempts=0,
            discard_after_attempt=self._times if self._discard else None,
            deadletter_after_attempt=self._times if self._deadletter else None,
            kind="sentry.taskworker.retry.Retry",
        )


FALLBACK_RETRY = Retry(times=3, deadletter=True)
