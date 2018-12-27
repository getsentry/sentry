from __future__ import absolute_import

from sentry.similarity.backends.abstract import AbstractIndexBackend


class DummyIndexBackend(AbstractIndexBackend):
    def classify(self, scope, items, limit=None, timestamp=None):
        return []

    def compare(self, scope, key, items, limit=None, timestamp=None):
        return []

    def record(self, scope, key, items, timestamp=None):
        return {}

    def merge(self, scope, destination, items, timestamp=None):
        return False

    def delete(self, scope, items, timestamp=None):
        return False

    def scan(self, scope, indices, batch=1000, timestamp=None):
        # empty generator
        return
        yield

    def flush(self, scope, indices, batch=1000, timestamp=None):
        pass

    def export(self, scope, items, timestamp=None):
        return {}

    def import_(self, scope, items, timestamp=None):
        return {}
