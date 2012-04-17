# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.interfaces import Template
from sentry.models import Event

from tests.base import TestCase


class TemplateTest(TestCase):
    def test_serialize(self):
        interface = Template(
            filename='foo.html',
            context_line='hello world',
            lineno=1,
        )
        result = interface.serialize()
        self.assertEquals(result['filename'], 'foo.html')
        self.assertEquals(result['context_line'], 'hello world')
        self.assertEquals(result['lineno'], 1)

    def test_get_hash(self):
        interface = Template(
            filename='foo.html',
            context_line='hello world',
            lineno=1,
        )
        result = interface.get_hash()
        self.assertEquals(result, ['foo.html', 'hello world'])

    @mock.patch('sentry.interfaces.get_context')
    @mock.patch('sentry.interfaces.Template.get_traceback')
    def test_to_string_returns_traceback(self, get_traceback, get_context):
        get_traceback.return_value = 'traceback'
        event = mock.Mock(spec=Event)
        interface = Template(
            filename='foo.html',
            context_line='hello world',
            lineno=1,
        )
        result = interface.to_string(event)
        get_traceback.assert_called_once_with(event, get_context.return_value)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\ntraceback')
