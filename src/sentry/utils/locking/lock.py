from __future__ import absolute_import

import logging
import six

from contextlib import contextmanager

from sentry.utils.locking import UnableToAcquireLock


logger = logging.getLogger(__name__)


class Lock(object):
    def __init__(self, backend, key, duration, routing_key=None):
        self.backend = backend
        self.key = key
        self.duration = duration
        self.routing_key = routing_key

    def __repr__(self):
        return '<Lock: {!r}>'.format(self.key)

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
            six.raise_from(UnableToAcquireLock('Unable to acquire {!r} due to error: {}'.format(self, error)), error)

        @contextmanager
        def releaser():
            try:
                yield
            finally:
                self.release()

        return releaser()

    def release(self):
        """
        Attempt to release the lock.

        Any exceptions raised when attempting to release the lock are logged
        and supressed.
        """
        try:
            self.backend.release(self.key, self.routing_key)
        except Exception as error:
            logger.warning('Failed to release %r due to error: %r', self, error, exc_info=True)
