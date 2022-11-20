from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from threading import BoundedSemaphore
from typing import Any


class EagerFuture:
    """Emulate the Future class."""

    def __init__(self, result: Any) -> None:
        self._result = result

    def cancel(self) -> bool:
        return False

    def cancelled(self) -> bool:
        return False

    def running(self) -> bool:
        return False

    def done(self) -> bool:
        return True

    def result(self, timeout: int | None = None) -> Any:
        return self._result

    def exception(self, timeout: int | None = None) -> None:
        return None


class BoundedPoolExecutorBase:
    _executor_cls: ProcessPoolExecutor | ThreadPoolExecutor = None

    def __init__(
        self, worker_count: int | None, queue_size: int, always_eager: bool = False
    ) -> None:
        self.always_eager = always_eager
        self.executor = self._executor_cls(max_workers=worker_count)
        self.semaphore = BoundedSemaphore(queue_size)

    def submit(self, function, *args, **kwargs):
        if self.always_eager:
            return EagerFuture(function(*args, **kwargs))

        self.semaphore.acquire()

        future = self.executor.submit(function, *args, **kwargs)
        future.add_done_callback(self.semaphore_release_callback)
        return future

    def semaphore_release_callback(self, result: Any) -> Any:
        self.semaphore.release()
        return result


class BoundedProcessPoolExecutor(BoundedPoolExecutorBase):
    _executor_cls = ProcessPoolExecutor


class BoundedThreadPoolExecutor(BoundedPoolExecutorBase):
    _executor_cls = ThreadPoolExecutor
