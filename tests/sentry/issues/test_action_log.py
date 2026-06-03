from typing import Any
from unittest.mock import MagicMock, patch

import sentry.api.helpers.group_index.update
import sentry.issues.endpoints.group_details
import sentry.issues.priority
import sentry.issues.status_change
import sentry.models.groupassignee
import sentry.models.groupinbox
from sentry.issues.action_log import (
    ActionContext,
    ActionType,
    action_context_scope,
    get_action_context,
    publish_action,
    resolve_action_source,
)
from sentry.models.group import GroupStatus
from sentry.seer.endpoints.seer_rpc import SeerRpcSignatureAuthentication
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.types.group import GroupSubStatus, PriorityLevel


def _make_request(
    *,
    meta: dict[str, str] | None = None,
    cookies: dict[str, str] | None = None,
    auth: Any = None,
    successful_authenticator: Any = None,
) -> MagicMock:
    request = MagicMock()
    request.META = meta or {}
    request.COOKIES = cookies or {}
    request.auth = auth if auth is not None else MagicMock()
    request.successful_authenticator = successful_authenticator
    return request


MCP_USER_AGENT = "sentry-mcp/0.18.0 (https://mcp.sentry.dev)"


class TestResolveActionSource(TestCase):
    def test_mcp_known_family(self) -> None:
        request = _make_request(
            meta={
                "HTTP_USER_AGENT": MCP_USER_AGENT,
                "HTTP_X_SENTRY_MCP_CLIENT_FAMILY": "claude-code",
            },
        )
        assert resolve_action_source(request) == "mcp:claude-code"

    def test_mcp_unrecognized_family_logs_and_falls_back(self) -> None:
        request = _make_request(
            meta={
                "HTTP_USER_AGENT": MCP_USER_AGENT,
                "HTTP_X_SENTRY_MCP_CLIENT_FAMILY": "some-new-editor",
            },
        )
        with self.assertLogs("sentry.issues.action_log", level="WARNING") as logs:
            assert resolve_action_source(request) == "mcp"
        assert any(r.__dict__.get("client_family") == "some-new-editor" for r in logs.records)

    def test_mcp_catchall_family_is_not_logged(self) -> None:
        request = _make_request(
            meta={
                "HTTP_USER_AGENT": MCP_USER_AGENT,
                "HTTP_X_SENTRY_MCP_CLIENT_FAMILY": "unknown",
            },
        )
        with self.assertNoLogs("sentry.issues.action_log", level="WARNING"):
            assert resolve_action_source(request) == "mcp"

    def test_mcp_without_family(self) -> None:
        request = _make_request(meta={"HTTP_USER_AGENT": MCP_USER_AGENT})
        assert resolve_action_source(request) == "mcp"

    def test_mcp_family_without_user_agent_is_not_mcp(self) -> None:
        # The MCP source is gated on the User-Agent, not the client-family header, so the
        # header alone does not flip the source to mcp.
        request = _make_request(meta={"HTTP_X_SENTRY_MCP_CLIENT_FAMILY": "claude-code"})
        assert resolve_action_source(request) == "api"

    def test_seer_referrer(self) -> None:
        request = _make_request(meta={"HTTP_X_SEER_REFERRER": "seer-explorer"})
        assert resolve_action_source(request) == "seer:explorer"

    def test_seer_rpc_authenticator(self) -> None:
        authenticator = MagicMock(spec=SeerRpcSignatureAuthentication)
        request = _make_request(successful_authenticator=authenticator)
        assert resolve_action_source(request) == "seer:explorer"

    def test_seer_referrer_takes_priority_over_rpc_auth(self) -> None:
        authenticator = MagicMock(spec=SeerRpcSignatureAuthentication)
        request = _make_request(
            meta={"HTTP_X_SEER_REFERRER": "seer-slack"},
            successful_authenticator=authenticator,
        )
        assert resolve_action_source(request) == "seer:slack"

    def test_frontend_request(self) -> None:
        request = _make_request(cookies={"session": "abc"})
        request.auth = None
        assert resolve_action_source(request) == "web"

    def test_sentry_cli(self) -> None:
        request = _make_request(meta={"HTTP_USER_AGENT": "sentry-cli/2.30.0"})
        assert resolve_action_source(request) == "sentry-cli"

    def test_generic_api_fallback(self) -> None:
        request = _make_request(meta={"HTTP_USER_AGENT": "python-requests/2.31.0"})
        assert resolve_action_source(request) == "api"


