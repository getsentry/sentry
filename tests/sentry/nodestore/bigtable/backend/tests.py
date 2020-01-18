from __future__ import absolute_import

# from datetime import timedelta
# from django.utils import timezone

from sentry.nodestore.bigtable.backend import BigtableNodeStorage
from sentry.testutils import TestCase

# from sentry.utils.compat import mock


class BigtableNodeStorageTest(TestCase):
    def setUp(self):
        self.ns = BigtableNodeStorage()
        self.ns.bootstrap()

    def test_get(self):
        node_id = "node_id"
        data = {"foo": "bar"}
        self.ns.set(node_id, data)
        assert self.ns.get(node_id) == data

    def test_get_multi(self):
        nodes = [("node_1", {"foo": "a"}), ("node_2", {"foo": "b"})]

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

    def test_cache(self):
        with self.options({"nodedata.cache-sample-rate": 1.0, "nodedata.cache-on-save": True}):
            pass

    #         node_1 = ("node_1", {"event_id": "a" * 32})
    #         node_2 = ("node_2", {"event_id": "b" * 32})
    #         node_3 = ("node_3", {"event_id": "c" * 32})

    #         for node_id, data in [node_1, node_2, node_3]:
    #             Node.objects.create(id=node_id, data=data)

    #         # Get / get multi populates cache
    #         assert self.ns.get(node_1[0]) == node_1[1]
    #         assert self.ns.get_multi([node_2[0], node_3[0]]) == {
    #             node_2[0]: node_2[1],
    #             node_3[0]: node_3[1],
    #         }
    #         with mock.patch.object(Node.objects, "get") as mock_get:
    #             assert self.ns.get(node_1[0]) == node_1[1]
    #             assert self.ns.get(node_2[0]) == node_2[1]
    #             assert self.ns.get(node_3[0]) == node_3[1]
    #             assert mock_get.call_count == 0

    #         with mock.patch.object(Node.objects, "filter") as mock_filter:
    #             assert self.ns.get_multi([node_1[0], node_2[0], node_3[0]])
    #             assert mock_filter.call_count == 0

    #         # Manually deleted item should still retreivable from cache
    #         Node.objects.get(id=node_1[0]).delete()
    #         assert self.ns.get(node_1[0]) == node_1[1]
    #         assert self.ns.get_multi([node_1[0], node_2[0]]) == {
    #             node_1[0]: node_1[1],
    #             node_2[0]: node_2[1],
    #         }

    #         # Deletion clars cache
    #         self.ns.delete(node_1[0])
    #         assert self.ns.get_multi([node_1[0], node_2[0]]) == {node_2[0]: node_2[1]}
    #         self.ns.delete_multi([node_1[0], node_2[0]])
    #         assert self.ns.get_multi([node_1[0], node_2[0]]) == {}

    #         # Setting the item updates cache
    #         new_value = {"event_id": "d" * 32}
    #         self.ns.set(node_1[0], new_value)
    #         with mock.patch.object(Node.objects, "get") as mock_get:
    #             assert self.ns.get(node_1[0]) == new_value
    #             assert mock_get.call_count == 0
