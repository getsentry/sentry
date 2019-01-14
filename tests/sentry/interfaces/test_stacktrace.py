# -*- coding: utf-8 -*-

from __future__ import absolute_import

import functools

import mock
from django.conf import settings
from django.template.loader import render_to_string
from exam import fixture

from sentry.interfaces.stacktrace import (Frame, Stacktrace, get_context, is_url, slim_frame_data)
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

    def test_hash_without_system_frames(self):
        interface = Stacktrace.to_python(
            dict(
                frames=[
                    {
                        'lineno': 1,
                        'filename': 'foo.py',
                        'in_app': True,
                    }, {
                        'lineno': 1,
                        'filename': 'bar.py',
                        'in_app': None,
                    }
                ]
            )
        )
        result = interface.get_hash(system_frames=False)
        assert result == ['foo.py', 1]

        result = interface.get_hash(system_frames=True)
        assert result == ['foo.py', 1, 'bar.py', 1]

    def test_compute_hashes(self):
        interface = Stacktrace.to_python(
            dict(
                frames=[
                    {
                        'lineno': 1,
                        'filename': 'a/foo.py',
                        'in_app': True,
                    }, {
                        'lineno': 1,
                        'filename': 'a/bar.py',
                        'in_app': None,
                    }
                ]
            )
        )
        result = interface.compute_hashes('python')
        assert result == [['a/foo.py', 1, 'a/bar.py', 1], ['a/foo.py', 1]]

    def test_compute_hashes_cocoa(self):
        interface = Stacktrace.to_python(
            dict(
                frames=[
                    {
                        'lineno': 1,
                        'filename': '/foo/bar/bar.m',
                        'in_app': True,
                    }, {
                        'lineno': 1,
                        'filename': '/foo/bar/baz.m',
                        'in_app': None,
                    }
                ]
            )
        )
        result = interface.compute_hashes('cocoa')
        assert result == [['bar.m', 1, 'baz.m', 1], ['bar.m', 1]]

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
        interface = Frame.to_python(
            {
                'filename': 'foo.py',
                'function': 'block in _conditional_callback_around_233',
            }
        )
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 'block'])

    def test_get_hash_sanitizes_versioned_filenames(self):
        # This is Ruby specific
        interface = Frame.to_python(
            {
                'filename': '/data/foo/releases/20140114151955/app/views/foo.html.erb',
                'context_line': '<% if @hotels.size > 0 %>',
            }
        )
        result = interface.get_hash()
        self.assertEquals(
            result, [
                '/data/foo/releases/<version>/app/views/foo.html.erb',
                '<% if @hotels.size > 0 %>',
            ]
        )

        interface = Frame.to_python(
            {
                'filename': '20140114151955/app/views/foo.html.erb',
                'context_line': '<% if @hotels.size > 0 %>',
            }
        )
        result = interface.get_hash()
        self.assertEquals(
            result, [
                '<version>/app/views/foo.html.erb',
                '<% if @hotels.size > 0 %>',
            ]
        )

    def test_get_hash_ignores_java8_lambda_module(self):
        interface = Frame.to_python(
            {
                'module': 'foo.bar.Baz$$Lambda$40/1673859467',
                'function': 'call',
            }
        )
        result = interface.get_hash(platform='java')
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

    def test_get_hash_ignores_ENHANCED_clojure_classes(self):
        interface = Frame.to_python(
            {
                'module': 'sentry_clojure_example.core$_main$fn__1539',
                'function': 'invoke'
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(result, [
            'sentry_clojure_example.core$_main$fn__<auto>',
            'invoke',
        ])

    def test_get_hash_ignores_extra_ENHANCED_clojure_classes(self):
        interface = Frame.to_python(
            {
                'module': 'sentry_clojure_example.core$_main$fn__1539$fn__1540',
                'function': 'invoke'
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(
            result, [
                'sentry_clojure_example.core$_main$fn__<auto>$fn__<auto>',
                'invoke',
            ]
        )

    def test_get_hash_ignores_ENHANCED_spring_classes(self):
        interface = Frame.to_python(
            {
                'module':
                'invalid.gruml.talkytalkyhub.common.config.'
                'JipJipConfig$$EnhancerBySpringCGLIB$$1ebdddb0',
                'function':
                'jipJipManagementApplication'
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(
            result, [
                'invalid.gruml.talkytalkyhub.common.config.JipJipConfig'
                '$$EnhancerBySpringCGLIB$$<auto>',
                'jipJipManagementApplication',
            ]
        )

    def test_get_hash_ignores_extra_ENHANCED_spring_classes(self):
        interface = Frame.to_python(
            {
                'module':
                'invalid.gruml.talkytalkyhub.common.config.'
                'JipJipConfig$$EnhancerBySpringCGLIB$$1ebdddb0'
                '$$EnhancerBySpringCGLIB$$8219cd38'
                '$$FastClassBySpringCGLIB$$6c0b35d1',
                'function':
                'jipJipManagementApplication'
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(
            result, [
                'invalid.gruml.talkytalkyhub.common.config.JipJipConfig'
                '$$EnhancerBySpringCGLIB$$<auto>$$EnhancerBySpringCGLIB$$<auto>'
                '$$FastClassBySpringCGLIB$$<auto>',
                'jipJipManagementApplication',
            ]
        )

    def test_get_hash_ignores_javassist(self):
        interface = Frame.to_python(
            {
                'module': 'com.example.api.entry.EntriesResource_$$_javassist_seam_74',
                'function': 'fn',
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(
            result, [
                'com.example.api.entry.EntriesResource_$$_javassist<auto>', 'fn'
            ]
        )

        interface = Frame.to_python(
            {
                'module': 'com.example.api.entry.EntriesResource_$$_javassist_74',
                'function': 'fn',
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(
            result, [
                'com.example.api.entry.EntriesResource_$$_javassist<auto>', 'fn'
            ]
        )

        interface = Frame.to_python(
            {
                'filename': 'EntriesResource_$$_javassist_seam_74.java',
                'function': 'fn',
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(
            result, [
                'EntriesResource_$$_javassist<auto>.java', 'fn'
            ]
        )

    def test_get_hash_ignores_sun_java_generated_constructors(self):
        interface = Frame.to_python(
            {
                'module': 'sun.reflect.GeneratedSerializationConstructorAccessor1',
                'function': 'invoke',
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(result, [
            'sun.reflect.GeneratedSerializationConstructorAccessor<auto>',
            'invoke',
        ])

        interface = Frame.to_python(
            {
                'module': 'sun.reflect.GeneratedConstructorAccessor2',
                'function': 'invoke',
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(result, [
            'sun.reflect.GeneratedConstructorAccessor<auto>',
            'invoke',
        ])

    def test_get_hash_ignores_sun_java_generated_methods(self):
        interface = Frame.to_python(
            {
                'module': 'sun.reflect.GeneratedMethodAccessor12345',
                'function': 'invoke',
            }
        )
        result = interface.get_hash(platform='java')
        self.assertEquals(result, [
            'sun.reflect.GeneratedMethodAccessor',
            'invoke',
        ])

    def test_get_hash_sanitizes_erb_templates(self):
        # This is Ruby specific
        interface = Frame.to_python(
            {
                'filename': 'foo.html.erb',
                'function': '_foo_html_erb__3327151541118998292_70361296749460',
            }
        )
        result = interface.get_hash()
        self.assertEquals(result, [
            'foo.html.erb',
            '_foo_html_erb__<anon>_<anon>',
        ])

    def test_get_hash_ignores_filename_if_blob(self):
        interface = Frame.to_python(
            {
                'filename': 'blob:http://example.com/7f7aaadf-a006-4217-9ed5-5fbf8585c6c0',
            }
        )
        result = interface.get_hash()
        self.assertEquals(result, [])

    def test_get_hash_ignores_filename_if_http(self):
        interface = Frame.to_python(
            {
                'context_line': 'hello world',
                'filename': 'http://foo.com/foo.py',
                'function': 'test',
            }
        )
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_ignores_filename_if_https(self):
        interface = Frame.to_python(
            {
                'context_line': 'hello world',
                'filename': 'https://foo.com/foo.py',
                'function': 'test',
            }
        )
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_ignores_filename_if_abs_path_is_http(self):
        interface = Frame.to_python(
            {
                'context_line': 'hello world',
                'abs_path': 'https://foo.com/foo.py',
                'function': 'test',
                'filename': 'foo.py',
            }
        )
        result = interface.get_hash()
        self.assertEquals(result, ['hello world'])

    def test_get_hash_uses_module_over_filename(self):
        interface = Frame.to_python({'lineno': 1, 'filename': 'foo.py', 'module': 'foo'})
        result = interface.get_hash()
        self.assertEquals(result, ['foo', 1])

    def test_get_hash_uses_function_over_lineno(self):
        interface = Frame.to_python({'lineno': 1, 'filename': 'foo.py', 'function': 'bar'})
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 'bar'])

    def test_get_hash_uses_context_line_over_function(self):
        interface = Frame.to_python(
            {
                'context_line': 'foo bar',
                'lineno': 1,
                'filename': 'foo.py',
                'function': 'bar'
            }
        )
        result = interface.get_hash()
        self.assertEquals(result, ['foo.py', 'foo bar'])

    def test_get_hash_discards_seemingly_useless_stack(self):
        interface = Stacktrace.to_python(
            {
                'frames': [
                    {
                        'context_line': '<HTML>',
                        'lineno': 1,
                        'abs_path': 'http://example.com/foo',
                        'filename': 'foo',
                        'function': '?',
                    }
                ],
            }
        )
        result = interface.get_hash()
        assert result == []

    def test_get_hash_does_not_discard_non_urls(self):
        interface = Stacktrace.to_python(
            {
                'frames': [
                    {
                        'context_line': '<HTML>',
                        'lineno': 1,
                        'abs_path': 'foo',
                        'filename': 'foo',
                        'function': '?',
                    }
                ],
            }
        )
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
        interface = Stacktrace.to_python(
            {
                'frames': [
                    {
                        'context_line': 'hello world',
                        'abs_path': 'http://foo.com/bar/',
                        'lineno': 107,
                        'filename': '/bar/',
                        'module': '<unknown module>',
                    }
                ],
            }
        )
        result = interface.get_hash()
        assert result == []

    def test_get_hash_ignores_module_if_page_url(self):
        """
        When the abs_path is a URL without a file extension, and the module is
        a suffix of that URL, we should ignore the module. This takes care of a
        raven-js issue where page URLs (not source filenames) are being used as
        the module.
        """

        interface = Frame.to_python({
            'filename': 'foo.py',
            'abs_path': 'https://sentry.io/foo/bar/baz.js',
            'module': 'foo/bar/baz',
        })
        result = interface.get_hash(platform='javascript')
        assert result == ['foo/bar/baz']

        interface = Frame.to_python({
            'filename': 'foo.py',
            'abs_path': 'https://sentry.io/foo/bar/baz',
            'module': 'foo/bar/baz',
        })
        result = interface.get_hash(platform='javascript')
        assert result == ['<module>']

    def test_get_hash_ignores_singular_anonymous_frame(self):
        interface = Stacktrace.to_python({
            'frames': [
                {"abs_path": "<anonymous>", "filename": "<anonymous>", "in_app": False},
                {"function": "c",
                 "abs_path": "file:///C:/Users/redacted/AppData/Local/redacted/resources/app.asar/dojo/dojo.js",
                 "in_app": False,
                 "lineno": 1188,
                 "colno": 125,
                 "filename": "/C:/Users/redacted/AppData/Local/redacted/app-2.4.1/resources/app.asar/dojo/dojo.js"},
                {"function": "Object._createDocumentViewModel",
                 "abs_path": "file:///C:/Users/redacted/AppData/Local/redacted/app-2.4.1/resources/app.asar/dojo/dojo.js",
                 "in_app": False,
                 "lineno": 1184,
                 "colno": 92,
                 "filename": "/C:/Users/redacted/AppData/Local/redacted/app-2.4.1/resources/app.asar/dojo/dojo.js"}
            ]
        })
        result = interface.get_hash(platform='javascript')

        assert result == []

    def test_collapse_recursion(self):
        interface = Stacktrace.to_python(
            {
                'frames': [
                    {
                        'abs_path': 'Application.java',
                        'filename': 'Application.java',
                        'function': 'main',
                        'in_app': False,
                        'lineno': 13,
                        'module': 'io.sentry.example.Application'
                    },
                    {
                        'abs_path': 'Application.java',
                        'filename': 'Application.java',
                        'function': 'normalFunc',
                        'in_app': False,
                        'lineno': 20,
                        'module': 'io.sentry.example.Application'
                    },
                    {
                        'abs_path': 'Application.java',
                        'filename': 'Application.java',
                        'function': 'recurFunc',
                        'in_app': False,
                        'lineno': 27,
                        'module': 'io.sentry.example.Application'
                    },
                    {
                        'abs_path': 'Application.java',
                        'filename': 'Application.java',
                        'function': 'recurFunc',
                        'in_app': False,
                        'lineno': 27,
                        'module': 'io.sentry.example.Application'
                    },
                    {
                        'abs_path': 'Application.java',
                        'filename': 'Application.java',
                        'function': 'recurFunc',
                        'in_app': False,
                        'lineno': 27,
                        'module': 'io.sentry.example.Application'
                    },
                    {
                        'abs_path': 'Application.java',
                        'filename': 'Application.java',
                        'function': 'recurFunc',
                        'in_app': False,
                        'lineno': 25,
                        'module': 'io.sentry.example.Application'
                    },
                    {
                        'abs_path': 'Application.java',
                        'filename': 'Application.java',
                        'function': 'throwError',
                        'in_app': False,
                        'lineno': 32,
                        'module': 'io.sentry.example.Application'
                    }
                ]
            }
        )
        result = interface.get_hash()
        self.assertEquals(result, [
            'io.sentry.example.Application', 'main',
            'io.sentry.example.Application', 'normalFunc',
            # first call to recursive function
            'io.sentry.example.Application', 'recurFunc',
            # (exact) recursive frames omitted here
            # call from *different location* in recursive function
            'io.sentry.example.Application', 'recurFunc',
            'io.sentry.example.Application', 'throwError'
        ])

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

    def test_get_hash_ignores_safari_native_code(self):
        interface = Frame.to_python(
            {
                'abs_path': '[native code]',
                'filename': '[native code]',
                'function': 'forEach',
            }
        )
        result = interface.get_hash()
        self.assertEquals(result, [])

    def test_cocoa_culprit(self):
        stacktrace = Stacktrace.to_python(
            dict(
                frames=[
                    {
                        'filename': 'foo/baz.c',
                        'package': '/foo/bar/baz.dylib',
                        'lineno': 1,
                        'in_app': True,
                        'function': '-[CRLCrashAsyncSafeThread crash]',
                    }
                ]
            )
        )
        assert stacktrace.get_culprit_string(platform='cocoa') == '-[CRLCrashAsyncSafeThread crash]'

    def test_emoji_culprit(self):
        stacktrace = Stacktrace.to_python(
            dict(
                frames=[
                    {
                        'filename': 'foo/baz.c',
                        'package': '/foo/bar/baz.dylib',
                        'module': u'\U0001f62d',
                        'lineno': 1,
                        'in_app': True,
                        'function': u'\U0001f60d',
                    }
                ]
            )
        )
        assert stacktrace.get_culprit_string(platform='javascript') == u'\U0001f60d(\U0001f62d)'

    def test_cocoa_strict_stacktrace(self):
        stacktrace = Stacktrace.to_python(
            dict(
                frames=[
                    {
                        'filename': 'foo/baz.c',
                        'package': '/foo/bar/libswiftCore.dylib',
                        'lineno': 1,
                        'in_app': False,
                        'function': 'fooBar',
                    }, {
                        'package': '/foo/bar/MyApp',
                        'in_app': True,
                        'function': 'fooBar2',
                    }, {
                        'filename': 'Mycontroller.swift',
                        'package': '/foo/bar/MyApp',
                        'in_app': True,
                        'function': '-[CRLCrashAsyncSafeThread crash]',
                    }
                ]
            )
        )
        assert stacktrace.get_culprit_string(platform='cocoa') == '-[CRLCrashAsyncSafeThread crash]'

    def test_get_hash_does_not_group_different_js_errors(self):
        interface = Stacktrace.to_python(
            {
                'frames': [
                    {
                        'context_line': '{snip}',
                        'lineno': 20,
                        'filename': 'https://foo.com/index.js',
                        'function': '?',
                    }
                ],
            }
        )
        result = interface.get_hash()
        assert result == []

    def test_get_hash_uses_symbol_instead_of_function(self):
        interface = Frame.to_python(
            {
                'module': 'libfoo',
                'function': 'int main()',
                'symbol': '_main',
            }
        )
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
