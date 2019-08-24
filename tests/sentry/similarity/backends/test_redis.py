from __future__ import absolute_import

import time

import msgpack
from exam import fixture

from sentry.similarity.backends.redis import RedisScriptMinHashIndexBackend
from sentry.similarity.signatures import MinHashSignatureBuilder
from sentry.testutils import TestCase
from sentry.utils import redis

from .base import MinHashIndexBackendTestMixin


signature_builder = MinHashSignatureBuilder(32, 0xFFFF)


class RedisScriptMinHashIndexBackendTestCase(MinHashIndexBackendTestMixin, TestCase):
    @fixture
    def index(self):
        return RedisScriptMinHashIndexBackend(
            redis.clusters.get("default").get_local_client(0),
            "sim",
            signature_builder,
            16,
            60 * 60,
            12,
            10,
        )

    def test_export_import(self):
        self.index.record("example", "1", [("index", "hello world")])

        timestamp = int(time.time())
        result = self.index.export("example", [("index", 1)], timestamp=timestamp)
        assert len(result) == 1

        # Copy the data from key 1 to key 2.
        self.index.import_("example", [("index", 2, result[0])], timestamp=timestamp)

        r1 = msgpack.unpackb(self.index.export("example", [("index", 1)], timestamp=timestamp)[0])
        r2 = msgpack.unpackb(self.index.export("example", [("index", 2)], timestamp=timestamp)[0])
        assert r1[0] == r2[0]
        self.assertAlmostEqual(r1[1], r2[1], delta=10)  # cannot ensure exact TTL match

        # Copy the data again to key 2 (duplicating all of the data.)
        self.index.import_("example", [("index", 2, result[0])], timestamp=timestamp)

        result = self.index.export("example", [("index", 2)], timestamp=timestamp)
        assert len(result) == 1
