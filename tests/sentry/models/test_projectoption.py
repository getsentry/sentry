# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import ProjectOption
from sentry.testutils import TestCase


class ProjectOptionManagerTest(TestCase):
    def test_set_value(self):
        ProjectOption.objects.set_value(self.project, 'foo', 'bar')
        assert ProjectOption.objects.filter(
            project=self.project, key='foo', value='bar').exists()

    def test_get_value(self):
        result = ProjectOption.objects.get_value(self.project, 'foo')
        assert result is None

        ProjectOption.objects.create(
            project=self.project, key='foo', value='bar')
        result = ProjectOption.objects.get_value(self.project, 'foo')
        assert result == 'bar'

    def test_unset_value(self):
        ProjectOption.objects.unset_value(self.project, 'foo')
        ProjectOption.objects.create(
            project=self.project, key='foo', value='bar')
        ProjectOption.objects.unset_value(self.project, 'foo')
        assert not ProjectOption.objects.filter(
            project=self.project, key='foo').exists()

    def test_get_value_bulk(self):
        result = ProjectOption.objects.get_value_bulk([self.project], 'foo')
        assert result == {self.project: None}

        ProjectOption.objects.create(
            project=self.project, key='foo', value='bar')
        result = ProjectOption.objects.get_value_bulk([self.project], 'foo')
        assert result == {self.project: 'bar'}
