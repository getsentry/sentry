# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from exam import fixture

from sentry.interfaces.template import Template
from sentry.models import Event
from sentry.testutils import TestCase


class TemplateTest(TestCase):
    @fixture
    def interface(self):
        return Template.to_python(dict(
            filename='foo.html',
            context_line='hello world',
            lineno=1,
        ))

    def test_serialize(self):
        result = self.interface.to_json()
        self.assertEquals(result['filename'], 'foo.html')
        self.assertEquals(result['context_line'], 'hello world')
        self.assertEquals(result['lineno'], 1)

    def test_get_hash(self):
        result = self.interface.get_hash()
        self.assertEquals(result, ['foo.html', 'hello world'])

    @mock.patch('sentry.interfaces.template.get_context')
    @mock.patch('sentry.interfaces.template.Template.get_traceback')
    def test_to_string_returns_traceback(self, get_traceback, get_context):
        get_traceback.return_value = 'traceback'
        event = mock.Mock(spec=Event)
        result = self.interface.to_string(event)
        get_traceback.assert_called_once_with(event, get_context.return_value)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\ntraceback')

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    def test_get_api_context(self):
        result = self.interface.get_api_context()
        assert result == {
            'filename': 'foo.html',
            'context': [(1, 'hello world')],
            'lineNo': 1,
        }
