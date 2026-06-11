from typing import Any
from unittest.mock import MagicMock, patch

import pytest

import sentry.api.helpers.group_index.update
import sentry.issues.endpoints.group_details
import sentry.issues.endpoints.group_integration_details
import sentry.issues.priority
import sentry.issues.status_change
import sentry.models.group
import sentry.models.groupassignee
import sentry.models.groupinbox
from sentry.issues.action_log import (
    SYSTEM_ACTOR,
    ActionContext,
    DuplicateActionError,
    GroupActionActor,
    action_context_scope,
    get_action_context,
    publish_action,
    resolve_action_source,
    sanitize_mcp_client_family,
)
from sentry.issues.action_log.base import ActionSource
from sentry.issues.action_log.types import (
    ArchiveAction,
    AssignAction,
    CreateExternalIssueAction,
    GroupActionType,
    GroupActorType,
    LinkExternalIssueAction,
    MarkReviewedAction,
    MergeFromOtherAction,
    MergeIntoOtherAction,
    ResolveAction,
    SetPriorityAction,
    UnassignAction,
    UnlinkExternalIssueAction,
    ViewAction,
)
from sentry.issues.groupactionlogentry import GroupActionLogEntry
from sentry.models.group import Group, GroupStatus
from sentry.seer.endpoints.seer_rpc import SeerRpcSignatureAuthentication
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.types.activity import ActivityType
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


class TestSanitizeMcpClientFamily(TestCase):
    def test_known_family(self) -> None:
        assert sanitize_mcp_client_family("claude-code") == "claude-code"
        assert sanitize_mcp_client_family("cursor") == "cursor"
        assert sanitize_mcp_client_family("copilot") == "copilot"

    def test_strips_whitespace_and_lowercases(self) -> None:
        assert sanitize_mcp_client_family("  Claude-Code  ") == "claude-code"
        assert sanitize_mcp_client_family("CURSOR") == "cursor"

    def test_none_returns_unknown(self) -> None:
        assert sanitize_mcp_client_family(None) == "unknown"

    def test_empty_string_returns_unknown(self) -> None:
        assert sanitize_mcp_client_family("") == "unknown"

    def test_catchall_returns_unknown(self) -> None:
        assert sanitize_mcp_client_family("unknown") == "unknown"
        assert sanitize_mcp_client_family("other") == "unknown"

    def test_unrecognized_logs_warning_and_returns_unknown(self) -> None:
        with self.assertLogs("sentry.issues.action_log", level="WARNING") as logs:
            result = sanitize_mcp_client_family("some-new-editor")
        assert result == "unknown"
        assert any(getattr(r, "client_family", None) == "some-new-editor" for r in logs.records)

    def test_catchall_does_not_log_warning(self) -> None:
        with self.assertNoLogs("sentry.issues.action_log", level="WARNING"):
            sanitize_mcp_client_family("other")
            sanitize_mcp_client_family("unknown")


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
        assert any(getattr(r, "client_family", None) == "some-new-editor" for r in logs.records)

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
        actor = GroupActionActor.user(42)
        with action_context_scope(source="web", actor=actor):
            ctx = get_action_context()
            assert ctx is not None
            assert ctx.source == "web"
            assert ctx.actor == actor
        assert get_action_context() is None

    def test_scope_without_actor(self) -> None:
        with action_context_scope(source="system", actor=SYSTEM_ACTOR):
            ctx = get_action_context()
            assert ctx is not None
            assert ctx.source == "system"
            assert ctx.actor == SYSTEM_ACTOR

    def test_nested_scopes(self) -> None:
        actor1 = GroupActionActor.user(1)
        actor2 = GroupActionActor.user(2)
        with action_context_scope(source="web", actor=actor1):
            with action_context_scope(source="api", actor=actor2):
                ctx = get_action_context()
                assert ctx == ActionContext(source="api", actor=actor2)
            ctx = get_action_context()
            assert ctx == ActionContext(source="web", actor=actor1)


class TestPublishAction(TestCase):
    def test_emits_structured_log(self) -> None:
        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action(
                ResolveAction(),
                source="mcp:claude-code",
                group_id=1,
                organization_id=2,
                project_id=3,
                actor=GroupActionActor.user(4),
            )
        assert len(logs.records) == 1
        record = logs.records[0]
        assert record.message == "group.action_log"
        assert getattr(record, "action") == "resolve"
        assert getattr(record, "source") == "mcp:claude-code"
        assert getattr(record, "actor_id") == "4"

    def test_actor_type_derived_from_actor(self) -> None:
        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action(
                ResolveAction(),
                source="web",
                group_id=1,
                organization_id=2,
                project_id=3,
                actor=GroupActionActor.user(99),
            )
        assert getattr(logs.records[0], "actor_type") == "user"

        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action(
                ResolveAction(),
                source="system",
                group_id=1,
                organization_id=2,
                project_id=3,
            )
        assert getattr(logs.records[0], "actor_type") == "system"


