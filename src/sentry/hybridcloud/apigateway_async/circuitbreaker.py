from __future__ import annotations

import asyncio
import time
from collections import defaultdict

from django.conf import settings


class CircuitBreaker:
    __slots__ = [
        "concurrency",
        "counter_window",
        "failures",
        "semaphore",
        "_clock",
        "_counters",
        "_counter_idx",
    ]

    def __init__(self, concurrency, failures):
        self.concurrency = concurrency
        self.counter_window = failures[0]
        self.failures = failures[1]
        self.semaphore = asyncio.Semaphore(self.concurrency)
        self._clock = 0
        self._counters = [0, 0]
        self._counter_idx = 0

    def _counter_flip(self, clock):
        self._clock = clock
        prev = self._counter_idx
        self._counter_idx = 1 - prev
        self._counters[prev] = 0

    def _maybe_counter_flip(self):
        now = int(time.monotonic())
        delta = now - self._clock
        if delta > 0:
            if delta // self.counter_window:
                self._counter_flip(now)

    def counter_incr(self):
        self._maybe_counter_flip()
        self._counters[self._counter_idx] += 1

    def window_overflow(self) -> bool:
        return self._counters[self._counter_idx] > self.failures

    def overflow(self) -> bool:
        return self.semaphore.locked()

    def ctx(self) -> CircuitBreakerCtx:
        return CircuitBreakerCtx(self)


class CircuitBreakerOverflow(Exception): ...


class CircuitBreakerWindowOverflow(Exception): ...


class CircuitBreakerCtx:
    __slots__ = ["cb"]

    def __init__(self, cb: CircuitBreaker):
        self.cb = cb

    def incr_failures(self):
        self.cb.counter_incr()

    async def __aenter__(self):
        if self.cb.overflow():
            raise CircuitBreakerOverflow
        await self.cb.semaphore.acquire()
        if self.cb.window_overflow():
            self.cb.semaphore.release()
            raise CircuitBreakerWindowOverflow
        return self

    async def __aexit__(self, exc_type, exc_value, exc_tb):
        self.cb.semaphore.release()


class CircuitBreakerManager:
    __slots__ = ["objs"]

    def __init__(
        self,
        max_concurrency: int | None = None,
        failures: int | None = None,
        failure_window: int | None = None,
    ):
        concurrency = max_concurrency or settings.APIGATEWAY_PROXY_MAX_CONCURRENCY
        failures = failures or settings.APIGATEWAY_PROXY_MAX_FAILURES
        failure_window = failure_window or settings.APIGATEWAY_PROXY_FAILURE_WINDOW
        self.objs = defaultdict(lambda: CircuitBreaker(concurrency, (failure_window, failures)))

    def get(self, key: str) -> CircuitBreakerCtx:
        return self.objs[key].ctx()
