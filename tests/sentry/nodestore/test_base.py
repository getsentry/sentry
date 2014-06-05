# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.nodestore.base import NodeStorage
from sentry.testutils import TestCase


class NodeStorageTest(TestCase):
    def setUp(self):
        self.ns = NodeStorage()

    def test_generate_id(self):
        result = self.ns.generate_id()
        assert result
