# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.testutils import TestCase
from sentry.interfaces.message import Message


class MessageTest(TestCase):
    @fixture
    def interface(self):
        return Message.to_python(dict(
            message='Hello there %s!',
            params=('world',)
        ))

    def test_serialize_behavior(self):
        assert self.interface.to_json() == {
            'message': self.interface.message,
            'params': self.interface.params,
        }

    def test_get_hash_uses_message(self):
        assert self.interface.get_hash() == [self.interface.message]

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()
