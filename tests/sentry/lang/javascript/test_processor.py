# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest
import responses
import six
from libsourcemap import Token

from mock import patch
from requests.exceptions import RequestException

from sentry.interfaces.stacktrace import Stacktrace
from sentry.lang.javascript.processor import (
    BadSource, discover_sourcemap, fetch_sourcemap, fetch_file, generate_module,
    SourceProcessor, trim_line, UrlResult, fetch_release_file, CannotFetchSource,
    UnparseableSourcemap,
)
from sentry.lang.javascript.errormapping import (
    rewrite_exception, REACT_MAPPING_URL
)
from sentry.models import File, Release, ReleaseFile, EventError
from sentry.testutils import TestCase
from sentry.utils.strings import truncatechars

base64_sourcemap = 'data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdGVzdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zb2xlLmxvZyhcImhlbGxvLCBXb3JsZCFcIikiXX0='

unicode_body = u"""function add(a, b) {
    "use strict";
    return a + b; // fôo
}"""


class FetchReleaseFileTest(TestCase):
    def test_unicode(self):
        project = self.project
        release = Release.objects.create(
            project=project,
            version='abc',
        )

        file = File.objects.create(
            name='file.min.js',
            type='release.file',
            headers={'Content-Type': 'application/json; charset=utf-8'},
        )

        binary_body = unicode_body.encode('utf-8')
        file.putfile(six.BytesIO(binary_body))

        ReleaseFile.objects.create(
            name='file.min.js',
            release=release,
            project=project,
            file=file,
        )

        result = fetch_release_file('file.min.js', release)

        assert type(result[1]) is six.binary_type
        assert result == (
            {'content-type': 'application/json; charset=utf-8'},
            binary_body,
            200,
            'utf-8',
        )

        # test with cache hit, which should be compressed
        new_result = fetch_release_file('file.min.js', release)

        assert result == new_result


class FetchFileTest(TestCase):
    @responses.activate
    def test_simple(self):
        responses.add(responses.GET, 'http://example.com', body='foo bar',
                      content_type='application/json')

        result = fetch_file('http://example.com')

        assert len(responses.calls) == 1

        assert result.url == 'http://example.com'
        assert result.body == 'foo bar'
        assert result.headers == {'content-type': 'application/json'}

        # ensure we use the cached result
        result2 = fetch_file('http://example.com')

        assert len(responses.calls) == 1

        assert result == result2

    @responses.activate
    def test_with_token(self):
        responses.add(responses.GET, 'http://example.com', body='foo bar',
                      content_type='application/json')

        self.project.update_option('sentry:token', 'foobar')
        self.project.update_option('sentry:origins', ['*'])

        result = fetch_file('http://example.com', project=self.project)

        assert len(responses.calls) == 1
        assert responses.calls[0].request.headers['X-Sentry-Token'] == 'foobar'

        assert result.url == 'http://example.com'
        assert result.body == 'foo bar'
        assert result.headers == {'content-type': 'application/json'}

    @responses.activate
    def test_connection_failure(self):
        responses.add(responses.GET, 'http://example.com', body=RequestException())

        with pytest.raises(BadSource):
            fetch_file('http://example.com')

        assert len(responses.calls) == 1

        # ensure we use the cached domain-wide failure for the second call
        with pytest.raises(BadSource):
            fetch_file('http://example.com/foo/bar')

        assert len(responses.calls) == 1

    @responses.activate
    def test_non_url_without_release(self):
        with pytest.raises(BadSource):
            fetch_file('/example.js')

    @responses.activate
    @patch('sentry.lang.javascript.processor.fetch_release_file')
    def test_non_url_with_release(self, mock_fetch_release_file):
        mock_fetch_release_file.return_value = (
            {'content-type': 'application/json'},
            'foo',
            200,
            None,
        )

        release = Release.objects.create(project=self.project, version='1')

        result = fetch_file('/example.js', release=release)
        assert result.url == '/example.js'
        assert result.body == 'foo'
        assert isinstance(result.body, six.binary_type)
        assert result.headers == {'content-type': 'application/json'}
        assert result.encoding is None

    @responses.activate
    def test_unicode_body(self):
        responses.add(responses.GET, 'http://example.com',
                      body=u'"fôo bar"'.encode('utf-8'),
                      content_type='application/json; charset=utf-8')

        result = fetch_file('http://example.com')

        assert len(responses.calls) == 1

        assert result.url == 'http://example.com'
        assert result.body == '"f\xc3\xb4o bar"'
        assert result.headers == {'content-type': 'application/json; charset=utf-8'}
        assert result.encoding == 'utf-8'

        # ensure we use the cached result
        result2 = fetch_file('http://example.com')

        assert len(responses.calls) == 1

        assert result == result2

    @responses.activate
    def test_truncated(self):
        url = truncatechars('http://example.com', 3)
        with pytest.raises(CannotFetchSource) as exc:
            fetch_file(url)

        assert exc.value.data['type'] == EventError.JS_MISSING_SOURCE
        assert exc.value.data['url'] == url


