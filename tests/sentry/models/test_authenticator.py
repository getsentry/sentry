from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.models import Authenticator, TotpInterface, RecoveryCodeInterface


class AuthenticatorTest(TestCase):
    def test_user_has_2fa(self):
        user = self.create_user('foo@example.com')
        assert Authenticator.objects.user_has_2fa(user) is False
        assert Authenticator.objects.filter(user=user).count() == 0

        RecoveryCodeInterface().enroll(user)

        assert Authenticator.objects.user_has_2fa(user) is False
        assert Authenticator.objects.filter(user=user).count() == 1

        TotpInterface().enroll(user)

        assert Authenticator.objects.user_has_2fa(user) is True
        assert Authenticator.objects.filter(user=user).count() == 2
