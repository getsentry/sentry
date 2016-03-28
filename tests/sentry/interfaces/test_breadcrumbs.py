# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import datetime
from django.utils import timezone

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
        assert result.values[0]['timestamp'] == datetime(2016, 3, 24, 22, 6, 33, 973275, tzinfo=timezone.utc)
        assert result.values[0]['data'] == {'message': 'Whats up dawg?'}
