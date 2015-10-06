# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.api.serializers import serialize
from sentry.testutils import TestCase


class BaseSerializerTest(TestCase):
    def test_serialize(self):
        assert serialize([]) == []
        assert serialize(None) is None

        user = self.create_user()
        # We don't want to assert on the value, just that it serialized
        assert isinstance(serialize(user), dict)

        f = type('lol', (), {})()
        assert serialize(f) is f, 'should return the object when unknown'

        rv = serialize([user])
        assert isinstance(rv, list)
        assert len(rv) == 1

        rv = serialize([user, None])
        assert isinstance(rv, list)
        assert len(rv) == 2
        assert rv[1] is None

        rv = serialize([None, user])
        assert isinstance(rv, list)
        assert len(rv) == 2
        assert rv[0] is None
        assert isinstance(rv[1], dict)
