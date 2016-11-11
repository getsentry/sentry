# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.threads import Threads
from sentry.testutils import TestCase


class ThreadsTest(TestCase):
    @fixture
    def interface(self):
        return Threads.to_python(dict(values=[{
            'id': 42,
            'crashed': False,
            'current': True,
            'name': 'Main Thread',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.c',
                'function': 'main',
                'lineno': 1,
                'in_app': True,
            }]},
            'raw_stacktrace': {'frames': [{
                'filename': None,
                'lineno': 1,
                'function': '<redacted>',
                'in_app': True,
            }]},
        }]))

    def test_basics(self):
        self.create_event(data={
            'sentry.interfaces.Exception': self.interface.to_json(),
        })
        context = self.interface.get_api_context()
        assert context['values'][0]['stacktrace']['frames'][0]['function'] == 'main'
        assert context['values'][0]['rawStacktrace']['frames'][0]['function'] == '<redacted>'
        assert context['values'][0]['id'] == 42
        assert context['values'][0]['name'] == 'Main Thread'
        assert context['values'][0]['crashed'] is False
        assert context['values'][0]['current'] is True
