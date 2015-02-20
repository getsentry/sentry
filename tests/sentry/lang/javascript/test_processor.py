# -*- coding: utf-8 -*-

from __future__ import absolute_import

from mock import patch

from sentry.lang.javascript.processor import (
    BAD_SOURCE, discover_sourcemap, fetch_sourcemap, fetch_url, generate_module,
    trim_line, UrlResult
)
from sentry.lang.javascript.sourcemaps import SourceMap, SourceMapIndex
from sentry.testutils import TestCase

base64_sourcemap = 'data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdGVzdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zb2xlLmxvZyhcImhlbGxvLCBXb3JsZCFcIikiXX0='


class FetchUrlTest(TestCase):
    @patch('sentry.lang.javascript.processor.safe_urlopen')
    @patch('sentry.lang.javascript.processor.safe_urlread')
    def test_simple(self, safe_urlread, safe_urlopen):
        safe_urlopen.return_value.headers = (('content-type', 'application/json'),)
        safe_urlread.return_value = u'foo bar'

        result = fetch_url('http://example.com')

        safe_urlopen.assert_called_once_with(
            'http://example.com', allow_redirects=True, timeout=5,
            headers=[], verify_ssl=False)
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        assert result.url == 'http://example.com'
        assert result.body == u'foo bar'
        assert result.headers == {'content-type': 'application/json'}

        # ensure we use the cached result
        result2 = fetch_url('http://example.com')

        safe_urlopen.assert_called_once()

        assert result == result2

    @patch('sentry.lang.javascript.processor.safe_urlopen')
    @patch('sentry.lang.javascript.processor.safe_urlread')
    def test_with_token(self, safe_urlread, safe_urlopen):
        self.project.update_option('sentry:token', 'foobar')
        self.project.update_option('sentry:origins', ['*'])

        safe_urlopen.return_value.headers = (('content-type', 'application/json'),)
        safe_urlread.return_value = u'foo bar'

        result = fetch_url('http://example.com', project=self.project)

        safe_urlopen.assert_called_once_with(
            'http://example.com', allow_redirects=True, timeout=5,
            headers=[('X-Sentry-Token', 'foobar')], verify_ssl=False)
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        assert result.url == 'http://example.com'
        assert result.body == u'foo bar'
        assert result.headers == {'content-type': 'application/json'}

        # ensure we use the cached result
        result2 = fetch_url('http://example.com')

        safe_urlopen.assert_called_once()

        assert result == result2

    @patch('sentry.lang.javascript.processor.safe_urlopen')
    @patch('sentry.lang.javascript.processor.safe_urlread')
    def test_connection_failure(self, safe_urlread, safe_urlopen):
        safe_urlopen.side_effect = Exception()

        result = fetch_url('http://example.com')

        safe_urlopen.assert_called_once_with(
            'http://example.com', allow_redirects=True, timeout=5,
            headers=[], verify_ssl=False)
        assert not safe_urlread.mock_calls

        assert result == BAD_SOURCE

        # ensure we use the cached domain-wide failure for the second call
        result = fetch_url('http://example.com/foo/bar')

        safe_urlopen.assert_called_once()

        assert result == BAD_SOURCE

    @patch('sentry.lang.javascript.processor.safe_urlopen')
    @patch('sentry.lang.javascript.processor.safe_urlread')
    def test_read_failure(self, safe_urlread, safe_urlopen):
        safe_urlopen.return_value.headers = (('content-type', 'application/json'),)
        safe_urlread.side_effect = Exception()

        result = fetch_url('http://example.com')

        safe_urlopen.assert_called_once_with(
            'http://example.com', allow_redirects=True, timeout=5,
            headers=[], verify_ssl=False)
        safe_urlread.assert_called_once_with(safe_urlopen.return_value)

        assert result == BAD_SOURCE

        # ensure we use the cached failure for the second call
        result = fetch_url('http://example.com')

        safe_urlopen.assert_called_once()

        assert result == BAD_SOURCE


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


class GenerateModuleTest(TestCase):
    def test_simple(self):
        assert generate_module(None) == '<unknown module>'
        assert generate_module('http://example.com/foo.js') == 'foo'
        assert generate_module('http://example.com/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/js/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/javascript/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/1.0/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/v1/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/v1.0.0/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/_baz/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/1/2/3/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/abcdef0/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/92cd589eca8235e7b373bf5ae94ebf898e3b949c/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/7d6d00eae0ceccdc7ee689659585d95f/foo/bar.js') == 'foo/bar'
        assert generate_module('/foo/bar.js') == 'foo/bar'
        assert generate_module('../../foo/bar.js') == 'foo/bar'
        assert generate_module('/foo/bar-7d6d00eae0ceccdc7ee689659585d95f.js') == 'foo/bar'
        assert generate_module('/bower_components/foo/bar.js') == 'foo/bar'
        assert generate_module('/node_modules/foo/bar.js') == 'foo/bar'


class FetchBase64SourcemapTest(TestCase):
    def test_simple(self):
        index = fetch_sourcemap(base64_sourcemap)
        states = [SourceMap(1, 0, '/test.js', 0, 0, None)]
        sources = set(['/test.js'])
        keys = [(1, 0)]
        content = {'/test.js': ['console.log("hello, World!")']}

        assert index == SourceMapIndex(states, keys, sources, content)


class TrimLineTest(TestCase):
    long_line = 'The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring.'

    def test_simple(self):
        assert trim_line('foo') == 'foo'
        assert trim_line(self.long_line) == 'The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it li {snip}'
        assert trim_line(self.long_line, column=10) == 'The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it li {snip}'
        assert trim_line(self.long_line, column=66) == '{snip} blic is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it lives wi {snip}'
        assert trim_line(self.long_line, column=190) == '{snip} gn. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring.'
        assert trim_line(self.long_line, column=9999) == '{snip} gn. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring.'
