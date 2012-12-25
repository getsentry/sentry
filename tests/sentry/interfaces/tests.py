# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pickle

from sentry.interfaces import Interface, Message, Stacktrace
from sentry.models import Event
from sentry.testutils import TestCase, fixture


class InterfaceBase(TestCase):
    @fixture
    def event(self):
        return Event(
            id=1,
        )


class InterfaceTest(InterfaceBase):
    @fixture
    def interface(self):
        return Interface(foo=1)

    def test_init_sets_attrs(self):
        assert self.interface.attrs == ['foo']

    def test_setstate_sets_attrs(self):
        data = pickle.dumps(self.interface)
        obj = pickle.loads(data)
        assert obj.attrs == ['foo']

    def test_to_html_default(self):
        assert self.interface.to_html(self.event) == ''

    def test_to_string_default(self):
        assert self.interface.to_string(self.event) == ''


class MessageTest(InterfaceBase):
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
