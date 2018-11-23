from __future__ import absolute_import

from sentry.eventtypes import ErrorEvent
from sentry.testutils import TestCase


class ErrorEventTest(TestCase):
    def test_has_metadata_none(self):
        inst = ErrorEvent({})
        assert not inst.has_metadata()

        inst = ErrorEvent({'exception': None})
        assert not inst.has_metadata()

        inst = ErrorEvent({'exception': {'values': None}})
        assert not inst.has_metadata()

        inst = ErrorEvent({'exception': {'values': [None]}})
        assert not inst.has_metadata()

        inst = ErrorEvent({'exception': {'values': [{}]}})
        assert not inst.has_metadata()

        inst = ErrorEvent({'exception': {'values': [{
            'type': None,
            'value': None,
        }]}})
        assert not inst.has_metadata()

    def test_has_metadata(self):
        inst = ErrorEvent({'exception': {'values': [{
            'type': 'Exception',
            'value': 'Foo',
        }]}})
        assert inst.has_metadata()

        inst = ErrorEvent({'exception': {'values': [{
            'stacktrace': {},
        }]}})
        assert inst.has_metadata()

    def test_get_metadata(self):
        inst = ErrorEvent({'exception': {'values': [{
            'type': 'Exception',
            'value': 'Foo',
        }]}})
        assert inst.get_metadata() == {
            'type': 'Exception',
            'value': 'Foo',
        }

    def test_get_metadata_none(self):
        inst = ErrorEvent({'exception': {'values': [{
            'type': None,
            'value': None,
            'stacktrace': {},
        }]}})
        assert inst.get_metadata() == {
            'type': 'Error',
            'value': '',
        }

    def test_to_string_none_value(self):
        inst = ErrorEvent({})
        result = inst.to_string({'type': 'Error', 'value': None})
        assert result == 'Error'

    def test_to_string_eliminates_values_with_newline(self):
        inst = ErrorEvent({})
        result = inst.to_string({'type': 'Error', 'value': 'foo\nbar'})
        assert result == 'Error: foo'

    def test_to_string_handles_empty_value(self):
        inst = ErrorEvent({})
        result = inst.to_string({'type': 'Error', 'value': ''})
        assert result == 'Error'
