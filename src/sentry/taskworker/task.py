from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from functools import update_wrapper
from typing import TYPE_CHECKING, Generic, ParamSpec, TypeVar

from django.conf import settings
from django.utils import timezone
from sentry_protos.sentry.v1.taskworker_pb2 import RetryState

from sentry.taskworker.retry import Retry

if TYPE_CHECKING:
    from sentry.taskworker.registry import TaskNamespace


P = ParamSpec("P")
R = TypeVar("R")


class Task(Generic[P, R]):
    def __init__(
        self,
        name: str,
        func: Callable[P, R],
        namespace: TaskNamespace,
        retry: Retry | None,
        idempotent: bool = False,
        deadline: timedelta | int | None = None,
    ):
        self.name = name
        self._func = func
        self._namespace = namespace
        self._retry = retry
        self._idempotent = idempotent
        self._deadline = deadline
        update_wrapper(self, func)

    @property
    def retry(self) -> Retry | None:
        return self._retry

    @property
    def idempotent(self) -> bool:
        return self._idempotent or False

    @property
    def deadline_timestamp(self) -> int | None:
        # TODO add namespace/default deadlines
        if not self._deadline:
            return None
        if isinstance(self._deadline, int):
            return int(timezone.now().timestamp() + self._deadline)
        if isinstance(self._deadline, timedelta):
            return int(timezone.now().timestamp() + self._deadline.total_seconds())
        raise ValueError(f"unknown type for Task.deadline {self._deadline}")

    def __call__(self, *args: P.args, **kwargs: P.kwargs) -> R:
        return self._func(*args, **kwargs)

    def delay(self, *args: P.args, **kwargs: P.kwargs) -> None:
        self.apply_async(*args, **kwargs)

    def apply_async(self, *args: P.args, **kwargs: P.kwargs) -> None:
        if settings.TASK_WORKER_ALWAYS_EAGER:
            self._func(*args, **kwargs)
        else:
            self._namespace.send_task(self, args, kwargs)

    def should_retry(self, state: RetryState, exc: Exception) -> bool:
        # No retry policy means no retries.
        retry = self.retry
        if not retry:
            return False
        return retry.should_retry(state, exc)
