from contextlib import contextmanager

from sentry.digests.backends.base import Backend


class DummyBackend(Backend):
    def add(self, key, record, increment_delay=None, maximum_delay=None):
        pass

    def enabled(self, project):
        return False

    @contextmanager
    def digest(self, key, minimum_delay=None):
        yield []

    def schedule(self, deadline):
        return
        yield  # make this a generator

    def maintenance(self, deadline):
        pass
