import functools
import logging
from contextlib import contextmanager


logger = logging.getLogger(__name__)


class Lock(object):
    def __init__(self, manager, key, duration):
        self.manager = manager
        self.key = key
        self.duration = duration

    def __repr__(self):
        return '<Lock: {!r}>'.format(self.key)

    def acquire(self):
        self.manager.acquire(self.key, self.duration)

        @contextmanager
        def releaser():
            try:
                yield
            finally:
                self.release()

        return releaser()

    def release(self):
        try:
            self.manager.release(self.key)
        except Exception as error:
            logger.warning('Failed to release lock (%r) due to error: %s', self, error, exc_info=True)
