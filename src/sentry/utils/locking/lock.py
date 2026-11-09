from __future__ import annotations

import logging
import random
import time
from collections.abc import Generator
from contextlib import contextmanager
from typing import ContextManager

from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.backends import LockBackend

logger = logging.getLogger(__name__)


class Lock:
    def __init__(
        self, backend: LockBackend, key: str, duration: int, routing_key: str | None = None
    ) -> None:
        self.backend = backend
        self.key = key
        self.duration = duration
        self.routing_key = routing_key

    def __repr__(self) -> str:
        return f"<Lock: {self.key!r}>"

    def acquire(self) -> ContextManager[None]:
        """
        Attempt to acquire the lock once, without waiting.

        If the lock is successfully acquired, this method returns a context
        manager that will automatically release the lock when exited. If the
        lock cannot be acquired, an ``UnableToAcquireLock`` error will be
        raised. Any backend error (such as Redis being unavailable) is also
        raised as ``UnableToAcquireLock``, not only contention.

        The lock is taken when this method is called, not when the context
        manager is entered. Use it directly in a ``with`` statement so that it
        is always released::

            try:
                with lock.acquire():
                    ...
            except UnableToAcquireLock:
                ...

        The lock expires after ``duration`` seconds even if it is still held,
        and it cannot be extended. Locks are not reentrant: acquiring a lock
        that is already held fails, even from the same process.
        """
        try:
            self.backend.acquire(self.key, self.duration, self.routing_key)
        except Exception as error:
            raise UnableToAcquireLock(
                f"Unable to acquire {self!r} due to error: {error}"
            ) from error

        @contextmanager
        def releaser() -> Generator[None]:
            try:
                yield
            finally:
                self.release()

        return releaser()

    def blocking_acquire(
        self, initial_delay: float, timeout: float, exp_base: float = 1.6
    ) -> ContextManager[None]:
        """
        Try to acquire the lock in a polling loop with jittered exponential
        backoff. Returns the same context manager as ``acquire``.

        :param initial_delay: The first retry delay is picked at random
            between 0 and this value (in seconds). The upper bound of the range
            is multiplied by ``exp_base`` after every attempt.
        :param timeout: Time in seconds after which ``UnableToAcquireLock``
            will be raised. It can be raised earlier, when the next delay would
            end after the timeout.
        :param exp_base: Factor by which the retry delay range grows after
            every attempt.
        """
        stop = time.monotonic() + timeout
        attempt = 0
        while time.monotonic() < stop:
            try:
                return self.acquire()
            except UnableToAcquireLock:
                delay = (exp_base**attempt) * random.random() * initial_delay
                # Redundant check to prevent futile sleep in last iteration:
                if time.monotonic() + delay > stop:
                    break

                time.sleep(delay)

            attempt += 1

        raise UnableToAcquireLock(f"Unable to acquire {self!r} because of timeout")

    def release(self) -> None:
        """
        Attempt to release the lock.

        Any exceptions raised when attempting to release the lock are logged
        and suppressed. This includes releasing a lock that already expired,
        or that another holder took after it expired.

        Prefer the context manager returned by ``acquire`` over calling this
        method directly.
        """
        try:
            self.backend.release(self.key, self.routing_key)
        except Exception as error:
            logger.warning("Failed to release %r due to error: %r", self, error, exc_info=True)

    def locked(self) -> bool:
        """
        See if the lock is currently held by anyone, including the caller.

        Do not use this to decide whether to call ``acquire``: another process
        can take the lock between the two calls. Call ``acquire`` and handle
        ``UnableToAcquireLock`` instead.
        """
        return self.backend.locked(self.key, self.routing_key)