class TestActionContext(TestCase):
    def test_default_is_none(self) -> None:
        assert get_action_context() is None

    def test_scope_sets_and_resets(self) -> None:
        with action_context_scope(source="web", actor_id=42):
            ctx = get_action_context()
            assert ctx is not None
            assert ctx.source == "web"
            assert ctx.actor_id == 42
        assert get_action_context() is None

    def test_scope_without_actor(self) -> None:
        with action_context_scope(source="system", actor_id=None):
            ctx = get_action_context()
            assert ctx is not None
            assert ctx.source == "system"
            assert ctx.actor_id is None

    def test_nested_scopes(self) -> None:
        with action_context_scope(source="web", actor_id=1):
            with action_context_scope(source="api", actor_id=2):
                ctx = get_action_context()
                assert ctx == ActionContext(source="api", actor_id=2)
            ctx = get_action_context()
            assert ctx == ActionContext(source="web", actor_id=1)


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
        assert extra["actor_id"] == 4

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


class TestPublishActionFromContext(TestCase):
    def test_logs_error_and_uses_unknown_without_context(self) -> None:
        from sentry.issues.action_log import publish_action_from_context

        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action_from_context(
                action=ActionType.RESOLVE,
                group_id=1,
                organization_id=2,
                project_id=3,
            )
        error_records = [r for r in logs.records if r.levelname == "ERROR"]
        assert any("without ActionContext" in r.message for r in error_records)
        info_record = [r for r in logs.records if r.message == "issue.action_log"][0]
        assert info_record.__dict__["source"] == "unknown"


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

    @patch.object(
        sentry.api.helpers.group_index.update, "publish_action_from_context", autospec=True
    )
    def test_resolve_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(self.url, data={"status": "resolved"}, format="json")
        assert response.status_code == 200
        resolve_calls = [
            c for c in mock_publish.call_args_list if c.kwargs.get("action") == ActionType.RESOLVE
        ]
        assert len(resolve_calls) == 1
        assert resolve_calls[0].kwargs["group_id"] == self.group.id

    @patch.object(
        sentry.api.helpers.group_index.update, "publish_action_from_context", autospec=True
    )
    def test_resolve_already_resolved_skips(self, mock_publish: MagicMock) -> None:
        self.group.update(status=GroupStatus.RESOLVED, substatus=None)
        response = self.client.put(self.url, data={"status": "resolved"}, format="json")
        assert response.status_code == 200
        resolve_calls = [
            c for c in mock_publish.call_args_list if c.kwargs.get("action") == ActionType.RESOLVE
        ]
        assert len(resolve_calls) == 0

    @patch.object(sentry.issues.status_change, "publish_action_from_context", autospec=True)
    def test_archive_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(
            self.url,
            data={"status": "ignored", "substatus": "archived_until_escalating"},
            format="json",
        )
        assert response.status_code == 200
        mock_publish.assert_called_once()
        assert mock_publish.call_args.kwargs["action"] == ActionType.ARCHIVE

    @patch.object(sentry.issues.status_change, "publish_action_from_context", autospec=True)
    def test_archive_already_archived_skips(self, mock_publish: MagicMock) -> None:
        self.group.update(status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING)
        response = self.client.put(
            self.url,
            data={"status": "ignored", "substatus": "archived_until_escalating"},
            format="json",
        )
        assert response.status_code == 200
        mock_publish.assert_not_called()

    @patch.object(sentry.issues.priority, "publish_action_from_context", autospec=True)
    def test_priority_change_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(self.url, data={"priority": "high"}, format="json")
        assert response.status_code == 200
        mock_publish.assert_called_once()
        assert mock_publish.call_args.kwargs["action"] == ActionType.SET_PRIORITY

    @patch.object(sentry.issues.priority, "publish_action_from_context", autospec=True)
    def test_priority_same_value_skips(self, mock_publish: MagicMock) -> None:
        response = self.client.put(self.url, data={"priority": "medium"}, format="json")
        assert response.status_code == 200
        mock_publish.assert_not_called()

    @patch.object(sentry.models.groupassignee, "publish_action_from_context", autospec=True)
    def test_assign_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.put(
            self.url, data={"assignedTo": f"user:{self.user.id}"}, format="json"
        )
        assert response.status_code == 200
        mock_publish.assert_called_once()
        assert mock_publish.call_args.kwargs["action"] == ActionType.ASSIGN

    @patch.object(sentry.models.groupassignee, "publish_action_from_context", autospec=True)
    def test_assign_same_user_skips(self, mock_publish: MagicMock) -> None:
        self.client.put(self.url, data={"assignedTo": f"user:{self.user.id}"}, format="json")
        mock_publish.reset_mock()
        self.client.put(self.url, data={"assignedTo": f"user:{self.user.id}"}, format="json")
        mock_publish.assert_not_called()

    @patch.object(sentry.models.groupassignee, "publish_action_from_context", autospec=True)
    def test_unassign_emits_action(self, mock_publish: MagicMock) -> None:
        self.client.put(self.url, data={"assignedTo": f"user:{self.user.id}"}, format="json")
        mock_publish.reset_mock()
        response = self.client.put(self.url, data={"assignedTo": ""}, format="json")
        assert response.status_code == 200
        unassign_calls = [
            c for c in mock_publish.call_args_list if c.kwargs.get("action") == ActionType.UNASSIGN
        ]
        assert len(unassign_calls) == 1

    @patch.object(sentry.models.groupassignee, "publish_action_from_context", autospec=True)
    def test_unassign_without_assignee_skips(self, mock_publish: MagicMock) -> None:
        response = self.client.put(self.url, data={"assignedTo": ""}, format="json")
        assert response.status_code == 200
        mock_publish.assert_not_called()

    @patch.object(sentry.issues.endpoints.group_details, "publish_action", autospec=True)
    def test_view_emits_action(self, mock_publish: MagicMock) -> None:
        response = self.client.get(self.url, format="json")
        assert response.status_code == 200
        mock_publish.assert_called_once()
        assert mock_publish.call_args.kwargs["action"] == ActionType.VIEW

    @patch.object(sentry.models.groupinbox, "publish_action_from_context", autospec=True)
    def test_mark_reviewed_emits_for_inbox_groups(self, mock_publish: MagicMock) -> None:
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
        response = self.client.put(url, data={"inbox": False}, format="json")
        assert response.status_code == 200
        reviewed_calls = [
            c
            for c in mock_publish.call_args_list
            if c.kwargs.get("action") == ActionType.MARK_REVIEWED
        ]
        assert len(reviewed_calls) == 1
        assert reviewed_calls[0].kwargs["group_id"] == group_in_inbox.id

    @patch.object(sentry.api.helpers.group_index.update, "publish_action", autospec=True)
    def test_merge_emits_actions(self, mock_publish: MagicMock) -> None:
        group2 = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        url = f"/api/0/organizations/{self.organization.slug}/issues/?id={self.group.id}&id={group2.id}"
        response = self.client.put(url, data={"merge": 1}, format="json")
        assert response.status_code == 200
        merge_from = [
            c
            for c in mock_publish.call_args_list
            if c.kwargs.get("action") == ActionType.MERGE_FROM_OTHER
        ]
        merge_into = [
            c
            for c in mock_publish.call_args_list
            if c.kwargs.get("action") == ActionType.MERGE_INTO_OTHER
        ]
        assert len(merge_from) == 1
        assert len(merge_into) == 1
