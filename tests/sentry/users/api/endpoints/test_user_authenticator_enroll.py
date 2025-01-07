from unittest import mock

from django.core import mail
from django.db import router
from django.db.models import F
from django.urls import reverse

from sentry import audit_log
from sentry.auth.authenticators.sms import SmsInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.organizations.services.organization.serial import serialize_member
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.authenticator import Authenticator
from sentry.users.models.useremail import UserEmail
from tests.sentry.users.api.endpoints.test_user_authenticator_details import (
    assert_security_email_sent,
)


@control_silo_test
class UserAuthenticatorEnrollTest(APITestCase):
    endpoint = "sentry-api-0-user-authenticator-enroll"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="foo")

    @mock.patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=True)
    def test_totp_can_enroll(self, validate_otp):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        with mock.patch(
            "sentry.auth.authenticators.base.generate_secret_key", return_value="Z" * 32
        ):
            resp = self.get_success_response("me", "totp")

        assert resp.data["secret"] == "Z" * 32
        assert (
            resp.data["qrcode"]
            == "otpauth://totp/admin%40localhost?issuer=Sentry&secret=ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"
        )
        assert resp.data["form"]
        assert resp.data["secret"]

        # try to enroll
        with self.tasks():
            self.get_success_response(
                "me", "totp", method="post", **{"secret": "secret12", "otp": "1234"}
            )
        assert validate_otp.call_count == 1
        assert validate_otp.call_args == mock.call("1234")

        interface = Authenticator.objects.get_interface(user=self.user, interface_id="totp")
        assert isinstance(interface, TotpInterface)
        assert interface.authenticator, "should have authenticator"
        assert interface.secret == "secret12"
        assert interface.config == {"secret": "secret12"}

        # also enrolls in recovery codes
        recovery = Authenticator.objects.get_interface(user=self.user, interface_id="recovery")
        assert recovery.is_enrolled()

        assert_security_email_sent("mfa-added")

        # can rotate in place
        self.get_success_response("me", "totp")
        self.get_success_response(
            "me", "totp", method="post", **{"secret": "secret56", "otp": "5678"}
        )
        assert validate_otp.call_args == mock.call("5678")

        interface = Authenticator.objects.get_interface(user=self.user, interface_id="totp")
        assert isinstance(interface, TotpInterface)
        assert interface.secret == "secret56"
        assert interface.config == {"secret": "secret56"}

    @mock.patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=True)
    def test_totp_no_verified_primary_email(self, validate_otp):
        from urllib.parse import quote

        user = self.create_user()
        UserEmail.objects.filter(user=user, email=user.email).update(is_verified=False)
        self.login_as(user)

        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        with mock.patch(
            "sentry.auth.authenticators.base.generate_secret_key", return_value="Z" * 32
        ):
            resp = self.get_success_response("me", "totp")

        assert resp.data["secret"] == "Z" * 32
        assert (
            resp.data["qrcode"]
            == f"otpauth://totp/{quote(user.email)}?issuer=Sentry&secret=ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"
        )
        assert resp.data["form"]
        assert resp.data["secret"]

        # try to enroll
        with self.tasks():
            resp = self.get_error_response(
                "me",
                "totp",
                method="post",
                status_code=401,
                **{"secret": "secret12", "otp": "1234"},
            )
            assert resp.data == {
                "detail": {
                    "code": "primary-email-verification-required",
                    "message": "Primary email verification required.",
                    "extra": {"username": user.email},
                }
            }

    @override_options({"totp.disallow-new-enrollment": True})
    def test_totp_disallow_new_enrollment(self):
        self.get_error_response(
            "me",
            "totp",
            method="post",
            **{"secret": "secret12", "otp": "1234"},
        )

    @mock.patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=False)
    def test_invalid_otp(self, validate_otp):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        # try to enroll
        with self.tasks():
            self.get_error_response(
                "me",
                "totp",
                method="post",
                status_code=400,
                **{"secret": "secret12", "otp": "1234"},
            )

        assert validate_otp.call_count == 1
        assert validate_otp.call_args == mock.call("1234")

        assert len(mail.outbox) == 0

    @mock.patch("sentry.auth.authenticators.SmsInterface.validate_otp", return_value=True)
    @mock.patch("sentry.auth.authenticators.SmsInterface.send_text", return_value=True)
    @override_options({"sms.twilio-account": "twilio-account"})
    def test_sms_can_enroll(self, send_text, validate_otp):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        resp = self.get_success_response("me", "sms")
        assert resp.data["form"]
        assert resp.data["secret"]

        self.get_success_response(
            "me", "sms", method="post", **{"secret": "secret12", "phone": "1231234"}
        )
        assert send_text.call_count == 1
        assert validate_otp.call_count == 0

        with self.tasks():
            self.get_success_response(
                "me",
                "sms",
                method="post",
                **{"secret": "secret12", "phone": "1231234", "otp": "123123"},
            )
        assert validate_otp.call_count == 1
        assert validate_otp.call_args == mock.call("123123")

        interface = Authenticator.objects.get_interface(user=self.user, interface_id="sms")
        assert isinstance(interface, SmsInterface)
        assert interface.phone_number == "1231234"

        assert_security_email_sent("mfa-added")

    @override_options(
        {"sms.twilio-account": "test-twilio-account", "sms.disallow-new-enrollment": True}
    )
    def test_sms_disallow_new_enrollment(self):
        form_data = {"phone": "+12345678901"}
        self.get_error_response("me", "sms", method="post", status_code=403, **form_data)

    @override_options({"sms.twilio-account": "twilio-account"})
    def test_sms_invalid_otp(self):
        # OTP as None
        self.get_error_response(
            "me",
            "sms",
            method="post",
            status_code=400,
            **{"secret": "secret12", "phone": "1231234", "otp": None},
        )
        # OTP as empty string
        self.get_error_response(
            "me",
            "sms",
            method="post",
            status_code=400,
            **{"secret": "secret12", "phone": "1231234", "otp": ""},
        )

    @override_options({"sms.twilio-account": "twilio-account"})
    def test_sms_no_verified_email(self):
        user = self.create_user()
        UserEmail.objects.filter(user=user, email=user.email).update(is_verified=False)

        self.login_as(user)

        resp = self.get_error_response(
            "me",
            "sms",
            method="post",
            status_code=401,
            **{"secret": "secret12", "phone": "1231234", "otp": None},
        )
        assert resp.data == {
            "detail": {
                "code": "primary-email-verification-required",
                "message": "Primary email verification required.",
                "extra": {"username": user.email},
            }
        }

    @mock.patch(
        "sentry.users.api.endpoints.user_authenticator_enroll.ratelimiter.backend.is_limited",
        return_value=True,
    )
    @mock.patch("sentry.auth.authenticators.U2fInterface.try_enroll")
    @override_options({"system.url-prefix": "https://testserver"})
    def test_rate_limited(self, try_enroll, is_limited):
        self.get_success_response("me", "u2f")
        self.get_error_response(
            "me",
            "u2f",
            method="post",
            status_code=429,
            **{
                "deviceName": "device name",
                "challenge": "challenge",
                "response": "response",
            },
        )

        assert try_enroll.call_count == 0

    @mock.patch("sentry.auth.authenticators.U2fInterface.try_enroll", return_value=True)
    @override_options({"system.url-prefix": "https://testserver"})
    def test_u2f_can_enroll(self, try_enroll):
        resp = self.get_success_response("me", "u2f")
        assert resp.data["form"]
        assert "secret" not in resp.data
        assert "qrcode" not in resp.data
        assert resp.data["challenge"]

        with self.tasks():
            self.get_success_response(
                "me",
                "u2f",
                method="post",
                **{
                    "deviceName": "device name",
                    "challenge": "challenge",
                    "response": "response",
                },
            )

        assert try_enroll.call_count == 1
        mock_challenge = try_enroll.call_args.args[3]["challenge"]
        assert try_enroll.call_args == mock.call(
            "challenge",
            "response",
            "device name",
            {
                "challenge": mock_challenge,
                "user_verification": "discouraged",
            },
        )

        assert_security_email_sent("mfa-added")

    @override_options({"u2f.disallow-new-enrollment": True})
    def test_u2f_disallow_new_enrollment(self):
        self.get_error_response(
            "me",
            "u2f",
            method="post",
            **{
                "deviceName": "device name",
                "challenge": "challenge",
                "response": "response",
            },
        )

    @mock.patch("sentry.auth.authenticators.U2fInterface.try_enroll", return_value=True)
    @override_options({"system.url-prefix": "https://testserver"})
    def test_u2f_superuser_and_staff_cannot_enroll_other_user(self, try_enroll):
        elevated_user = self.create_user(is_superuser=True, is_staff=True)
        self.login_as(user=elevated_user, superuser=True, staff=True)

        resp = self.get_success_response(self.user.id, "u2f")
        assert resp.data["form"]
        assert "secret" not in resp.data
        assert "qrcode" not in resp.data
        assert resp.data["challenge"]

        # check that the U2F device was enrolled for elevated_user
        # and not self.user passed in the request body
        assert not Authenticator.objects.filter(user=self.user).exists()
        assert Authenticator.objects.get_interface(user=elevated_user, interface_id="u2f")

        with self.tasks():
            self.get_success_response(
                self.user.id,
                "u2f",
                method="post",
                **{
                    "deviceName": "device name",
                    "challenge": "challenge",
                    "response": "response",
                },
            )

        assert try_enroll.call_count == 1
        mock_challenge = try_enroll.call_args.args[3]["challenge"]
        assert try_enroll.call_args == mock.call(
            "challenge",
            "response",
            "device name",
            {
                "challenge": mock_challenge,
                "user_verification": "discouraged",
            },
        )

        assert_security_email_sent("mfa-added")


