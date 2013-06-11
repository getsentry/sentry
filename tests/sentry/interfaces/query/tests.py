# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.testutils import TestCase, fixture
from sentry.interfaces import Query


class QueryTest(TestCase):
    @fixture
    def interface(self):
        return Query(query='SELECT 1', engine='psycopg2')

    def test_serialize_behavior(self):
        assert self.interface.serialize() == {
            'query': self.interface.query,
            'engine': self.interface.engine,
        }

    def test_get_hash_uses_query(self):
        assert self.interface.get_hash() == [self.interface.query]

    def test_get_search_context(self):
        assert self.interface.get_search_context(self.event) == {
            'text': [self.interface.query],
        }
