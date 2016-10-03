from __future__ import absolute_import

from sentry.eventtypes import ErrorEvent
from sentry.testutils import TestCase


class ErrorEventTest(TestCase):
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
