from datetime import timedelta
from time import time
from unittest.mock import patch

from django.conf import settings
from django.utils import timezone
from rest_framework.test import APIClient

from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apidevicecode import DeviceCodeStatus
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class OAuthDeviceTestBase(APITestCase):
    endpoint = "sentry-api-0-oauth-device"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(owner=self.user)
        self.device_code = self.create_api_device_code(
            application=self.application, scope_list=["project:read"]
        )

    def prepare_consent(self) -> None:
        self.get_success_response(method="get", user_code=self.device_code.user_code)


@control_silo_test
class OAuthDeviceGetTest(OAuthDeviceTestBase):
    method = "get"

    def test_entry_state(self) -> None:
        self.login_as(self.user)
        response = self.get_success_response()
        assert response.data == {"stage": "codeEntry"}
        assert "no-store" in response["Cache-Control"]

    def test_consent_context_and_normalized_code(self) -> None:
        self.login_as(self.user)
        response = self.get_success_response(
            user_code=self.device_code.user_code.lower().replace("-", "")
        )

        assert response.data["stage"] == "consent"
        assert response.data["application"]["clientId"] == self.application.client_id
        assert response.data["scopes"] == ["project:read"]
        assert response.data["permissions"] == ["Read access to projects."]
        assert response.data["userCode"] == self.device_code.user_code
        assert response.data["transactionId"] is None
        assert response.data["organizationOptions"] == []
        assert "clientSecret" not in response.data["application"]
        assert self.device_code.device_code not in str(response.data)
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.PENDING
        assert not ApiToken.objects.filter(application=self.application).exists()

    def test_organization_options(self) -> None:
        self.login_as(self.user)
        organization = self.create_organization(owner=self.user)
        self.create_organization(owner=self.create_user())
        self.application.update(requires_org_level_access=True, scopes=["project:read"])
        response = self.get_success_response(user_code=self.device_code.user_code)
        assert response.data["organizationOptions"] == [
            {"id": str(organization.id), "slug": organization.slug, "name": organization.name}
        ]

    def test_organization_membership_required(self) -> None:
        self.login_as(self.user)
        self.application.update(requires_org_level_access=True)
        response = self.get_error_response(status_code=400, user_code=self.device_code.user_code)
        assert "organization" in response.data["detail"]

    def test_unknown_code(self) -> None:
        self.login_as(self.user)
        response = self.get_error_response(status_code=400, user_code="invalid")
        assert "Invalid or expired code" in response.data["detail"]

    def test_processed_code_approved(self) -> None:
        status = DeviceCodeStatus.APPROVED
        self.login_as(self.user)
        self.device_code.update(status=status)
        self.get_error_response(status_code=400, user_code=self.device_code.user_code)

    def test_processed_code_denied(self) -> None:
        status = DeviceCodeStatus.DENIED
        self.login_as(self.user)
        self.device_code.update(status=status)
        self.get_error_response(status_code=400, user_code=self.device_code.user_code)

    def test_expired_code(self) -> None:
        self.login_as(self.user)
        self.device_code.update(expires_at=timezone.now() - timedelta(seconds=1))
        response = self.get_error_response(status_code=400, user_code=self.device_code.user_code)
        assert "expired" in response.data["detail"]

    def test_rate_limiting(self) -> None:
        self.login_as(self.user)
        with patch("sentry.api.endpoints.oauth_device.ratelimiter.is_limited", return_value=True):
            response = self.get_error_response(
                status_code=400, user_code=self.device_code.user_code
            )
        assert "Too many attempts" in response.data["detail"]

    def test_requires_session(self) -> None:
        self.get_error_response(status_code=403, user_code=self.device_code.user_code)

    def test_requires_completed_mfa(self) -> None:
        self.login_as(self.user)
        self.session["_pending_2fa"] = [self.user.id, time()]
        self.save_session()
        self.get_error_response(status_code=403, user_code=self.device_code.user_code)

    def test_rejects_bearer_token(self) -> None:
        self.login_as(self.user)
        token = self.create_user_auth_token(user=self.user)
        self.get_error_response(
            status_code=403,
            user_code=self.device_code.user_code,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
        )


