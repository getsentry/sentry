from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from sentry.auth.authenticators.totp import TotpInterface
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apidevicecode import DeviceCodeStatus
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.impersonation import simulate_impersonation
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuthDeviceGetTest(APITestCase):
    endpoint = "sentry-api-0-oauth-device"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application()
        self.device = self.create_api_device_code(
            application=self.application, scope_list=["project:read"]
        )

    def test_requires_session_authentication(self) -> None:
        self.get_error_response(user_code=self.device.user_code, status_code=403)

    def test_requires_user_code(self) -> None:
        self.login_as(self.user)
        self.get_error_response(status_code=400)

    def test_prepares_session_bound_consent(self) -> None:
        self.login_as(self.user)
        response = self.get_success_response(user_code=self.device.user_code.lower())
        assert response.data == {
            "stage": "consent",
            "userCode": self.device.user_code,
            "organizationOptions": [],
        }
        assert self.client.session[f"oa2:{self.device.user_code}"] == {
            "device_code_id": self.device.id,
            "user_id": self.user.id,
        }
        assert "no-store" in response["Cache-Control"]
        self.device.refresh_from_db()
        assert self.device.status == DeviceCodeStatus.PENDING

    def test_organization_choices(self) -> None:
        self.login_as(self.user)
        organization = self.create_organization(owner=self.user)
        self.create_organization(owner=self.create_user())
        self.application.update(requires_org_level_access=True)
        response = self.get_success_response(user_code=self.device.user_code)
        assert response.data["organizationOptions"] == [
            {"id": str(organization.id), "slug": organization.slug, "name": organization.name}
        ]

    def test_requires_eligible_organization(self) -> None:
        self.login_as(self.user)
        self.application.update(requires_org_level_access=True)
        response = self.get_error_response(user_code=self.device.user_code, status_code=400)
        assert response.data == {
            "detail": "This application requires organization-level access. "
            "You must be a member of an organization to authorize this application."
        }

    def test_invalid_code(self) -> None:
        self.login_as(self.user)
        self.get_error_response(user_code="XXXX-XXXX", status_code=400)

    def test_suspended_account(self) -> None:
        self.login_as(self.user)
        self.user.update(is_suspended=True)
        self.get_error_response(user_code=self.device.user_code, status_code=403)

    def test_token_authentication_is_rejected(self) -> None:
        self.login_as(self.user)
        token = self.create_user_auth_token(user=self.user)
        self.get_error_response(
            user_code=self.device.user_code,
            status_code=403,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )

    def test_device_issuance_context_login_and_consent(self) -> None:
        issued = self.client.post(
            reverse("sentry-oauth-device-code"),
            {"client_id": self.application.client_id, "scope": "project:read"},
            format="multipart",
        )
        assert issued.status_code == 200
        user_code = issued.json()["user_code"]
        context = self.client.get(
            reverse("sentry-api-0-oauth-device-context"), {"user_code": user_code}
        )
        assert context.status_code == 200
        assert context.data["userCode"] == user_code
        self.get_error_response(user_code=user_code, status_code=403)

        self.client.get(reverse("sentry-api-0-auth-config"))
        login = self.client.post(
            reverse("sentry-api-0-auth-login"),
            {"username": self.user.username, "password": "admin"},
        )
        assert login.status_code == 200
        consent = self.get_success_response(user_code=user_code)
        assert consent.data["userCode"] == user_code
        assert consent.data["stage"] == "consent"

        approved = self.get_success_response(method="post", userCode=user_code, op="approve")
        assert approved.data == {"stage": "approved"}
        polled = self.client.post(
            reverse("sentry-oauth-token"),
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": issued.json()["device_code"],
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
            },
            format="multipart",
        )
        assert polled.status_code == 200
        token = ApiToken.objects.get(application=self.application, user=self.user)
        assert polled.json()["access_token"] == token.token
        assert token.scope_list == ["project:read"]


@control_silo_test
class OAuthDevicePostTest(APITestCase):
    endpoint = "sentry-api-0-oauth-device"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application()
        self.device = self.create_api_device_code(
            application=self.application, scope_list=["project:read"]
        )
        self.login_as(self.user)

    def prepare(self) -> None:
        self.get_success_response(method="get", user_code=self.device.user_code)

    def test_approve_logged_in_user(self) -> None:
        self.prepare()
        response = self.get_success_response(userCode=self.device.user_code.lower(), op="approve")
        assert response.data == {"stage": "approved"}
        self.device.refresh_from_db()
        assert self.device.status == DeviceCodeStatus.APPROVED
        assert self.device.user_id == self.user.id
        assert ApiAuthorization.objects.get(
            application=self.application, user=self.user
        ).scope_list == ["project:read"]

    def test_impersonated_approval_blocked(self) -> None:
        impersonator = self.create_user(is_superuser=True)
        with simulate_impersonation(impersonator):
            self.prepare()
            self.get_error_response(userCode=self.device.user_code, op="approve", status_code=403)

        self.device.refresh_from_db()
        assert self.device.status == DeviceCodeStatus.PENDING
        assert not ApiAuthorization.objects.filter(application=self.application).exists()
        assert not ApiToken.objects.filter(application=self.application).exists()

    def test_deny_and_poll(self) -> None:
        self.prepare()
        response = self.get_success_response(userCode=self.device.user_code, op="deny")
        assert response.data == {"stage": "denied"}
        polled = self.client.post(
            reverse("sentry-oauth-token"),
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
            },
            format="multipart",
        )
        assert polled.status_code == 400
        assert polled.json()["error"] == "access_denied"
        assert not ApiAuthorization.objects.filter(application=self.application).exists()

    def test_requires_prepared_consent(self) -> None:
        self.get_error_response(userCode=self.device.user_code, op="approve", status_code=400)

    def test_requires_authentication(self) -> None:
        self.prepare()
        self.client.logout()
        self.get_error_response(userCode=self.device.user_code, op="approve", status_code=403)

    def test_different_account(self) -> None:
        self.prepare()
        self.login_as(self.create_user())
        self.get_error_response(userCode=self.device.user_code, op="approve", status_code=400)

    def test_replay(self) -> None:
        self.prepare()
        self.get_success_response(userCode=self.device.user_code, op="approve")
        self.get_error_response(userCode=self.device.user_code, op="deny", status_code=400)

    def test_organization_selection_can_be_corrected(self) -> None:
        organization = self.create_organization(owner=self.user)
        foreign = self.create_organization(owner=self.create_user())
        self.application.update(requires_org_level_access=True)
        self.prepare()
        self.get_error_response(userCode=self.device.user_code, op="approve", status_code=400)
        self.get_error_response(
            userCode=self.device.user_code,
            op="approve",
            selectedOrganizationId=str(foreign.id),
            status_code=400,
        )
        self.get_success_response(
            userCode=self.device.user_code,
            op="approve",
            selectedOrganizationId=str(organization.id),
        )
        self.device.refresh_from_db()
        assert self.device.organization_id == organization.id

    def test_csrf_protection(self) -> None:
        self.prepare()
        authenticated_client = self.client
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.cookies.update(authenticated_client.cookies)
        self.get_error_response(userCode=self.device.user_code, op="approve", status_code=403)
        csrf_token = "a" * 32
        self.client.cookies[settings.CSRF_COOKIE_NAME] = csrf_token
        self.get_success_response(
            userCode=self.device.user_code,
            op="approve",
            extra_headers={"HTTP_X_CSRFTOKEN": csrf_token},
        )

    def test_context_mfa_consent_and_approval(self) -> None:
        self.client.logout()
        interface = TotpInterface()
        interface.enroll(self.user)
        context = self.client.get(
            reverse("sentry-api-0-oauth-device-context"), {"user_code": self.device.user_code}
        )
        assert context.status_code == 200
        self.get_error_response(method="get", user_code=self.device.user_code, status_code=403)
        self.client.get(reverse("sentry-api-0-auth-config"))
        login = self.client.post(
            reverse("sentry-api-0-auth-login"),
            {"username": self.user.username, "password": "admin"},
        )
        assert login.status_code == 202
        self.get_error_response(method="get", user_code=self.device.user_code, status_code=403)
        with patch.object(interface.__class__, "validate_otp", return_value=True):
            completed = self.client.post(
                reverse("sentry-api-0-auth-2fa"), {"method": "totp", "otp": "123456"}
            )
        assert completed.status_code == 200
        self.prepare()
        response = self.get_success_response(userCode=self.device.user_code, op="approve")
        assert response.data == {"stage": "approved"}

    def test_invalid_decision_preserves_prepared_consent(self) -> None:
        self.prepare()
        self.get_error_response(userCode=self.device.user_code, op="invalid", status_code=400)
        self.get_success_response(userCode=self.device.user_code, op="deny")

    def test_expiry_after_consent_preparation(self) -> None:
        self.prepare()

        self.device.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.get_error_response(userCode=self.device.user_code, op="approve", status_code=400)
        self.device.refresh_from_db()
        assert self.device.status == DeviceCodeStatus.PENDING
