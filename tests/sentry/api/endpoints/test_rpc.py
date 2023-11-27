from __future__ import annotations

from typing import Any, Dict

from django.test import override_settings
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.services.hybrid_cloud.organization import RpcUserOrganizationContext
from sentry.services.hybrid_cloud.rpc import generate_request_signature
from sentry.testutils.cases import APITestCase
from sentry.utils import json


@override_settings(RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
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

    def auth_header(self, path: str, data: dict | str) -> str:
        if isinstance(data, dict):
            data = json.dumps(data)
        signature = generate_request_signature(path, data.encode("utf8"))

        return f"rpcsignature {signature}"

    def test_auth(self):
        path = self._get_path("not_a_service", "not_a_method")
        response = self.client.post(path)
        assert response.status_code == 403

    def _send_post_request(self, path, data):
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        return response

    def test_bad_service_name(self):
        path = self._get_path("not_a_service", "not_a_method")
        data: Dict[str, Any] = {"args": {}, "meta": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 404

    def test_bad_method_name(self):
        path = self._get_path("user", "not_a_method")
        data: Dict[str, Any] = {"args": {}, "meta": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 404

    def test_no_body(self):
        path = self._get_path("organization", "get_organization_by_id")
        data: Dict[str, Any] = {"args": {}, "meta": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    def test_invalid_args_syntax(self):
        path = self._get_path("organization", "get_organization_by_id")
        data: Dict[str, Any] = {"args": [], "meta": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    def test_missing_argument_key(self):
        path = self._get_path("organization", "get_organization_by_id")
        data: Dict[str, Any] = {}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    def test_missing_argument_values(self):
        path = self._get_path("organization", "get_organization_by_id")
        data: Dict[str, Any] = {"args": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    def test_with_empty_response(self):
        path = self._get_path("organization", "get_organization_by_id")
        data = {"args": {"id": 0}}
        response = self._send_post_request(path, data)

        assert response.status_code == 200
        assert "meta" in response.data
        assert response.data["value"] is None

    def test_with_object_response(self):
        organization = self.create_organization()

        path = self._get_path("organization", "get_organization_by_id")
        data = {"args": {"id": organization.id}}
        response = self._send_post_request(path, data)
        assert response.status_code == 200
        assert response.data
        assert "meta" in response.data

        response_obj = RpcUserOrganizationContext.parse_obj(response.data["value"])
        assert response_obj.organization.id == organization.id
        assert response_obj.organization.slug == organization.slug
        assert response_obj.organization.name == organization.name

    def test_with_invalid_arguments(self):
        path = self._get_path("organization", "get_organization_by_id")
        data = {"args": {"id": "invalid type"}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

        data = {"args": {"invalid": "invalid type"}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }
