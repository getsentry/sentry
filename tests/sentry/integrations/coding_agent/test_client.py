from unittest.mock import MagicMock, patch

from requests import PreparedRequest, Request

from sentry.integrations.coding_agent.client import CodingAgentClient
from sentry.integrations.coding_agent.models import CodingAgentLaunchRequest
from sentry.seer.autofix.utils import CodingAgentState
from sentry.testutils.cases import TestCase


class _StubCodingAgentClient(CodingAgentClient):
    """Minimal concrete subclass for testing the base class behaviour."""

    integration_name = "stub_agent"
    base_url = "https://api.example.com"

    def launch(self, *, webhook_url: str, request: CodingAgentLaunchRequest) -> CodingAgentState:
        raise NotImplementedError


class CodingAgentClientApiKeyTest(TestCase):
    def test_finalize_request_adds_x_api_key_header(self) -> None:
        client = _StubCodingAgentClient(api_key="sk-ant-test-key-123")
        req = Request(method="GET", url="https://api.example.com/v1/agents/abc")
        prepared = req.prepare()

        result = client.finalize_request(prepared)

        assert result.headers["x-api-key"] == "sk-ant-test-key-123"

    def test_finalize_request_skips_header_when_no_api_key(self) -> None:
        client = _StubCodingAgentClient()
        req = Request(method="GET", url="https://api.example.com/v1/agents/abc")
        prepared = req.prepare()

        result = client.finalize_request(prepared)

        assert "x-api-key" not in result.headers

    def test_finalize_request_preserves_existing_headers(self) -> None:
        client = _StubCodingAgentClient(api_key="sk-ant-test-key-456")
        req = Request(
            method="POST",
            url="https://api.example.com/v1/sessions",
            headers={"content-type": "application/json", "anthropic-version": "2024-01-01"},
        )
        prepared = req.prepare()

        result = client.finalize_request(prepared)

        assert result.headers["x-api-key"] == "sk-ant-test-key-456"
        assert result.headers["content-type"] == "application/json"
        assert result.headers["anthropic-version"] == "2024-01-01"

    @patch.object(_StubCodingAgentClient, "_do_send")
    def test_request_sends_x_api_key_header(self, mock_do_send) -> None:
        """The x-api-key header reaches the network layer via _request."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}
        mock_do_send.return_value = mock_response

        client = _StubCodingAgentClient(api_key="sk-ant-integration-key")
        client.get("/v1/agents/test-agent-id")

        sent_request: PreparedRequest = mock_do_send.call_args[0][1]
        assert sent_request.headers["x-api-key"] == "sk-ant-integration-key"
