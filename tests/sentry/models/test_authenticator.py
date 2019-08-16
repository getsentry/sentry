from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.models import Authenticator, TotpInterface, RecoveryCodeInterface


class AuthenticatorTest(TestCase):
    def test_user_has_2fa(self):
        user = self.create_user("foo@example.com")
        assert Authenticator.objects.user_has_2fa(user) is False
        assert Authenticator.objects.filter(user=user).count() == 0

        RecoveryCodeInterface().enroll(user)

        assert Authenticator.objects.user_has_2fa(user) is False
        assert Authenticator.objects.filter(user=user).count() == 1

        TotpInterface().enroll(user)

        assert Authenticator.objects.user_has_2fa(user) is True
        assert Authenticator.objects.filter(user=user).count() == 2

    def test_bulk_users_have_2fa(self):
        user1 = self.create_user("foo1@example.com")
        user2 = self.create_user("foo2@example.com")

        TotpInterface().enroll(user1)

        assert Authenticator.objects.bulk_users_have_2fa([user1.id, user2.id, 9999]) == {
            user1.id: True,
            user2.id: False,
            9999: False,
        }
