# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.nodestore.django.models import Node
from sentry.nodestore.django.backend import DjangoNodeStorage
from sentry.testutils import TestCase
from sentry.utils.compat import mock


class DjangoNodeStorageTest(TestCase):
    def setUp(self):
        self.ns = DjangoNodeStorage()

    def test_get(self):
        node = Node.objects.create(id="d2502ebbd7df41ceba8d3275595cac33", data={"foo": "bar"})

        result = self.ns.get(node.id)
        assert result == node.data

    def test_get_multi(self):
        nodes = [
            Node.objects.create(id="d2502ebbd7df41ceba8d3275595cac33", data={"foo": "bar"}),
            Node.objects.create(id="5394aa025b8e401ca6bc3ddee3130edc", data={"foo": "baz"}),
        ]

        result = self.ns.get_multi(
            ["d2502ebbd7df41ceba8d3275595cac33", "5394aa025b8e401ca6bc3ddee3130edc"]
        )
        assert result == dict((n.id, n.data) for n in nodes)

    def test_set(self):
        self.ns.set("d2502ebbd7df41ceba8d3275595cac33", {"foo": "bar"})
        assert Node.objects.get(id="d2502ebbd7df41ceba8d3275595cac33").data == {"foo": "bar"}

    def test_set_multi(self):
        self.ns.set_multi(
            {
                "d2502ebbd7df41ceba8d3275595cac33": {"foo": "bar"},
                "5394aa025b8e401ca6bc3ddee3130edc": {"foo": "baz"},
            }
        )
        assert Node.objects.get(id="d2502ebbd7df41ceba8d3275595cac33").data == {"foo": "bar"}
        assert Node.objects.get(id="5394aa025b8e401ca6bc3ddee3130edc").data == {"foo": "baz"}

    def test_create(self):
        node_id = self.ns.create({"foo": "bar"})
        assert Node.objects.get(id=node_id).data == {"foo": "bar"}

    def test_delete(self):
        node = Node.objects.create(id="d2502ebbd7df41ceba8d3275595cac33", data={"foo": "bar"})

        self.ns.delete(node.id)
        assert not Node.objects.filter(id=node.id).exists()

    def test_delete_multi(self):
        node = Node.objects.create(id="d2502ebbd7df41ceba8d3275595cac33", data={"foo": "bar"})

        self.ns.delete_multi([node.id])
        assert not Node.objects.filter(id=node.id).exists()

    def test_cleanup(self):
        now = timezone.now()
        cutoff = now - timedelta(days=1)

        node = Node.objects.create(
            id="d2502ebbd7df41ceba8d3275595cac33", timestamp=now, data={"foo": "bar"}
        )

        node2 = Node.objects.create(
            id="d2502ebbd7df41ceba8d3275595cac34", timestamp=cutoff, data={"foo": "bar"}
        )

        self.ns.cleanup(cutoff)

        assert Node.objects.filter(id=node.id).exists()
        assert not Node.objects.filter(id=node2.id).exists()

    def test_cache(self):
        node_1 = ("a" * 32, {"foo": "a"})
        node_2 = ("b" * 32, {"foo": "b"})
        node_3 = ("c" * 32, {"foo": "c"})

        for node_id, data in [node_1, node_2, node_3]:
            Node.objects.create(id=node_id, data=data)

        # Get / get multi populates cache
        assert self.ns.get(node_1[0]) == node_1[1]
        assert self.ns.get_multi([node_2[0], node_3[0]]) == {
            node_2[0]: node_2[1],
            node_3[0]: node_3[1],
        }
        with mock.patch.object(Node.objects, "get") as mock_get:
            assert self.ns.get(node_1[0]) == node_1[1]
            assert self.ns.get(node_2[0]) == node_2[1]
            assert self.ns.get(node_3[0]) == node_3[1]
            assert mock_get.call_count == 0

        with mock.patch.object(Node.objects, "filter") as mock_filter:
            assert self.ns.get_multi([node_1[0], node_2[0], node_3[0]])
            assert mock_filter.call_count == 0

        # Manually deleted item should still retreivable from cache
        Node.objects.get(id=node_1[0]).delete()
        assert self.ns.get(node_1[0]) == node_1[1]
        assert self.ns.get_multi([node_1[0], node_2[0]]) == {
            node_1[0]: node_1[1],
            node_2[0]: node_2[1],
        }

        # Deletion clars cache
        self.ns.delete(node_1[0])
        assert self.ns.get_multi([node_1[0], node_2[0]]) == {node_2[0]: node_2[1]}
        self.ns.delete_multi([node_1[0], node_2[0]])
        assert self.ns.get_multi([node_1[0], node_2[0]]) == {}

        # Setting the item updates cache
        new_value = {"event_id": "d" * 32}
        self.ns.set(node_1[0], new_value)
        with mock.patch.object(Node.objects, "get") as mock_get:
            assert self.ns.get(node_1[0]) == new_value
            assert mock_get.call_count == 0

        # Missing rows are never cached
        assert self.ns.get("node_4") is None
        with mock.patch.object(Node.objects, "get") as mock_get:
            mock_get.side_effect = Node.DoesNotExist
            self.ns.get("node_4")
            self.ns.get("node_4")
            assert mock_get.call_count == 2
