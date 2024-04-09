from fido2.ctap2 import AuthenticatorData
from fido2.utils import sha256

from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.authenticators.u2f import create_credential_object
from sentry.models.authenticator import Authenticator, AuthenticatorConfig
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class AuthenticatorTest(TestCase):
    def test_user_has_2fa(self):
        user = self.create_user("foo@example.com")
        assert user.has_2fa() is False
        assert Authenticator.objects.filter(user=user).count() == 0

        RecoveryCodeInterface().enroll(user)

        assert user.has_2fa() is False
        assert Authenticator.objects.filter(user=user).count() == 1

        TotpInterface().enroll(user)

        assert user.has_2fa() is True
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


def test_authenticator_config_compatibility():
    field_json = AuthenticatorConfig()

    value = {
        "devices": [
            {
                "binding": {
                    "publicKey": "publickey",
                    "keyHandle": "aowerkoweraowerkkro",
                    "appId": "https://dev.getsentry.net:8000/auth/2fa/u2fappid.json",
                },
                "name": "Sentry",
                "ts": 1512505334,
            },
            {
                "name": "Alert Escargot",
                "ts": 1512505334,
                "binding": AuthenticatorData.create(
                    sha256(b"test"),
                    0x41,
                    1,
                    create_credential_object(
                        {
                            "publicKey": "webauthn",
                            "keyHandle": "webauthn",
                        }
                    ),
                ),
            },
        ]
    }

    assert field_json.to_python(field_json.get_db_prep_value(value)) == value
