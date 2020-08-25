# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.compat import mock

from social_auth.models import UserSocialAuth

from sentry.models import User
from sentry.plugins.bases import IssueTrackingPlugin
from sentry.testutils import TestCase


class GetAuthForUserTest(TestCase):
    def _get_mock_user(self):
        user = mock.Mock(spec=User(id=1))
        user.is_authenticated.return_value = False
        return user

    def test_requires_auth_provider(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin()
        self.assertRaises(AssertionError, p.get_auth_for_user, user)

    def test_returns_none_on_missing_identity(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin()
        p.auth_provider = "test"
        self.assertEquals(p.get_auth_for_user(user), None)

    def test_returns_identity(self):
        user = User.objects.create(username="test", email="test@example.com")
        auth = UserSocialAuth.objects.create(provider="test", user=user)
        p = IssueTrackingPlugin()
        p.auth_provider = "test"
        self.assertEquals(p.get_auth_for_user(user), auth)
