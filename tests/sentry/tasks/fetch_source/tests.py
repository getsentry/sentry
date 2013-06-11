# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.tasks.fetch_source import expand_javascript_source
from sentry.testutils import TestCase


class ExpandJavascriptSourceTest(TestCase):
    @mock.patch('sentry.models.Event.update')
    @mock.patch('sentry.tasks.fetch_source.fetch_url')
    @mock.patch('sentry.tasks.fetch_source.fetch_sourcemap')
    def test_calls_from_kwargs(self, fetch_sourcemap, fetch_url, update):
        data = {
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
        fetch_sourcemap.return_value = None
        fetch_url.return_value.body = '\n'.join('hello world')

        expand_javascript_source(data)

        fetch_url.assert_called_once_with('http://example.com/foo.js')

        frame_list = data['sentry.interfaces.Stacktrace']['frames']
        frame = frame_list[0]
        assert frame['pre_context'] == ['h', 'e', 'l']
        assert frame['context_line'] == 'l'
        assert frame['post_context'] == ['o', ' ', 'w', 'o', 'r']

        frame = frame_list[1]
        assert frame['pre_context'] == []
        assert frame['context_line'] == 'h'
        assert frame['post_context'] == ['e', 'l', 'l', 'o', ' ']
