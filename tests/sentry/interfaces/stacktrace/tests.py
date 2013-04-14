# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.interfaces import Stacktrace, Exception
from sentry.models import Event
from sentry.testutils import TestCase, fixture


class StacktraceTest(TestCase):
    @fixture
    def interface(self):
        return Stacktrace(frames=[
            {
                'filename': 'foo/bar.py'
            },
            {
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': True,
            }
        ])

    def test_legacy_interface(self):
        # Simple test to ensure legacy data works correctly with the ``Frame``
        # objects
        event = self.event
        interface = Stacktrace(**event.data['sentry.interfaces.Stacktrace'])
        assert len(interface.frames) == 5
        assert interface == event.interfaces['sentry.interfaces.Stacktrace']

    def test_requires_filename(self):
        with self.assertRaises(AssertionError):
            Stacktrace(frames=[{}]).validate()

        Stacktrace(frames=[{
            'filename': 'foo.py',
        }]).validate()
        Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }]).validate()

    def test_allows_abs_path_without_filename(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'abs_path': 'foo/bar/baz.py',
        }])
        frame = interface.frames[0]
        assert frame.filename == 'foo/bar/baz.py'
        assert frame.abs_path == frame.filename

    def test_coerces_url_filenames(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'http://foo.com/foo.js',
        }])
        frame = interface.frames[0]
        assert frame.filename == '/foo.js'
        assert frame.abs_path == 'http://foo.com/foo.js'

    def test_coerces_url_abs_paths(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'foo.js',
            'abs_path': 'http://foo.com/foo.js',
        }])
        frame = interface.frames[0]
        assert frame.filename == '/foo.js'
        assert frame.abs_path == 'http://foo.com/foo.js'

    def test_ignores_results_with_empty_path(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'http://foo.com',
        }])
        frame = interface.frames[0]
        assert frame.filename == 'http://foo.com'
        assert frame.abs_path == frame.filename

    def test_serialize_returns_frames(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }])
        result = interface.serialize()
        assert 'frames' in result

    def test_get_hash_with_only_required_vars(self):
        interface = Stacktrace(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }])
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 1])

    def test_get_hash_ignores_filename_if_http(self):
        interface = Stacktrace(frames=[{
            'context_line': 'hello world',
            'filename': 'http://foo.com/foo.py',
        }])
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_ignores_filename_if_https(self):
        interface = Stacktrace(frames=[{
            'context_line': 'hello world',
            'filename': 'https://foo.com/foo.py',
        }])
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_ignores_filename_if_abs_path_is_http(self):
        interface = Stacktrace(frames=[{
            'context_line': 'hello world',
            'abs_path': 'https://foo.com/foo.py',
            'filename': 'foo.py',
        }])
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

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

    def test_get_composite_hash_uses_exception_value_if_no_type_or_stack(self):
        interface = Stacktrace(frames=[])
        interface_exc = Exception(value='bar')
        result = interface.get_composite_hash({
            'sentry.interfaces.Exception': interface_exc,
        })
        self.assertEquals(result[-1], 'bar')

    @mock.patch('sentry.interfaces.Stacktrace.get_stacktrace')
    def test_to_string_returns_stacktrace(self, get_stacktrace):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[])
        result = interface.to_string(event)
        get_stacktrace.assert_called_once_with(event, system_frames=False, max_frames=5)
        self.assertEquals(result, get_stacktrace.return_value)

    @mock.patch('sentry.interfaces.is_newest_frame_first', mock.Mock(return_value=False))
    @mock.patch('sentry.interfaces.Stacktrace.get_stacktrace')
    def test_get_traceback_response(self, get_stacktrace):
        event = mock.Mock(spec=Event())
        event.message = 'foo'
        get_stacktrace.return_value = 'bar'
        interface = Stacktrace(frames=[{'lineno': 1, 'filename': 'foo.py'}])
        result = interface.get_traceback(event)
        get_stacktrace.assert_called_once_with(event, newest_first=None)
        self.assertEquals(result, 'foo\n\nbar')

    @mock.patch('sentry.interfaces.is_newest_frame_first', mock.Mock(return_value=False))
    @mock.patch('sentry.interfaces.Stacktrace.get_traceback')
    @mock.patch('sentry.interfaces.render_to_string')
    @mock.patch('sentry.interfaces.Frame.get_context')
    def test_to_html_render_call(self, get_frame_context, render_to_string, get_traceback):
        event = mock.Mock(spec=Event())
        get_traceback.return_value = 'bar'
        interface = Stacktrace(frames=[{'lineno': 1, 'filename': 'foo.py'}])
        result = interface.to_html(event)
        get_traceback.assert_called_once_with(event, newest_first=False)
        get_frame_context.assert_called_once_with(event=event, is_public=False)
        render_to_string.assert_called_once_with('sentry/partial/interfaces/stacktrace.html', {
            'event': event,
            'frames': [get_frame_context.return_value],
            'stacktrace': 'bar',
            'stack_id': 'stacktrace_1',
            'system_frames': 0,
            'newest_first': False,
            'is_public': False,
        })
        self.assertEquals(result, render_to_string.return_value)

    @mock.patch('sentry.interfaces.is_newest_frame_first', mock.Mock(return_value=False))
    @mock.patch('sentry.interfaces.Stacktrace.get_traceback')
    def test_to_html_response(self, get_traceback):
        event = mock.Mock(spec=Event())
        event.message = 'foo'
        get_traceback.return_value = 'bar'
        interface = Stacktrace(frames=[{'lineno': 1, 'filename': 'foo.py'}])
        result = interface.to_html(event)
        get_traceback.assert_called_once_with(event, newest_first=False)
        self.assertTrue('<div class="module">' in result)

    @mock.patch('sentry.interfaces.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_only_filename(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[{'filename': 'foo'}, {'filename': 'bar'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo"\n  File "bar"')

    @mock.patch('sentry.interfaces.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_module(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[{'module': 'foo'}, {'module': 'bar'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  Module "foo"\n  Module "bar"')

    @mock.patch('sentry.interfaces.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_filename_and_function(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[{'filename': 'foo', 'function': 'biz'}, {'filename': 'bar', 'function': 'baz'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo", in biz\n  File "bar", in baz')

    @mock.patch('sentry.interfaces.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_filename_function_lineno_and_context(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[{'filename': 'foo', 'function': 'biz', 'lineno': 3, 'context_line': '  def foo(r):'},
            {'filename': 'bar', 'function': 'baz', 'lineno': 5, 'context_line': '    return None'}])
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo", line 3, in biz\n    def foo(r):\n  File "bar", line 5, in baz\n    return None')
