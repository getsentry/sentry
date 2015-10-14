from __future__ import absolute_import

from contextlib import contextmanager

from sentry.digests.backends.base import Backend


class DummyBackend(Backend):
    def add(self, key, record):
        pass

    @contextmanager
    def digest(self, key):
        yield []

    def schedule(self, deadline):
        return
        yield  # make this a generator

    def maintenance(self, deadline):
        pass
