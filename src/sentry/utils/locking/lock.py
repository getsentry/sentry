import logging
from contextlib import contextmanager

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
        self.backend.acquire(self.key, self.duration, self.routing_key)

        @contextmanager
        def releaser():
            try:
                yield
            finally:
                self.release()

        return releaser()

    def release(self):
        try:
            self.backend.release(self.key, self.routing_key)
        except Exception as error:
            logger.warning('Failed to release %r due to error: %r', self, error, exc_info=True)
