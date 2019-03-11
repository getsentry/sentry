# -*- coding: utf-8 -*-

from __future__ import absolute_import

import functools

import mock
from django.conf import settings
from django.template.loader import render_to_string
from exam import fixture

from sentry.interfaces.stacktrace import (
    Frame, Stacktrace, get_context, is_url, slim_frame_data,
    trim_function_name
)
from sentry.models import Event
from sentry.testutils import TestCase


def test_is_url():
    assert is_url('http://example.org/') is True
    assert is_url('https://example.org/') is True
    assert is_url('file:///tmp/filename') is True
    assert is_url('applewebdata://00000000-0000-1000-8080-808080808080') is True
    assert is_url('app:///index.bundle') is False   # react native
    assert is_url('webpack:///./app/index.jsx') is False  # webpack bundle
    assert is_url('data:,') is False
    assert is_url('blob:\x00') is False


def test_trim_function_name():
    assert trim_function_name('+[foo:(bar)]', 'objc') == '+[foo:(bar)]'
    assert trim_function_name('[foo:(bar)]', 'objc') == '[foo:(bar)]'
    assert trim_function_name('-[foo:(bar)]', 'objc') == '-[foo:(bar)]'
    assert trim_function_name(
        '(anonymous namespace)::foo(int)',
        'native') == '(anonymous namespace)::foo'
    assert trim_function_name('foo::bar::foo(int)', 'native') == 'foo::bar::foo'


class GetContextTest(TestCase):
    def test_works_with_empty_filename(self):
        result = get_context(0, 'hello world')
        assert result == [(0, 'hello world')]


