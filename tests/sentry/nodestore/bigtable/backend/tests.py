from __future__ import absolute_import

import pytest

from sentry.nodestore.bigtable.backend import BigtableNodeStorage
from sentry.testutils import TestCase
from sentry.utils.compat import mock


@pytest.mark.skip(reason="Bigtable is not available in CI")
class BigtableNodeStorageTest(TestCase):
    def setUp(self):
        self.ns = BigtableNodeStorage(project="test")
        self.ns.bootstrap()

    def test_get(self):
        node_id = "node_id"
        data = {"foo": "bar"}
        self.ns.set(node_id, data)
        assert self.ns.get(node_id) == data

    def test_get_multi(self):
        nodes = [("a" * 32, {"foo": "a"}), ("b" * 32, {"foo": "b"})]

        self.ns.set(nodes[0][0], nodes[0][1])
        self.ns.set(nodes[1][0], nodes[1][1])

        result = self.ns.get_multi([nodes[0][0], nodes[1][0]])
        assert result == dict((n[0], n[1]) for n in nodes)

    def test_set(self):
        node_id = "d2502ebbd7df41ceba8d3275595cac33"
        data = {"foo": "bar"}
        self.ns.set(node_id, data)
        assert self.ns.get(node_id) == data

    def test_delete(self):
        node_id = "d2502ebbd7df41ceba8d3275595cac33"
        data = {"foo": "bar"}
        self.ns.set(node_id, data)
        assert self.ns.get(node_id) == data
        self.ns.delete(node_id)
        assert not self.ns.get(node_id)

    def test_delete_multi(self):
        nodes = [("node_1", {"foo": "a"}), ("node_2", {"foo": "b"})]

        for n in nodes:
            self.ns.set(n[0], n[1])

        self.ns.delete_multi([nodes[0][0], nodes[1][0]])
        assert not self.ns.get(nodes[0][0])
        assert not self.ns.get(nodes[1][0])

    def test_compression(self):
        self.ns.compression = True
        self.test_get()

    def test_cache(self):
        node_1 = ("a" * 32, {"foo": "a"})
        node_2 = ("b" * 32, {"foo": "b"})
        node_3 = ("c" * 32, {"foo": "c"})

        for node_id, data in [node_1, node_2, node_3]:
            self.ns.set(node_id, data)

        # Get / get multi populates cache
        assert self.ns.get(node_1[0]) == node_1[1]
        assert self.ns.get_multi([node_2[0], node_3[0]]) == {
            node_2[0]: node_2[1],
            node_3[0]: node_3[1],
        }
        with mock.patch.object(self.ns.connection, "read_row") as mock_read_row:
            assert self.ns.get(node_1[0]) == node_1[1]
            assert self.ns.get(node_2[0]) == node_2[1]
            assert self.ns.get(node_3[0]) == node_3[1]
            assert mock_read_row.call_count == 0

        with mock.patch.object(self.ns.connection, "read_rows") as mock_read_rows:
            assert self.ns.get_multi([node_1[0], node_2[0], node_3[0]])
            assert mock_read_rows.call_count == 0

        # Manually deleted item should still retrievable from cache
        row = self.ns.connection.row(node_1[0])
        row.delete()
        row.commit()
        assert self.ns.get(node_1[0]) == node_1[1]
        assert self.ns.get_multi([node_1[0], node_2[0]]) == {
            node_1[0]: node_1[1],
            node_2[0]: node_2[1],
        }

        # Deletion clears cache
        self.ns.delete(node_1[0])
        assert self.ns.get_multi([node_1[0], node_2[0]]) == {node_1[0]: None, node_2[0]: node_2[1]}
        self.ns.delete_multi([node_1[0], node_2[0]])
        assert self.ns.get_multi([node_1[0], node_2[0]]) == {node_1[0]: None, node_2[0]: None}

        # Setting the item updates cache
        new_value = {"event_id": "d" * 32}
        self.ns.set(node_1[0], new_value)
        with mock.patch.object(self.ns.connection, "read_row") as mock_read_row:
            assert self.ns.get(node_1[0]) == new_value
            assert mock_read_row.call_count == 0

        # Missing rows are never cached
        assert self.ns.get("node_4") is None
        with mock.patch.object(self.ns.connection, "read_row") as mock_read_row:
            mock_read_row.return_value = None
            self.ns.get("node_4")
            self.ns.get("node_4")
            assert mock_read_row.call_count == 2
