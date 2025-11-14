import hashlib
import hmac
from typing import int, Any
from unittest.mock import patch

import orjson
import pytest
from django.urls import reverse
from rest_framework.exceptions import MethodNotAllowed

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import Feature


class TestCursorWebhook(APITestCase):
    endpoint = "sentry-extensions-cursor-webhook"

    def setUp(self):
        super().setUp()
        # Create a Cursor integration linked to this organization
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            name="Cursor Agent",
            external_id="cursor",
            metadata={
                "api_key": "test_api_key_123",
                "domain_name": "cursor.sh",
                "webhook_secret": "secret123",
            },
        )
        self.installation = self.integration.get_installation(organization_id=self.organization.id)

    def _url(self) -> str:
        return reverse(
            "sentry-extensions-cursor-webhook",
            kwargs={"organization_id": self.organization.id},
        )

    def _signed_headers(self, body: bytes, secret: str | None = None) -> dict[str, str]:
        used_secret = secret or self.integration.metadata["webhook_secret"]
        signature = hmac.new(used_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        return {"HTTP_X_WEBHOOK_SIGNATURE": f"sha256={signature}"}

    def _post_with_headers(self, body: bytes, headers: dict[str, str]):
        # mypy: The DRF APIClient stubs can misinterpret **extra headers as a positional arg.
        client: Any = self.client
        return client.post(self._url(), data=body, content_type="application/json", **headers)

    def _build_status_payload(
        self,
        *,
        id: str | None = "agent-1",
        status: str = "FINISHED",
        repo: str = "github.com/testorg/testrepo",
        ref: str | None = "main",
        pr_url: str | None = "https://github.com/testorg/testrepo/pull/1",
        agent_url: str | None = "https://cursor.sh/agents/1",
        summary: str | None = "All done",
    ) -> dict[str, Any]:
        return {
            "event": "statusChange",
            "id": id,
            "status": status,
            "source": {"repository": repo, "ref": ref},
            "target": {"prUrl": pr_url, "url": agent_url},
            "summary": summary,
        }

    @patch("sentry.integrations.cursor.webhooks.handler.update_coding_agent_state")
    def test_happy_path_finished(self, mock_update_state):
        payload = self._build_status_payload(status="FINISHED")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)

        with Feature({"organizations:seer-coding-agent-integrations": True}):
            response = self._post_with_headers(body, headers)

        assert response.status_code == 204
        # Validate call to update_coding_agent_state
        assert mock_update_state.call_count == 1
        args, kwargs = mock_update_state.call_args
        assert kwargs["agent_id"] == "agent-1"
        assert kwargs["status"].name == "COMPLETED"
        assert kwargs["agent_url"] == "https://cursor.sh/agents/1"
        result = kwargs["result"]
        assert result.repo_full_name == "testorg/testrepo"
        assert result.repo_provider == "github"
        assert result.pr_url == "https://github.com/testorg/testrepo/pull/1"

    def test_feature_flag_disabled(self):
        payload = self._build_status_payload(status="FINISHED")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)

        with Feature({"organizations:seer-coding-agent-integrations": False}):
            response = self._post_with_headers(body, headers)

        assert response.status_code == 404

    def test_invalid_method(self):
        with pytest.raises(MethodNotAllowed):
            self.client.get(self._url())

    def test_invalid_json(self):
        body = b"{bad json}"
        headers = self._signed_headers(body)
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            response = self._post_with_headers(body, headers)
        assert response.status_code == 400

    def test_missing_signature(self):
        payload = self._build_status_payload()
        body = orjson.dumps(payload)
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            response = self.client.post(self._url(), data=body, content_type="application/json")
        assert response.status_code == 403

    def test_invalid_signature(self):
        payload = self._build_status_payload()
        body = orjson.dumps(payload)
        headers = {"HTTP_X_WEBHOOK_SIGNATURE": "sha256=deadbeef"}
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            response = self._post_with_headers(body, headers)
        assert response.status_code == 403

    @patch(
        "sentry.integrations.cursor.webhooks.handler.CursorWebhookEndpoint._get_cursor_integration_secret",
        return_value=None,
    )
    def test_no_webhook_secret_set(self, _mock_secret):
        payload = self._build_status_payload()
        body = orjson.dumps(payload)
        # Provide any signature header so we hit secret lookup path
        headers = {"HTTP_X_WEBHOOK_SIGNATURE": "sha256=deadbeef"}
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            response = self._post_with_headers(body, headers)
        assert response.status_code == 403

    @patch("sentry.integrations.cursor.webhooks.handler.update_coding_agent_state")
    def test_error_status_maps_to_failed(self, mock_update_state):
        payload = self._build_status_payload(status="ERROR", pr_url=None)
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)

        with Feature({"organizations:seer-coding-agent-integrations": True}):
            response = self._post_with_headers(body, headers)
        assert response.status_code == 204

        args, kwargs = mock_update_state.call_args
        assert kwargs["status"].name == "FAILED"
        # pr_url should be None for failures
        assert kwargs["result"].pr_url is None

    @patch("sentry.integrations.cursor.webhooks.handler.update_coding_agent_state")
    def test_unknown_status_logs_and_defaults_to_failed(self, mock_update_state):
        payload = self._build_status_payload(status="WEIRD")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)

        with Feature({"organizations:seer-coding-agent-integrations": True}):
            response = self._post_with_headers(body, headers)
        assert response.status_code == 204
        args, kwargs = mock_update_state.call_args
        assert kwargs["status"].name == "FAILED"

    def test_missing_agent_id_or_status(self):
        # Missing id
        body = orjson.dumps(self._build_status_payload(id=None))
        headers = self._signed_headers(body)
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        # Missing status
        payload = self._build_status_payload()
        payload.pop("status")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204

    @patch("sentry.integrations.cursor.webhooks.handler.update_coding_agent_state")
    def test_repo_variants_and_validation(self, mock_update_state):
        # Missing repo
        payload = self._build_status_payload()
        payload["source"].pop("repository")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        mock_update_state.assert_not_called()

        # Non-github host
        payload = self._build_status_payload(repo="https://gitlab.com/testorg/testrepo")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        mock_update_state.assert_not_called()

        # Bad format path
        payload = self._build_status_payload(repo="github.com/not-a-valid-path")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        mock_update_state.assert_not_called()

        # No scheme but valid host should work
        payload = self._build_status_payload(repo="github.com/testorg/testrepo")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        assert mock_update_state.call_count == 1

        # Dotted repo name should be accepted
        mock_update_state.reset_mock()
        payload = self._build_status_payload(repo="github.com/testorg/test.repo")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        with Feature({"organizations:seer-coding-agent-integrations": True}):
            resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        assert mock_update_state.call_count == 1

    @patch("sentry.integrations.cursor.webhooks.handler.update_coding_agent_state")
    def test_signature_without_prefix(self, mock_update_state):
        payload = self._build_status_payload(status="FINISHED")
        body = orjson.dumps(payload)
        secret = self.integration.metadata["webhook_secret"]
        signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        headers = {"HTTP_X_WEBHOOK_SIGNATURE": signature}

        with Feature({"organizations:seer-coding-agent-integrations": True}):
            response = self._post_with_headers(body, headers)
        assert response.status_code == 204

    @patch("sentry.integrations.cursor.webhooks.handler.update_coding_agent_state")
    def test_seer_api_error_is_caught(self, mock_update_state):
        from sentry.seer.models import SeerApiError

        mock_update_state.side_effect = SeerApiError("boom", status=500)
        payload = self._build_status_payload(status="FINISHED")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)

        with Feature({"organizations:seer-coding-agent-integrations": True}):
            response = self._post_with_headers(body, headers)
        assert response.status_code == 204
        # Even with exception, endpoint must not raise