class DiscoverSourcemapTest(TestCase):
    # discover_sourcemap(result)
    def test_simple(self):
        result = UrlResult('http://example.com', {}, '', None)
        assert discover_sourcemap(result) is None

        result = UrlResult('http://example.com', {
            'x-sourcemap': 'http://example.com/source.map.js'
        }, '', None)
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {
            'sourcemap': 'http://example.com/source.map.js'
        }, '', None)
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {}, '//@ sourceMappingURL=http://example.com/source.map.js\nconsole.log(true)', None)
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {}, '//# sourceMappingURL=http://example.com/source.map.js\nconsole.log(true)', None)
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {}, 'console.log(true)\n//@ sourceMappingURL=http://example.com/source.map.js', None)
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {}, 'console.log(true)\n//# sourceMappingURL=http://example.com/source.map.js', None)
        assert discover_sourcemap(result) == 'http://example.com/source.map.js'

        result = UrlResult('http://example.com', {}, 'console.log(true)\n//# sourceMappingURL=http://example.com/source.map.js\n//# sourceMappingURL=http://example.com/source2.map.js', None)
        assert discover_sourcemap(result) == 'http://example.com/source2.map.js'

        result = UrlResult('http://example.com', {}, '//# sourceMappingURL=app.map.js/*ascii:lol*/', None)
        assert discover_sourcemap(result) == 'http://example.com/app.map.js'

        result = UrlResult('http://example.com', {}, '//# sourceMappingURL=/*lol*/', None)
        with self.assertRaises(AssertionError):
            discover_sourcemap(result)


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
        assert generate_module('http://example.com/foo/bar.coffee') == 'foo/bar'
        assert generate_module('http://example.com/foo/bar.js?v=1234') == 'foo/bar'
        assert generate_module('/foo/bar.js') == 'foo/bar'
        assert generate_module('../../foo/bar.js') == 'foo/bar'
        assert generate_module('/foo/bar-7d6d00eae0ceccdc7ee689659585d95f.js') == 'foo/bar'
        assert generate_module('/bower_components/foo/bar.js') == 'foo/bar'
        assert generate_module('/node_modules/foo/bar.js') == 'foo/bar'
        assert generate_module('http://example.com/vendor.92cd589eca8235e7b373bf5ae94ebf898e3b949c.js') == 'vendor'
        assert generate_module('/a/javascripts/application-bundle-149360d3414c26adac3febdf6832e25c.min.js') == 'a/javascripts/application-bundle'
        assert generate_module('https://example.com/libs/libs-20150417171659.min.js') == 'libs/libs'
        assert generate_module('webpack:///92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js') == 'vendor'
        assert generate_module('webpack:///example/92cd589eca8235e7b373bf5ae94ebf898e3b949c/vendor.js') == 'vendor'
        assert generate_module('~/app/components/projectHeader/projectSelector.jsx') == 'app/components/projectHeader/projectSelector'


class FetchSourcemapTest(TestCase):
    def test_simple_base64(self):
        smap_view = fetch_sourcemap(base64_sourcemap)
        tokens = [Token(1, 0, '/test.js', 0, 0, 0, None)]

        assert list(smap_view) == tokens
        assert smap_view.get_source_contents(0) == 'console.log("hello, World!")'
        assert smap_view.get_source_name(0) == u'/test.js'

    def test_base64_without_padding(self):
        smap_view = fetch_sourcemap(base64_sourcemap.rstrip('='))
        tokens = [Token(1, 0, '/test.js', 0, 0, 0, None)]

        assert list(smap_view) == tokens
        assert smap_view.get_source_contents(0) == 'console.log("hello, World!")'
        assert smap_view.get_source_name(0) == u'/test.js'

    def test_broken_base64(self):
        with pytest.raises(UnparseableSourcemap):
            fetch_sourcemap('data:application/json;base64,xxx')

    @responses.activate
    def test_simple_non_utf8(self):
        responses.add(responses.GET, 'http://example.com', body='{}',
                      content_type='application/json; charset=NOPE')

        with pytest.raises(CannotFetchSource) as exc:
            fetch_sourcemap('http://example.com')

        assert exc.value.data['type'] == EventError.JS_INVALID_SOURCE_ENCODING

    @responses.activate
    def test_garbage_json(self):
        responses.add(responses.GET, 'http://example.com', body='xxxx',
                      content_type='application/json')

        with pytest.raises(UnparseableSourcemap):
            fetch_sourcemap('http://example.com')


class TrimLineTest(TestCase):
    long_line = 'The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring.'

    def test_simple(self):
        assert trim_line('foo') == 'foo'
        assert trim_line(self.long_line) == 'The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it li {snip}'
        assert trim_line(self.long_line, column=10) == 'The public is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it li {snip}'
        assert trim_line(self.long_line, column=66) == '{snip} blic is more familiar with bad design than good design. It is, in effect, conditioned to prefer bad design, because that is what it lives wi {snip}'
        assert trim_line(self.long_line, column=190) == '{snip} gn. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring.'
        assert trim_line(self.long_line, column=9999) == '{snip} gn. It is, in effect, conditioned to prefer bad design, because that is what it lives with. The new becomes threatening, the old reassuring.'


