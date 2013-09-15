# -*- coding: utf-8 -*-

from __future__ import absolute_import

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

        result = self.ns.get('d2502ebbd7df41ceba8d3275595cac33')
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
