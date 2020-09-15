from __future__ import absolute_import

import io
import os

from six.moves.urllib.parse import parse_qsl
from django.core.urlresolvers import reverse
from django.conf import settings
from django.db.models import F

from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    Authenticator,
    Organization,
    OrganizationMember,
)
from sentry.utils import json
from sentry.utils.compat import mock
from sentry.testutils import APITestCase


# TODO(joshuarli): move all fixtures to a standard path relative to gitroot,
#                  and implement this in testutils
def get_fixture_path(name):
    return os.path.join(
        os.path.dirname(__file__), os.pardir, os.pardir, os.pardir, "fixtures", name
    )


class UserAuthenticatorEnrollTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email="a@example.com", is_superuser=False)
        self.login_as(user=self.user)

    def _assert_security_email_sent(self, email_type, email_log):
        assert email_log.info.call_count == 1
        assert "mail.queued" in email_log.info.call_args[0]
        assert email_log.info.call_args[1]["extra"]["message_type"] == email_type

    @mock.patch("sentry.utils.email.logger")
    @mock.patch("sentry.models.TotpInterface.validate_otp", return_value=True)
    def test_totp_can_enroll(self, validate_otp, email_log):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        url = reverse(
            "sentry-api-0-user-authenticator-enroll",
            kwargs={"user_id": "me", "interface_id": "totp"},
        )

        with mock.patch("sentry.models.authenticator.generate_secret_key", return_value="Z" * 32):
            resp = self.client.get(url)

        assert resp.status_code == 200
        assert resp.data["secret"] == "Z" * 32
        with io.open(get_fixture_path("totp_qrcode.json")) as f:
            assert resp.data["qrcode"] == json.loads(f.read())
        assert resp.data["form"]
        assert resp.data["secret"]

        # try to enroll
        resp = self.client.post(url, data={"secret": "secret12", "otp": "1234"})
        assert validate_otp.call_count == 1
        assert validate_otp.call_args == mock.call("1234")
        assert resp.status_code == 204

        interface = Authenticator.objects.get_interface(user=self.user, interface_id="totp")
        assert interface

        # also enrolls in recovery codes
        recovery = Authenticator.objects.get_interface(user=self.user, interface_id="recovery")
        assert recovery.is_enrolled

        self._assert_security_email_sent("mfa-added", email_log)

        # can't enroll again because no multi enrollment is allowed
        resp = self.client.get(url)
        assert resp.status_code == 400
        resp = self.client.post(url)
        assert resp.status_code == 400

    @mock.patch("sentry.utils.email.logger")
    @mock.patch("sentry.models.TotpInterface.validate_otp", return_value=False)
    def test_invalid_otp(self, validate_otp, email_log):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        url = reverse(
            "sentry-api-0-user-authenticator-enroll",
            kwargs={"user_id": "me", "interface_id": "totp"},
        )

        # try to enroll
        resp = self.client.post(url, data={"secret": "secret12", "otp": "1234"})
        assert validate_otp.call_count == 1
        assert validate_otp.call_args == mock.call("1234")
        assert resp.status_code == 400
        assert email_log.call_count == 0

    @mock.patch("sentry.utils.email.logger")
    @mock.patch("sentry.models.SmsInterface.validate_otp", return_value=True)
    @mock.patch("sentry.models.SmsInterface.send_text", return_value=True)
    def test_sms_can_enroll(self, send_text, validate_otp, email_log):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["sms.twilio-account"] = "twilio-account"

        with self.settings(SENTRY_OPTIONS=new_options):
            url = reverse(
                "sentry-api-0-user-authenticator-enroll",
                kwargs={"user_id": "me", "interface_id": "sms"},
            )

            resp = self.client.get(url)
            assert resp.status_code == 200
            assert resp.data["form"]
            assert resp.data["secret"]

            resp = self.client.post(url, data={"secret": "secret12", "phone": "1231234"})
            assert send_text.call_count == 1
            assert validate_otp.call_count == 0
            assert resp.status_code == 204

            resp = self.client.post(
                url, data={"secret": "secret12", "phone": "1231234", "otp": "123123"}
            )
            assert validate_otp.call_count == 1
            assert validate_otp.call_args == mock.call("123123")

            interface = Authenticator.objects.get_interface(user=self.user, interface_id="sms")
            assert interface.phone_number == "1231234"

            self._assert_security_email_sent("mfa-added", email_log)

    def test_sms_invalid_otp(self):
        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["sms.twilio-account"] = "twilio-account"

        with self.settings(SENTRY_OPTIONS=new_options):
            url = reverse(
                "sentry-api-0-user-authenticator-enroll",
                kwargs={"user_id": "me", "interface_id": "sms"},
            )
            resp = self.client.post(
                url, data={"secret": "secret12", "phone": "1231234", "otp": None}
            )
            assert resp.status_code == 400
            resp = self.client.post(url, data={"secret": "secret12", "phone": "1231234", "otp": ""})
            assert resp.status_code == 400

    @mock.patch("sentry.utils.email.logger")
    @mock.patch("sentry.models.U2fInterface.try_enroll", return_value=True)
    def test_u2f_can_enroll(self, try_enroll, email_log):
        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["system.url-prefix"] = "https://testserver"
        with self.settings(SENTRY_OPTIONS=new_options):
            url = reverse(
                "sentry-api-0-user-authenticator-enroll",
                kwargs={"user_id": "me", "interface_id": "u2f"},
            )

            resp = self.client.get(url)
            assert resp.status_code == 200
            assert resp.data["form"]
            assert "secret" not in resp.data
            assert "qrcode" not in resp.data
            assert resp.data["challenge"]

            #
            resp = self.client.post(
                url,
                data={
                    "deviceName": "device name",
                    "challenge": "challenge",
                    "response": "response",
                },
            )
            assert try_enroll.call_count == 1
            assert try_enroll.call_args == mock.call("challenge", "response", "device name")
            assert resp.status_code == 204

            self._assert_security_email_sent("mfa-added", email_log)


