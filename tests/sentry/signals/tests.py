# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.contrib.auth.models import User
from sentry.models import Project, MEMBER_OWNER

from tests.base import TestCase


class SentrySignalTest(TestCase):
    def test_create_project_member_for_owner(self):
        user = User.objects.create(username='foo')
        project = Project.objects.create(name='foo', owner=user)
        self.assertTrue(project.member_set.filter(user=user, type=MEMBER_OWNER).exists())
