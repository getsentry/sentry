from typing import Any

from django.test import override_settings
from django.urls import reverse

from sentry.api.endpoints.seer_rpc import generate_request_signature
from sentry.testutils.cases import APITestCase
from sentry.utils import json


@override_settings(SEER_RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
class TestSeerRpc(APITestCase):
    @staticmethod
    def _get_path(method_name: str) -> str:
        return reverse(
            "sentry-api-0-seer-rpc-service",
            kwargs={"method_name": method_name},
        )

    def auth_header(self, path: str, data: dict | str) -> str:
        if isinstance(data, dict):
            data = json.dumps(data)
        signature = generate_request_signature(path, data.encode("utf8"))

        return f"rpcsignature {signature}"

    def test_invalid_endpoint(self):
        path = self._get_path("not_a_method")
        response = self.client.post(path)
        assert response.status_code == 403

    def test_invalid_authentication(self):
        path = self._get_path("on_autofix_step_update")
        data: dict[str, Any] = {"args": {"issued_id": 1, "status": "", "steps": []}, "meta": {}}
        response = self.client.post(path, data=data, HTTP_AUTHORIZATION="rpcsignature trash")
        assert response.status_code == 401

    def test_404(self):
        path = self._get_path("get_autofix_state")
        data: dict[str, Any] = {"args": {"issue_id": 1}, "meta": {}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 404

    def test_step_state_management(self):
        group = self.create_group()

        path = self._get_path("get_autofix_state")
        data: dict[str, Any] = {"args": {"issue_id": group.id}, "meta": {}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 200
        assert response.json() == {}

        path = self._get_path("on_autofix_step_update")
        data = {
            "args": {"issue_id": group.id, "status": "thing", "steps": [1, 2, 3]},
            "meta": {},
        }
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 200

        path = self._get_path("get_autofix_state")
        data = {"args": {"issue_id": group.id}, "meta": {}}
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        assert response.status_code == 200
        assert response.json() == {"status": "thing", "steps": [1, 2, 3]}
