from __future__ import annotations

import logging
import random
import time
from collections.abc import Generator
from contextlib import contextmanager
from typing import ContextManager
from uuid import uuid4

from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.locking.backends import LockBackend

logger = logging.getLogger(__name__)


class Lock:
    def __init__(self, backend: LockBackend, key: str, duration: int) -> None:
        self.backend = backend
        self.key = key
        self.duration = duration
        # Set by a successful acquire. Release sends this token so a stale
        # holder cannot delete a newer acquisition that reused the process uuid.
        self.token: str | None = None

    def __repr__(self) -> str:
        return f"<Lock: {self.key!r}>"

    def acquire(self) -> ContextManager[None]:
        """
        Attempt to acquire the lock.

        If the lock is successfully acquired, this method returns a context
        manager that will automatically release the lock when exited. If the
        lock cannot be acquired, an ``UnableToAcquireLock`` error will be
        raised.
        """
        token = uuid4().hex
        try:
            self.backend.acquire(self.key, self.duration, token)
        except Exception as error:
            raise UnableToAcquireLock(
                f"Unable to acquire {self!r} due to error: {error}"
            ) from error

        self.token = token

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
        Try to acquire the lock in a polling loop.

        :param initial_delay: A random retry delay will be picked between 0
            and this value (in seconds). The range from which we pick doubles
            in every iteration.
        :param timeout: Time in seconds after which ``UnableToAcquireLock``
            will be raised.
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

        A lock that never acquired returns without calling the backend. Sending
        the process uuid would delete a newer holder's key in this process.
        Any exceptions raised when attempting to release the lock are logged
        and suppressed. The token stays set when the release raises, so a retry
        can still delete the key.
        """
        token = self.token
        if token is None:
            return
        try:
            self.backend.release(self.key, token)
        except Exception as error:
            logger.warning("Failed to release %r due to error: %r", self, error, exc_info=True)
        else:
            self.token = None

    def locked(self) -> bool:
        """
        See if the lock has been taken somewhere else.
        """
        return self.backend.locked(self.key)
