# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import Group
from sentry.utils import MockDjangoRequest

from tests.base import TestCase


class SentryPluginTest(TestCase):
    def test_registration(self):
        from sentry.plugins import GroupActionProvider
        self.assertEquals(len(GroupActionProvider.plugins), 4)

    def test_get_actions(self):
        from sentry.templatetags.sentry_helpers import get_actions
        checksum = 'a' * 32
        group = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='a',
            checksum=checksum,
            message='hi',
        )

        widgets = list(get_actions(group, MockDjangoRequest()))
        self.assertEquals(len(widgets), 1)
