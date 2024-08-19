from __future__ import annotations

from collections.abc import Callable
from functools import update_wrapper
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.taskworker.config import TaskNamespace


class Task:
    name: str
    __func: Callable[..., Any]
    __namespace: TaskNamespace

    def __init__(self, name: str, func: Callable[..., Any], namespace: TaskNamespace):
        self.name = name
        self.__func = func
        self.__namespace = namespace
        update_wrapper(self, func)

    def __call__(self, *args, **kwargs) -> None:
        return self.__func(*args, **kwargs)

    def delay(self, *args, **kwargs):
        return self.apply_async(*args, **kwargs)

    def apply_async(self, *args, **kwargs):
        self.__namespace.send_task(self, args, kwargs)
