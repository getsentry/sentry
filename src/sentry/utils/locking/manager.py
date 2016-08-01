from __future__ import absolute_import

from sentry.utils.locking.lock import Lock


class LockManager(object):
    def __init__(self, backend):
        self.backend = backend

    def get(self, key, duration, routing_key=None):
        """
        Retrieve a ``Lock`` instance.
        """
        return Lock(self.backend, key, duration, routing_key)
