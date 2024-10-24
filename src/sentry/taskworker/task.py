from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from functools import update_wrapper
from typing import TYPE_CHECKING, Any

from django.utils import timezone

if TYPE_CHECKING:
    from sentry.taskworker.registry import TaskNamespace
    from sentry.taskworker.retry import Retry, RetryState


class Task:
    name: str
    __func: Callable[..., Any]
    __namespace: TaskNamespace
    __idempotent: bool | None
    __deadline: timedelta | int | None

    def __init__(
        self,
        name: str,
        func: Callable[..., Any],
        namespace: TaskNamespace,
        retry: Retry | None,
        idempotent: bool | None = None,
        deadline: timedelta | int | None = None,
    ):
        self.name = name
        self.__func = func
        self.__namespace = namespace
        self.__retry = retry
        self.__idempotent = idempotent
        self.__deadline = deadline
        update_wrapper(self, func)

    @property
    def retry(self) -> Retry | None:
        return self.__retry

    @property
    def idempotent(self) -> bool:
        return self.__idempotent or False

    @property
    def deadline_timestamp(self) -> int | None:
        # TODO add namespace/default deadlines
        if not self.__deadline:
            return None
        if isinstance(self.__deadline, int):
            return int(timezone.now().timestamp() + self.__deadline)
        if isinstance(self.__deadline, timedelta):
            return int(timezone.now().timestamp() + self.__deadline.total_seconds())
        raise ValueError(f"unknown type for Task.deadline {self.__deadline}")

    def __call__(self, *args, **kwargs) -> None:
        return self.__func(*args, **kwargs)

    def delay(self, *args, **kwargs):
        return self.apply_async(*args, **kwargs)

    def apply_async(self, *args, **kwargs):
        from django.conf import settings

        if settings.TASK_WORKER_ALWAYS_EAGER:
            self.__func(*args, **kwargs)
        else:
            self.__namespace.send_task(self, args, kwargs)

    def should_retry(self, state: RetryState, exc: Exception) -> bool:
        # No retry policy means no retries.
        retry = self.retry
        if not retry:
            return False
        return retry.should_retry(state, exc)