class SourceProcessorTest(TestCase):
    def test_get_stacktraces_returns_stacktrace_interface(self):
        data = {
            'message': 'hello',
            'platform': 'javascript',
            'sentry.interfaces.Stacktrace': {
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
        }

        processor = SourceProcessor(project=self.project)
        result = processor.get_stacktraces(data)
        assert len(result) == 1
        assert type(result[0][1]) is Stacktrace

    def test_get_stacktraces_returns_exception_interface(self):
        data = {
            'message': 'hello',
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'Error',
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

        processor = SourceProcessor(project=self.project)
        result = processor.get_stacktraces(data)
        assert len(result) == 1
        assert type(result[0][1]) is Stacktrace

    def test_get_culprit_is_patched(self):
        data = {
            'message': 'hello',
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'Error',
                    'stacktrace': {
                        'frames': [
                            {
                                'abs_path': 'http://example.com/foo.js',
                                'filename': 'foo.js',
                                'lineno': 4,
                                'colno': 0,
                                'function': 'thing',
                            },
                            {
                                'abs_path': 'http://example.com/bar.js',
                                'filename': 'bar.js',
                                'lineno': 1,
                                'colno': 0,
                                'function': 'oops',
                            },
                        ],
                    },
                }],
            }
        }

        processor = SourceProcessor(project=self.project)
        result = processor.process(data)
        assert result['culprit'] == 'bar in oops'

    def test_ensure_module_names(self):
        data = {
            'message': 'hello',
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'Error',
                    'stacktrace': {
                        'frames': [
                            {
                                'filename': 'foo.js',
                                'lineno': 4,
                                'colno': 0,
                                'function': 'thing',
                            },
                            {
                                'abs_path': 'http://example.com/foo/bar.js',
                                'filename': 'bar.js',
                                'lineno': 1,
                                'colno': 0,
                                'function': 'oops',
                            },
                        ],
                    },
                }],
            }
        }
        processor = SourceProcessor(project=self.project)
        result = processor.process(data)
        exc = result['sentry.interfaces.Exception']['values'][0]
        assert exc['stacktrace']['frames'][1]['module'] == 'foo/bar'


class ErrorMappingTest(TestCase):

    @responses.activate
    def test_react_error_mapping_resolving(self):
        responses.add(responses.GET, REACT_MAPPING_URL, body=r'''
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes.",
          "109": "%s.render(): A valid React element (or null) must be returned. You may have returned undefined, an array or some other invalid object.",
          "110": "Stateless function components cannot have refs."
        }
        ''', content_type='application/json')

        for x in range(3):
            data = {
                'platform': 'javascript',
                'sentry.interfaces.Exception': {
                    'values': [{
                        'type': 'InvariantViolation',
                        'value': (
                            'Minified React error #109; visit http://facebook'
                            '.github.io/react/docs/error-decoder.html?invariant='
                            '109&args[]=Component for the full message or use '
                            'the non-minified dev environment for full errors '
                            'and additional helpful warnings.'
                        ),
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

            assert rewrite_exception(data)

            assert data['sentry.interfaces.Exception']['values'][0]['value'] == (
                'Component.render(): A valid React element (or null) must be '
                'returned. You may have returned undefined, an array or '
                'some other invalid object.'
            )

    @responses.activate
    def test_react_error_mapping_empty_args(self):
        responses.add(responses.GET, REACT_MAPPING_URL, body=r'''
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes."
        }
        ''', content_type='application/json')

        data = {
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'InvariantViolation',
                    'value': (
                        'Minified React error #108; visit http://facebook'
                        '.github.io/react/docs/error-decoder.html?invariant='
                        '108&args[]=Component&args[]= for the full message '
                        'or use the non-minified dev environment for full '
                        'errors and additional helpful warnings.'
                    ),
                    'stacktrace': {
                        'frames': [
                            {
                                'abs_path': 'http://example.com/foo.js',
                                'filename': 'foo.js',
                                'lineno': 4,
                                'colno': 0,
                            },
                        ],
                    },
                }],
            }
        }

        assert rewrite_exception(data)

        assert data['sentry.interfaces.Exception']['values'][0]['value'] == (
            'Component.getChildContext(): key "" is not defined in '
            'childContextTypes.'
        )

    @responses.activate
    def test_react_error_mapping_truncated(self):
        responses.add(responses.GET, REACT_MAPPING_URL, body=r'''
        {
          "108": "%s.getChildContext(): key \"%s\" is not defined in childContextTypes."
        }
        ''', content_type='application/json')

        data = {
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'InvariantViolation',
                    'value': (
                        u'Minified React error #108; visit http://facebook'
                        u'.github.io/react/docs/error-decoder.html?…'
                    ),
                    'stacktrace': {
                        'frames': [
                            {
                                'abs_path': 'http://example.com/foo.js',
                                'filename': 'foo.js',
                                'lineno': 4,
                                'colno': 0,
                            },
                        ],
                    },
                }],
            }
        }

        assert rewrite_exception(data)

        assert data['sentry.interfaces.Exception']['values'][0]['value'] == (
            '<redacted>.getChildContext(): key "<redacted>" is not defined in '
            'childContextTypes.'
        )
