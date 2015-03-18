# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from exam import fixture

from sentry.interfaces.stacktrace import (
    Frame, Stacktrace, get_context, trim_frames
)
from sentry.models import Event
from sentry.testutils import TestCase


class GetContextTest(TestCase):
    def test_works_with_empty_filename(self):
        result = get_context(0, 'hello world')
        assert result == [(0, 'hello world')]


class StacktraceTest(TestCase):
    @fixture
    def interface(self):
        return Stacktrace.to_python(dict(frames=[
            {
                'filename': 'foo/bar.py'
            },
            {
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': True,
            }
        ]))

    def test_legacy_interface(self):
        # Simple test to ensure legacy data works correctly with the ``Frame``
        # objects
        event = self.event
        interface = Stacktrace.to_python(event.data['sentry.interfaces.Stacktrace'])
        assert len(interface.frames) == 5
        assert interface == event.interfaces['sentry.interfaces.Stacktrace']

    def test_requires_filename(self):
        with self.assertRaises(AssertionError):
            Stacktrace.to_python(dict(frames=[{}]))

        Stacktrace.to_python(dict(frames=[{
            'filename': 'foo.py',
        }]))
        Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }]))

    def test_allows_abs_path_without_filename(self):
        interface = Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'abs_path': 'foo/bar/baz.py',
        }]))
        frame = interface.frames[0]
        assert frame.filename == 'foo/bar/baz.py'
        assert frame.abs_path == frame.filename

    def test_coerces_url_filenames(self):
        interface = Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'http://foo.com/foo.js',
        }]))
        frame = interface.frames[0]
        assert frame.filename == '/foo.js'
        assert frame.abs_path == 'http://foo.com/foo.js'

    def test_coerces_url_abs_paths(self):
        interface = Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'foo.js',
            'abs_path': 'http://foo.com/foo.js',
        }]))
        frame = interface.frames[0]
        assert frame.filename == '/foo.js'
        assert frame.abs_path == 'http://foo.com/foo.js'

    def test_ignores_results_with_empty_path(self):
        interface = Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'http://foo.com',
        }]))
        frame = interface.frames[0]
        assert frame.filename == 'http://foo.com'
        assert frame.abs_path == frame.filename

    def test_serialize_returns_frames(self):
        interface = Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }]))
        result = interface.to_json()
        assert 'frames' in result

    def test_hash_without_system_frames(self):
        interface = Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
            'in_app': True,
        }, {
            'lineno': 1,
            'filename': 'bar.py',
            'in_app': None,
        }]))
        result = interface.get_hash(system_frames=False)
        assert result == ['foo.py', 1]

        result = interface.get_hash(system_frames=True)
        assert result == ['foo.py', 1, 'bar.py', 1]

    def test_compute_hashes(self):
        interface = Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
            'in_app': True,
        }, {
            'lineno': 1,
            'filename': 'bar.py',
            'in_app': None,
        }]))
        result = interface.compute_hashes('python')
        assert result == [['foo.py', 1, 'bar.py', 1], ['foo.py', 1]]

    def test_get_hash_with_only_required_vars(self):
        interface = Frame.to_python({
            'lineno': 1,
            'filename': 'foo.py',
        })
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 1])

    def test_get_hash_sanitizes_block_functions(self):
        # This is Ruby specific
        interface = Frame.to_python({
            'filename': 'foo.py',
            'function': 'block in _conditional_callback_around_233',
        })
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 'block'])

    def test_get_hash_sanitizes_versioned_filenames(self):
        # This is Ruby specific
        interface = Frame.to_python({
            'filename': '/data/foo/releases/20140114151955/app/views/foo.html.erb',
            'context_line': '<% if @hotels.size > 0 %>',
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            '/data/foo/releases/<version>/app/views/foo.html.erb',
            '<% if @hotels.size > 0 %>',
        ])

        interface = Frame.to_python({
            'filename': '20140114151955/app/views/foo.html.erb',
            'context_line': '<% if @hotels.size > 0 %>',
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            '<version>/app/views/foo.html.erb',
            '<% if @hotels.size > 0 %>',
        ])

    def test_get_hash_ignores_java8_lambda_module(self):
        interface = Frame.to_python({
            'module': 'foo.bar.Baz$$Lambda$40/1673859467',
            'function': 'call',
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            '<module>',
            'call',
        ])

    def test_get_hash_ignores_java8_lambda_function(self):
        interface = Frame.to_python({
            'module': 'foo.bar.Baz',
            'function': 'lambda$work$1',
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            'foo.bar.Baz',
            '<function>',
        ])

    def test_get_hash_sanitizes_erb_templates(self):
        # This is Ruby specific
        interface = Frame.to_python({
            'filename': 'foo.html.erb',
            'function': '_foo_html_erb__3327151541118998292_70361296749460',
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            'foo.html.erb', '_foo_html_erb__<anon>_<anon>',
        ])

    def test_get_hash_ignores_filename_if_http(self):
        interface = Frame.to_python({
            'context_line': 'hello world',
            'filename': 'http://foo.com/foo.py',
        })
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_ignores_filename_if_https(self):
        interface = Frame.to_python({
            'context_line': 'hello world',
            'filename': 'https://foo.com/foo.py',
        })
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_ignores_filename_if_abs_path_is_http(self):
        interface = Frame.to_python({
            'context_line': 'hello world',
            'abs_path': 'https://foo.com/foo.py',
            'filename': 'foo.py',
        })
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_uses_module_over_filename(self):
        interface = Frame.to_python({
            'lineno': 1,
            'filename': 'foo.py',
            'module': 'foo'
        })
        result = interface.get_hash()
        self.assertEquals(result, ['foo', 1])

    def test_get_hash_uses_function_over_lineno(self):
        interface = Frame.to_python({
            'lineno': 1,
            'filename': 'foo.py',
            'function': 'bar'
        })
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 'bar'])

    def test_get_hash_uses_context_line_over_function(self):
        interface = Frame.to_python({
            'context_line': 'foo bar',
            'lineno': 1,
            'filename': 'foo.py',
            'function': 'bar'
        })
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 'foo bar'])

    @mock.patch('sentry.interfaces.stacktrace.Stacktrace.get_stacktrace')
    def test_to_string_returns_stacktrace(self, get_stacktrace):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[])
        result = interface.to_string(event)
        get_stacktrace.assert_called_once_with(event, system_frames=False, max_frames=10)
        self.assertEquals(result, get_stacktrace.return_value)

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    @mock.patch('sentry.interfaces.stacktrace.Stacktrace.get_stacktrace')
    def test_get_traceback_response(self, get_stacktrace):
        event = mock.Mock(spec=Event())
        event.message = 'foo'
        get_stacktrace.return_value = 'bar'
        interface = Stacktrace.to_python(dict(frames=[{'lineno': 1, 'filename': 'foo.py'}]))
        result = interface.get_traceback(event)
        get_stacktrace.assert_called_once_with(event, newest_first=None)
        self.assertEquals(result, 'foo\n\nbar')

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    @mock.patch('sentry.interfaces.stacktrace.Stacktrace.get_traceback')
    @mock.patch('sentry.interfaces.stacktrace.render_to_string')
    @mock.patch('sentry.interfaces.stacktrace.Frame.get_context')
    def test_to_html_render_call(self, get_frame_context, render_to_string, get_traceback):
        event = mock.Mock(spec=Event())
        get_traceback.return_value = 'bar'
        interface = Stacktrace.to_python(dict(frames=[{'lineno': 1, 'filename': 'foo.py'}]))
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
            'first_frame_omitted': None,
            'last_frame_omitted': None,
        })
        self.assertEquals(result, render_to_string.return_value)

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    @mock.patch('sentry.interfaces.stacktrace.Stacktrace.get_traceback')
    def test_to_html_response(self, get_traceback):
        event = mock.Mock(spec=Event())
        event.message = 'foo'
        get_traceback.return_value = 'bar'
        interface = Stacktrace.to_python(dict(frames=[{'lineno': 1, 'filename': 'foo.py'}]))
        result = interface.to_html(event)
        get_traceback.assert_called_once_with(event, newest_first=False)
        self.assertTrue('<div class="module">' in result)

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_only_filename(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace.to_python(dict(frames=[{'filename': 'foo'}, {'filename': 'bar'}]))
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo"\n  File "bar"')

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_module(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace.to_python(dict(frames=[{'module': 'foo'}, {'module': 'bar'}]))
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  Module "foo"\n  Module "bar"')

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_filename_and_function(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace.to_python(dict(frames=[{'filename': 'foo', 'function': 'biz'}, {'filename': 'bar', 'function': 'baz'}]))
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo", in biz\n  File "bar", in baz')

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_filename_function_lineno_and_context(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace.to_python(dict(frames=[
            {'filename': 'foo', 'function': 'biz', 'lineno': 3, 'context_line': '  def foo(r):'},
            {'filename': 'bar', 'function': 'baz', 'lineno': 5, 'context_line': '    return None'},
        ]))
        result = interface.get_stacktrace(event)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\n  File "foo", line 3, in biz\n    def foo(r):\n  File "bar", line 5, in baz\n    return None')


class TrimFramesTest(TestCase):
    def test_under_max(self):
        value = {'frames': [{'filename': 'foo'}]}
        trim_frames(value)
        assert len(value['frames']) == 1
        assert value.get('frames_omitted') is None

    def test_over_max(self):
        values = []
        for n in xrange(5):
            values.append({'filename': 'frame %d' % n})
        value = {'frames': values}
        trim_frames(value, max_frames=4)

        assert len(value['frames']) == 4

        for value, num in zip(values[:2], xrange(2)):
            assert value['filename'] == 'frame %d' % num

        for value, num in zip(values[2:], xrange(3, 5)):
            assert value['filename'] == 'frame %d' % num
