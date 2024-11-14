import time

from sentry.cache.django import DjangoCache
from sentry.testutils.cases import TestCase


class DjangoCacheTest(TestCase):
    def setUp(self):
        self.cache = DjangoCache()
        self.cache_key = "test-key"
        self.cache_val = "test-val"

    def test_get_set(self):
        assert self.cache.get(self.cache_key) is None
        self.cache.set(self.cache_key, self.cache_val, 50)

        assert self.cache.get(self.cache_key) == self.cache_val

        # Test re-writing to an existing cache key works
        self.cache.set(self.cache_key, "new-test-val", 50)
        assert self.cache.get(self.cache_key) == "new-test-val"

    def test_delete(self):
        self.cache.set(self.cache_key, self.cache_val, 50)
        assert self.cache.get(self.cache_key) == self.cache_val
        self.cache.delete(self.cache_key)

        assert self.cache.get(self.cache_key) is None

        # Test deletion without an entry works
        self.cache.delete(self.cache_key)
        assert self.cache.get(self.cache_key) is None

    def test_ttl(self):
        self.cache.set(self.cache_key, self.cache_val, 0.1)
        assert self.cache.get(self.cache_key) == self.cache_val
        time.sleep(0.1)
        assert self.cache.get(self.cache_key) is None