@control_silo_test
class OAuthDevicePostTest(OAuthDeviceTestBase):
    method = "post"

    def test_approve(self) -> None:
        self.login_as(self.user)
        self.prepare_consent()
        response = self.get_success_response(userCode=self.device_code.user_code, op="approve")

        assert response.data == {"stage": "approved"}
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.APPROVED
        assert self.device_code.user_id == self.user.id
        assert self.device_code.organization_id is None
        authorization = ApiAuthorization.objects.get(application=self.application, user=self.user)
        assert authorization.get_scopes() == ["project:read"]
        assert not ApiToken.objects.filter(application=self.application).exists()
        assert f"oa2:{self.device_code.user_code}" not in self.client.session

    def test_deny(self) -> None:
        self.login_as(self.user)
        self.prepare_consent()
        response = self.get_success_response(userCode=self.device_code.user_code, op="deny")
        assert response.data == {"stage": "denied"}
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.DENIED
        assert not ApiAuthorization.objects.filter(application=self.application).exists()

    def test_organization_selection(self) -> None:
        self.login_as(self.user)
        organization = self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True)
        self.prepare_consent()
        self.get_success_response(
            userCode=self.device_code.user_code,
            op="approve",
            selectedOrganizationId=str(organization.id),
        )
        self.device_code.refresh_from_db()
        assert self.device_code.organization_id == organization.id

    def test_invalid_organization_selection_missing(self) -> None:
        self.login_as(self.user)
        self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True)
        self.prepare_consent()
        organization_id = None
        self.get_error_response(
            status_code=400,
            userCode=self.device_code.user_code,
            op="approve",
            selectedOrganizationId=organization_id,
        )
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.PENDING
        assert not ApiAuthorization.objects.filter(application=self.application).exists()

    def test_invalid_organization_selection_malformed(self) -> None:
        self.login_as(self.user)
        self.create_organization(owner=self.user)
        self.application.update(requires_org_level_access=True)
        self.prepare_consent()
        organization_id = "invalid"
        self.get_error_response(
            status_code=400,
            userCode=self.device_code.user_code,
            op="approve",
            selectedOrganizationId=organization_id,
        )
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.PENDING
        assert not ApiAuthorization.objects.filter(application=self.application).exists()

    def test_invalid_organization_selection_foreign(self) -> None:
        self.login_as(self.user)
        self.create_organization(owner=self.user)
        foreign_org = self.create_organization(owner=self.create_user())
        self.application.update(requires_org_level_access=True)
        self.prepare_consent()
        organization_id = str(foreign_org.id)
        self.get_error_response(
            status_code=400,
            userCode=self.device_code.user_code,
            op="approve",
            selectedOrganizationId=organization_id,
        )
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.PENDING
        assert not ApiAuthorization.objects.filter(application=self.application).exists()

    def test_requires_consent_from_get(self) -> None:
        self.login_as(self.user)
        self.get_error_response(status_code=400, userCode=self.device_code.user_code, op="approve")
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.PENDING

    def test_rejects_different_user(self) -> None:
        self.login_as(self.user)
        self.prepare_consent()
        session = self.client.session
        key = f"oa2:{self.device_code.user_code}"
        session[key] = {"device_code_id": self.device_code.id, "user_id": self.user.id + 1}
        session.save()
        assert session.session_key is not None
        self.client.cookies[settings.SESSION_COOKIE_NAME] = session.session_key
        self.get_error_response(status_code=400, userCode=self.device_code.user_code, op="approve")
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.PENDING

    def test_parallel_codes_and_replay(self) -> None:
        self.login_as(self.user)
        other_code = self.create_api_device_code(application=self.application)
        self.prepare_consent()
        self.get_success_response(method="get", user_code=other_code.user_code)
        self.get_success_response(userCode=self.device_code.user_code, op="approve")
        self.get_error_response(status_code=400, userCode=self.device_code.user_code, op="approve")
        self.get_success_response(userCode=other_code.user_code, op="deny")
        other_code.refresh_from_db()
        assert other_code.status == DeviceCodeStatus.DENIED

    def test_code_expires_after_get(self) -> None:
        self.login_as(self.user)
        self.prepare_consent()
        self.device_code.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.get_error_response(status_code=400, userCode=self.device_code.user_code, op="approve")
        assert not ApiAuthorization.objects.filter(application=self.application).exists()

    def test_application_deactivated_after_get(self) -> None:
        self.login_as(self.user)
        self.prepare_consent()
        self.application.update(status=ApiApplicationStatus.inactive)
        self.get_error_response(status_code=400, userCode=self.device_code.user_code, op="approve")
        assert not ApiAuthorization.objects.filter(application=self.application).exists()

    def test_invalid_request_missing_fields(self) -> None:
        data: dict[str, str] = {}
        self.login_as(self.user)
        self.get_error_response(status_code=400, **data)

    def test_invalid_request_missing_decision_field(self) -> None:
        data = {"userCode": "code"}
        self.login_as(self.user)
        self.get_error_response(status_code=400, **data)

    def test_invalid_request_unknown_operation(self) -> None:
        data = {"userCode": "code", "op": "invalid"}
        self.login_as(self.user)
        self.get_error_response(status_code=400, **data)

    def test_requires_session(self) -> None:
        self.get_error_response(status_code=403, userCode=self.device_code.user_code, op="approve")

    def test_requires_completed_mfa(self) -> None:
        self.login_as(self.user)
        self.prepare_consent()
        self.session = self.client.session
        self.session["_pending_2fa"] = [self.user.id, time()]
        self.save_session()
        self.get_error_response(status_code=403, userCode=self.device_code.user_code, op="approve")
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.PENDING

    def test_csrf_protection(self) -> None:
        self.client = APIClient(enforce_csrf_checks=True)
        self.login_as(self.user)
        self.prepare_consent()
        self.get_error_response(status_code=403, userCode=self.device_code.user_code, op="approve")
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.PENDING

        csrf_token = "a" * 32
        self.client.cookies[settings.CSRF_COOKIE_NAME] = csrf_token
        self.get_success_response(
            userCode=self.device_code.user_code,
            op="approve",
            extra_headers={"HTTP_X_CSRFTOKEN": csrf_token},
        )
        self.device_code.refresh_from_db()
        assert self.device_code.status == DeviceCodeStatus.APPROVED
