from unittest.mock import ANY, MagicMock, patch

from django.conf import settings
from django.urls import reverse

from sentry.auth.authenticators.base import ActivationChallengeResult, ActivationMessageResult
from sentry.auth.authenticators.sms import SmsInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.authenticators.u2f import U2fInterface
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils.auth import SsoSession


@control_silo_test
class AuthLoginEndpointTest(APITestCase):
    endpoint = "sentry-api-0-auth-login"
    method = "post"

    def setUp(self) -> None:
        # Requests to set the test cookie
        self.client.get(reverse("sentry-api-0-auth-config"))

    def test_login_invalid_password(self) -> None:
        response = self.get_error_response(
            username=self.user.username, password="bizbar", status_code=400
        )
        assert response.data["errors"]["__all__"] == [
            "Please enter a correct username and password. Note that both fields may be case-sensitive."
        ]

    def test_login_valid_credentials(self) -> None:
        response = self.get_success_response(username=self.user.username, password="admin")
        assert response.data["nextUri"] == "/organizations/new/"

    def test_login_valid_credentials_with_organization(self) -> None:
        organization = self.create_organization(owner=self.user)

        response = self.get_success_response(username=self.user.username, password="admin")

        assert response.data["nextUri"] == f"/organizations/{organization.slug}/issues/"
        assert self.client.session["activeorg"] == organization.slug

    def test_login_valid_credentials_with_requested_organization(self) -> None:
        self.create_organization(owner=self.user, slug="org-a")
        requested_organization = self.create_organization(owner=self.user, slug="org-b")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            orgSlug=requested_organization.slug,
        )

        assert response.data["nextUri"] == f"/organizations/{requested_organization.slug}/issues/"
        assert self.client.session["activeorg"] == requested_organization.slug

    def test_login_valid_credentials_with_snake_case_organization(self) -> None:
        self.create_organization(owner=self.user, slug="org-a")
        requested_organization = self.create_organization(owner=self.user, slug="org-b")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            org_slug=requested_organization.slug,
        )

        assert response.data["nextUri"] == f"/organizations/{requested_organization.slug}/issues/"
        assert self.client.session["activeorg"] == requested_organization.slug

    def test_login_with_unknown_requested_organization_uses_default(self) -> None:
        default_organization = self.create_organization(owner=self.user, slug="org-a")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            orgSlug="missing-org",
        )

        assert response.data["nextUri"] == f"/organizations/{default_organization.slug}/issues/"
        assert self.client.session["activeorg"] == default_organization.slug

    def test_login_with_unauthorized_requested_organization_uses_default(self) -> None:
        self.user.update(is_superuser=False)
        default_organization = self.create_organization(owner=self.user, slug="org-a")
        other_user = self.create_user("other@example.com")
        self.create_organization(owner=other_user, slug="org-b")

        response = self.get_success_response(
            username=self.user.username,
            password="admin",
            orgSlug="org-b",
        )

        assert response.data["nextUri"] == f"/organizations/{default_organization.slug}/issues/"
        assert self.client.session["activeorg"] == default_organization.slug

    def test_password_login_cannot_select_sso_required_organization(self) -> None:
        user = self.create_user(email="member@example.com")
        user.set_password("password")
        user.save()
        organization = self.create_organization(slug="sso-org")
        self.create_member(organization=organization, user=user)
        self.create_auth_provider(organization_id=organization.id, provider="dummy")

        response = self.get_success_response(
            username=user.username,
            password="password",
            orgSlug=organization.slug,
        )

        assert response.data["nextUri"] == reverse("sentry-account-settings")
        assert "activeorg" not in self.client.session
        assert SsoSession.django_session_key(organization.id) not in self.client.session

    def test_password_login_falls_back_from_sso_required_organization(self) -> None:
        user = self.create_user(email="member@example.com")
        user.set_password("password")
        user.save()
        sso_organization = self.create_organization(slug="sso-org")
        self.create_member(organization=sso_organization, user=user)
        self.create_auth_provider(organization_id=sso_organization.id, provider="dummy")
        password_organization = self.create_organization(owner=user, slug="password-org")

        response = self.get_success_response(
            username=user.username,
            password="password",
            orgSlug=sso_organization.slug,
        )

        assert response.data["nextUri"] == (f"/organizations/{password_organization.slug}/issues/")
        assert self.client.session["activeorg"] == password_organization.slug
        assert SsoSession.django_session_key(sso_organization.id) not in self.client.session

    def test_login_requires_mfa(self) -> None:
        TotpInterface().enroll(self.user)

        response = self.get_response(username=self.user.username, password="admin")

        assert response.status_code == 202
        assert response.data == {
            "mfaRequired": True,
            "mfaMethods": [{"id": "totp"}],
        }
        assert "_auth_user_id" not in self.client.session
        assert self.client.session["_pending_2fa"][0] == self.user.id

    def test_get_mfa_methods(self) -> None:
        TotpInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.get(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 200
        assert response.data == {
            "mfaRequired": True,
            "mfaMethods": [{"id": "totp"}],
        }

    def test_get_mfa_methods_requires_pending_login(self) -> None:
        response = self.client.get(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 404
        assert response.data == {"detail": "No two-factor authentication request is active"}

    def test_complete_mfa_login(self) -> None:
        interface = TotpInterface()
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        with patch.object(interface.__class__, "validate_otp", return_value=True):
            response = self.client.post(
                reverse("sentry-api-0-auth-2fa"),
                data={"method": "totp", "otp": "123456"},
            )

        assert response.status_code == 200
        assert response.data["nextUri"] == "/organizations/new/"
        assert response.data["user"]["id"] == str(self.user.id)
        assert self.client.session["_auth_user_id"] == str(self.user.id)
        assert "_pending_2fa" not in self.client.session

    def test_complete_mfa_login_requires_pending_login(self) -> None:
        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={"method": "totp", "otp": "123456"},
        )

        assert response.status_code == 401
        assert response.data == {"detail": "No pending two-factor authentication"}

    def test_complete_mfa_login_rejects_invalid_code(self) -> None:
        interface = TotpInterface()
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        with patch.object(interface.__class__, "validate_otp", return_value=False):
            response = self.client.post(
                reverse("sentry-api-0-auth-2fa"),
                data={"method": "totp", "otp": "invalid"},
            )

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid two-factor authentication credentials"}
        assert "_auth_user_id" not in self.client.session

    @patch("sentry.api.endpoints.auth_2fa.send_2fa_rate_limit_notification")
    @patch("sentry.api.endpoints.auth_2fa.is_2fa_rate_limited", return_value=True)
    def test_complete_mfa_login_rate_limited(
        self, is_rate_limited: MagicMock, send_notification: MagicMock
    ) -> None:
        TotpInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={"method": "totp", "otp": "123456"},
        )

        assert response.status_code == 429
        assert response.data == {"detail": "Too many two-factor authentication attempts"}
        is_rate_limited.assert_called_once_with(self.user.id)
        send_notification.assert_called_once_with(
            user_id=self.user.id,
            email=self.user.username,
            ip_address="127.0.0.1",
        )

    def test_complete_mfa_login_rejects_expired_password(self) -> None:
        interface = TotpInterface()
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")
        self.user.update(is_password_expired=True)

        with patch.object(interface.__class__, "validate_otp", return_value=True):
            response = self.client.post(
                reverse("sentry-api-0-auth-2fa"),
                data={"method": "totp", "otp": "123456"},
            )

        assert response.status_code == 403
        assert response.data == {
            "detail": "Cannot complete authentication because the password has expired"
        }
        assert "_pending_2fa" not in self.client.session
        assert "_auth_user_id" not in self.client.session
        assert "mfa" not in self.client.session

        self.user.refresh_from_db()
        self.user.set_password("new-password")
        self.user.save()

        response = self.get_response(username=self.user.username, password="new-password")

        assert response.status_code == 202
        assert self.client.session["_pending_2fa"][0] == self.user.id

    def test_cancel_mfa_login(self) -> None:
        TotpInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")
        session = self.client.session
        session["_after_2fa"] = "/after-2fa/"
        session["_next"] = "/settings/account/"
        session.save()
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key or ""
        assert self.client.session["_next"] == "/settings/account/"

        response = self.client.delete(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 204
        assert "_pending_2fa" not in self.client.session
        assert "_after_2fa" not in self.client.session
        assert self.client.session["_next"] == "/settings/account/"

    def test_cancel_mfa_login_is_idempotent(self) -> None:
        response = self.client.delete(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 204

    def test_cancel_mfa_login_clears_webauthn_challenge(self) -> None:
        session = self.client.session
        session["webauthn_authentication_state"] = "state"
        session.save()
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key or ""
        assert self.client.session["webauthn_authentication_state"] == "state"

        response = self.client.delete(reverse("sentry-api-0-auth-2fa"))

        assert response.status_code == 204
        assert "webauthn_authentication_state" not in self.client.session

    @patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True)
    @patch(
        "sentry.auth.authenticators.U2fInterface.activate",
        return_value=ActivationChallengeResult(b"challenge"),
    )
    def test_activate_webauthn_challenge(self, activate, is_available) -> None:
        U2fInterface().enroll(self.user)
        login_response = self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "u2f"},
        )

        assert login_response.data["mfaMethods"] == [{"id": "u2f"}]
        assert response.status_code == 200
        assert response.data == {
            "method": "u2f",
            # Base64-encoded form of the mocked b"challenge" activation payload.
            "challenge": {"webAuthnAuthenticationData": "Y2hhbGxlbmdl"},
        }
        activate.assert_called_once()

    @patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True)
    @patch("sentry.auth.authenticators.U2fInterface.validate_response", return_value=True)
    def test_complete_webauthn_login(self, validate_response, is_available) -> None:
        U2fInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")
        webauthn_response = {
            "keyHandle": "key-handle",
            "clientData": "client-data",
            "authenticatorData": "authenticator-data",
            "signatureData": "signature-data",
        }

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={"method": "u2f", "response": webauthn_response},
            content_type="application/json",
        )

        assert response.status_code == 200
        assert response.data["user"]["id"] == str(self.user.id)
        assert self.client.session["_auth_user_id"] == str(self.user.id)
        validate_response.assert_called_once_with(
            ANY,
            None,
            {
                "keyHandle": "key-handle",
                "clientData": "client-data",
                "authenticatorData": "authenticator-data",
                "signatureData": "signature-data",
            },
        )

    @patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True)
    def test_complete_webauthn_login_rejects_malformed_response(self, is_available) -> None:
        U2fInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")
        session = self.client.session
        session["webauthn_authentication_state"] = "state"
        session.save()

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={
                "method": "u2f",
                "response": {
                    "keyHandle": "a",
                    "clientData": "a",
                    "authenticatorData": "a",
                    "signatureData": "a",
                },
            },
            content_type="application/json",
        )

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid two-factor authentication credentials"}
        assert "_auth_user_id" not in self.client.session

    @patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True)
    def test_complete_webauthn_login_uses_camel_case_validation_errors(self, is_available) -> None:
        U2fInterface().enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa"),
            data={
                "method": "u2f",
                "response": {
                    "keyHandle": "key-handle",
                    "clientData": "client-data",
                    "authenticatorData": "authenticator-data",
                },
            },
            content_type="application/json",
        )

        assert response.status_code == 400
        assert "signatureData" in response.data["response"]

    @patch("sentry.auth.authenticators.SmsInterface.is_available", return_value=True)
    @patch(
        "sentry.auth.authenticators.SmsInterface.activate",
        return_value=ActivationMessageResult("Code sent", expires_in=45),
    )
    def test_activate_sms_challenge(self, activate, is_available) -> None:
        interface = SmsInterface()
        interface.phone_number = "5555551212"
        interface.enroll(self.user)
        login_response = self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "sms"},
        )

        assert login_response.data["mfaMethods"] == [{"id": "sms"}]
        assert response.status_code == 200
        assert response.data == {"method": "sms", "expiresIn": 45}
        activate.assert_called_once()

    @patch("sentry.api.endpoints.auth_2fa.sentry_sdk.capture_message")
    @patch("sentry.auth.authenticators.SmsInterface.is_available", return_value=True)
    @patch(
        "sentry.auth.authenticators.SmsInterface.activate",
        return_value=ActivationMessageResult("Unable to send code", type="error"),
    )
    def test_activate_challenge_captures_provider_error(
        self, activate, is_available, capture_message
    ) -> None:
        interface = SmsInterface()
        interface.phone_number = "5555551212"
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "sms"},
        )

        assert response.status_code == 503
        assert response.data == {"detail": "Unable to activate authentication challenge"}
        capture_message.assert_called_once_with(
            "Two-factor authentication challenge activation failed",
            level="error",
            extras={"method": "sms"},
        )

    @patch("sentry.api.endpoints.auth_2fa.sentry_sdk.capture_message")
    @patch("sentry.auth.authenticators.SmsInterface.is_available", return_value=True)
    @patch("sentry.auth.authenticators.SmsInterface.activate", return_value=None)
    def test_activate_challenge_captures_unexpected_result(
        self, activate, is_available, capture_message
    ) -> None:
        interface = SmsInterface()
        interface.phone_number = "5555551212"
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "sms"},
        )

        assert response.status_code == 500
        assert response.data == {"detail": "Unable to activate authentication challenge"}
        capture_message.assert_called_once_with(
            "Unexpected two-factor authentication challenge activation result",
            level="error",
            extras={"activation_type": "NoneType", "method": "sms"},
        )

    @patch("sentry.api.endpoints.auth_2fa.sentry_sdk.capture_exception")
    @patch("sentry.auth.authenticators.SmsInterface.is_available", return_value=True)
    @patch(
        "sentry.auth.authenticators.SmsInterface.activate",
        return_value=ActivationMessageResult("Code sent"),
    )
    def test_activate_challenge_captures_unsupported_result(
        self, activate, is_available, capture_exception
    ) -> None:
        interface = SmsInterface()
        interface.phone_number = "5555551212"
        interface.enroll(self.user)
        self.get_response(username=self.user.username, password="admin")

        response = self.client.post(
            reverse("sentry-api-0-auth-2fa-challenge"),
            data={"method": "sms"},
        )

        assert response.status_code == 500
        assert response.data == {"detail": "Unable to activate authentication challenge"}
        capture_exception.assert_called_once()

    def test_must_reactivate(self) -> None:
        self.user.update(is_active=False)

        response = self.get_success_response(username=self.user.username, password="admin")
        assert response.data["nextUri"] == "/auth/reactivate/"

    def test_login_suspended_user(self) -> None:
        self.user.update(is_suspended=True)

        response = self.get_error_response(
            username=self.user.username, password="admin", status_code=400
        )
        assert "Your account has been suspended." in str(response.data["errors"])

    @patch(
        "sentry.api.endpoints.auth_login.ratelimiter.backend.is_limited",
        autospec=True,
        return_value=True,
    )
    def test_login_ratelimit(self, is_limited: MagicMock) -> None:
        response = self.get_error_response(
            username=self.user.username, password="admin", status_code=400
        )
        assert [str(s) for s in response.data["errors"]["__all__"]] == [
            "You have made too many failed authentication attempts. Please try again later."
        ]
