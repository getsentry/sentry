# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.exception import SingleException
from sentry.testutils import TestCase
from sentry.models import Event
from sentry.event_manager import EventManager


class SingleExceptionTest(TestCase):
    @classmethod
    def to_python(cls, data):
        mgr = EventManager(data={"exception": {"values": [data]}})
        mgr.normalize()
        evt = Event(data=mgr.get_data())
        if evt.data.get('errors'):
            raise InterfaceValidationError(evt.data.get('errors'))

        excs = evt.interfaces['exception'].values
        if not excs:
            return SingleException.to_python({})
        return excs[0]

    @fixture
    def interface(self):
        return self.to_python(
            dict(
                type='ValueError',
                value='hello world',
                module='foo.bar',
            )
        )

    def test_serialize_behavior(self):
        assert self.interface.to_json() == {
            'type': self.interface.type,
            'value': self.interface.value,
            'module': self.interface.module,
        }

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    def test_only_requires_only_type_or_value(self):
        self.to_python(dict(
            type='ValueError',
        ))
        self.to_python(dict(
            value='ValueError',
        ))

    def test_coerces_object_value_to_string(self):
        result = self.to_python({
            'type': 'ValueError',
            'value': {'unauthorized': True},
        })
        assert result.value == '{"unauthorized":true}'

    def test_handles_type_in_value(self):
        result = self.to_python(dict(
            value='ValueError: unauthorized',
        ))
        assert result.type == 'ValueError'
        assert result.value == 'unauthorized'

        result = self.to_python(dict(
            value='ValueError:unauthorized',
        ))
        assert result.type == 'ValueError'
        assert result.value == 'unauthorized'

    def test_value_serialization_idempotent(self):
        result = self.to_python({
            'type': None,
            'value': {'unauthorized': True},
        }).to_json()

        assert 'type' not in result
        assert result['value'] == '{"unauthorized":true}'

        # Don't re-split a json-serialized value on the colon
        result = self.to_python(result).to_json()
        assert 'type' not in result
        assert result['value'] == '{"unauthorized":true}'
