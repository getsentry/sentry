# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.interfaces.breadcrumbs import Breadcrumbs
from sentry.testutils import TestCase


class BreadcrumbsTest(TestCase):
    def test_path(self):
        assert Breadcrumbs().get_path() == 'sentry.interfaces.Breadcrumbs'

    def test_simple(self):
        result = Breadcrumbs.to_python(
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

        assert Breadcrumbs.to_python({}).to_json() == sink
        assert Breadcrumbs.to_python({'values': None}).to_json() == sink
        assert Breadcrumbs.to_python({'values': []}).to_json() == sink

    def test_null_values_in_crumb(self):
        sink = {"values": [{"type": "default"}]}

        assert Breadcrumbs.to_python({'values': [{}]}).to_json() == sink
        assert Breadcrumbs.to_python({'values': [{"type": None}]}).to_json() == sink

        assert Breadcrumbs.to_python({'values': [None]}).to_json() == {}

    def test_non_string_keys(self):
        result = Breadcrumbs.to_python(
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
        assert result.values[0]['data'] == {'extra': '{"foo":"bar"}'}
