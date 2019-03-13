# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.testutils import TestCase
from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.message import Message
from sentry.models import Event
from sentry.event_manager import EventManager


def to_python(data):
    mgr = EventManager(data={"logentry": data})
    mgr.normalize()
    evt = Event(data=mgr.get_data())
    if evt.data.get('errors'):
        raise InterfaceValidationError(evt.data.get('errors'))
    return evt.interfaces.get('logentry') or Message.to_python({})


class MessageTest(TestCase):
    @fixture
    def interface(self):
        return to_python(
            dict(
                message='Hello there %s!',
                params=('world', ),
                formatted='Hello there world!',
            )
        )

    def test_serialize_behavior(self):
        assert self.interface.to_json() == {
            'message': self.interface.message,
            'params': self.interface.params,
            'formatted': 'Hello there world!'
        }

    def test_format_kwargs(self):
        interface = to_python(dict(
            message='Hello there %(name)s!',
            params={'name': 'world'},
        ))
        assert interface.to_json() == {
            'message': interface.message,
            'params': interface.params,
            'formatted': 'Hello there world!'
        }

    def test_format_braces(self):
        interface = to_python(dict(
            message='Hello there {}!',
            params=('world', ),
        ))
        assert interface.to_json() == {
            'message': interface.message,
            'params': interface.params,
            'formatted': 'Hello there world!'
        }

    def test_stringify_primitives(self):
        assert to_python(42).formatted == '42'
        assert to_python(True).formatted == 'true'
        assert to_python(4.2).formatted == '4.2'

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    # we had a regression which was throwing this data away
    def test_retains_formatted(self):
        result = type(self.interface).to_python({'message': 'foo bar', 'formatted': 'foo bar baz'})
        assert result.message == 'foo bar'
        assert result.formatted == 'foo bar baz'

    def test_discards_dupe_message(self):
        result = type(self.interface).to_python({'message': 'foo bar', 'formatted': 'foo bar'})
        assert result.message is None
        assert result.formatted == 'foo bar'
