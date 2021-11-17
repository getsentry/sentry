import datetime
from unittest import mock

from django.conf import settings
from django.core import mail
from django.db.models import F
from django.utils import timezone

from sentry.auth.authenticators import RecoveryCodeInterface, SmsInterface, TotpInterface
from sentry.models import Authenticator, Organization, User
from sentry.testutils import APITestCase


def get_auth(user: "User") -> Authenticator:
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


def assert_security_email_sent(email_type: str) -> None:
    """TODO(mgaeta): Move this function to a test helper directory."""
    body_fragment = {
        "mfa-added": "An authenticator has been added to your Sentry account",
        "mfa-removed": "An authenticator has been removed from your Sentry account",
        "recovery-codes-regenerated": "Recovery codes have been regenerated for your Sentry account",
    }.get(email_type)
    assert len(mail.outbox) == 1
    assert body_fragment in mail.outbox[0].body


class UserAuthenticatorDetailsTestBase(APITestCase):
    def setUp(self):
        self.login_as(user=self.user)

    def _require_2fa_for_organization(self) -> None:
        organization = self.create_organization(name="test monkey", owner=self.user)
        organization.update(flags=F("flags").bitor(Organization.flags.require_2fa))


class UserAuthenticatorDeviceDetailsTest(UserAuthenticatorDetailsTestBase):
    endpoint = "sentry-api-0-user-authenticator-device-details"
    method = "delete"

    def test_u2f_remove_device(self):
        auth = get_auth(self.user)

        with self.tasks():
            self.get_success_response(self.user.id, auth.id, "devicekeyhandle")

        authenticator = Authenticator.objects.get(id=auth.id)
        assert len(authenticator.interface.get_registered_devices()) == 1

        assert_security_email_sent("mfa-removed")

        # Can't remove last device.
        # TODO(mgaeta): We should not allow the API to return a 500.
        with self.tasks():
            self.get_error_response(self.user.id, auth.id, "aowerkoweraowerkkro", status_code=500)

        # Only one send.
        assert_security_email_sent("mfa-removed")

    def test_require_2fa__delete_device__ok(self):
        self._require_2fa_for_organization()
        self.test_u2f_remove_device()

    def test_rename_device(self):
        data = {"name": "for testing"}
        auth = get_auth(self.user)
        self.get_success_response(self.user.id, auth.id, "devicekeyhandle", **data, method="put")

        authenticator = Authenticator.objects.get(id=auth.id)
        assert authenticator.interface.get_device_name("devicekeyhandle") == "for testing"

    def test_rename_device_not_found(self):
        data = {"name": "for testing"}
        auth = get_auth(self.user)
        self.get_error_response(self.user.id, auth.id, "not_a_real_device", **data, method="put")


