from __future__ import annotations

import multiprocessing as mp
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from threading import BoundedSemaphore
from typing import Any


class EagerFuture:
    """Synchronous future class."""

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
    def __init__(
        self, worker_count: int | None, queue_size: int, always_eager: bool = False
    ) -> None:
        self.always_eager = always_eager
        self.executor = self.init_executor(worker_count)
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

    def init_executor(self, _: int) -> ProcessPoolExecutor | ThreadPoolExecutor:
        raise NotImplementedError


class BoundedProcessPoolExecutor(BoundedPoolExecutorBase):
    def init_executor(self, workers: int) -> ProcessPoolExecutor:
        # "Fork" is required.  "Spawn" has compatibility issues with Django among other problems.
        # Any threads that were forked will be broken in the subprocess.
        return ProcessPoolExecutor(max_workers=workers, mp_context=mp.get_context("fork"))


class BoundedThreadPoolExecutor(BoundedPoolExecutorBase):
    def init_executor(self, workers: int) -> ThreadPoolExecutor:
        return ThreadPoolExecutor(max_workers=workers)
