import datetime
from unittest import mock

from django.conf import settings
from django.core import mail
from django.utils import timezone
from fido2.ctap2 import AuthenticatorData
from fido2.utils import sha256
from rest_framework import status

from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.sms import SmsInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.authenticators.u2f import create_credential_object
from sentry.models.authenticator import Authenticator
from sentry.models.organization import Organization
from sentry.models.user import User
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


def get_auth(user: User) -> Authenticator:
    return Authenticator.objects.create(
        type=3,  # u2f
        user=user,
        config={
            "devices": [
                {
                    "binding": {
                        "publicKey": "aowekroawker",
                        "keyHandle": "devicekeyhandle",
                        "appId": "https://dev.getsentry.net:8000/auth/2fa/u2fappid.json",
                    },
                    "name": "Amused Beetle",
                    "ts": 1512505334,
                },
                {
                    "binding": {
                        "publicKey": "publickey",
                        "keyHandle": "aowerkoweraowerkkro",
                        "appId": "https://dev.getsentry.net:8000/auth/2fa/u2fappid.json",
                    },
                    "name": "Sentry",
                    "ts": 1512505334,
                },
            ]
        },
    )


def get_auth_webauthn(user: User) -> Authenticator:
    return Authenticator.objects.create(
        type=3,  # u2f
        user=user,
        config={
            "devices": [
                {
                    "binding": {
                        "publicKey": "aowekroawker",
                        "keyHandle": "devicekeyhandle",
                        "appId": "https://dev.getsentry.net:8000/auth/2fa/u2fappid.json",
                    },
                    "name": "Amused Beetle",
                    "ts": 1512505334,
                },
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
        },
    )


def assert_security_email_sent(email_type: str) -> None:
    """TODO(mgaeta): Move this function to a test helper directory."""
    body_fragment = {
        "mfa-added": "An authenticator has been added to your Sentry account",
        "mfa-removed": "An authenticator has been removed from your Sentry account",
        "recovery-codes-regenerated": "Recovery codes have been regenerated for your Sentry account",
    }[email_type]
    assert len(mail.outbox) == 1
    assert body_fragment in mail.outbox[0].body


class UserAuthenticatorDetailsTestBase(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)

    def _require_2fa_for_organization(self) -> None:
        self.create_organization(
            name="test monkey", owner=self.user, flags=Organization.flags.require_2fa
        )


@control_silo_test
class UserAuthenticatorDeviceDetailsTest(UserAuthenticatorDetailsTestBase):
    endpoint = "sentry-api-0-user-authenticator-device-details"
    method = "delete"

    def test_u2f_remove_device(self):
        auth = get_auth(self.user)

        with self.tasks():
            self.get_success_response(
                self.user.id,
                auth.id,
                "devicekeyhandle",
                status_code=status.HTTP_204_NO_CONTENT,
            )

        authenticator = Authenticator.objects.get(id=auth.id)
        assert len(authenticator.interface.get_registered_devices()) == 1

        assert_security_email_sent("mfa-removed")

        # Can't remove last device.
        # TODO(mgaeta): We should not allow the API to return a 500.
        with self.tasks():
            self.get_error_response(
                self.user.id,
                auth.id,
                "aowerkoweraowerkkro",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Only one send.
        assert_security_email_sent("mfa-removed")

    def test_require_2fa__delete_device__ok(self):
        self._require_2fa_for_organization()
        self.test_u2f_remove_device()

    def test_rename_device(self):
        auth = get_auth(self.user)
        self.get_success_response(
            self.user.id,
            auth.id,
            "devicekeyhandle",
            name="for testing",
            method="put",
            status_code=status.HTTP_204_NO_CONTENT,
        )

        authenticator = Authenticator.objects.get(id=auth.id)
        assert authenticator.interface.get_device_name("devicekeyhandle") == "for testing"

    def test_rename_webauthn_device(self):
        auth = get_auth_webauthn(self.user)
        self.get_success_response(
            self.user.id,
            auth.id,
            "webauthn",
            name="for testing",
            method="put",
            status_code=status.HTTP_204_NO_CONTENT,
        )

        authenticator = Authenticator.objects.get(id=auth.id)
        assert authenticator.interface.get_device_name("webauthn") == "for testing"

    def test_rename_device_not_found(self):
        auth = get_auth(self.user)
        self.get_error_response(
            self.user.id,
            auth.id,
            "not_a_real_device",
            name="for testing",
            method="put",
        )


@control_silo_test
class UserAuthenticatorDetailsTest(UserAuthenticatorDetailsTestBase):
    endpoint = "sentry-api-0-user-authenticator-details"

    def test_wrong_auth_id(self):
        self.get_error_response(self.user.id, "totp", status_code=status.HTTP_404_NOT_FOUND)

    def test_get_authenticator_details(self):
        interface = TotpInterface()
        interface.enroll(self.user)
        assert interface.authenticator is not None
        auth = interface.authenticator

        response = self.get_success_response(self.user.id, auth.id)

        assert response.data["isEnrolled"]
        assert response.data["id"] == "totp"
        assert response.data["authId"] == str(auth.id)

        # should not have these because enrollment
        assert "totp_secret" not in response.data
        assert "form" not in response.data
        assert "qrcode" not in response.data

    def test_get_recovery_codes(self):
        interface = RecoveryCodeInterface()
        interface.enroll(self.user)
        assert interface.authenticator is not None

        with self.tasks():
            response = self.get_success_response(self.user.id, interface.authenticator.id)

        assert response.data["id"] == "recovery"
        assert response.data["authId"] == str(interface.authenticator.id)
        assert len(response.data["codes"])

        assert len(mail.outbox) == 0

    def test_u2f_get_devices(self):
        auth = get_auth(self.user)

        response = self.get_success_response(self.user.id, auth.id)
        assert response.data["id"] == "u2f"
        assert response.data["authId"] == str(auth.id)
        assert len(response.data["devices"])
        assert response.data["devices"][0]["name"] == "Amused Beetle"

        # should not have these because enrollment
        assert "challenge" not in response.data
        assert "response" not in response.data

    def test_get_device_name(self):
        auth = get_auth(self.user)

        assert auth.interface.get_device_name("devicekeyhandle") == "Amused Beetle"
        assert auth.interface.get_device_name("aowerkoweraowerkkro") == "Sentry"

    def test_sms_get_phone(self):
        interface = SmsInterface()
        interface.phone_number = "5551231234"
        interface.enroll(self.user)
        assert interface.authenticator is not None

        response = self.get_success_response(self.user.id, interface.authenticator.id)
        assert response.data["id"] == "sms"
        assert response.data["authId"] == str(interface.authenticator.id)
        assert response.data["phone"] == "5551231234"

        # should not have these because enrollment
        assert "totp_secret" not in response.data
        assert "form" not in response.data

    def test_recovery_codes_regenerate(self):
        interface = RecoveryCodeInterface()
        interface.enroll(self.user)

        response = self.get_success_response(self.user.id, interface.authenticator.id)
        old_codes = response.data["codes"]
        old_created_at = response.data["createdAt"]

        response = self.get_success_response(self.user.id, interface.authenticator.id)
        assert old_codes == response.data["codes"]
        assert old_created_at == response.data["createdAt"]

        # regenerate codes
        tomorrow = timezone.now() + datetime.timedelta(days=1)
        with mock.patch.object(timezone, "now", return_value=tomorrow):
            with self.tasks():
                self.get_success_response(self.user.id, interface.authenticator.id, method="put")
                response = self.get_success_response(self.user.id, interface.authenticator.id)
            assert old_codes != response.data["codes"]
            assert old_created_at != response.data["createdAt"]

        assert_security_email_sent("recovery-codes-regenerated")

    def test_delete(self):
        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["sms.twilio-account"] = "twilio-account"
        user = self.create_user(email="a@example.com", is_superuser=True)

        with self.settings(SENTRY_OPTIONS=new_options):
            auth = Authenticator.objects.create(type=2, user=user)  # sms
            available_auths = Authenticator.objects.all_interfaces_for_user(
                user, ignore_backup=True
            )

            self.assertEqual(len(available_auths), 1)
            self.login_as(user=user, superuser=True)

            with self.tasks():
                self.get_success_response(user.id, auth.id, method="delete")

            assert not Authenticator.objects.filter(id=auth.id).exists()

            assert_security_email_sent("mfa-removed")

    def test_cannot_delete_without_superuser(self):
        user = self.create_user(email="a@example.com", is_superuser=False)
        auth = Authenticator.objects.create(type=3, user=user)  # u2f

        actor = self.create_user(email="b@example.com", is_superuser=False)
        self.login_as(user=actor)

        with self.tasks():
            self.get_error_response(
                self.user.id,
                auth.id,
                method="delete",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        assert Authenticator.objects.filter(id=auth.id).exists()

        assert len(mail.outbox) == 0

    def test_require_2fa__cannot_delete_last_auth(self):
        self._require_2fa_for_organization()

        # enroll in one auth method
        interface = TotpInterface()
        interface.enroll(self.user)
        assert interface.authenticator is not None
        auth = interface.authenticator

        with self.tasks():
            response = self.get_error_response(
                self.user.id,
                auth.id,
                method="delete",
                status_code=status.HTTP_403_FORBIDDEN,
            )
            assert b"requires 2FA" in response.content

        assert Authenticator.objects.filter(id=auth.id).exists()

        assert len(mail.outbox) == 0

    def test_require_2fa__can_delete_last_auth_superuser(self):
        self._require_2fa_for_organization()

        superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["sms.twilio-account"] = "twilio-account"

        with self.settings(SENTRY_OPTIONS=new_options):
            # enroll in one auth method
            interface = TotpInterface()
            interface.enroll(self.user)
            assert interface.authenticator is not None
            auth = interface.authenticator

            with self.tasks():
                self.get_success_response(
                    self.user.id,
                    auth.id,
                    method="delete",
                    status_code=status.HTTP_204_NO_CONTENT,
                )
                assert_security_email_sent("mfa-removed")

            assert not Authenticator.objects.filter(id=auth.id).exists()

    def test_require_2fa__delete_with_multiple_auth__ok(self):
        self._require_2fa_for_organization()

        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["sms.twilio-account"] = "twilio-account"

        with self.settings(SENTRY_OPTIONS=new_options):
            # enroll in two auth methods
            interface_sms = SmsInterface()
            interface_sms.phone_number = "5551231234"
            interface_sms.enroll(self.user)

            interface = TotpInterface()
            interface.enroll(self.user)
            assert interface.authenticator is not None
            auth = interface.authenticator

            with self.tasks():
                self.get_success_response(self.user.id, auth.id, method="delete")

            assert not Authenticator.objects.filter(id=auth.id).exists()
            assert_security_email_sent("mfa-removed")
