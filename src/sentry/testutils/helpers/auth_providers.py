__all__ = ["AuthProvider"]

from contextlib import contextmanager

from sentry.auth import register, unregister


@contextmanager
def AuthProvider(name, cls):
    register(name, cls)
    yield
    unregister(name, cls)