class TestPublishActionFromContext(TestCase):
    def test_logs_error_and_uses_unknown_without_context(self) -> None:
        from sentry.issues.action_log import publish_action_from_context

        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action_from_context(
                ResolveAction(),
                group_id=1,
                organization_id=2,
                project_id=3,
            )
        error_records = [r for r in logs.records if r.levelname == "ERROR"]
        assert any("without ActionContext" in r.message for r in error_records)
        info_record = [r for r in logs.records if r.message == "group.action_log"][0]
        assert getattr(info_record, "source") == "unknown"


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
            c
            for c in mock_publish.call_args_list
            if c.args[0].get_type() == GroupActionType.RESOLVE
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
            c
            for c in mock_publish.call_args_list
            if c.args[0].get_type() == GroupActionType.RESOLVE
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
        assert isinstance(mock_publish.call_args.args[0], ArchiveAction)

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
        assert isinstance(mock_publish.call_args.args[0], SetPriorityAction)

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
        assert isinstance(mock_publish.call_args.args[0], AssignAction)

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
            c for c in mock_publish.call_args_list if isinstance(c.args[0], UnassignAction)
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
        assert isinstance(mock_publish.call_args.args[0], ViewAction)

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
            c for c in mock_publish.call_args_list if isinstance(c.args[0], MarkReviewedAction)
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
            c for c in mock_publish.call_args_list if isinstance(c.args[0], MergeFromOtherAction)
        ]
        merge_into = [
            c for c in mock_publish.call_args_list if isinstance(c.args[0], MergeIntoOtherAction)
        ]
        assert len(merge_from) == 1
        assert len(merge_into) == 1


class TestUpdateGroupStatusActionLog(APITestCase, SnubaTestCase):
    def test_resolve_emits_action_with_context_source(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            with action_context_scope(
                source=ActionSource.SLACK, actor=GroupActionActor.user(self.user.id)
            ):
                Group.objects.update_group_status(
                    groups=[group],
                    status=GroupStatus.RESOLVED,
                    substatus=None,
                    activity_type=ActivityType.SET_RESOLVED,
                )
        records = [r for r in logs.records if r.message == "group.action_log"]
        assert len(records) == 1
        assert getattr(records[0], "action") == "resolve"
        assert getattr(records[0], "source") == ActionSource.SLACK
        assert getattr(records[0], "group_id") == str(group.id)
        assert getattr(records[0], "actor_id") == str(self.user.id)

    def test_ignore_emits_archive_action(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
                Group.objects.update_group_status(
                    groups=[group],
                    status=GroupStatus.IGNORED,
                    substatus=GroupSubStatus.UNTIL_ESCALATING,
                    activity_type=ActivityType.SET_IGNORED,
                )
        records = [r for r in logs.records if r.message == "group.action_log"]
        assert len(records) == 1
        assert getattr(records[0], "action") == "archive"
        assert getattr(records[0], "source") == ActionSource.SYSTEM

    @patch.object(sentry.models.group, "publish_action_from_context", autospec=True)
    def test_substatus_only_transition_emits_no_action(self, mock_publish: MagicMock) -> None:
        # AUTO_SET_ONGOING moves a group NEW -> ONGOING but it stays UNRESOLVED; that
        # substatus-only change must not be logged as an unresolve.
        group = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW)
        with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
            Group.objects.update_group_status(
                groups=[group],
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.ONGOING,
                activity_type=ActivityType.AUTO_SET_ONGOING,
                from_substatus=GroupSubStatus.NEW,
            )
        assert mock_publish.call_count == 0


class TestExternalIssueLinkingActionLog(APITestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.group = self.create_group(
            status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING
        )
        self.integration = self.create_integration(
            organization=self.organization,
            provider="example",
            name="Example",
            external_id="example:1",
        )
        self.base_url = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/integrations/{self.integration.id}/"

    @patch.object(
        sentry.issues.endpoints.group_integration_details, "publish_action", autospec=True
    )
    def test_create_external_issue_emits_action(self, mock_publish: MagicMock) -> None:
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.post(
                self.base_url, data={"assignee": "foo@sentry.io"}, format="json"
            )
        assert response.status_code == 201
        mock_publish.assert_called_once()
        assert isinstance(mock_publish.call_args.args[0], CreateExternalIssueAction)
        assert mock_publish.call_args.kwargs["group_id"] == self.group.id
        assert mock_publish.call_args.args[0].provider == "example"

    @patch.object(
        sentry.issues.endpoints.group_integration_details, "publish_action", autospec=True
    )
    def test_link_external_issue_emits_action(self, mock_publish: MagicMock) -> None:
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.put(
                self.base_url, data={"externalIssue": "APP-123"}, format="json"
            )
        assert response.status_code == 201
        mock_publish.assert_called_once()
        assert isinstance(mock_publish.call_args.args[0], LinkExternalIssueAction)
        assert mock_publish.call_args.kwargs["group_id"] == self.group.id

    @patch.object(
        sentry.issues.endpoints.group_integration_details, "publish_action", autospec=True
    )
    def test_unlink_external_issue_emits_action(self, mock_publish: MagicMock) -> None:
        from sentry.integrations.models.external_issue import ExternalIssue
        from sentry.models.grouplink import GroupLink

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="APP-123",
        )
        GroupLink.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.delete(
                f"{self.base_url}?externalIssue={external_issue.id}", format="json"
            )
        assert response.status_code == 204
        mock_publish.assert_called_once()
        assert isinstance(mock_publish.call_args.args[0], UnlinkExternalIssueAction)

    @patch.object(
        sentry.issues.endpoints.group_integration_details, "publish_action", autospec=True
    )
    def test_unlink_unlinked_external_issue_skips_action(self, mock_publish: MagicMock) -> None:
        from sentry.integrations.models.external_issue import ExternalIssue

        # The external issue exists but is not linked to this group, so nothing is
        # removed. The endpoint still returns 204, but no action should be recorded.
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="APP-123",
        )
        with self.feature("organizations:integrations-issue-basic"):
            response = self.client.delete(
                f"{self.base_url}?externalIssue={external_issue.id}", format="json"
            )
        assert response.status_code == 204
        mock_publish.assert_not_called()


