import pytest

from sentry.cache.redis import RedisCache, ValueTooLarge
from sentry.testutils.cases import TestCase


class RedisCacheTest(TestCase):
    def setUp(self):
        self.backend = RedisCache()

    def test_integration(self):
        self.backend.set("foo", {"foo": "bar"}, 50)

        result = self.backend.get("foo")
        assert result == {"foo": "bar"}

        self.backend.delete("foo")

        result = self.backend.get("foo")
        assert result is None

        with pytest.raises(ValueTooLarge):
            self.backend.set("foo", "x" * (RedisCache.max_size + 1), 0)
