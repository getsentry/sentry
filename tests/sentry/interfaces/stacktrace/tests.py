# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.interfaces import Stacktrace
from sentry.models import Event

from sentry.testutils import TestCase


class StacktraceTest(TestCase):
    def test_requires_filename_and_lineno(self):
        self.assertRaises(AssertionError, Stacktrace, frames=[{
            'lineno': 1,
        }])
        Stacktrace(frames=[{
            'filename': 'foo.py',
        }])
        Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }])

    def test_serialize_returns_frames(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }])
        result = interface.serialize()
        self.assertTrue('frames' in result)

    def test_get_hash_with_only_required_vars(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }])
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 1])

    def test_get_hash_uses_module_over_filename(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
            'module': 'foo'
        }])
        result = interface.get_hash()
        self.assertEquals(result, ['foo', 1])

    def test_get_hash_uses_function_over_lineno(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
            'function': 'bar'
        }])
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 'bar'])

    @mock.patch('sentry.interfaces.Stacktrace.get_stacktrace')
    def test_to_string_returns_stacktrace(self, get_stacktrace):
        event = mock.Mock(spec=Event)
        interface = Stacktrace(frames=[])
        result = interface.to_string(event)
        get_stacktrace.assert_called_once_with(event)
        self.assertEquals(result, get_stacktrace.return_value)

    @mock.patch('sentry.interfaces.Stacktrace.get_stacktrace')
    def test_get_traceback_response(self, get_stacktrace):
        event = mock.Mock(spec=Event)
        event.message = 'foo'
        get_stacktrace.return_value = 'bar'
        interface = Stacktrace(frames=[])
        result = interface.get_traceback(event)
        get_stacktrace.assert_called_once_with(event)
        self.assertEquals(result, 'foo\n\nbar')

    @mock.patch('sentry.interfaces.Stacktrace.get_traceback')
    @mock.patch('sentry.interfaces.render_to_string')
    def test_to_html_render_call(self, render_to_string, get_traceback):
        event = mock.Mock(spec=Event)
        get_traceback.return_value = 'bar'
        interface = Stacktrace(frames=[])
        result = interface.to_html(event)
        get_traceback.assert_called_once_with(event)
        render_to_string.assert_called_once_with('sentry/partial/interfaces/stacktrace.html', {
            'event': event,
            'frames': [],
            'stacktrace': 'bar',
        })
        self.assertEquals(result, render_to_string.return_value)

    @mock.patch('sentry.interfaces.Stacktrace.get_traceback')
    def test_to_html_response(self, get_traceback):
        event = mock.Mock(spec=Event)
        event.message = 'foo'
        get_traceback.return_value = 'bar'
        interface = Stacktrace(frames=[])
        result = interface.to_html(event)
        get_traceback.assert_called_once_with(event)
        self.assertTrue('<div id="traceback" class="module">' in result)

    def test_get_stacktrace_with_only_filename(self):
        event = mock.Mock(spec=Event)
        interface = Stacktrace(frames=[{'filename': 'foo'}, {'filename': 'bar'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo"\n  File "bar"')

    def test_get_stacktrace_with_filename_and_function(self):
        event = mock.Mock(spec=Event)
        interface = Stacktrace(frames=[{'filename': 'foo', 'function': 'biz'}, {'filename': 'bar', 'function': 'baz'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo", in biz\n  File "bar", in baz')

    def test_get_stacktrace_with_filename_function_lineno_and_context(self):
        event = mock.Mock(spec=Event)
        interface = Stacktrace(frames=[{'filename': 'foo', 'function': 'biz', 'lineno': 3, 'context_line': '  def foo(r):'},
            {'filename': 'bar', 'function': 'baz', 'lineno': 5, 'context_line': '    return None'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo", line 3, in biz\n    def foo(r):\n  File "bar", line 5, in baz\n    return None')
