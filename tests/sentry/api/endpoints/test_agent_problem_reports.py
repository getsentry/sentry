from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry_sdk.envelope import Envelope

from sentry.agent_reports.submit import _capture_feedback_envelope
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test

_EVENT_ID = "a" * 32


def _payload(**overrides: object) -> dict[str, object]:
    body: dict[str, object] = {
        "area": "mcp",
        "summary": "search_issues rejects a documented query",
        "expected": "The documented query is accepted.",
        "observed": "The API returns 400 invalid query.",
        "toolName": "search_issues",
        "apiEndpoint": "GET /api/0/organizations/{organization_slug}/issues/",
        "documentationUrl": "https://docs.sentry.io/api/",
        "requestId": "req-1",
        "eventId": _EVENT_ID,
        "reproductionSteps": ["Call search_issues with the documented query"],
        "additionalContext": "Compared with the OpenAPI example.",
    }
    body.update(overrides)
    return body


@control_silo_test
class AgentProblemReportsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-agent-problem-reports"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_requires_authentication(self) -> None:
        self.client.logout()
        response = self.get_response(**_payload())
        assert response.status_code == 401

    @patch("sentry.agent_reports.submit._capture_feedback_envelope", return_value=True)
    def test_submits_user_feedback(self, capture_envelope: MagicMock) -> None:
        response = self.get_success_response(
            **_payload(
                summary="token=sntrys_secretvalue is rejected",
                observed="Email user@example.com was copied into the error.",
            ),
            extra_headers={"HTTP_USER_AGENT": "sentry-mcp/1.2.3"},
            status_code=201,
        )

        assert response.data["delivered"] is True
        assert len(response.data["id"]) == 32
        capture_envelope.assert_called_once()
        envelope = capture_envelope.call_args.args[0]
        item = next(iter(envelope))
        payload = item.payload.json
        message = payload["contexts"]["feedback"]["message"]

        assert payload["type"] == "feedback"
        assert payload["event_id"] == response.data["id"]
        assert item.type == "feedback"
        assert "sntrys_secretvalue" not in message
        assert "[redacted]" in message
        assert "user@example.com" not in message
        assert payload["contexts"]["feedback"]["associated_event_id"] == _EVENT_ID
        assert payload["contexts"]["feedback"]["contact_email"] == self.user.email
        assert payload["tags"] == {
            "feedback.source": "agent-problem-report",
            "feedback.area": "mcp",
            "feedback.owner": "agent-interfaces",
        }
        assert payload["contexts"]["agent_report"]["tool_name"] == "search_issues"
        assert payload["contexts"]["agent_report"]["user_agent"] == "sentry-mcp/1.2.3"
        assert payload["user"]["id"] == str(self.user.id)

    @patch("sentry.agent_reports.submit._capture_feedback_envelope", return_value=False)
    def test_reports_when_sdk_is_inactive(self, capture_envelope: MagicMock) -> None:
        response = self.get_success_response(**_payload(), status_code=201)

        capture_envelope.assert_called_once()

        assert response.data["delivered"] is False
        assert len(response.data["id"]) == 32

    def test_rejects_invalid_event_id(self) -> None:
        response = self.get_response(**_payload(eventId="not-an-event"))
        assert response.status_code == 400
        assert "eventId" in response.data

    def test_rejects_documentation_url_with_credentials(self) -> None:
        response = self.get_response(
            **_payload(documentationUrl="https://user:secret@docs.sentry.io/api/")
        )
        assert response.status_code == 400
        assert "documentationUrl" in response.data

    def test_rejects_unknown_area(self) -> None:
        response = self.get_response(**_payload(area="billing"))
        assert response.status_code == 400
        assert "area" in response.data

    @patch("sentry.agent_reports.submit._capture_feedback_envelope", return_value=True)
    def test_truncates_long_reports(self, capture_envelope: MagicMock) -> None:
        self.get_success_response(
            **_payload(
                expected="e" * 2000,
                observed="o" * 2000,
                additionalContext="c" * 2000,
            ),
            status_code=201,
        )

        envelope = capture_envelope.call_args.args[0]
        message = next(iter(envelope)).payload.json["contexts"]["feedback"]["message"]
        assert len(message) <= 4000
        assert message.endswith("[truncated]")

    def test_disabled_option_hides_endpoint(self) -> None:
        with self.options({"agent.problem-reports.enabled": False}):
            response = self.get_response(**_payload())
        assert response.status_code == 404


def test_capture_sends_when_sdk_is_active() -> None:
    client = MagicMock()
    client.is_active.return_value = True
    envelope = Envelope()

    with patch("sentry.agent_reports.submit.sentry_sdk.get_client", return_value=client):
        assert _capture_feedback_envelope(envelope) is True

    client.transport.capture_envelope.assert_called_once_with(envelope)


def test_capture_skips_inactive_sdk() -> None:
    client = MagicMock()
    client.transport = None
    client.is_active.return_value = False

    with patch("sentry.agent_reports.submit.sentry_sdk.get_client", return_value=client):
        assert _capture_feedback_envelope(Envelope()) is False
