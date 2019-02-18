from __future__ import absolute_import

from sentry.eventtypes import ErrorEvent
from sentry.testutils import TestCase


class ErrorEventTest(TestCase):
    def test_has_metadata_none(self):
        inst = ErrorEvent()
        assert not inst.has_metadata({})

        inst = ErrorEvent()
        data = {'exception': None}
        assert not inst.has_metadata(data)

        inst = ErrorEvent()
        data = {'exception': {'values': None}}
        assert not inst.has_metadata(data)

        inst = ErrorEvent()
        data = {'exception': {'values': [None]}}
        assert not inst.has_metadata(data)

        inst = ErrorEvent()
        data = {'exception': {'values': [{}]}}
        assert not inst.has_metadata(data)

        inst = ErrorEvent()
        data = {'exception': {'values': [{
            'type': None,
            'value': None,
        }]}}
        assert not inst.has_metadata(data)

    def test_has_metadata(self):
        inst = ErrorEvent()
        data = {'exception': {'values': [{
            'type': 'Exception',
            'value': 'Foo',
        }]}}
        assert inst.has_metadata(data)

        inst = ErrorEvent()
        data = {'exception': {'values': [{
            'stacktrace': {},
        }]}}
        assert inst.has_metadata(data)

    def test_get_metadata(self):
        inst = ErrorEvent()
        data = {'exception': {'values': [{
            'type': 'Exception',
            'value': 'Foo',
        }]}}
        assert inst.get_metadata(data) == {
            'type': 'Exception',
            'value': 'Foo',
        }

    def test_get_metadata_none(self):
        inst = ErrorEvent()
        data = {'exception': {'values': [{
            'type': None,
            'value': None,
            'stacktrace': {},
        }]}}
        assert inst.get_metadata(data) == {
            'type': 'Error',
            'value': '',
        }

    def test_get_title_none_value(self):
        inst = ErrorEvent()
        result = inst.get_title({'type': 'Error', 'value': None})
        assert result == 'Error'

    def test_get_title_eliminates_values_with_newline(self):
        inst = ErrorEvent()
        result = inst.get_title({'type': 'Error', 'value': 'foo\nbar'})
        assert result == 'Error: foo'

    def test_get_title_handles_empty_value(self):
        inst = ErrorEvent()
        result = inst.get_title({'type': 'Error', 'value': ''})
        assert result == 'Error'
