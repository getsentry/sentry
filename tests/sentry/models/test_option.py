# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import Option
from sentry.testutils import TestCase


class OptionManagerTest(TestCase):
    def test_set_value(self):
        Option.objects.set_value('foo', 'bar')
        assert Option.objects.filter(key='foo', value='bar').exists()

    def test_get_value(self):
        result = Option.objects.get_value('foo')
        assert result is None

        Option.objects.create(key='foo', value='bar')
        result = Option.objects.get_value('foo')
        assert result == 'bar'

    def test_unset_value(self):
        Option.objects.unset_value('foo')
        Option.objects.create(key='foo', value='bar')
        Option.objects.unset_value('foo')
        assert not Option.objects.filter(key='foo').exists()
