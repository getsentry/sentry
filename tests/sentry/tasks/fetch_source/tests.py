# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from celery.task import Task
from sentry.models import Event
from sentry.tasks.fetch_source import fetch_javascript_source
from sentry.testutils import TestCase


class StoreEventTest(TestCase):
    def test_is_task(self):
        self.assertTrue(isinstance(fetch_javascript_source, Task))

    @mock.patch('sentry.models.Event.update')
    @mock.patch('urllib2.build_opener')
    def test_calls_from_kwargs(self, build_opener, update):
        event = Event(data={
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
        })
        build_opener.return_value.open.return_value.read.return_value = '\n'.join('hello world')

        fetch_javascript_source(event)

        build_opener.assert_called_once_with()
        build_opener.return_value.open.assert_called_once_with('http://example.com/foo.js')
        build_opener.return_value.open.return_value.read.assert_called_once_with()
        update.assert_called_once_with(data=event.data)

        frame_list = event.data['sentry.interfaces.Stacktrace']['frames']
        frame = frame_list[0]
        assert frame['pre_context'] == ['h', 'e', 'l']
        assert frame['context_line'] == 'l'
        assert frame['post_context'] == ['o', ' ', 'w', 'o', 'r']

        frame = frame_list[1]
        assert frame['pre_context'] == []
        assert frame['context_line'] == 'h'
        assert frame['post_context'] == ['e', 'l', 'l', 'o', ' ']
