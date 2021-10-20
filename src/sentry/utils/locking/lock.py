import logging
import random
import time
from contextlib import contextmanager
from typing import Optional

from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


class Lock:
    def __init__(self, backend, key: str, duration: int, routing_key: Optional[str] = None) -> None:
        self.backend = backend
        self.key = key
        self.duration = duration
        self.routing_key = routing_key

    def __repr__(self):
        return f"<Lock: {self.key!r}>"

    def acquire(self):
        """
        Attempt to acquire the lock.

        If the lock is successfully acquired, this method returns a context
        manager that will automatically release the lock when exited. If the
        lock cannot be acquired, an ``UnableToAcquireLock`` error will be
        raised.
        """
        try:
            self.backend.acquire(self.key, self.duration, self.routing_key)
        except Exception as error:
            raise UnableToAcquireLock(
                f"Unable to acquire {self!r} due to error: {error}"
            ) from error

        @contextmanager
        def releaser():
            try:
                yield
            finally:
                self.release()

        return releaser()

    def blocking_acquire(self, initial_delay: float, timeout: float, exp_base=1.6):
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
                delay = (exp_base ** attempt) * random.random() * initial_delay
                # Redundant check to prevent futile sleep in last iteration:
                if time.monotonic() + delay > stop:
                    break

                time.sleep(delay)

            attempt += 1

        raise UnableToAcquireLock(f"Unable to acquire {self!r} because of timeout")

    def release(self):
        """
        Attempt to release the lock.

        Any exceptions raised when attempting to release the lock are logged
        and suppressed.
        """
        try:
            self.backend.release(self.key, self.routing_key)
        except Exception as error:
            logger.warning("Failed to release %r due to error: %r", self, error, exc_info=True)

    def locked(self):
        """
        See if the lock has been taken somewhere else.
        """
        return self.backend.locked(self.key, self.routing_key)
