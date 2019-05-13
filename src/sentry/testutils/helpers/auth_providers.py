from __future__ import absolute_import

from contextlib import contextmanager

from sentry.auth import register, unregister

__all__ = ['AuthProvider']


@contextmanager
def AuthProvider(name, cls):
    register(name, cls)
    yield
    unregister(name, cls)
