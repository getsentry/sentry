from django.core.cache import cache

from sentry.testutils.cases import TestCase


class CacheTest(TestCase):
    def setUp(self):
        self.cache = cache
        self.cache_key = "test-key"

    def test_get_set(self):
        assert self.cache.get(self.cache_key) is None
        self.cache.set(self.cache_key, "test-value", 50)

        assert self.cache.get(self.cache_key) == "test-value"

        # Test re-writing to an existing cache key works
        self.cache.set(self.cache_key, True, 50)
        assert self.cache.get(self.cache_key) is True

    def test_delete(self):
        self.cache.set(self.cache_key, "test-value", 50)
        assert self.cache.get(self.cache_key) == "test-value"
        self.cache.delete(self.cache_key)

        assert self.cache.get(self.cache_key) is None

        # Test deletion without an entry works
        self.cache.delete(self.cache_key)
        assert self.cache.get(self.cache_key) is None
