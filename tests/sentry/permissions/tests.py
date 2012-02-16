# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.contrib.auth.models import User, AnonymousUser
from sentry.permissions import can_create_projects
from tests.base import TestCase


class CanCreateProjectTest(TestCase):
    def test_superuser_is_true(self):
        user = User(id=100000, is_superuser=True)
        self.assertTrue(can_create_projects(user))

    def test_anonymous_is_false(self):
        user = AnonymousUser()
        self.assertFalse(can_create_projects(user))

    def test_allow_creation_is_true(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=True):
            user = User(id=100000)
            self.assertTrue(can_create_projects(user))

    def test_dont_allow_creation_is_false(self):
        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=False):
            user = User(id=100000)
            self.assertFalse(can_create_projects(user))
