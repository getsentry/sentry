from typing import Any
from unittest.mock import MagicMock, patch

from sentry.issues.action_log import (
    ActionType,
    publish_action,
    resolve_action_source,
)
from sentry.models.group import GroupStatus
from sentry.seer.endpoints.seer_rpc import SeerRpcSignatureAuthentication
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.types.group import GroupSubStatus, PriorityLevel


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

    def test_actor_type_derived_from_actor_id(self) -> None:
        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action(
                action=ActionType.RESOLVE,
                source="web",
                group_id=1,
                organization_id=2,
                project_id=3,
                actor_id=99,
            )
        assert logs.records[0].__dict__["actor_type"] == "user"

        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action(
                action=ActionType.RESOLVE,
                source="system",
                group_id=1,
                organization_id=2,
                project_id=3,
            )
        assert logs.records[0].__dict__["actor_type"] == "system"


PUBLISH_UPDATE = "sentry.api.helpers.group_index.update.publish_action"
PUBLISH_DETAILS = "sentry.issues.endpoints.group_details.publish_action"


class TestActionLogIntegration(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group(
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ONGOING,
            priority=PriorityLevel.MEDIUM,
        )
        self.url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/"

    @patch(PUBLISH_UPDATE)
    def test_resolve_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(self.url, data={"status": "resolved"}, format="json")
        assert response.status_code == 200
        mock_publish.assert_called_once()
        kwargs = mock_publish.call_args.kwargs
        assert kwargs["action"] == ActionType.RESOLVE
        assert kwargs["group_id"] == self.group.id
        assert kwargs["actor_id"] == self.user.id

    @patch(PUBLISH_UPDATE)
    def test_resolve_already_resolved_skips_action(self, mock_publish: MagicMock) -> None:
        self.group.update(status=GroupStatus.RESOLVED, substatus=None)
        response = self.client.put(self.url, data={"status": "resolved"}, format="json")
        assert response.status_code == 200
        mock_publish.assert_not_called()

    @patch(PUBLISH_UPDATE)
    def test_archive_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(
            self.url,
            data={"status": "ignored", "substatus": "archived_until_escalating"},
            format="json",
        )
        assert response.status_code == 200
        mock_publish.assert_called_once()
        assert mock_publish.call_args.kwargs["action"] == ActionType.ARCHIVE

    @patch(PUBLISH_UPDATE)
    def test_priority_change_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(self.url, data={"priority": "high"}, format="json")
        assert response.status_code == 200
        mock_publish.assert_called_once()
        kwargs = mock_publish.call_args.kwargs
        assert kwargs["action"] == ActionType.SET_PRIORITY
        assert kwargs["metadata"] == {"priority": "high"}

    @patch(PUBLISH_UPDATE)
    def test_priority_same_value_skips_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(self.url, data={"priority": "medium"}, format="json")
        assert response.status_code == 200
        mock_publish.assert_not_called()

    @patch(PUBLISH_UPDATE)
    def test_assign_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(
            self.url,
            data={"assignedTo": f"user:{self.user.id}"},
            format="json",
        )
        assert response.status_code == 200
        calls = [c for c in mock_publish.call_args_list if c.kwargs["action"] == ActionType.ASSIGN]
        assert len(calls) == 1
        assert calls[0].kwargs["group_id"] == self.group.id

    @patch(PUBLISH_UPDATE)
    def test_assign_same_user_skips_action(self, mock_publish: MagicMock) -> None:
        self.client.put(
            self.url,
            data={"assignedTo": f"user:{self.user.id}"},
            format="json",
        )
        mock_publish.reset_mock()
        self.client.put(
            self.url,
            data={"assignedTo": f"user:{self.user.id}"},
            format="json",
        )
        assign_calls = [
            c for c in mock_publish.call_args_list if c.kwargs["action"] == ActionType.ASSIGN
        ]
        assert len(assign_calls) == 0

    @patch(PUBLISH_UPDATE)
    def test_unassign_without_assignee_skips_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(self.url, data={"assignedTo": ""}, format="json")
        assert response.status_code == 200
        unassign_calls = [
            c for c in mock_publish.call_args_list if c.kwargs["action"] == ActionType.UNASSIGN
        ]
        assert len(unassign_calls) == 0

    @patch(PUBLISH_DETAILS)
    def test_view_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200
        mock_publish.assert_called_once()
        kwargs = mock_publish.call_args.kwargs
        assert kwargs["action"] == ActionType.VIEW
        assert kwargs["group_id"] == self.group.id

    @patch(PUBLISH_UPDATE)
    def test_mark_reviewed_only_for_groups_in_inbox(self, mock_publish: MagicMock) -> None:
        from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox

        group_in_inbox = self.create_group(
            status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        group_not_in_inbox = self.create_group(
            status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING
        )
        add_group_to_inbox(group_in_inbox, GroupInboxReason.NEW)
        assert GroupInbox.objects.filter(group=group_in_inbox).exists()
        assert not GroupInbox.objects.filter(group=group_not_in_inbox).exists()

        url = f"/api/0/organizations/{self.organization.slug}/issues/?id={group_in_inbox.id}&id={group_not_in_inbox.id}"
        response = self.client.put(
            url,
            data={"inbox": False},
            format="json",
        )
        assert response.status_code == 200
        reviewed_calls = [
            c for c in mock_publish.call_args_list if c.kwargs["action"] == ActionType.MARK_REVIEWED
        ]
        assert len(reviewed_calls) == 1
        assert reviewed_calls[0].kwargs["group_id"] == group_in_inbox.id

    @patch(PUBLISH_UPDATE)
    def test_archive_already_archived_skips_action(self, mock_publish: MagicMock) -> None:
        self.group.update(status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING)
        response = self.client.put(
            self.url,
            data={"status": "ignored", "substatus": "archived_until_escalating"},
            format="json",
        )
        assert response.status_code == 200
        archive_calls = [
            c for c in mock_publish.call_args_list if c.kwargs["action"] == ActionType.ARCHIVE
        ]
        assert len(archive_calls) == 0

    @patch(PUBLISH_UPDATE)
    def test_unresolve_already_unresolved_skips_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(self.url, data={"status": "unresolved"}, format="json")
        assert response.status_code == 200
        unresolve_calls = [
            c for c in mock_publish.call_args_list if c.kwargs["action"] == ActionType.UNRESOLVE
        ]
        assert len(unresolve_calls) == 0

    @patch(PUBLISH_UPDATE)
    def test_unassign_with_existing_assignee_emits_action(self, mock_publish: MagicMock) -> None:
        self.client.put(
            self.url,
            data={"assignedTo": f"user:{self.user.id}"},
            format="json",
        )
        mock_publish.reset_mock()
        response = self.client.put(self.url, data={"assignedTo": ""}, format="json")
        assert response.status_code == 200
        unassign_calls = [
            c for c in mock_publish.call_args_list if c.kwargs["action"] == ActionType.UNASSIGN
        ]
        assert len(unassign_calls) == 1
        assert unassign_calls[0].kwargs["group_id"] == self.group.id