@control_silo_test(include_monolith_run=True)
class AcceptOrganizationInviteTest(APITestCase):
    endpoint = "sentry-api-0-user-authenticator-enroll"

    def setUp(self):
        self.organization = self.create_organization(owner=self.create_user("foo@example.com"))
        self.user = self.create_user("bar@example.com", is_superuser=False)
        self.login_as(user=self.user)

        self.require_2fa_for_organization()
        self.assertFalse(self.user.has_2fa())

    @assume_test_silo_mode(SiloMode.REGION)
    def require_2fa_for_organization(self):
        self.organization.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        self.assertTrue(self.organization.flags.require_2fa.is_set)

    def _assert_pending_invite_details_in_session(self, om):
        assert self.client.session["invite_token"] == om.token
        assert self.client.session["invite_member_id"] == om.id
        assert self.client.session["invite_organization_id"] == om.organization_id

    def create_existing_om(self):
        with assume_test_silo_mode(SiloMode.REGION), outbox_runner():
            OrganizationMember.objects.create(
                user_id=self.user.id, role="member", organization=self.organization
            )

    def get_om_and_init_invite(self):
        with assume_test_silo_mode(SiloMode.REGION), outbox_runner():
            om = OrganizationMember.objects.create(
                email="newuser@example.com",
                role="member",
                token="abc",
                organization=self.organization,
            )

        resp = self.client.get(
            reverse(
                "sentry-api-0-organization-accept-organization-invite",
                args=[self.organization.slug, om.id, om.token],
            )
        )
        assert resp.status_code == 200
        self._assert_pending_invite_details_in_session(om)

        return om

    def assert_invite_accepted(self, response, member_id: int) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(id=member_id)
        assert om.user_id == self.user.id
        assert om.email is None

        with assume_test_silo_mode(SiloMode.REGION):
            serialized_member = serialize_member(om).get_audit_log_metadata()

        AuditLogEntry.objects.get(
            organization_id=self.organization.id,
            target_object=om.id,
            target_user=self.user,
            event=audit_log.get_event_id("MEMBER_ACCEPT"),
            data=serialized_member,
        )

        assert not self.client.session.get("invite_token")
        assert not self.client.session.get("invite_member_id")

    @override_options({"system.url-prefix": "https://testserver"})
    def setup_u2f(self, om):
        # We have to add the invite details back in to the session
        # prior to .save_session() since this re-creates the session property
        # when under test. See here for more details:
        # https://docs.djangoproject.com/en/2.2/topics/testing/tools/#django.test.Client.session
        self.session["webauthn_register_state"] = "state"
        self.session["invite_token"] = self.client.session["invite_token"]
        self.session["invite_member_id"] = self.client.session["invite_member_id"]
        self.session["invite_organization_id"] = self.client.session["invite_organization_id"]
        self.save_session()
        return self.get_success_response(
            "me",
            "u2f",
            method="post",
            **{"deviceName": "device name", "challenge": "challenge", "response": "response"},
        )

    def test_cannot_accept_invite_pending_invite__2fa_required(self):
        om = self.get_om_and_init_invite()

        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(id=om.id)
        assert om.user_id is None
        assert om.email == "newuser@example.com"

    @mock.patch("sentry.auth.authenticators.U2fInterface.try_enroll", return_value=True)
    def test_accept_pending_invite__u2f_enroll(self, try_enroll):
        om = self.get_om_and_init_invite()
        resp = self.setup_u2f(om)

        self.assert_invite_accepted(resp, om.id)

    @mock.patch("sentry.auth.authenticators.SmsInterface.validate_otp", return_value=True)
    @mock.patch("sentry.auth.authenticators.SmsInterface.send_text", return_value=True)
    @override_options({"sms.twilio-account": "twilio-account"})
    def test_accept_pending_invite__sms_enroll(self, send_text, validate_otp):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        om = self.get_om_and_init_invite()

        # setup sms
        self.get_success_response(
            "me", "sms", method="post", **{"secret": "secret12", "phone": "1231234"}
        )
        resp = self.get_success_response(
            "me",
            "sms",
            method="post",
            **{
                "secret": "secret12",
                "phone": "1231234",
                "otp": "123123",
                "memberId": om.id,
                "token": om.token,
            },
        )

        assert validate_otp.call_count == 1
        assert validate_otp.call_args == mock.call("123123")

        interface = Authenticator.objects.get_interface(user=self.user, interface_id="sms")
        assert isinstance(interface, SmsInterface)
        assert interface.phone_number == "1231234"

        self.assert_invite_accepted(resp, om.id)

    @mock.patch("sentry.auth.authenticators.TotpInterface.validate_otp", return_value=True)
    def test_accept_pending_invite__totp_enroll(self, validate_otp):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        om = self.get_om_and_init_invite()

        # setup totp
        self.get_success_response("me", "totp")
        resp = self.get_success_response(
            "me",
            "totp",
            method="post",
            **{"secret": "secret12", "otp": "1234", "memberId": om.id, "token": om.token},
        )

        interface = Authenticator.objects.get_interface(user=self.user, interface_id="totp")
        assert interface

        self.assert_invite_accepted(resp, om.id)

    @mock.patch("sentry.users.api.endpoints.user_authenticator_enroll.logger")
    @mock.patch("sentry.auth.authenticators.U2fInterface.try_enroll", return_value=True)
    def test_user_already_org_member(self, try_enroll, log):
        om = self.get_om_and_init_invite()
        self.create_existing_om()
        self.setup_u2f(om)

        with assume_test_silo_mode(SiloMode.REGION):
            assert not OrganizationMember.objects.filter(id=om.id).exists()

        log.info.assert_called_once_with(
            "Pending org invite not accepted - User already org member",
            extra={"organization_id": self.organization.id, "user_id": self.user.id},
        )

    @mock.patch("sentry.users.api.endpoints.user_authenticator_enroll.logger")
    @mock.patch("sentry.auth.authenticators.U2fInterface.try_enroll", return_value=True)
    def test_org_member_does_not_exist(self, try_enroll, log):
        om = self.get_om_and_init_invite()

        # Mutate the OrganizationMember, putting it out of sync with the
        # pending member cookie.
        with (
            assume_test_silo_mode(SiloMode.REGION),
            unguarded_write(using=router.db_for_write(OrganizationMember)),
        ):
            om.update(id=om.id + 1)

        self.setup_u2f(om)

        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(id=om.id)
        assert om.user_id is None
        assert om.email == "newuser@example.com"

        assert log.exception.call_count == 1
        assert log.exception.call_args[0][0] == "Invalid pending invite cookie"

    @mock.patch("sentry.users.api.endpoints.user_authenticator_enroll.logger")
    @mock.patch("sentry.auth.authenticators.U2fInterface.try_enroll", return_value=True)
    def test_invalid_token(self, try_enroll, log):
        om = self.get_om_and_init_invite()

        # Mutate the OrganizationMember, putting it out of sync with the
        # pending member cookie.
        with (
            assume_test_silo_mode(SiloMode.REGION),
            unguarded_write(using=router.db_for_write(OrganizationMember)),
        ):
            om.update(token="123")

        self.setup_u2f(om)

        with assume_test_silo_mode(SiloMode.REGION):
            om = OrganizationMember.objects.get(id=om.id)
        assert om.user_id is None
        assert om.email == "newuser@example.com"

    @mock.patch("sentry.users.api.endpoints.user_authenticator_enroll.logger")
    @mock.patch("sentry.auth.authenticators.U2fInterface.try_enroll", return_value=True)
    @override_options({"system.url-prefix": "https://testserver"})
    def test_enroll_without_pending_invite__no_error(self, try_enroll, log):
        self.session["webauthn_register_state"] = "state"
        self.save_session()
        self.get_success_response(
            "me",
            "u2f",
            method="post",
            **{
                "deviceName": "device name",
                "challenge": "challenge",
                "response": "response",
            },
        )

        assert log.error.called is False
