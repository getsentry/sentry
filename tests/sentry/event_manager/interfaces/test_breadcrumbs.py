# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.breadcrumbs import Breadcrumbs
from sentry.testutils import TestCase
from sentry.models import Event
from sentry.event_manager import EventManager


def to_python(data):
    mgr = EventManager(data={"breadcrumbs": data})
    mgr.normalize()
    evt = Event(data=mgr.get_data())
    if evt.data.get('errors'):
        raise InterfaceValidationError(evt.data.get('errors'))
    return evt.interfaces.get('breadcrumbs') or Breadcrumbs.to_python({})


class BreadcrumbsTest(TestCase):
    def test_path(self):
        assert Breadcrumbs().get_path() == 'breadcrumbs'

    def test_simple(self):
        result = to_python(
            dict(
                values=[
                    {
                        'type': 'message',
                        'timestamp': 1458857193.973275,
                        'data': {
                            'message': 'Whats up dawg?',
                        },
                    }
                ]
            )
        )
        assert len(result.values) == 1
        assert result.values[0]['type'] == 'message'
        ts = result.values[0]['timestamp']
        assert int(ts) == 1458857193
        assert abs(ts - 1458857193.973275) < 0.001
        assert result.values[0]['data'] == {'message': 'Whats up dawg?'}

    def test_null_values(self):
        sink = {}

        assert to_python({}).to_json() == sink
        assert to_python({'values': []}).to_json() == sink

        # TODO(markus): The following cases should eventually generate {"values": [None]}
        assert to_python({'values': [{}]}).to_json() == sink
        assert to_python({'values': [{"type": None}]}).to_json() == sink

        assert to_python({'values': [None]}).to_json() == sink

    def test_non_string_keys(self):
        result = to_python(
            dict(
                values=[
                    {
                        'type': 'message',
                        'timestamp': 1458857193.973275,
                        'data': {
                            'extra': {
                                'foo': 'bar'
                            },
                        },
                    }
                ]
            )
        )
        assert len(result.values) == 1
        assert result.values[0]['data'] == {'extra': {"foo": '"bar"'}}

    def test_string_data(self):
        with pytest.raises(InterfaceValidationError):
            to_python(
                dict(
                    values=[
                        {
                            'type': 'message',
                            'timestamp': 1458857193.973275,
                            'data': 'must be a mapping'
                        }
                    ]
                )
            )
