from __future__ import annotations

import dataclasses
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.taskworker.task import Task


@dataclasses.dataclass
class RetryState:
    """Retry state that is persisted as part of a task"""

    attempts: int
    discard_after_attempt: int | None
    deadletter_after_attempt: int | None
    kind: str

    def to_dict(self) -> dict[str, Any]:
        return dataclasses.asdict(self)


class Retry:
    __times: int | None
    __on: Sequence[type] | None
    __ignore: Sequence[type] | None
    __deadletter: bool | None
    __discard: bool | None

    """Used with tasks to define the retry policy for a task"""

    def __init__(
        self,
        times: int | None = None,
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

    def should_retry(self, task: Task, exc: Exception) -> bool:
        # TODO implement this for real.
        return True

    def initial_state(self) -> RetryState:
        return RetryState(
            attempts=0,
            discard_after_attempt=self.__times if self.__discard else None,
            deadletter_after_attempt=self.__times if self.__deadletter else None,
            kind="sentry.taskworker.retry.Retry",
        )


FALLBACK_RETRY = Retry(times=3, deadletter=True)
