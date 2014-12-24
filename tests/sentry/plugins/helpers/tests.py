# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
from sentry.plugins.helpers import set_option, unset_option, get_option
from sentry.testutils import TestCase


class SentryPluginTest(TestCase):
    def test_set_option_with_project(self):
        with mock.patch('sentry.models.ProjectOption.objects.set_value') as set_value:
            project = mock.Mock()
            set_option('key', 'value', project)

            set_value.assert_called_once_with(project, 'key', 'value')

    def test_get_option_with_project(self):
        with mock.patch('sentry.models.ProjectOption.objects.get_value') as get_value:
            project = mock.Mock()
            result = get_option('key', project)
            self.assertEquals(result, get_value.return_value)

            get_value.assert_called_once_with(project, 'key', None)

    def test_unset_option_with_project(self):
        with mock.patch('sentry.models.ProjectOption.objects.unset_value') as unset_value:
            project = mock.Mock()
            unset_option('key', project)

            unset_value.assert_called_once_with(project, 'key')
