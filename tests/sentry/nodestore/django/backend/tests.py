# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.nodestore.django.models import Node
from sentry.nodestore.django.backend import DjangoNodeStorage
from sentry.testutils import TestCase


class DjangoNodeStorageTest(TestCase):
    def setUp(self):
        self.ns = DjangoNodeStorage()

    def test_get(self):
        node = Node.objects.create(
            id='d2502ebbd7df41ceba8d3275595cac33',
            data={
                'foo': 'bar',
            }
        )

        result = self.ns.get(node.id)
        assert result == node.data

    def test_get_multi(self):
        nodes = [
            Node.objects.create(
                id='d2502ebbd7df41ceba8d3275595cac33',
                data={
                    'foo': 'bar',
                }
            ),
            Node.objects.create(
                id='5394aa025b8e401ca6bc3ddee3130edc',
                data={
                    'foo': 'baz',
                }
            ),
        ]

        result = self.ns.get_multi([
            'd2502ebbd7df41ceba8d3275595cac33', '5394aa025b8e401ca6bc3ddee3130edc'
        ])
        assert result == dict((n.id, n.data) for n in nodes)

    def test_set(self):
        self.ns.set('d2502ebbd7df41ceba8d3275595cac33', {
            'foo': 'bar',
        })
        assert Node.objects.get(id='d2502ebbd7df41ceba8d3275595cac33').data == {
            'foo': 'bar',
        }

    def test_set_multi(self):
        self.ns.set_multi({
            'd2502ebbd7df41ceba8d3275595cac33': {
                'foo': 'bar',
            },
            '5394aa025b8e401ca6bc3ddee3130edc': {
                'foo': 'baz',
            },
        })
        assert Node.objects.get(id='d2502ebbd7df41ceba8d3275595cac33').data == {
            'foo': 'bar',
        }
        assert Node.objects.get(id='5394aa025b8e401ca6bc3ddee3130edc').data == {
            'foo': 'baz',
        }

    def test_create(self):
        node_id = self.ns.create({
            'foo': 'bar',
        })
        assert Node.objects.get(id=node_id).data == {
            'foo': 'bar',
        }

    def test_delete(self):
        node = Node.objects.create(
            id='d2502ebbd7df41ceba8d3275595cac33',
            data={
                'foo': 'bar',
            }
        )

        self.ns.delete(node.id)
        assert not Node.objects.filter(id=node.id).exists()

    def test_delete_multi(self):
        node = Node.objects.create(
            id='d2502ebbd7df41ceba8d3275595cac33',
            data={
                'foo': 'bar',
            }
        )

        self.ns.delete_multi([node.id])
        assert not Node.objects.filter(id=node.id).exists()

    def test_cleanup(self):
        now = timezone.now()
        cutoff = now - timedelta(days=1)

        node = Node.objects.create(
            id='d2502ebbd7df41ceba8d3275595cac33',
            timestamp=now,
            data={
                'foo': 'bar',
            }
        )

        node2 = Node.objects.create(
            id='d2502ebbd7df41ceba8d3275595cac34',
            timestamp=cutoff,
            data={
                'foo': 'bar',
            }
        )

        self.ns.cleanup(cutoff)

        assert Node.objects.filter(id=node.id).exists()
        assert not Node.objects.filter(id=node2.id).exists()