class AcceptOrganizationInviteTest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization(owner=self.create_user("foo@example.com"))
        self.user = self.create_user("bar@example.com", is_superuser=False)
        self.login_as(user=self.user)

        self.require_2fa_for_organization()
        self.assertFalse(Authenticator.objects.user_has_2fa(self.user))

    def require_2fa_for_organization(self):
        self.organization.update(flags=F("flags").bitor(Organization.flags.require_2fa))
        self.assertTrue(self.organization.flags.require_2fa.is_set)

    def _assert_pending_invite_cookie_set(self, response, om):
        invite_link = om.get_invite_link()
        invite_data = dict(parse_qsl(response.client.cookies["pending-invite"].value))
        assert invite_data.get("url") in invite_link

    def create_existing_om(self):
        OrganizationMember.objects.create(
            user=self.user, role="member", organization=self.organization
        )

    def get_om_and_init_invite(self):
        om = OrganizationMember.objects.create(
            email="newuser@example.com", role="member", token="abc", organization=self.organization
        )

        resp = self.client.get(
            reverse("sentry-api-0-accept-organization-invite", args=[om.id, om.token])
        )
        assert resp.status_code == 200
        self._assert_pending_invite_cookie_set(resp, om)

        return om

    def assert_invite_accepted(self, response, member_id):
        om = OrganizationMember.objects.get(id=member_id)
        assert om.user == self.user
        assert om.email is None

        AuditLogEntry.objects.get(
            organization=self.organization,
            target_object=om.id,
            target_user=self.user,
            event=AuditLogEntryEvent.MEMBER_ACCEPT,
            data=om.get_audit_log_data(),
        )

        self.assertFalse(response.client.cookies["pending-invite"].value)

    def setup_u2f(self):
        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["system.url-prefix"] = "https://testserver"
        with self.settings(SENTRY_OPTIONS=new_options):
            url = reverse(
                "sentry-api-0-user-authenticator-enroll",
                kwargs={"user_id": "me", "interface_id": "u2f"},
            )

            resp = self.client.post(
                url,
                data={
                    "deviceName": "device name",
                    "challenge": "challenge",
                    "response": "response",
                },
            )
            assert resp.status_code == 204

        return resp

    def test_cannot_accept_invite_pending_invite__2fa_required(self):
        om = self.get_om_and_init_invite()

        om = OrganizationMember.objects.get(id=om.id)
        assert om.user is None
        assert om.email == "newuser@example.com"

    @mock.patch("sentry.models.U2fInterface.try_enroll", return_value=True)
    def test_accept_pending_invite__u2f_enroll(self, try_enroll):
        om = self.get_om_and_init_invite()
        resp = self.setup_u2f()

        self.assert_invite_accepted(resp, om.id)

    @mock.patch("sentry.models.SmsInterface.validate_otp", return_value=True)
    @mock.patch("sentry.models.SmsInterface.send_text", return_value=True)
    def test_accept_pending_invite__sms_enroll(self, send_text, validate_otp):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        om = self.get_om_and_init_invite()

        # setup sms
        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["sms.twilio-account"] = "twilio-account"

        with self.settings(SENTRY_OPTIONS=new_options):
            url = reverse(
                "sentry-api-0-user-authenticator-enroll",
                kwargs={"user_id": "me", "interface_id": "sms"},
            )

            resp = self.client.post(url, data={"secret": "secret12", "phone": "1231234"})
            assert resp.status_code == 204

            resp = self.client.post(
                url,
                data={
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
            assert interface.phone_number == "1231234"

        self.assert_invite_accepted(resp, om.id)

    @mock.patch("sentry.models.TotpInterface.validate_otp", return_value=True)
    def test_accept_pending_invite__totp_enroll(self, validate_otp):
        # XXX: Pretend an unbound function exists.
        validate_otp.__func__ = None

        om = self.get_om_and_init_invite()

        # setup totp
        url = reverse(
            "sentry-api-0-user-authenticator-enroll",
            kwargs={"user_id": "me", "interface_id": "totp"},
        )

        resp = self.client.get(url)
        assert resp.status_code == 200

        resp = self.client.post(
            url, data={"secret": "secret12", "otp": "1234", "memberId": om.id, "token": om.token}
        )
        assert resp.status_code == 204

        interface = Authenticator.objects.get_interface(user=self.user, interface_id="totp")
        assert interface

        self.assert_invite_accepted(resp, om.id)

    @mock.patch("sentry.api.endpoints.user_authenticator_enroll.logger")
    @mock.patch("sentry.models.U2fInterface.try_enroll", return_value=True)
    def test_user_already_org_member(self, try_enroll, log):
        om = self.get_om_and_init_invite()
        self.create_existing_om()
        self.setup_u2f()

        assert not OrganizationMember.objects.filter(id=om.id).exists()

        log.info.assert_called_once_with(
            "Pending org invite not accepted - User already org member",
            extra={"organization_id": self.organization.id, "user_id": self.user.id},
        )

    @mock.patch("sentry.api.endpoints.user_authenticator_enroll.logger")
    @mock.patch("sentry.models.U2fInterface.try_enroll", return_value=True)
    def test_org_member_does_not_exist(self, try_enroll, log):
        om = self.get_om_and_init_invite()

        # Mutate the OrganizationMember, putting it out of sync with the
        # pending member cookie.
        om.update(id=om.id + 1)

        self.setup_u2f()

        om = OrganizationMember.objects.get(id=om.id)
        assert om.user is None
        assert om.email == "newuser@example.com"

        assert log.error.call_count == 1
        assert log.error.call_args[0][0] == "Invalid pending invite cookie"

    @mock.patch("sentry.api.endpoints.user_authenticator_enroll.logger")
    @mock.patch("sentry.models.U2fInterface.try_enroll", return_value=True)
    def test_invalid_token(self, try_enroll, log):
        om = self.get_om_and_init_invite()

        # Mutate the OrganizationMember, putting it out of sync with the
        # pending member cookie.
        om.update(token="123")

        self.setup_u2f()

        om = OrganizationMember.objects.get(id=om.id)
        assert om.user is None
        assert om.email == "newuser@example.com"

    @mock.patch("sentry.api.endpoints.user_authenticator_enroll.logger")
    @mock.patch("sentry.models.U2fInterface.try_enroll", return_value=True)
    def test_enroll_without_pending_invite__no_error(self, try_enroll, log):
        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["system.url-prefix"] = "https://testserver"
        with self.settings(SENTRY_OPTIONS=new_options):
            url = reverse(
                "sentry-api-0-user-authenticator-enroll",
                kwargs={"user_id": "me", "interface_id": "u2f"},
            )

            resp = self.client.post(
                url,
                data={
                    "deviceName": "device name",
                    "challenge": "challenge",
                    "response": "response",
                },
            )
            assert resp.status_code == 204
        assert log.error.called is False
