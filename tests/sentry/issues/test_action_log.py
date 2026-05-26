from typing import Any
from unittest.mock import MagicMock, patch

from sentry.issues.action_log import (
    ActionType,
    publish_action,
    resolve_action_source,
)
from sentry.seer.endpoints.seer_rpc import SeerRpcSignatureAuthentication
from sentry.testutils.cases import TestCase


def _make_request(
    *,
    application_id: int | None = None,
    meta: dict[str, str] | None = None,
    cookies: dict[str, str] | None = None,
    auth: Any = None,
    successful_authenticator: Any = None,
) -> MagicMock:
    request = MagicMock()
    request.META = meta or {}
    request.COOKIES = cookies or {}

    if auth is not None:
        request.auth = auth
    else:
        token = MagicMock()
        token.application_id = application_id
        request.auth = token

    request.successful_authenticator = successful_authenticator
    return request


class TestResolveActionSource(TestCase):
    def test_no_request_returns_system(self) -> None:
        assert resolve_action_source(None) == "system"

    @patch("sentry.issues.action_log._get_mcp_application_id", return_value=42)
    def test_mcp_known_client_claude_code(self, mock_get_id: MagicMock) -> None:
        request = _make_request(
            application_id=42,
            meta={"HTTP_X_SENTRY_MCP_CLIENT_NAME": "Claude Code"},
        )
        assert resolve_action_source(request) == "mcp:claude-code"

    @patch("sentry.issues.action_log._get_mcp_application_id", return_value=42)
    def test_mcp_known_client_cursor(self, mock_get_id: MagicMock) -> None:
        request = _make_request(
            application_id=42,
            meta={"HTTP_X_SENTRY_MCP_CLIENT_NAME": "cursor"},
        )
        assert resolve_action_source(request) == "mcp:cursor"

    @patch("sentry.issues.action_log._get_mcp_application_id", return_value=42)
    def test_mcp_unknown_client(self, mock_get_id: MagicMock) -> None:
        request = _make_request(
            application_id=42,
            meta={"HTTP_X_SENTRY_MCP_CLIENT_NAME": "some-new-editor"},
        )
        assert resolve_action_source(request) == "mcp"

    @patch("sentry.issues.action_log._get_mcp_application_id", return_value=42)
    def test_mcp_no_client_header(self, mock_get_id: MagicMock) -> None:
        request = _make_request(application_id=42)
        assert resolve_action_source(request) == "mcp"

    @patch("sentry.issues.action_log._get_mcp_application_id", return_value=42)
    def test_mcp_header_ignored_when_wrong_application(self, mock_get_id: MagicMock) -> None:
        request = _make_request(
            application_id=999,
            meta={"HTTP_X_SENTRY_MCP_CLIENT_NAME": "Claude Code"},
        )
        assert resolve_action_source(request) == "api"

    def test_seer_referrer_explorer(self) -> None:
        request = _make_request(
            meta={"HTTP_X_SEER_REFERRER": "seer-explorer"},
        )
        assert resolve_action_source(request) == "seer:explorer"

    def test_seer_referrer_slack(self) -> None:
        request = _make_request(
            meta={"HTTP_X_SEER_REFERRER": "seer-slack-bot"},
        )
        assert resolve_action_source(request) == "seer:slack"

    def test_seer_rpc_authenticator(self) -> None:
        authenticator = MagicMock(spec=SeerRpcSignatureAuthentication)
        request = _make_request(successful_authenticator=authenticator)
        assert resolve_action_source(request) == "seer:explorer"

    def test_frontend_request(self) -> None:
        request = _make_request(cookies={"session": "abc"})
        request.auth = None
        assert resolve_action_source(request) == "web"

    def test_sentry_cli(self) -> None:
        request = _make_request(
            meta={"HTTP_USER_AGENT": "sentry-cli/2.30.0"},
        )
        assert resolve_action_source(request) == "sentry-cli"

    def test_generic_api_fallback(self) -> None:
        request = _make_request(
            meta={"HTTP_USER_AGENT": "python-requests/2.31.0"},
        )
        assert resolve_action_source(request) == "api"

    def test_empty_request_falls_through_to_api(self) -> None:
        request = _make_request()
        assert resolve_action_source(request) == "api"


class TestPublishAction(TestCase):
    def test_emits_structured_log(self) -> None:
        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action(
                action=ActionType.RESOLVE,
                source="mcp:claude-code",
                group_id=1,
                organization_id=2,
                project_id=3,
                actor_id=4,
            )
        assert len(logs.records) == 1
        record = logs.records[0]
        extra = record.__dict__
        assert record.message == "issue.action_log"
        assert extra["action"] == "resolve"
        assert extra["source"] == "mcp:claude-code"
        assert extra["group_id"] == 1
        assert extra["organization_id"] == 2
        assert extra["project_id"] == 3
        assert extra["actor_id"] == 4

    def test_emits_without_optional_fields(self) -> None:
        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action(
                action=ActionType.VIEW,
                source="web",
                group_id=10,
                organization_id=20,
                project_id=30,
            )
        extra = logs.records[0].__dict__
        assert extra["actor_id"] is None
        assert extra["metadata"] == {}
