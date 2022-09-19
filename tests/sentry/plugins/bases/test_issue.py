from unittest import mock

import pytest

from sentry.models import User
from sentry.plugins.bases.issue import IssueTrackingPlugin
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from social_auth.models import UserSocialAuth


@control_silo_test
class GetAuthForUserTest(TestCase):
    def _get_mock_user(self):
        user = mock.Mock(spec=User(id=1))
        user.is_authenticated = False
        return user

    def test_requires_auth_provider(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin()
        pytest.raises(AssertionError, p.get_auth_for_user, user)

    def test_returns_none_on_missing_identity(self):
        user = self._get_mock_user()
        p = IssueTrackingPlugin()
        p.auth_provider = "test"
        self.assertEqual(p.get_auth_for_user(user), None)

    def test_returns_identity(self):
        user = User.objects.create(username="test", email="test@example.com")
        auth = UserSocialAuth.objects.create(provider="test", user=user)
        p = IssueTrackingPlugin()
        p.auth_provider = "test"
        self.assertEqual(p.get_auth_for_user(user), auth)
