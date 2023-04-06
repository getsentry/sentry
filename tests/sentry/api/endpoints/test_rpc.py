from django.test import override_settings
from django.urls import reverse

from sentry.services.hybrid_cloud.organization import RpcUserOrganizationContext
from sentry.testutils import APITestCase


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

    @override_settings(ALLOW_HYBRID_CLOUD_RPC=True)
    def test_bad_service_name(self):
        path = self._get_path("not_a_service", "not_a_method")
        response = self.client.post(path)
        assert response.status_code == 404

    @override_settings(ALLOW_HYBRID_CLOUD_RPC=True)
    def test_bad_method_name(self):
        path = self._get_path("user", "not_a_method")
        response = self.client.post(path)
        assert response.status_code == 404

    @override_settings(ALLOW_HYBRID_CLOUD_RPC=True)
    def test_no_arguments(self):
        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path)
        assert response.status_code == 400

    @override_settings(ALLOW_HYBRID_CLOUD_RPC=True)
    def test_missing_argument_key(self):
        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path, {})
        assert response.status_code == 400

    @override_settings(ALLOW_HYBRID_CLOUD_RPC=True)
    def test_missing_argument_values(self):
        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path, {"args": {}})
        assert response.status_code == 400

    @override_settings(ALLOW_HYBRID_CLOUD_RPC=True)
    def test_with_empty_response(self):
        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path, {"args": {"id": 0}})
        assert response.status_code == 200
        assert response.data is None

    @override_settings(ALLOW_HYBRID_CLOUD_RPC=True)
    def test_with_object_response(self):
        organization = self.create_organization()

        path = self._get_path("organization", "get_organization_by_id")
        response = self.client.post(path, {"args": {"id": organization.id}})
        assert response.status_code == 200
        assert response.data

        response_obj = RpcUserOrganizationContext.parse_obj(response.data)
        assert response_obj.organization.id == organization.id
        assert response_obj.organization.slug == organization.slug
        assert response_obj.organization.name == organization.name
