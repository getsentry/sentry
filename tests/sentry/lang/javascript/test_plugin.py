from __future__ import absolute_import

import responses
import os.path

from mock import patch

from sentry.models import Event, File, FileBlob, Release, ReleaseFile
from sentry.testutils import TestCase

BASE64_SOURCEMAP = 'data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvdGVzdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zb2xlLmxvZyhcImhlbGxvLCBXb3JsZCFcIikiXX0='


def get_fixture_path(name):
    return os.path.join(os.path.dirname(__file__), 'fixtures', name)


def load_fixture(name):
    with open(get_fixture_path(name)) as fp:
        return fp.read()


class JavascriptIntegrationTest(TestCase):
    @patch('sentry.lang.javascript.processor.fetch_file')
    def test_source_expansion(self, mock_fetch_file):
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

        mock_fetch_file.return_value.body = '\n'.join('hello world')

        resp = self._postWithHeader(data)
        assert resp.status_code, 200

        mock_fetch_file.assert_called_once_with(
            'http://example.com/foo.js',
            project=self.project,
            release=None,
            allow_scraping=True,
        )

        event = Event.objects.get()
        exception = event.interfaces['sentry.interfaces.Exception']
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == ['h', 'e', 'l']
        assert frame.context_line == 'l'
        assert frame.post_context == ['o', ' ', 'w', 'o', 'r']

        frame = frame_list[1]
        assert frame.pre_context is None
        assert frame.context_line == 'h'
        assert frame.post_context == ['e', 'l', 'l', 'o', ' ']

    @patch('sentry.lang.javascript.processor.fetch_file')
    @patch('sentry.lang.javascript.processor.discover_sourcemap')
    def test_inlined_sources(self, mock_discover_sourcemap, mock_fetch_file):
        data = {
            'message': 'hello',
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'Error',
                    'stacktrace': {
                        'frames': [
                            {
                                'abs_path': 'http://example.com/test.min.js',
                                'filename': 'test.js',
                                'lineno': 1,
                                'colno': 0,
                            },
                        ],
                    },
                }],
            }
        }

        mock_discover_sourcemap.return_value = BASE64_SOURCEMAP

        mock_fetch_file.return_value.url = 'http://example.com/test.min.js'
        mock_fetch_file.return_value.body = '\n'.join('<generated source>')

        resp = self._postWithHeader(data)
        assert resp.status_code, 200

        mock_fetch_file.assert_called_once_with(
            'http://example.com/test.min.js',
            project=self.project,
            release=None,
            allow_scraping=True,
        )

        event = Event.objects.get()
        exception = event.interfaces['sentry.interfaces.Exception']
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert not frame.pre_context
        assert frame.context_line == 'console.log("hello, World!")'
        assert not frame.post_context
        assert frame.data['sourcemap'] == 'http://example.com/test.min.js'

    @responses.activate
    def test_sourcemap_source_expansion(self):
        responses.add(responses.GET, 'http://example.com/file.min.js',
                      body=load_fixture('file.min.js'))
        responses.add(responses.GET, 'http://example.com/file1.js',
                      body=load_fixture('file1.js'))
        responses.add(responses.GET, 'http://example.com/file2.js',
                      body=load_fixture('file2.js'))
        responses.add(responses.GET, 'http://example.com/file.sourcemap.js',
                      body=load_fixture('file.sourcemap.js'))

        data = {
            'message': 'hello',
            'platform': 'javascript',
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'Error',
                    'stacktrace': {
                        'frames': [
                            {
                                'abs_path': 'http://example.com/file.min.js',
                                'filename': 'file.min.js',
                                'lineno': 1,
                                'colno': 39,
                            },
                        ],
                    },
                }],
            }
        }

        resp = self._postWithHeader(data)
        assert resp.status_code, 200

        event = Event.objects.get()
        assert not event.data['errors']

        exception = event.interfaces['sentry.interfaces.Exception']
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == [
            'function add(a, b) {',
            '\t"use strict";',
        ]
        assert frame.context_line == '\treturn a + b;'
        assert frame.post_context == ['}']

    @responses.activate
    def test_expansion_via_release_artifacts(self):
        project = self.project
        release = Release.objects.create(
            project=project,
            version='abc',
        )

        f1 = File.objects.create(
            name='file.min.js',
            type='release.file',
            headers={'Content-Type': 'application/json'},
            blob=FileBlob.from_file(open(get_fixture_path('file.min.js'), 'rb'))
        )

        ReleaseFile.objects.create(
            name='http://example.com/{}'.format(f1.name),
            release=release,
            project=project,
            file=f1,
        )

        f2 = File.objects.create(
            name='file1.js',
            type='release.file',
            headers={'Content-Type': 'application/json'},
            blob=FileBlob.from_file(open(get_fixture_path('file1.js'), 'rb'))
        )
        ReleaseFile.objects.create(
            name='http://example.com/{}'.format(f2.name),
            release=release,
            project=project,
            file=f2,
        )

        f3 = File.objects.create(
            name='file2.js',
            type='release.file',
            headers={'Content-Type': 'application/json'},
            blob=FileBlob.from_file(open(get_fixture_path('file2.js'), 'rb'))
        )
        ReleaseFile.objects.create(
            name='http://example.com/{}'.format(f3.name),
            release=release,
            project=project,
            file=f3,
        )

        f4 = File.objects.create(
            name='file.sourcemap.js',
            type='release.file',
            headers={'Content-Type': 'application/json'},
            blob=FileBlob.from_file(open(get_fixture_path('file.sourcemap.js'), 'rb'))
        )
        ReleaseFile.objects.create(
            name='http://example.com/{}'.format(f4.name),
            release=release,
            project=project,
            file=f4,
        )

        data = {
            'message': 'hello',
            'platform': 'javascript',
            'release': 'abc',
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'Error',
                    'stacktrace': {
                        'frames': [
                            {
                                'abs_path': 'http://example.com/file.min.js',
                                'filename': 'file.min.js',
                                'lineno': 1,
                                'colno': 39,
                            },
                        ],
                    },
                }],
            }
        }

        resp = self._postWithHeader(data)
        assert resp.status_code, 200

        event = Event.objects.get()
        assert not event.data['errors']

        exception = event.interfaces['sentry.interfaces.Exception']
        frame_list = exception.values[0].stacktrace.frames

        frame = frame_list[0]
        assert frame.pre_context == [
            'function add(a, b) {',
            '\t"use strict";',
        ]
        assert frame.context_line == '\treturn a + b;'
        assert frame.post_context == ['}']
