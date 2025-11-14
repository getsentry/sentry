from __future__ import annotations

import contextlib
from collections.abc import Generator
from typing import Any, ContextManager, Self, int
from unittest import mock

from django.conf import settings

from sentry.taskworker.task import Task as TaskworkerTask

__all__ = ("BurstTaskRunner", "TaskRunner")


@contextlib.contextmanager
def TaskRunner() -> Generator[None]:
    with mock.patch.object(settings, "TASKWORKER_ALWAYS_EAGER", True):
        yield


class BurstTaskRunnerRetryError(Exception):
    """
    An exception that mocks can throw, which will bubble to tasks run by the `BurstTaskRunner` and
    cause them to be re-queued, rather than failed immediately. Useful for simulating the
    `@instrument_task` decorator's retry semantics.
    """


class _BurstState:
    def __init__(self) -> None:
        self._active = False
        self._orig_signal_send = TaskworkerTask._signal_send
        self.queue: list[tuple[TaskworkerTask[Any, Any], tuple[Any, ...], dict[str, Any]]] = []

    def _signal_send(
        self,
        task: TaskworkerTask[Any, Any],
        args: tuple[Any, ...] = (),
        kwargs: dict[str, Any] | None = None,
    ) -> None:
        if not self._active:
            raise AssertionError("task enqueued to burst runner while burst was not active!")
        self.queue.append((task, args, {} if kwargs is None else kwargs))

    @contextlib.contextmanager
    def _patched(self) -> Generator[Self]:
        if self._active:
            raise AssertionError("nested BurstTaskRunner!")

        with mock.patch.object(TaskworkerTask, "_signal_send", self._signal_send):
            self._active = True
            try:
                yield self
            finally:
                self._active = False

    @contextlib.contextmanager
    def temporarily_enable_normal_task_processing(self) -> Generator[None]:
        if not self._active:
            raise AssertionError("cannot disable burst when not active")

        with mock.patch.object(TaskworkerTask, "_signal_send", self._orig_signal_send):
            self._active = False
            try:
                yield
            finally:
                self._active = True

    def __call__(self, max_jobs: int | None = None) -> None:
        if not self._active:
            raise AssertionError("burst called outside of mocked context")

        jobs = 0
        while self.queue and (max_jobs is None or max_jobs > jobs):
            task, args, kwargs = self.queue.pop(0)

            try:
                task(*args, **kwargs)
            except BurstTaskRunnerRetryError:
                self.queue.append((task, args, kwargs))

            jobs += 1

        if self.queue:
            raise RuntimeError(f"Could not empty queue, last task items: {self.queue!r}")


def BurstTaskRunner() -> ContextManager[_BurstState]:
    """
    A fixture for queueing up tasks and working them off in bursts.

    The main interesting property is that one can run tasks at a later point in
    the future, testing "concurrency" without actually spawning any kind of
    worker.
    """

    return _BurstState()._patched()
