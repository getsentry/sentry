# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.interfaces import Stacktrace, Exception
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

    def test_get_hash_uses_context_line_over_function(self):
        interface = Stacktrace(frames=[{
            'context_line': 'foo bar',
            'lineno': 1,
            'filename': 'foo.py',
            'function': 'bar'
        }])
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 'foo bar'])

    def test_get_composite_hash_uses_exception_if_present(self):
        interface = Stacktrace(frames=[{
            'context_line': 'foo bar',
            'lineno': 1,
            'filename': 'foo.py',
            'function': 'bar'
        }])
        interface_exc = Exception(type='exception', value='bar')
        result = interface.get_composite_hash({
            'sentry.interfaces.Exception': interface_exc,
        })
        self.assertEquals(result[-1], 'exception')

    @mock.patch('sentry.interfaces.Stacktrace.get_stacktrace')
    def test_to_string_returns_stacktrace(self, get_stacktrace):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[])
        result = interface.to_string(event)
        get_stacktrace.assert_called_once_with(event, system_frames=False, max_frames=5)
        self.assertEquals(result, get_stacktrace.return_value)

    @mock.patch('sentry.interfaces.Stacktrace.get_stacktrace')
    @mock.patch('sentry.interfaces.Stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_traceback_response(self, get_stacktrace):
        event = mock.Mock(spec=Event())
        event.message = 'foo'
        get_stacktrace.return_value = 'bar'
        interface = Stacktrace(frames=[{'lineno': 1, 'filename': 'foo.py'}])
        result = interface.get_traceback(event)
        get_stacktrace.assert_called_once_with(event, newest_first=None)
        self.assertEquals(result, 'foo\n\nbar')

    @mock.patch('sentry.interfaces.Stacktrace.get_traceback')
    @mock.patch('sentry.interfaces.render_to_string')
    @mock.patch('sentry.interfaces.Stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_to_html_render_call(self, render_to_string, get_traceback):
        event = mock.Mock(spec=Event())
        get_traceback.return_value = 'bar'
        interface = Stacktrace(frames=[{'lineno': 1, 'filename': 'foo.py'}])
        result = interface.to_html(event)
        get_traceback.assert_called_once_with(event, newest_first=False)
        render_to_string.assert_called_once_with('sentry/partial/interfaces/stacktrace.html', {
            'event': event,
            'frames': [{'function': None, 'abs_path': None, 'start_lineno': None, 'lineno': 1, 'context': [], 'vars': [], 'in_app': True, 'filename': 'foo.py'}],
            'stacktrace': 'bar',
            'system_frames': 0,
            'newest_first': False,
        })
        self.assertEquals(result, render_to_string.return_value)

    @mock.patch('sentry.interfaces.Stacktrace.get_traceback')
    @mock.patch('sentry.interfaces.Stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_to_html_response(self, get_traceback):
        event = mock.Mock(spec=Event())
        event.message = 'foo'
        get_traceback.return_value = 'bar'
        interface = Stacktrace(frames=[{'lineno': 1, 'filename': 'foo.py'}])
        result = interface.to_html(event)
        get_traceback.assert_called_once_with(event, newest_first=False)
        self.assertTrue('<div class="module">' in result)

    @mock.patch('sentry.interfaces.Stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_only_filename(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[{'filename': 'foo'}, {'filename': 'bar'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo"\n  File "bar"')

    @mock.patch('sentry.interfaces.Stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_filename_and_function(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[{'filename': 'foo', 'function': 'biz'}, {'filename': 'bar', 'function': 'baz'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo", in biz\n  File "bar", in baz')

    @mock.patch('sentry.interfaces.Stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_filename_function_lineno_and_context(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[{'filename': 'foo', 'function': 'biz', 'lineno': 3, 'context_line': '  def foo(r):'},
            {'filename': 'bar', 'function': 'baz', 'lineno': 5, 'context_line': '    return None'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo", line 3, in biz\n    def foo(r):\n  File "bar", line 5, in baz\n    return None')
