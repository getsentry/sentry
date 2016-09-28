# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.interfaces.breadcrumbs import Breadcrumbs
from sentry.testutils import TestCase


class BreadcrumbsTest(TestCase):
    def test_path(self):
        assert Breadcrumbs().get_path() == 'sentry.interfaces.Breadcrumbs'

    def test_simple(self):
        result = Breadcrumbs.to_python(dict(values=[{
            'type': 'message',
            'timestamp': 1458857193.973275,
            'data': {
                'message': 'Whats up dawg?',
            },
        }]))
        assert len(result.values) == 1
        assert result.values[0]['type'] == 'message'
        ts = result.values[0]['timestamp']
        assert int(ts) == 1458857193
        assert abs(ts - 1458857193.973275) < 0.001
        assert result.values[0]['data'] == {'message': 'Whats up dawg?'}

    def test_non_string_keys(self):
        result = Breadcrumbs.to_python(dict(values=[{
            'type': 'message',
            'timestamp': 1458857193.973275,
            'data': {
                'extra': {'foo': 'bar'},
            },
        }]))
        assert len(result.values) == 1
        assert result.values[0]['data'] == {'extra': '{"foo":"bar"}'}
