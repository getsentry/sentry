# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.query import Query
from sentry.testutils import TestCase


class QueryTest(TestCase):
    @fixture
    def interface(self):
        return Query.to_python(dict(query='SELECT 1', engine='psycopg2'))

    def test_serialize_behavior(self):
        assert self.interface.to_json() == {
            'query': self.interface.query,
            'engine': self.interface.engine,
        }

    def test_get_hash_uses_query(self):
        assert self.interface.get_hash() == [self.interface.query]

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()
