# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.cache.redis import RedisCache, ValueTooLarge
from sentry.testutils import TestCase


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

        with self.assertRaises(ValueTooLarge):
            self.backend.set("foo", "x" * (RedisCache.max_size + 1), 0)
