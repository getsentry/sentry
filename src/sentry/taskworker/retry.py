from __future__ import annotations

from collections.abc import Sequence
from multiprocessing.context import TimeoutError

from sentry_protos.sentry.v1.taskworker_pb2 import RetryState


class Retry:
    __times: int
    __on: Sequence[type] | None
    __ignore: Sequence[type] | None
    __deadletter: bool | None
    __discard: bool | None

    """Used with tasks to define the retry policy for a task"""

    def __init__(
        self,
        times: int = 1,
        on: Sequence[type] | None = None,
        ignore: Sequence[type] | None = None,
        deadletter: bool | None = None,
        discard: bool | None = None,
    ):
        self.__times = times
        self.__on = on
        self.__ignore = ignore
        self.__deadletter = deadletter
        self.__discard = discard

    def should_retry(self, state: RetryState, exc: Exception) -> bool:
        # No more attempts left
        if state.attempts >= self.__times:
            return False
        # No retries for types on the ignore list
        if self.__ignore and isinstance(exc, self.__ignore):
            return False
        # In the retry allow list or processing deadline is exceeded
        # When processing deadline is exceeded, the subprocess raises a TimeoutError
        if (self.__on and isinstance(exc, self.__on)) or isinstance(exc, TimeoutError):
            return True
        # TODO add logging/assertion for no funny business
        return False

    def initial_state(self) -> RetryState:
        return RetryState(
            attempts=0,
            discard_after_attempt=self.__times if self.__discard else None,
            deadletter_after_attempt=self.__times if self.__deadletter else None,
            kind="sentry.taskworker.retry.Retry",
        )


FALLBACK_RETRY = Retry(times=3, deadletter=True)
