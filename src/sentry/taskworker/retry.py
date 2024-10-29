from __future__ import annotations

from multiprocessing.context import TimeoutError

from sentry_protos.sentry.v1.taskworker_pb2 import RetryState


class RetryError(Exception):
    """
    Exception that tasks can raise to indicate that the current task
    should be retried.
    """


class Retry:
    """Used with tasks to define the retry policy for a task"""

    def __init__(
        self,
        *,
        times: int = 1,
        on: tuple[type[BaseException], ...] | None = None,
        ignore: tuple[type[BaseException], ...] | None = None,
        deadletter: bool = False,
        discard: bool = False,
    ):
        if discard and deadletter:
            raise AssertionError("You cannot enable both discard and deadletter modes")
        self._times = times
        self._allowed_exception_types: tuple[type[BaseException], ...] = on or ()
        self._denied_exception_types: tuple[type[BaseException], ...] = ignore or ()
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
            discard_after_attempt=self._times if self._discard else None,
            deadletter_after_attempt=self._times if self._deadletter else None,
            kind="sentry.taskworker.retry.Retry",
        )
