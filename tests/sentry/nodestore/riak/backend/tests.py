# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.nodestore.riak.backend import RiakNodeStorage
from sentry.testutils import TestCase


def riak_is_available():
    import socket
    try:
        socket.create_connection(('127.0.0.1', 8098), 1.0)
    except socket.error:
        return False
    else:
        return True

require_riak = pytest.mark.skipif(
    'not riak_is_available()',
    reason="requires riak server running")


@require_riak
class RiakNodeStorageTest(TestCase):
    def setUp(self):
        self.ns = RiakNodeStorage(nodes=[{
            'host': '127.0.0.1',
            'http_port': 8098,
        }])

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