class TestPublishActionWrite(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    def test_creates_log_entry(self) -> None:
        with self.options({"issues.action-log.write-to-db": True}):
            publish_action(
                ViewAction(),
                source=ActionSource.API,
                group_id=self.group.id,
                organization_id=self.group.project.organization_id,
                project_id=self.group.project_id,
                actor=GroupActionActor.user(self.user.id),
            )

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.type == GroupActionType.VIEW
        assert entry.actor_id == self.user.id
        assert entry.actor_type == GroupActorType.USER
        assert entry.source == ActionSource.API
        assert entry.data == {}
        assert entry.date_added is not None

    def test_system_action(self) -> None:
        with self.options({"issues.action-log.write-to-db": True}):
            publish_action(
                ViewAction(),
                source=ActionSource.SYSTEM,
                group_id=self.group.id,
                organization_id=self.group.project.organization_id,
                project_id=self.group.project_id,
                actor=SYSTEM_ACTOR,
            )

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.SYSTEM
        assert entry.actor_id == 0

    def test_multiple_entries_ordered(self) -> None:
        with self.options({"issues.action-log.write-to-db": True}):
            for _ in range(3):
                publish_action(
                    ViewAction(),
                    source=ActionSource.API,
                    group_id=self.group.id,
                    organization_id=self.group.project.organization_id,
                    project_id=self.group.project_id,
                    actor=GroupActionActor.user(self.user.id),
                )

        entries = list(
            GroupActionLogEntry.objects.filter(group_id=self.group.id).order_by("date_added", "id")
        )
        assert len(entries) == 3
        assert entries[0].id < entries[1].id < entries[2].id

    def test_duplicate_idempotency_key_raises(self) -> None:
        kwargs = dict(
            source=ActionSource.API,
            group_id=self.group.id,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            actor=GroupActionActor.user(self.user.id),
            idempotency_key="view-123",
        )

        with self.options({"issues.action-log.write-to-db": True}):
            publish_action(ViewAction(), **kwargs)

            with pytest.raises(DuplicateActionError):
                publish_action(ViewAction(), **kwargs)

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    def test_option_disabled_skips_write(self) -> None:
        with self.options({"issues.action-log.write-to-db": False}):
            publish_action(
                ViewAction(),
                source=ActionSource.API,
                group_id=self.group.id,
                organization_id=self.group.project.organization_id,
                project_id=self.group.project_id,
                actor=GroupActionActor.user(self.user.id),
            )

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0