class StacktraceTest(TestCase):
    @fixture
    def interface(self):
        return Stacktrace.to_python(
            dict(
                frames=[
                    {
                        'filename': 'foo/bar.py'
                    }, {
                        'filename': 'foo/baz.py',
                        'lineno': 1,
                        'in_app': True,
                    }
                ]
            )
        )

    def test_null_values(self):
        sink = {}

        assert Stacktrace.to_python({}).to_json() == sink
        assert Stacktrace.to_python({'frames': None}).to_json() == sink
        assert Stacktrace.to_python({'frames': []}).to_json() == sink

        # TODO(markus): Should eventually generate frames: [None]
        assert Stacktrace.to_python({'frames': [None]}).to_json() == {}

    def test_null_values_in_frames(self):
        sink = {'frames': [{}]}

        assert Stacktrace.to_python({'frames': [{}]}).to_json() == sink
        assert Stacktrace.to_python({'frames': [{'abs_path': None}]}).to_json() == sink

    def test_legacy_interface(self):
        # Simple test to ensure legacy data works correctly with the ``Frame``
        # objects
        event = self.event
        interface = Stacktrace.to_python(event.data['stacktrace'])
        assert len(interface.frames) == 2
        assert interface == event.interfaces['stacktrace']

    def test_filename(self):
        Stacktrace.to_python(dict(frames=[{
            'filename': 'foo.py',
        }]))
        Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }]))

    def test_allows_abs_path_without_filename(self):
        interface = Stacktrace.to_python(
            dict(frames=[{
                'lineno': 1,
                'abs_path': 'foo/bar/baz.py',
            }])
        )
        frame = interface.frames[0]
        assert frame.filename == 'foo/bar/baz.py'
        assert frame.abs_path == frame.filename

    def test_coerces_url_filenames(self):
        interface = Stacktrace.to_python(
            dict(frames=[{
                'lineno': 1,
                'filename': 'http://foo.com/foo.js',
            }])
        )
        frame = interface.frames[0]
        assert frame.filename == '/foo.js'
        assert frame.abs_path == 'http://foo.com/foo.js'

    def test_does_not_overwrite_filename(self):
        interface = Stacktrace.to_python(
            dict(
                frames=[{
                    'lineno': 1,
                    'filename': 'foo.js',
                    'abs_path': 'http://foo.com/foo.js',
                }]
            )
        )
        frame = interface.frames[0]
        assert frame.filename == 'foo.js'
        assert frame.abs_path == 'http://foo.com/foo.js'

    def test_ignores_results_with_empty_path(self):
        interface = Stacktrace.to_python(
            dict(frames=[{
                'lineno': 1,
                'filename': 'http://foo.com',
            }])
        )
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

    def test_frame_hard_limit(self):
        hard_limit = settings.SENTRY_STACKTRACE_FRAMES_HARD_LIMIT
        interface = Stacktrace.to_python(
            {
                'frames': [
                    {
                        'filename': 'Application.java',
                        'function': 'main',
                        'lineno': i,  # linenos from 1 to the hard limit + 1
                    } for i in range(1, hard_limit + 2)
                ]
            }
        )

        assert len(interface.frames) == hard_limit
        assert interface.frames[0].lineno == 1
        assert interface.frames[-1].lineno == hard_limit + 1
        # second to last frame (lineno:250) should be removed
        assert interface.frames[-2].lineno == hard_limit - 1

    @mock.patch('sentry.interfaces.stacktrace.Stacktrace.get_stacktrace')
    def test_to_string_returns_stacktrace(self, get_stacktrace):
        event = mock.Mock(spec=Event())
        interface = Stacktrace(frames=[])
        result = interface.to_string(event)
        get_stacktrace.assert_called_once_with(event, system_frames=False, max_frames=10)
        self.assertEquals(result, get_stacktrace.return_value)

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_only_filename(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace.to_python(dict(frames=[{'filename': 'foo'}, {'filename': 'bar'}]))
        result = interface.get_stacktrace(event)
        self.assertEquals(
            result, 'Stacktrace (most recent call last):\n\n  File "foo"\n  File "bar"'
        )

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_module(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace.to_python(dict(frames=[{'module': 'foo'}, {'module': 'bar'}]))
        result = interface.get_stacktrace(event)
        self.assertEquals(
            result, 'Stacktrace (most recent call last):\n\n  Module "foo"\n  Module "bar"'
        )

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_filename_and_function(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace.to_python(
            dict(
                frames=[
                    {
                        'filename': 'foo',
                        'function': 'biz'
                    }, {
                        'filename': 'bar',
                        'function': 'baz'
                    }
                ]
            )
        )
        result = interface.get_stacktrace(event)
        self.assertEquals(
            result,
            'Stacktrace (most recent call last):\n\n  File "foo", in biz\n  File "bar", in baz'
        )

    @mock.patch('sentry.interfaces.stacktrace.is_newest_frame_first', mock.Mock(return_value=False))
    def test_get_stacktrace_with_filename_function_lineno_and_context(self):
        event = mock.Mock(spec=Event())
        interface = Stacktrace.to_python(
            dict(
                frames=[
                    {
                        'filename': 'foo',
                        'function': 'biz',
                        'lineno': 3,
                        'context_line': '  def foo(r):'
                    },
                    {
                        'filename': 'bar',
                        'function': 'baz',
                        'lineno': 5,
                        'context_line': '    return None'
                    },
                ]
            )
        )
        result = interface.get_stacktrace(event)
        self.assertEquals(
            result,
            'Stacktrace (most recent call last):\n\n  File "foo", line 3, in biz\n    def foo(r):\n  File "bar", line 5, in baz\n    return None'
        )

    def test_bad_input(self):
        assert Frame.to_python({
            'filename': 1,
        }).filename is None

        assert Frame.to_python({
            'filename': 'foo',
            'abs_path': 1,
        }).abs_path == 'foo'

        assert Frame.to_python({
            'function': 1,
        }).function is None

        assert Frame.to_python({
            'module': 1,
        }).module is None

        assert Frame.to_python({
            'function': '?',
        }).function is None

    def test_context_with_nan(self):
        self.assertEquals(
            Frame.to_python({
                'filename': 'x',
                'vars': {
                    'x': float('inf')
                },
            }).vars,
            {'x': '<inf>'},
        )
        self.assertEquals(
            Frame.to_python({
                'filename': 'x',
                'vars': {
                    'x': float('-inf')
                },
            }).vars,
            {'x': '<-inf>'},
        )
        self.assertEquals(
            Frame.to_python({
                'filename': 'x',
                'vars': {
                    'x': float('nan')
                },
            }).vars,
            {'x': '<nan>'},
        )

    def test_address_normalization(self):
        interface = Frame.to_python(
            {
                'lineno': 1,
                'filename': 'blah.c',
                'function': 'main',
                'instruction_addr': 123456,
                'symbol_addr': '123450',
                'image_addr': '0x0',
            }
        )
        assert interface.instruction_addr == '0x1e240'
        assert interface.symbol_addr == '0x1e23a'
        assert interface.image_addr == '0x0'


class SlimFrameDataTest(TestCase):
    def test_under_max(self):
        interface = Stacktrace.to_python({'frames': [{'filename': 'foo'}]})
        slim_frame_data(interface, 4)
        assert len(interface.frames) == 1
        assert not interface.frames_omitted

    def test_over_max(self):
        values = []
        for n in range(5):
            values.append(
                {
                    'filename': 'frame %d' % n,
                    'vars': {
                        'foo': 'bar'
                    },
                    'context_line': 'b',
                    'pre_context': ['a'],
                    'post_context': ['c'],
                }
            )
        interface = Stacktrace.to_python({'frames': values})
        slim_frame_data(interface, 4)

        assert len(interface.frames) == 5

        for value, num in zip(interface.frames[:2], range(2)):
            assert value.filename == 'frame %d' % num
            assert value.vars is not None
            assert value.pre_context is not None
            assert value.post_context is not None

        for value, num in zip(interface.frames[3:], range(3, 5)):
            assert value.filename == 'frame %d' % num
            assert value.vars is not None
            assert value.pre_context is not None
            assert value.post_context is not None

        value = interface.frames[2]
        assert value.filename == 'frame 2'
        assert not value.vars
        assert not value.pre_context
        assert not value.post_context


def test_java_frame_rendering():
    render = functools.partial(render_to_string, 'sentry/partial/frames/java.txt')

    # This is the ideal case.
    assert render(
        {
            'module': 'com.getsentry.example.Example',
            'function': 'test',
            'filename': 'Example.java',
            'lineno': 1,
        }
    ).strip() == 'at com.getsentry.example.Example.test(Example.java:1)'

    # Legacy support for frames without filename.
    assert render({
        'module': 'com.getsentry.example.Example',
        'function': 'test',
        'lineno': 1,
    }).strip() == 'at com.getsentry.example.Example.test'

    # (This shouldn't happen, but...)
    assert render(
        {
            'module': 'com.getsentry.example.Example',
            'function': 'test',
            'filename': 'foo/bar/Example.java',
            'lineno': 1,
        }
    ).strip() == 'at com.getsentry.example.Example.test(Example.java:1)'

    # Native methods don't have line numbers.
    assert render({
        'function': 'test',
        'filename': 'Example.java',
        'lineno': -2,
    }).strip() == 'at test(Example.java)'

    assert render({
        'function': 'test',
        'filename': 'Example.java',
        'lineno': 1,
    }).strip() == 'at test(Example.java:1)'
