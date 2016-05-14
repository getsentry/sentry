from sentry.utils.locking.lock import Lock


class LockManager(object):
    def __init__(self, backend):
        self.backend = backend

    def get(self, *args, **kwargs):
        return Lock(self.backend, *args, **kwargs)
