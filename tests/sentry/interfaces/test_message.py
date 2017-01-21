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
            params=('world',),
            formatted='Hello there world!',
        ))

    def test_serialize_behavior(self):
        assert self.interface.to_json() == {
            'message': self.interface.message,
            'params': self.interface.params,
            'formatted': 'Hello there world!'
        }

    def test_get_hash_uses_message(self):
        assert self.interface.get_hash() == [self.interface.message]

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    def test_serialize_non_string_for_message(self):
        result = type(self.interface).to_python({
            'message': {'foo': 'bar'},
        })
        assert result.message == '{"foo":"bar"}'

    # we had a regression which was throwing this data away
    def test_retains_formatted(self):
        result = type(self.interface).to_python({
            'message': 'foo bar',
            'formatted': 'foo bar baz'
        })
        assert result.message == 'foo bar'
        assert result.formatted == 'foo bar baz'

    def test_discards_dupe_formatted(self):
        result = type(self.interface).to_python({
            'message': 'foo bar',
            'formatted': 'foo bar'
        })
        assert result.message == 'foo bar'
        assert result.formatted is None