class UserAuthenticatorDetailsTest(UserAuthenticatorDetailsTestBase):
    endpoint = "sentry-api-0-user-authenticator-details"

    def test_wrong_auth_id(self):
        self.get_error_response(self.user.id, "totp", status_code=404)

    def test_get_authenticator_details(self):
        interface = TotpInterface()
        interface.enroll(self.user)
        auth = interface.authenticator

        resp = self.get_success_response(self.user.id, auth.id)

        assert resp.data["isEnrolled"]
        assert resp.data["id"] == "totp"
        assert resp.data["authId"] == str(auth.id)

        # should not have these because enrollment
        assert "totp_secret" not in resp.data
        assert "form" not in resp.data
        assert "qrcode" not in resp.data

    def test_get_recovery_codes(self):
        interface = RecoveryCodeInterface()
        interface.enroll(self.user)

        with self.tasks():
            resp = self.get_success_response(self.user.id, interface.authenticator.id)

        assert resp.data["id"] == "recovery"
        assert resp.data["authId"] == str(interface.authenticator.id)
        assert len(resp.data["codes"])

        assert len(mail.outbox) == 0

    def test_u2f_get_devices(self):
        auth = get_auth(self.user)

        resp = self.get_success_response(self.user.id, auth.id)
        assert resp.data["id"] == "u2f"
        assert resp.data["authId"] == str(auth.id)
        assert len(resp.data["devices"])
        assert resp.data["devices"][0]["name"] == "Amused Beetle"

        # should not have these because enrollment
        assert "challenge" not in resp.data
        assert "response" not in resp.data

    def test_get_device_name(self):
        auth = get_auth(self.user)

        assert auth.interface.get_device_name("devicekeyhandle") == "Amused Beetle"
        assert auth.interface.get_device_name("aowerkoweraowerkkro") == "Sentry"

    def test_sms_get_phone(self):
        interface = SmsInterface()
        interface.phone_number = "5551231234"
        interface.enroll(self.user)

        resp = self.get_success_response(self.user.id, interface.authenticator.id)
        assert resp.data["id"] == "sms"
        assert resp.data["authId"] == str(interface.authenticator.id)
        assert resp.data["phone"] == "5551231234"

        # should not have these because enrollment
        assert "totp_secret" not in resp.data
        assert "form" not in resp.data

    def test_recovery_codes_regenerate(self):
        interface = RecoveryCodeInterface()
        interface.enroll(self.user)

        resp = self.get_success_response(self.user.id, interface.authenticator.id)
        old_codes = resp.data["codes"]
        old_created_at = resp.data["createdAt"]

        resp = self.get_success_response(self.user.id, interface.authenticator.id)
        assert old_codes == resp.data["codes"]
        assert old_created_at == resp.data["createdAt"]

        # regenerate codes
        tomorrow = timezone.now() + datetime.timedelta(days=1)
        with mock.patch.object(timezone, "now", return_value=tomorrow):
            with self.tasks():
                self.get_success_response(self.user.id, interface.authenticator.id, method="put")
                resp = self.get_success_response(self.user.id, interface.authenticator.id)
            assert old_codes != resp.data["codes"]
            assert old_created_at != resp.data["createdAt"]

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
            self.get_error_response(self.user.id, auth.id, method="delete", status_code=403)

        assert Authenticator.objects.filter(id=auth.id).exists()

        assert len(mail.outbox) == 0

    def test_require_2fa__cannot_delete_last_auth(self):
        self._require_2fa_for_organization()

        # enroll in one auth method
        interface = TotpInterface()
        interface.enroll(self.user)
        auth = interface.authenticator

        with self.tasks():
            resp = self.get_error_response(self.user.id, auth.id, method="delete", status_code=403)
            assert b"requires 2FA" in resp.content

        assert Authenticator.objects.filter(id=auth.id).exists()

        assert len(mail.outbox) == 0

    def test_require_2fa__can_delete_last_auth_superuser(self):
        self._require_2fa_for_organization()

        superuser = self.create_user(email="a@example.com", is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        # enroll in one auth method
        interface = TotpInterface()
        interface.enroll(self.user)
        auth = interface.authenticator

        with self.tasks():
            self.get_success_response(self.user.id, auth.id, method="delete", status_code=204)
            assert_security_email_sent("mfa-removed")

        assert not Authenticator.objects.filter(id=auth.id).exists()

    def test_require_2fa__delete_with_multiple_auth__ok(self):
        self._require_2fa_for_organization()

        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["sms.twilio-account"] = "twilio-account"

        with self.settings(SENTRY_OPTIONS=new_options):
            # enroll in two auth methods
            interface = SmsInterface()
            interface.phone_number = "5551231234"
            interface.enroll(self.user)

            interface = TotpInterface()
            interface.enroll(self.user)
            auth = interface.authenticator

            with self.tasks():
                self.get_success_response(self.user.id, auth.id, method="delete")

            assert not Authenticator.objects.filter(id=auth.id).exists()
            assert_security_email_sent("mfa-removed")
