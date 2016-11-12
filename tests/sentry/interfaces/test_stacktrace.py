# -*- coding: utf-8 -*-

from __future__ import absolute_import

import functools

import mock
from django.template.loader import render_to_string
from exam import fixture

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.stacktrace import (
    Frame, Stacktrace, get_context, slim_frame_data
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
        assert len(interface.frames) == 1
        assert interface == event.interfaces['sentry.interfaces.Stacktrace']

    def test_requires_filename(self):
        with self.assertRaises(InterfaceValidationError):
            Stacktrace.to_python(dict(frames=[{}]))

        Stacktrace.to_python(dict(frames=[{
            'filename': 'foo.py',
        }]))
        Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'foo.py',
        }]))

    def test_requires_frames(self):
        with self.assertRaises(InterfaceValidationError):
            Stacktrace.to_python({})

        with self.assertRaises(InterfaceValidationError):
            Stacktrace.to_python(dict(frames=[]))

        with self.assertRaises(InterfaceValidationError):
            Stacktrace.to_python(dict(frames=1))

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

    def test_does_not_overwrite_filename(self):
        interface = Stacktrace.to_python(dict(frames=[{
            'lineno': 1,
            'filename': 'foo.js',
            'abs_path': 'http://foo.com/foo.js',
        }]))
        frame = interface.frames[0]
        assert frame.filename == 'foo.js'
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

    def test_get_hash_with_minimal_app_frames(self):
        frames = [{
            'lineno': 1,
            'filename': 'foo.py',
            'in_app': True,
        }] + [{
            'lineno': 1,
            'filename': 'bar.py',
            'in_app': False,
        } for _ in range(11)]
        interface = Stacktrace.to_python(dict(frames=frames))
        result = interface.get_hash(system_frames=False)
        assert not result

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

    def test_get_hash_ignores_ENHANCED_spring_classes(self):
        interface = Frame.to_python({
            'module': 'invalid.gruml.talkytalkyhub.common.config.'
            'JipJipConfig$$EnhancerBySpringCGLIB$$1ebdddb0',
            'function': 'jipJipManagementApplication'
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            'invalid.gruml.talkytalkyhub.common.config.JipJipConfig'
            '$$EnhancerBySpringCGLIB$$<auto>',
            'jipJipManagementApplication',
        ])

    def test_get_hash_ignores_extra_ENHANCED_spring_classes(self):
        interface = Frame.to_python({
            'module': 'invalid.gruml.talkytalkyhub.common.config.'
            'JipJipConfig$$EnhancerBySpringCGLIB$$1ebdddb0'
            '$$EnhancerBySpringCGLIB$$8219cd38'
            '$$FastClassBySpringCGLIB$$6c0b35d1',
            'function': 'jipJipManagementApplication'
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            'invalid.gruml.talkytalkyhub.common.config.JipJipConfig'
            '$$EnhancerBySpringCGLIB$$<auto>$$EnhancerBySpringCGLIB$$<auto>'
            '$$FastClassBySpringCGLIB$$<auto>',
            'jipJipManagementApplication',
        ])

    def test_get_hash_ignores_sun_java_generated_methods(self):
        interface = Frame.to_python({
            'module': 'sun.reflect.GeneratedMethodAccessor12345',
            'function': 'invoke',
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            'sun.reflect.GeneratedMethodAccessor',
            'invoke',
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

    def test_get_hash_ignores_filename_if_blob(self):
        interface = Frame.to_python({
            'filename': 'blob:http://example.com/7f7aaadf-a006-4217-9ed5-5fbf8585c6c0',
        })
        result = interface.get_hash()
        self.assertEquals(result, [])

    def test_get_hash_ignores_filename_if_http(self):
        interface = Frame.to_python({
            'context_line': 'hello world',
            'filename': 'http://foo.com/foo.py',
            'function': 'test',
        })
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_ignores_filename_if_https(self):
        interface = Frame.to_python({
            'context_line': 'hello world',
            'filename': 'https://foo.com/foo.py',
            'function': 'test',
        })
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_ignores_filename_if_abs_path_is_http(self):
        interface = Frame.to_python({
            'context_line': 'hello world',
            'abs_path': 'https://foo.com/foo.py',
            'function': 'test',
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

    def test_get_hash_discards_seemingly_useless_stack(self):
        interface = Stacktrace.to_python({
            'frames': [{
                'context_line': '<HTML>',
                'lineno': 1,
                'abs_path': 'http://example.com/foo',
                'filename': 'foo',
                'function': '?',
            }],
        })
        result = interface.get_hash()
        assert result == []

    def test_get_hash_does_not_discard_non_urls(self):
        interface = Stacktrace.to_python({
            'frames': [{
                'context_line': '<HTML>',
                'lineno': 1,
                'abs_path': 'foo',
                'filename': 'foo',
                'function': '?',
            }],
        })
        result = interface.get_hash()
        assert result != []

    def test_get_hash_excludes_single_frame_urls(self):
        """
        Browser JS will often throw errors (from inlined code in an HTML page)
        which contain only a single frame, no function name, and have the HTML
        document as the filename.

        In this case the hash is often not usable as the context cannot be
        trusted and the URL is dynamic.
        """
        interface = Stacktrace.to_python({
            'frames': [{
                'context_line': 'hello world',
                'abs_path': 'http://foo.com/bar/',
                'lineno': 107,
                'filename': '/bar/',
                'module': '<unknown module>',
            }],
        })
        result = interface.get_hash()
        assert result == []

    def test_cocoa_culprit(self):
        stacktrace = Stacktrace.to_python(dict(frames=[
            {
                'filename': 'foo/baz.c',
                'package': '/foo/bar/baz.dylib',
                'lineno': 1,
                'in_app': True,
                'function': 'fooBar',
            }
        ]))
        assert stacktrace.get_culprit_string(platform='cocoa') == 'fooBar (baz)'

    def test_get_hash_does_not_group_different_js_errors(self):
        interface = Stacktrace.to_python({
            'frames': [{
                'context_line': '{snip}',
                'lineno': 20,
                'filename': 'https://foo.com/index.js',
                'function': '?',
            }],
        })
        result = interface.get_hash()
        assert result == []

    def test_get_hash_uses_symbol_instead_of_function(self):
        interface = Frame.to_python({
            'module': 'libfoo',
            'function': 'int main()',
            'symbol': '_main',
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            'libfoo',
            '_main',
        ])

    def test_get_hash_skips_symbol_if_unknown(self):
        interface = Frame.to_python({
            'module': 'libfoo',
            'function': 'main',
            'symbol': '?',
        })
        result = interface.get_hash()
        self.assertEquals(result, [
            'libfoo',
            'main',
        ])

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

    def test_bad_input(self):
        with self.assertRaises(InterfaceValidationError):
            Frame.to_python({
                'filename': 1,
            })

        with self.assertRaises(InterfaceValidationError):
            Frame.to_python({
                'filename': 'foo',
                'abs_path': 1,
            })

        with self.assertRaises(InterfaceValidationError):
            Frame.to_python({
                'function': 1,
            })

        with self.assertRaises(InterfaceValidationError):
            Frame.to_python({
                'module': 1,
            })

    def test_context_with_nan(self):
        self.assertEquals(
            Frame.to_python({
                'filename': 'x',
                'vars': {'x': float('inf')},
            }).vars,
            {'x': '<inf>'},
        )
        self.assertEquals(
            Frame.to_python({
                'filename': 'x',
                'vars': {'x': float('-inf')},
            }).vars,
            {'x': '<-inf>'},
        )
        self.assertEquals(
            Frame.to_python({
                'filename': 'x',
                'vars': {'x': float('nan')},
            }).vars,
            {'x': '<nan>'},
        )

    def test_address_normalization(self):
        interface = Frame.to_python({
            'lineno': 1,
            'filename': 'blah.c',
            'function': 'main',
            'instruction_addr': 123456,
            'symbol_addr': '123450',
            'image_addr': '0x0',
        })
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
            values.append({
                'filename': 'frame %d' % n,
                'vars': {'foo': 'bar'},
                'context_line': 'b',
                'pre_context': ['a'],
                'post_context': ['c'],
            })
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
    assert render({
        'module': 'com.getsentry.example.Example',
        'function': 'test',
        'filename': 'Example.java',
        'lineno': 1,
    }).strip() == 'at com.getsentry.example.Example.test(Example.java:1)'

    # Legacy support for frames without filename.
    assert render({
        'module': 'com.getsentry.example.Example',
        'function': 'test',
        'lineno': 1,
    }).strip() == 'at com.getsentry.example.Example.test'

    # (This shouldn't happen, but...)
    assert render({
        'module': 'com.getsentry.example.Example',
        'function': 'test',
        'filename': 'foo/bar/Example.java',
        'lineno': 1,
    }).strip() == 'at com.getsentry.example.Example.test(Example.java:1)'

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
