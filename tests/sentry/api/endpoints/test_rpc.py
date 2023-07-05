from django.test import override_settings
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.models.notificationsetting import NotificationSetting
from sentry.notifications.types import (
    NotificationScopeType,
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.services.hybrid_cloud.organization import RpcUserOrganizationContext
from sentry.testutils import APITestCase
from sentry.types.integrations import ExternalProviders


class RpcServiceEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user, superuser=True)

    @staticmethod
    def _get_path(service_name: str, method_name: str) -> str:
        return reverse(
            "sentry-api-0-rpc-service",
            kwargs={"service_name": service_name, "method_name": method_name},
        )

    def test_auth(self):
        path = self._get_path("not_a_service", "not_a_method")
        response = self.client.post(path)
        assert response.status_code == 403

    @override_settings(DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_bad_service_name(self):
        path = self._get_path("not_a_service", "not_a_method")
        response = self.client.post(path)
        assert response.status_code == 404

    @override_settings(DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_bad_method_name(self):
        path = self._get_path("user", "not_a_method")
        response = self.client.post(path)
        assert response.status_code == 404

    @override_settings(DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_no_arguments(self):
        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    @override_settings(DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_missing_argument_key(self):
        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path, {})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    @override_settings(DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_missing_argument_values(self):
        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path, {"args": {}})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    @override_settings(DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_with_empty_response(self):
        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path, {"args": {"id": 0}})
        assert response.status_code == 200
        assert "meta" in response.data
        assert response.data["value"] is None

    @override_settings(DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_with_object_response(self):
        organization = self.create_organization()

        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path, {"args": {"id": organization.id}})
        assert response.status_code == 200
        assert response.data
        assert "meta" in response.data

        response_obj = RpcUserOrganizationContext.parse_obj(response.data["value"])
        assert response_obj.organization.id == organization.id
        assert response_obj.organization.slug == organization.slug
        assert response_obj.organization.name == organization.name

    @override_settings(DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_with_invalid_arguments(self):
        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path, {"args": {"id": "invalid type"}})
        assert response.status_code == 400
        assert response.data == [ErrorDetail(string="Invalid input.", code="invalid")]

        response = self.client.post(path, {"args": {"invalid": "invalid type"}})
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    @override_settings(DEV_HYBRID_CLOUD_RPC_SENDER={"is_allowed": True})
    def test_with_enum_serialization(self):
        path = self._get_path("notifications", "get_settings_for_user_by_projects")
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user_id=self.user.id,
        )
        response = self.client.post(
            path,
            {
                "args": {
                    "type": 20,
                    "user_id": self.user.id,
                    "parent_ids": [self.project.id],
                }
            },
        )
        assert response.status_code == 200
        response_body = response.json()
        setting = NotificationSetting.objects.filter(user_id=self.user.id).get()
        assert response_body["value"] == [
            {
                "id": setting.id,
                "scope_type": NotificationScopeType.USER.value,
                "scope_identifier": self.user.id,
                "target_id": response_body["value"][0]["target_id"],
                "team_id": None,
                "user_id": self.user.id,
                "provider": ExternalProviders.EMAIL.value,
                "type": NotificationSettingTypes.ISSUE_ALERTS.value,
                "value": 20,
            }
        ]
