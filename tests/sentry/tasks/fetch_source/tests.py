# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.tasks.fetch_source import (
    UrlResult, expand_javascript_source, discover_sourcemap, fetch_sourcemap)
from sentry.utils.sourcemaps import (SourceMap, SourceMapIndex)
from sentry.testutils import TestCase

base64_sourcemap = 'data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdGVzdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zb2xlLmxvZyhcImhlbGxvLCBXb3JsZCFcIikiXX0='


class DiscoverSourcemapTest(TestCase):
    # discover_sourcemap(result)
    def test_simple(self):
        result = UrlResult('http://example.com', {}, '')
        assert discover_sourcemap(result) is None

        result = UrlResult('http://example.com', {
            'x-sourcemap': 'http://example.com/source.map.js'
        }, '')
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {
            'sourcemap': 'http://example.com/source.map.js'
        }, '')
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {}, '//@ sourceMappingURL=http://example.com/source.map.js\nconsole.log(true)')
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {}, '//# sourceMappingURL=http://example.com/source.map.js\nconsole.log(true)')
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {}, 'console.log(true)\n//@ sourceMappingURL=http://example.com/source.map.js')
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {}, 'console.log(true)\n//# sourceMappingURL=http://example.com/source.map.js')
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'


class ExpandJavascriptSourceTest(TestCase):
    @mock.patch('sentry.models.Event.update')
    @mock.patch('sentry.tasks.fetch_source.fetch_url')
    @mock.patch('sentry.tasks.fetch_source.fetch_sourcemap')
    @mock.patch('sentry.tasks.fetch_source.discover_sourcemap')
    def test_simple(self, discover_sourcemap, fetch_sourcemap, fetch_url, update):
        data = {
            'sentry.interfaces.Exception': {
                'values': [{
                    'stacktrace': {
                        'frames': [
                            {
                                'abs_path': 'http://example.com/foo.js',
                                'filename': 'foo.js',
                                'lineno': 4,
                                'colno': 0,
                            },
                            {
                                'abs_path': 'http://example.com/foo.js',
                                'filename': 'foo.js',
                                'lineno': 1,
                                'colno': 0,
                            },
                        ],
                    },
                }],
            }
        }
        discover_sourcemap.return_value = None
        fetch_sourcemap.return_value = None
        fetch_url.return_value.body = '\n'.join('hello world')

        expand_javascript_source(data)

        fetch_url.assert_called_once_with('http://example.com/foo.js')

        frame_list = data['sentry.interfaces.Exception']['values'][0]['stacktrace']['frames']
        frame = frame_list[0]
        assert frame['pre_context'] == ['h', 'e', 'l']
        assert frame['context_line'] == 'l'
        assert frame['post_context'] == ['o', ' ', 'w', 'o', 'r']

        frame = frame_list[1]
        assert frame['pre_context'] == []
        assert frame['context_line'] == 'h'
        assert frame['post_context'] == ['e', 'l', 'l', 'o', ' ']

    @mock.patch('sentry.models.Event.update')
    @mock.patch('sentry.tasks.fetch_source.fetch_url')
    @mock.patch('sentry.tasks.fetch_source.discover_sourcemap')
    def test_inlined_sources(self, discover_sourcemap, fetch_url, update):
        data = {
            'sentry.interfaces.Exception': {
                'values': [{
                    'stacktrace': {
                        'frames': [
                            {
                                'abs_path': 'http://example.com/test.js',
                                'filename': 'test.js',
                                'lineno': 1,
                                'colno': 0,
                            },
                        ],
                    },
                }],
            }
        }
        discover_sourcemap.return_value = base64_sourcemap
        fetch_url.return_value.body = '\n'.join('<generated source>')

        expand_javascript_source(data)
        fetch_url.assert_called_once_with('http://example.com/test.js')

        frame_list = data['sentry.interfaces.Exception']['values'][0]['stacktrace']['frames']
        frame = frame_list[0]
        assert frame['pre_context'] == []
        assert frame['context_line'] == 'console.log("hello, World!")'
        assert frame['post_context'] == []


class FetchBase64SourcemapTest(TestCase):
    def test_simple(self):
        index = fetch_sourcemap(base64_sourcemap)
        states = [SourceMap(1, 0, '/test.js', 0, 0, None)]
        sources = set(['/test.js'])
        keys = [(1, 0)]
        content = {'/test.js': ['console.log("hello, World!")']}

        assert index == SourceMapIndex(states, keys, sources, content)
