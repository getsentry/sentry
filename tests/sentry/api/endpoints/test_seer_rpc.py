from typing import Any

import orjson
from django.test import override_settings
from django.urls import reverse
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey

from sentry.api.endpoints.seer_rpc import generate_request_signature
from sentry.testutils.cases import APITestCase


@override_settings(SEER_RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
class TestSeerRpc(APITestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(organization=self.org)

    @staticmethod
    def _get_path(method_name: str) -> str:
        return reverse(
            "sentry-api-0-seer-rpc-service",
            kwargs={"method_name": method_name},
        )

    def auth_header(self, path: str, data: dict | str) -> str:
        if isinstance(data, dict):
            data = orjson.dumps(data).decode()
        signature = generate_request_signature(path, data.encode())

        return f"rpcsignature {signature}"

    def test_invalid_endpoint(self):
        path = self._get_path("not_a_method")
        response = self.client.post(path)
        assert response.status_code == 403

    def test_404(self):
        path = self._get_path("get_organization_slug")
        data: dict[str, Any] = {"args": {"org_id": 1}, "meta": {}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 404

    def test_get_attribute_names(self):
        path = self._get_path("get_attribute_names")
        data: dict[str, Any] = {
            "args": {
                "org_id": self.org.id,
                "project_ids": [self.project.id],
                "stats_period": "24h",
            }
        }
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 200
        assert "fields" in response.data

    def test_get_attribute_values(self):
        path = self._get_path("get_attribute_values")
        data: dict[str, Any] = {
            "args": {
                "fields": [{"name": "test", "type": AttributeKey.Type.TYPE_STRING}],
                "org_id": self.org.id,
                "project_ids": [self.project.id],
                "stats_period": "24h",
            }
        }
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 200
        assert "values" in response.data
