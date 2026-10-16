from django.urls import reverse

from sentry.models.apidevicecode import DeviceCodeStatus
from sentry.testutils.cases import APITestCase
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
        self.get_error_response(user_code=self.device.user_code, status_code=400)

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
