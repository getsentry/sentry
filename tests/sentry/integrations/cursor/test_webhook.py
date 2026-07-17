import hashlib
import hmac
from typing import Any
from unittest.mock import patch

import orjson
import pytest
from django.urls import reverse
from rest_framework.exceptions import MethodNotAllowed

from sentry.models.pullrequest import (
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.seer.autofix.coding_agent_handoffs import CodingAgentSyncResult
from sentry.testutils.cases import APITestCase


class TestCursorWebhook(APITestCase):
    endpoint = "sentry-extensions-cursor-webhook"

    def setUp(self) -> None:
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
        branch_name: str | None = "cursor/fix-bug-1234",
        agent_url: str | None = "https://cursor.sh/agents/1",
        summary: str | None = "All done",
    ) -> dict[str, Any]:
        return {
            "event": "statusChange",
            "id": id,
            "status": status,
            "source": {"repository": repo, "ref": ref},
            "target": {"prUrl": pr_url, "branchName": branch_name, "url": agent_url},
            "summary": summary,
        }

    def _skip_log_extra(self, mock_logger: Any) -> dict[str, Any]:
        calls = [
            c
            for c in mock_logger.info.call_args_list
            if c.args and c.args[0] == "cursor_webhook.attribution_skipped"
        ]
        assert len(calls) == 1
        return calls[0].kwargs["extra"]

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_happy_path_finished(self, mock_update_state):
        mock_update_state.return_value = CodingAgentSyncResult(
            known_to_seer=True, run_id=None, group_id=None
        )
        payload = self._build_status_payload(status="FINISHED")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)

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
        assert result.branch_name == "cursor/fix-bug-1234"

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_branch_name_absent_is_none(self, mock_update_state):
        payload = self._build_status_payload(status="FINISHED", branch_name=None)
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)

        response = self._post_with_headers(body, headers)

        assert response.status_code == 204
        assert mock_update_state.call_args[1]["result"].branch_name is None

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_finished_records_pr_attribution(self, mock_update_state):
        mock_update_state.return_value = CodingAgentSyncResult(
            known_to_seer=True, run_id=123, group_id=456
        )
        repo = self.create_repo(
            self.project, name="testorg/testrepo", provider="integrations:github"
        )
        body = orjson.dumps(self._build_status_payload(status="FINISHED"))
        headers = self._signed_headers(body)

        with self.feature("organizations:pr-metrics-attribution"):
            response = self._post_with_headers(body, headers)

        assert response.status_code == 204
        attribution = PullRequestAttribution.objects.get()
        assert attribution.signal_type == PullRequestAttributionSignalType.SEER_DELEGATED_CURSOR
        assert attribution.source == PullRequestAttributionSource.SEER_DATA
        assert attribution.pull_request.repository_id == repo.id
        assert attribution.pull_request.key == "1"
        # run_id/group_ids are resolved locally (via SeerRunCodingAgentHandoff ->
        # SeerRun -> SeerAgentRun) rather than left sparse as they were before.
        assert attribution.signal_details is not None
        assert attribution.signal_details["run_id"] == 123
        assert attribution.signal_details["group_ids"] == [456]

    @patch("sentry.seer.autofix.coding_agent_handoffs.update_coding_agent_state")
    def test_finished_updates_seer_run_coding_agent_handoff(self, mock_update_state):
        # Mocked one level deeper than the other tests in this file (Seer's own RPC call,
        # rather than sync_coding_agent_status itself) so the real Sentry-side DB write
        # inside sync_coding_agent_status still runs and can be asserted on here.
        mock_update_state.return_value = True
        seer_run = self.create_seer_run(self.organization, seer_run_state_id=123)
        handoff = self.create_seer_run_coding_agent_handoff(
            seer_run, agent_id="agent-1", provider="cursor_background_agent"
        )
        body = orjson.dumps(self._build_status_payload(status="FINISHED"))
        headers = self._signed_headers(body)

        response = self._post_with_headers(body, headers)

        assert response.status_code == 204
        handoff.refresh_from_db()
        assert handoff.status == "completed"

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_unknown_agent_records_no_attribution(self, mock_update_state):
        # Seer returns False (e.g. 404) for agent_ids it doesn't know about —
        # these are Cursor sessions not delegated by Seer, and must not be attributed.
        mock_update_state.return_value = CodingAgentSyncResult(
            known_to_seer=False, run_id=None, group_id=None
        )
        self.create_repo(self.project, name="testorg/testrepo", provider="integrations:github")
        body = orjson.dumps(self._build_status_payload(status="FINISHED"))
        headers = self._signed_headers(body)

        with self.feature("organizations:pr-metrics-attribution"):
            response = self._post_with_headers(body, headers)

        assert response.status_code == 204
        assert not PullRequestAttribution.objects.exists()

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_error_status_records_no_attribution(self, mock_update_state):
        self.create_repo(self.project, name="testorg/testrepo", provider="integrations:github")
        body = orjson.dumps(self._build_status_payload(status="ERROR", pr_url=None))
        headers = self._signed_headers(body)

        with self.feature("organizations:pr-metrics-attribution"):
            response = self._post_with_headers(body, headers)

        assert response.status_code == 204
        assert not PullRequestAttribution.objects.exists()

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_finished_without_pr_url_records_no_attribution(self, mock_update_state):
        # Isolates the ``and pr_url`` half of the attribution guard: a completed
        # agent that produced no PR must not be attributed.
        self.create_repo(self.project, name="testorg/testrepo", provider="integrations:github")
        body = orjson.dumps(self._build_status_payload(status="FINISHED", pr_url=None))
        headers = self._signed_headers(body)

        with self.feature("organizations:pr-metrics-attribution"):
            response = self._post_with_headers(body, headers)

        assert response.status_code == 204
        assert not PullRequestAttribution.objects.exists()

    @patch("sentry.integrations.cursor.webhooks.handler.logger")
    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_completed_without_attribution_logs_skip_reason(self, mock_update_state, mock_logger):
        # A completed agent that we don't attribute must leave a breadcrumb naming the
        # gate that blocked it, otherwise a missing SEER_DELEGATED_CURSOR row is invisible.
        self.create_repo(self.project, name="testorg/testrepo", provider="integrations:github")

        # Seer didn't recognize the agent: known_to_seer=False, but a PR is present.
        mock_update_state.return_value = CodingAgentSyncResult(
            known_to_seer=False, run_id=None, group_id=None
        )
        body = orjson.dumps(self._build_status_payload(status="FINISHED"))
        with self.feature("organizations:pr-metrics-attribution"):
            assert self._post_with_headers(body, self._signed_headers(body)).status_code == 204
        extra = self._skip_log_extra(mock_logger)
        assert extra["known_to_seer"] is False
        assert extra["has_pr_url"] is True

        # Seer knew the agent but there's no PR to attribute: known_to_seer=True, pr_url absent.
        mock_logger.reset_mock()
        mock_update_state.return_value = CodingAgentSyncResult(
            known_to_seer=True, run_id=None, group_id=None
        )
        body = orjson.dumps(self._build_status_payload(status="FINISHED", pr_url=None))
        with self.feature("organizations:pr-metrics-attribution"):
            assert self._post_with_headers(body, self._signed_headers(body)).status_code == 204
        extra = self._skip_log_extra(mock_logger)
        assert extra["known_to_seer"] is True
        assert extra["has_pr_url"] is False

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_finished_records_no_attribution_when_flag_disabled(self, mock_update_state):
        self.create_repo(self.project, name="testorg/testrepo", provider="integrations:github")
        body = orjson.dumps(self._build_status_payload(status="FINISHED"))
        headers = self._signed_headers(body)

        with self.feature({"organizations:pr-metrics-attribution": False}):
            response = self._post_with_headers(body, headers)

        assert response.status_code == 204
        assert not PullRequestAttribution.objects.exists()

    def test_invalid_method(self) -> None:
        with pytest.raises(MethodNotAllowed):
            self.client.get(self._url())

    def test_invalid_json(self) -> None:
        body = b"{bad json}"
        headers = self._signed_headers(body)
        response = self._post_with_headers(body, headers)
        assert response.status_code == 400

    def test_missing_signature(self) -> None:
        payload = self._build_status_payload()
        body = orjson.dumps(payload)
        response = self.client.post(self._url(), data=body, content_type="application/json")
        assert response.status_code == 403

    def test_invalid_signature(self) -> None:
        payload = self._build_status_payload()
        body = orjson.dumps(payload)
        headers = {"HTTP_X_WEBHOOK_SIGNATURE": "sha256=deadbeef"}
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
        response = self._post_with_headers(body, headers)
        assert response.status_code == 403

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_error_status_maps_to_failed(self, mock_update_state):
        payload = self._build_status_payload(status="ERROR", pr_url=None)
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)

        response = self._post_with_headers(body, headers)
        assert response.status_code == 204

        args, kwargs = mock_update_state.call_args
        assert kwargs["status"].name == "FAILED"
        # pr_url should be None for failures
        assert kwargs["result"].pr_url is None

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_unknown_status_logs_and_defaults_to_failed(self, mock_update_state):
        payload = self._build_status_payload(status="WEIRD")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)

        response = self._post_with_headers(body, headers)
        assert response.status_code == 204
        args, kwargs = mock_update_state.call_args
        assert kwargs["status"].name == "FAILED"

    def test_missing_agent_id_or_status(self) -> None:
        # Missing id
        body = orjson.dumps(self._build_status_payload(id=None))
        headers = self._signed_headers(body)
        resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        # Missing status
        payload = self._build_status_payload()
        payload.pop("status")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_repo_variants_and_validation(self, mock_update_state):
        # Missing repo
        payload = self._build_status_payload()
        payload["source"].pop("repository")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        mock_update_state.assert_not_called()

        # Non-github host
        payload = self._build_status_payload(repo="https://gitlab.com/testorg/testrepo")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        mock_update_state.assert_not_called()

        # Bad format path
        payload = self._build_status_payload(repo="github.com/not-a-valid-path")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        mock_update_state.assert_not_called()

        # No scheme but valid host should work
        payload = self._build_status_payload(repo="github.com/testorg/testrepo")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        assert mock_update_state.call_count == 1

        # Dotted repo name should be accepted
        mock_update_state.reset_mock()
        payload = self._build_status_payload(repo="github.com/testorg/test.repo")
        body = orjson.dumps(payload)
        headers = self._signed_headers(body)
        resp = self._post_with_headers(body, headers)
        assert resp.status_code == 204
        assert mock_update_state.call_count == 1

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_invalid_pr_url_is_dropped(self, mock_update_state):
        # Non-https scheme must be rejected — the pr_url is nulled out so no attribution fires.
        mock_update_state.return_value = CodingAgentSyncResult(
            known_to_seer=True, run_id=None, group_id=None
        )
        self.create_repo(self.project, name="testorg/testrepo", provider="integrations:github")

        for bad_url in [
            "not-a-url-at-all",
            "http://github.com/testorg/testrepo/pull/1",
            "https://github.com/otherorg/otherrepo/pull/1",
            "https://github.com/testorg/testrepo/tree/main",
        ]:
            mock_update_state.reset_mock()
            body = orjson.dumps(self._build_status_payload(status="FINISHED", pr_url=bad_url))
            headers = self._signed_headers(body)

            with self.feature("organizations:pr-metrics-attribution"):
                response = self._post_with_headers(body, headers)

            assert response.status_code == 204, bad_url
            # The Seer state update still happens, but with no pr_url.
            assert mock_update_state.call_count == 1, bad_url
            assert mock_update_state.call_args[1]["result"].pr_url is None, bad_url
            assert not PullRequestAttribution.objects.exists(), bad_url

    @patch("sentry.integrations.cursor.webhooks.handler.sync_coding_agent_status")
    def test_signature_without_prefix(self, mock_update_state):
        payload = self._build_status_payload(status="FINISHED")
        body = orjson.dumps(payload)
        secret = self.integration.metadata["webhook_secret"]
        signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        headers = {"HTTP_X_WEBHOOK_SIGNATURE": signature}

        response = self._post_with_headers(body, headers)
        assert response.status_code == 204
