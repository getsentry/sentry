# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.nodestore.base import NodeStorage
from sentry.nodestore.multi.backend import MultiNodeStorage
from sentry.testutils import TestCase


class InMemoryBackend(NodeStorage):
    def __init__(self):
        self._data = {}

    def set(self, id, data):
        self._data[id] = data

    def get(self, id):
        return self._data.get(id)


class MultiNodeStorageTest(TestCase):
    def setUp(self):
        self.ns = MultiNodeStorage([
            (InMemoryBackend, {}),
            (InMemoryBackend, {}),
        ])

    def test_basic_integration(self):
        node_id = self.ns.create({
            'foo': 'bar',
        })
        assert node_id is not None
        for backend in self.ns.backends:
            assert backend.get(node_id) == {
                'foo': 'bar',
            }

        self.ns.set(node_id, {
            'foo': 'baz',
        })
        for backend in self.ns.backends:
            assert backend.get(node_id) == {
                'foo': 'baz',
            }

        result = self.ns.get(node_id)
        assert result == {
            'foo': 'baz',
        }

        node_id2 = self.ns.create({
            'foo': 'bar',
        })
        for backend in self.ns.backends:
            assert backend.get(node_id2) == {
                'foo': 'bar',
            }

        result = self.ns.get_multi([node_id, node_id2])
        assert result[node_id] == {
            'foo': 'baz',
        }
        assert result[node_id2] == {
            'foo': 'bar',
        }

        result = self.ns.set_multi({
            node_id: {
                'foo': 'biz',
            },
            node_id2: {
                'foo': 'bir',
            },
        })

        for backend in self.ns.backends:
            assert backend.get(node_id) == {
                'foo': 'biz',
            }
            assert backend.get(node_id2) == {
                'foo': 'bir',
            }
