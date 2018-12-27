# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.interfaces.breadcrumbs import Breadcrumbs
from sentry.testutils import TestCase


class BreadcrumbsTest(TestCase):
    def test_path(self):
        assert Breadcrumbs().get_path() == 'breadcrumbs'

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

        # TODO(markus): The following cases should eventually generate {"values": [None]}
        assert Breadcrumbs.to_python({'values': [{}]}).to_json() == sink
        assert Breadcrumbs.to_python({'values': [{"type": None}]}).to_json() == sink

        assert Breadcrumbs.to_python({'values': [None]}).to_json() == sink

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

    def test_string_data(self):
        result = Breadcrumbs.to_python(
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
        assert len(result.values) == 1
        assert not result.values[0].get('data')
