# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture
import mock
import pytest

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.template import Template
from sentry.event_manager import EventManager
from sentry.models import Event
from sentry.testutils import TestCase


def to_python(data):
    mgr = EventManager(data={"template": data})
    mgr.normalize()
    evt = Event(data=mgr.get_data())
    if evt.data.get('errors'):
        raise InterfaceValidationError(evt.data.get('errors'))

    return evt.interfaces.get('template') or Template.to_python({})


class TemplateTest(TestCase):
    @fixture
    def interface(self):
        return to_python(
            dict(
                filename='foo.html',
                context_line='hello world',
                lineno=1,
            )
        )

    def test_serialize(self):
        result = self.interface.to_json()
        self.assertEquals(result['filename'], 'foo.html')
        self.assertEquals(result['context_line'], 'hello world')
        self.assertEquals(result['lineno'], 1)

    def test_required_attributes(self):
        with pytest.raises(InterfaceValidationError):
            to_python({})
        with pytest.raises(InterfaceValidationError):
            to_python({"lineno": None, "context_line": ""})
        with pytest.raises(InterfaceValidationError):
            to_python({"lineno": 0, "context_line": ""})
        with pytest.raises(InterfaceValidationError):
            to_python({"lineno": 1})
        with pytest.raises(InterfaceValidationError):
            to_python({"lineno": 1, "context_line": 42})

    @mock.patch('sentry.interfaces.template.get_context')
    @mock.patch('sentry.interfaces.template.Template.get_traceback')
    def test_to_string_returns_traceback(self, get_traceback, get_context):
        get_traceback.return_value = 'traceback'
        event = mock.Mock(spec=Event)
        result = self.interface.to_string(event)
        get_traceback.assert_called_once_with(event, get_context.return_value)
        self.assertEquals(result, 'Stacktrace (most recent call last):\n\ntraceback')

    def test_get_api_context(self):
        result = self.interface.get_api_context()
        assert result == {
            'filename': 'foo.html',
            'context': [(1, 'hello world')],
            'lineNo': 1,
        }
