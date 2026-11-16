from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apidevicecode import DeviceCodeStatus
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuthDeviceContextTest(APITestCase):
    endpoint = "sentry-api-0-oauth-device-context"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(name="Example application")
        self.device = self.create_api_device_code(
            application=self.application, scope_list=["project:read"]
        )

    def test_code_entry(self) -> None:
        response = self.get_success_response()
        assert response.data == {"stage": "codeEntry"}

    def test_public_context_and_normalization(self) -> None:
        code = self.device.user_code.replace("-", "").lower()
        response = self.get_success_response(user_code=f" {code} ")
        assert response.data == {
            "stage": "context",
            "application": {
                "clientId": self.application.client_id,
                "name": self.application.name,
                "homepageUrl": None,
                "privacyUrl": None,
                "termsUrl": None,
                "requiresOrgLevelAccess": False,
            },
            "scopes": ["project:read"],
            "permissions": ["Read access to projects."],
            "permissionGroups": [
                {
                    "resource": "projects",
                    "label": "Projects",
                    "scopes": ["project:read"],
                    "actions": ["read"],
                    "description": None,
                    "accessDescriptions": {
                        "read": "View projects and their settings.",
                        "write": "Create and update projects. Manage project settings and alert rules, including deleting them.",
                        "admin": "Includes write access and allows deleting projects and removing ownership rules.",
                    },
                }
            ],
            "userCode": self.device.user_code,
        }
        assert "no-store" in response["Cache-Control"]
        self.device.refresh_from_db()
        assert self.device.status == DeviceCodeStatus.PENDING
        assert not ApiToken.objects.filter(application=self.application).exists()
        assert not any(key.startswith("oa2:") for key in self.client.session.keys())

    def test_invalid_code(self) -> None:
        self.get_error_response(user_code="XXXX-XXXX", status_code=400)

    def test_expired_code_remains_available_to_polling_client(self) -> None:
        self.device.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.get_error_response(user_code=self.device.user_code, status_code=400)
        response = self.client.post(
            "/oauth/token/",
            {
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "device_code": self.device.device_code,
                "client_id": self.application.client_id,
                "client_secret": self.application.client_secret,
            },
            format="multipart",
        )
        assert response.status_code == 400
        assert response.json()["error"] == "expired_token"

    def test_inactive_application(self) -> None:
        self.application.update(status=ApiApplicationStatus.inactive)
        self.get_error_response(user_code=self.device.user_code, status_code=400)

    def test_completed_request(self) -> None:
        self.device.update(status=DeviceCodeStatus.DENIED)
        self.get_error_response(user_code=self.device.user_code, status_code=400)

    def test_verification_throttling(self) -> None:
        with patch("sentry.api.helpers.oauth_device.ratelimiter.is_limited", return_value=True):
            self.get_error_response(user_code=self.device.user_code, status_code=429)

    def test_blank_code_returns_entry(self) -> None:
        response = self.get_success_response(user_code="   ")
        assert response.data == {"stage": "codeEntry"}

    def test_oversized_code(self) -> None:
        response = self.get_error_response(user_code="a" * 33, status_code=400)
        assert "user_code" in response.data
