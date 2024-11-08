from __future__ import annotations

import contextlib
from collections.abc import Generator
from typing import Any, ContextManager, Self
from unittest import mock

from celery import current_app
from celery.app.task import Task
from django.conf import settings

__all__ = ("BurstTaskRunner", "TaskRunner")


@contextlib.contextmanager
def TaskRunner() -> Generator[None]:
    prev = settings.CELERY_ALWAYS_EAGER
    settings.CELERY_ALWAYS_EAGER = True
    current_app.conf.CELERY_ALWAYS_EAGER = True
    with mock.patch.object(settings, "TASK_WORKER_ALWAYS_EAGER", True):
        try:
            yield
        finally:
            current_app.conf.CELERY_ALWAYS_EAGER = prev
            settings.CELERY_ALWAYS_EAGER = prev


class BurstTaskRunnerRetryError(Exception):
    """
    An exception that mocks can throw, which will bubble to tasks run by the `BurstTaskRunner` and
    cause them to be re-queued, rather than failed immediately. Useful for simulating the
    `@instrument_task` decorator's retry semantics.
    """


class _BurstState:
    def __init__(self) -> None:
        self._active = False
        self._orig_apply_async = Task.apply_async
        self.queue: list[tuple[Task, tuple[Any, ...], dict[str, Any]]] = []

    def _apply_async(
        self,
        task: Task,
        args: tuple[Any, ...] = (),
        kwargs: dict[str, Any] | None = None,
        countdown: float | None = None,
        queue: str | None = None,
        **options: Any,
    ) -> None:
        if not self._active:
            raise AssertionError("task enqueued to burst runner while burst was not active!")

        try:
            _start_time = options.pop("__start_time", None)
            if _start_time and kwargs:
                kwargs["__start_time"] = _start_time
        except Exception:
            pass

        self.queue.append((task, args, {} if kwargs is None else kwargs))

    @contextlib.contextmanager
    def _patched(self) -> Generator[Self]:
        if self._active:
            raise AssertionError("nested BurstTaskRunner!")

        with mock.patch.object(Task, "apply_async", self._apply_async):
            self._active = True
            try:
                yield self
            finally:
                self._active = False

    @contextlib.contextmanager
    def temporarily_enable_normal_task_processing(self) -> Generator[None]:
        if not self._active:
            raise AssertionError("cannot disable burst when not active")

        with mock.patch.object(Task, "apply_async", self._orig_apply_async):
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
    A fixture for queueing up Celery tasks and working them off in bursts.

    The main interesting property is that one can run tasks at a later point in
    the future, testing "concurrency" without actually spawning any kind of
    worker.
    """

    return _BurstState()._patched()
