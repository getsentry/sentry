# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.nodestore.cassandra.backend import CassandraNodeStorage
from sentry.testutils import TestCase, requires_cassandra


@requires_cassandra
class CassandraNodeStorageTest(TestCase):
    def setUp(self):
        self.ns = CassandraNodeStorage(servers=[
            '127.0.0.1:9042',
        ])

    def test_integration(self):
        node_id = self.ns.create({
            'foo': 'bar',
        })
        assert node_id is not None

        self.ns.set(node_id, {
            'foo': 'baz',
        })

        result = self.ns.get(node_id)
        assert result == {
            'foo': 'baz',
        }

        node_id2 = self.ns.create({
            'foo': 'bar',
        })

        result = self.ns.get_multi([node_id, node_id2])
        assert result[node_id] == {
            'foo': 'baz',
        }
        assert result[node_id2] == {
            'foo': 'bar',
        }
