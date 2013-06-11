# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.testutils import TestCase, fixture
from sentry.interfaces import Message


class MessageTest(TestCase):
    @fixture
    def interface(self):
        return Message(message='Hello there %s!', params=('world',))

    def test_serialize_behavior(self):
        assert self.interface.serialize() == {
            'message': self.interface.message,
            'params': self.interface.params,
        }

    def test_get_hash_uses_message(self):
        assert self.interface.get_hash() == [self.interface.message]

    def test_get_search_context_with_params_as_list(self):
        interface = self.interface
        interface.params = ['world']
        assert interface.get_search_context(self.event) == {
            'text': [interface.message] + list(interface.params)
        }

    def test_get_search_context_with_params_as_tuple(self):
        assert self.interface.get_search_context(self.event) == {
            'text': [self.interface.message] + list(self.interface.params)
        }

    def test_get_search_context_with_params_as_dict(self):
        interface = self.interface
        interface.params = {'who': 'world'}
        interface.message = 'Hello there %(who)s!'
        assert self.interface.get_search_context(self.event) == {
            'text': [interface.message] + interface.params.values()
        }

    def test_get_search_context_with_unsupported_params(self):
        interface = self.interface
        interface.params = object()
        interface.message = 'Hello there %(who)s!'
        assert self.interface.get_search_context(self.event) == {
            'text': [interface.message],
        }
