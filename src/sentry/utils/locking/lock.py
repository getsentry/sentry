from __future__ import annotations

import logging
import random
import time
from collections.abc import Generator
from contextlib import contextmanager
from typing import ContextManager
from uuid import uuid4

from sentry.utils import metrics
from sentry.utils.locking import LockHeld, LockNotOwned, UnableToAcquireLock
from sentry.utils.locking.backends import LockBackend

logger = logging.getLogger(__name__)


class Lock:
    def __init__(
        self, backend: LockBackend, key: str, duration: int, name: str | None = None
    ) -> None:
        self.backend = backend
        self.key = key
        self.duration = duration
        self.name = name
        # Set by a successful acquire. Release sends this token so a stale
        # holder cannot delete a newer acquisition that reused the process uuid.
        self.token: str | None = None
        self._acquired_at: float | None = None

    def __repr__(self) -> str:
        return f"<Lock: {self.key!r}>"

    def _incr(self, key: str, tags: dict[str, str]) -> None:
        if self.name is not None:
            metrics.incr(key, tags={"lock_name": self.name, **tags})

    def _timing(self, key: str, value: float, tags: dict[str, str] | None = None) -> None:
        if self.name is not None:
            metrics.timing(key, value, tags={"lock_name": self.name, **(tags or {})})

    def _acquire_once(self) -> ContextManager[None]:
        token = uuid4().hex
        try:
            self.backend.acquire(self.key, self.duration, token)
        except Exception as error:
            error_type = LockHeld if isinstance(error, LockHeld) else UnableToAcquireLock
            raise error_type(f"Unable to acquire {self!r} due to error: {error}") from error

        self.token = token
        self._acquired_at = time.monotonic()

        @contextmanager
        def releaser() -> Generator[None]:
            try:
                yield
            finally:
                self.release()

        return releaser()

    def acquire(self) -> ContextManager[None]:
        """
        Attempt to acquire the lock.

        If the lock is successfully acquired, this method returns a context
        manager that will automatically release the lock when exited. If the
        lock cannot be acquired, an ``UnableToAcquireLock`` error will be
        raised. It is a ``LockHeld`` when another holder has the key, and a
        plain ``UnableToAcquireLock`` when the backend failed.
        """
        try:
            releaser = self._acquire_once()
        except UnableToAcquireLock:
            self._incr("locks.acquire", {"mode": "nonblocking", "result": "failed"})
            raise
        self._incr("locks.acquire", {"mode": "nonblocking", "result": "acquired"})
        return releaser

    def blocking_acquire(
        self,
        initial_delay: float,
        timeout: float,
        exp_base: float = 1.6,
        max_delay: float | None = None,
        retry_backend_errors: bool = True,
    ) -> ContextManager[None]:
        """
        Try to acquire the lock in a polling loop.

        :param initial_delay: A random retry delay will be picked between 0
            and this value (in seconds). The range from which we pick grows by
            ``exp_base`` in every iteration.
        :param timeout: Time in seconds after which ``UnableToAcquireLock``
            will be raised. The last attempt is made at the deadline.
        :param max_delay: Upper bound in seconds for the range a delay is
            picked from. Without it, a waiter can still be asleep for seconds
            after the holder released.
        :param retry_backend_errors: When false, only ``LockHeld`` is retried
            and a backend failure is raised on its first attempt, so an outage
            is not reported as contention after the whole timeout.
        """
        start = time.monotonic()
        slept = 0.0
        window = initial_delay
        while True:
            try:
                releaser = self._acquire_once()
            except LockHeld:
                pass
            except UnableToAcquireLock:
                if not retry_backend_errors:
                    self._record_blocking_acquire("failed", start)
                    raise
            else:
                self._record_blocking_acquire("acquired", start)
                return releaser

            # freeze_time stops time.monotonic and not time.sleep. Counting the
            # time slept still reaches the deadline under a frozen clock.
            remaining = timeout - max(time.monotonic() - start, slept)
            if remaining <= 0:
                break
            if max_delay is not None:
                window = min(window, max_delay)
            delay = min(window * random.random(), remaining)
            time.sleep(delay)
            slept += delay
            window *= exp_base

        self._record_blocking_acquire("timeout", start)
        raise UnableToAcquireLock(f"Unable to acquire {self!r} because of timeout")

    def _record_blocking_acquire(self, result: str, start: float) -> None:
        tags = {"mode": "blocking", "result": result}
        self._incr("locks.acquire", tags)
        self._timing("locks.acquire.wait", time.monotonic() - start, tags)

    def release(self) -> None:
        """
        Attempt to release the lock.

        A lock that never acquired returns without calling the backend. Sending
        the process uuid would delete a newer holder's key in this process.
        Any exceptions raised when attempting to release the lock are logged
        and suppressed. The token stays set when the release raises, so a retry
        can still delete the key.
        """
        token = self.token
        if token is None:
            return
        if self._acquired_at is not None:
            # A lock rebuilt from a stored token never acquired here, so its
            # hold time is unknown.
            self._timing("locks.held", time.monotonic() - self._acquired_at)
            self._acquired_at = None
        try:
            self.backend.release(self.key, token)
        except Exception as error:
            # LockNotOwned means the lease expired before the release and
            # another holder may have run at the same time.
            result = "not_owned" if isinstance(error, LockNotOwned) else "error"
            self._incr("locks.release", {"result": result})
            logger.warning("Failed to release %r due to error: %r", self, error, exc_info=True)
        else:
            self._incr("locks.release", {"result": "released"})
            self.token = None

    def locked(self) -> bool:
        """
        See if the lock has been taken somewhere else.
        """
        return self.backend.locked(self.key)
