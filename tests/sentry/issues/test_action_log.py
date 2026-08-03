from typing import Any, cast
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth.models import AnonymousUser
from django.db import router, transaction

from sentry.auth.services.auth import AuthenticatedToken
from sentry.hybridcloud.models.outbox import CellOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.issues.action_log import (
    SYSTEM_ACTOR,
    ActionContext,
    GroupActionActor,
    action_context_scope,
    get_action_context,
    publish_action,
    resolve_action_actor,
    resolve_action_source,
)
from sentry.issues.action_log.types import (
    ActionSource,
    ArchiveAction,
    AssignAction,
    CreateExternalIssueAction,
    GroupAction,
    GroupActionType,
    GroupActorType,
    LinkExternalIssueAction,
    MarkReviewedAction,
    MergeFromOtherAction,
    MergeIntoOtherAction,
    PullRequestClosedAction,
    ResolveAction,
    SetPriorityAction,
    SetResolvedByAgeAction,
    UnassignAction,
    UnlinkExternalIssueAction,
    ViewAction,
)
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.seer.endpoints.seer_rpc import SeerRpcSignatureAuthentication
from sentry.testutils.cases import APITestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.action_log import CapturedAction, capture_action_log
from sentry.testutils.outbox import outbox_runner
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


class IntentionalRollback(Exception):
    """Raised to force a transaction rollback in tests."""


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


class TestResolveActionActor(TestCase):
    def _request(self, *, auth: Any = None, user: Any = None) -> MagicMock:
        request = MagicMock()
        request.auth = auth
        request.user = user if user is not None else AnonymousUser()
        return request

    def test_session_user(self) -> None:
        request = self._request(user=self.user)
        assert resolve_action_actor(request) == GroupActionActor.user(self.user.id)

    def test_personal_api_token(self) -> None:
        auth = AuthenticatedToken(kind="api_token", user_id=self.user.id)
        request = self._request(auth=auth, user=self.user)
        assert resolve_action_actor(request) == GroupActionActor.user(self.user.id)

    def test_agent_token(self) -> None:
        auth = AuthenticatedToken(kind="agent_token", user_id=self.user.id)
        request = self._request(auth=auth)
        assert resolve_action_actor(request) == GroupActionActor.user(self.user.id)

    def test_org_auth_token(self) -> None:
        auth = AuthenticatedToken(kind="org_auth_token", organization_id=self.organization.id)
        request = self._request(auth=auth)
        assert resolve_action_actor(request) == GroupActionActor.org(self.organization.id)

    def test_legacy_api_key_is_org_actor(self) -> None:
        auth = AuthenticatedToken(kind="api_key", organization_id=self.organization.id)
        request = self._request(auth=auth)
        assert resolve_action_actor(request) == GroupActionActor.org(self.organization.id)

    def test_sentry_app_token_resolves_to_app(self) -> None:
        sentry_app = self.create_sentry_app(organization=self.organization)
        auth = AuthenticatedToken(
            kind="api_token",
            application_id=sentry_app.application_id,
            user_id=sentry_app.proxy_user.id,
        )
        request = self._request(auth=auth, user=sentry_app.proxy_user)
        assert resolve_action_actor(request) == GroupActionActor.sentry_app(sentry_app.id)

    def test_user_oauth_token_with_application_id_is_user(self) -> None:
        # An OAuth client acting on behalf of a user (e.g. the MCP) has an application_id but
        # authenticates as the real user (is_sentry_app=False), so it must resolve to USER and
        # not trigger a SentryApp lookup.
        auth = AuthenticatedToken(kind="api_token", user_id=self.user.id, application_id=987654)
        request = self._request(auth=auth, user=self.user)
        assert resolve_action_actor(request) == GroupActionActor.user(self.user.id)

    def test_unauthenticated_is_system(self) -> None:
        assert resolve_action_actor(self._request()) == SYSTEM_ACTOR


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
                project=self.project,
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
                project=self.project,
                actor=GroupActionActor.user(99),
            )
        assert getattr(logs.records[0], "actor_type") == "user"

        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action(
                ResolveAction(),
                source="system",
                group_id=1,
                project=self.project,
            )
        assert getattr(logs.records[0], "actor_type") == "system"


class TestPublishActionFromContext(TestCase):
    def test_logs_error_and_uses_unknown_without_context(self) -> None:
        from sentry.issues.action_log import publish_action_from_context

        with self.assertLogs("sentry.issues.action_log", level="INFO") as logs:
            publish_action_from_context(
                ResolveAction(),
                group_id=1,
                project=self.project,
            )
        error_records = [r for r in logs.records if r.levelname == "ERROR"]
        assert any("without ActionContext" in r.message for r in error_records)
        info_record = [r for r in logs.records if r.message == "group.action_log"][0]
        assert getattr(info_record, "source") == "unknown"


class TestPublishActionsFromContextBulk(TestCase):
    def test_multiple_writes(self) -> None:
        from sentry.issues.action_log import action_context_scope, publish_actions_from_context_bulk

        actor = GroupActionActor.user(42)
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            with action_context_scope(source="web", actor=actor):
                publish_actions_from_context_bulk(
                    [
                        (ViewAction(), self.group.project, self.group.id, None),
                        (ResolveAction(), self.group.project, self.group.id, None),
                    ],
                )

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 2


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

    def test_resolve_emits_action(self) -> None:
        with capture_action_log() as log:
            response = self.client.put(self.url, data={"status": "resolved"}, format="json")
        assert response.status_code == 200
        log.assert_logged(ResolveAction, group_id=self.group.id)

    def test_resolve_already_resolved_skips(self) -> None:
        self.group.update(status=GroupStatus.RESOLVED, substatus=None)
        with capture_action_log() as log:
            response = self.client.put(self.url, data={"status": "resolved"}, format="json")
        assert response.status_code == 200
        log.assert_not_logged(ResolveAction)

    def test_archive_emits_action(self) -> None:
        with capture_action_log() as log:
            response = self.client.put(
                self.url,
                data={"status": "ignored", "substatus": "archived_until_escalating"},
                format="json",
            )
        assert response.status_code == 200
        log.assert_logged(ArchiveAction, group_id=self.group.id)

    def test_archive_already_archived_skips(self) -> None:
        self.group.update(status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING)
        with capture_action_log() as log:
            response = self.client.put(
                self.url,
                data={"status": "ignored", "substatus": "archived_until_escalating"},
                format="json",
            )
        assert response.status_code == 200
        log.assert_not_logged(ArchiveAction)

    def test_priority_change_emits_action(self) -> None:
        with capture_action_log() as log:
            response = self.client.put(self.url, data={"priority": "high"}, format="json")
        assert response.status_code == 200
        log.assert_logged(SetPriorityAction, group_id=self.group.id, priority="high")

    def test_priority_same_value_skips(self) -> None:
        with capture_action_log() as log:
            response = self.client.put(self.url, data={"priority": "medium"}, format="json")
        assert response.status_code == 200
        log.assert_not_logged(SetPriorityAction)

    def test_assign_emits_action(self) -> None:
        with capture_action_log() as log:
            response = self.client.put(
                self.url, data={"assignedTo": f"user:{self.user.id}"}, format="json"
            )
        assert response.status_code == 200
        log.assert_logged(AssignAction, group_id=self.group.id)

    def test_assign_same_user_skips(self) -> None:
        self.client.put(self.url, data={"assignedTo": f"user:{self.user.id}"}, format="json")
        with capture_action_log() as log:
            self.client.put(self.url, data={"assignedTo": f"user:{self.user.id}"}, format="json")
        log.assert_not_logged(AssignAction)

    def test_unassign_emits_action(self) -> None:
        self.client.put(self.url, data={"assignedTo": f"user:{self.user.id}"}, format="json")
        with capture_action_log() as log:
            response = self.client.put(self.url, data={"assignedTo": ""}, format="json")
        assert response.status_code == 200
        log.assert_logged(UnassignAction, group_id=self.group.id)

    def test_unassign_without_assignee_skips(self) -> None:
        with capture_action_log() as log:
            response = self.client.put(self.url, data={"assignedTo": ""}, format="json")
        assert response.status_code == 200
        log.assert_not_logged(UnassignAction)

    def test_view_emits_action(self) -> None:
        with capture_action_log() as log:
            response = self.client.get(self.url, format="json")
        assert response.status_code == 200
        log.assert_logged(ViewAction, group_id=self.group.id)

    def test_mark_reviewed_emits_for_inbox_groups(self) -> None:
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
        with capture_action_log() as log:
            response = self.client.put(url, data={"inbox": False}, format="json")
        assert response.status_code == 200
        log.assert_logged(MarkReviewedAction, group_id=group_in_inbox.id)
        log.assert_not_logged(MarkReviewedAction, group_id=group_not_in_inbox.id)

    def test_merge_emits_actions(self) -> None:
        group2 = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        url = f"/api/0/organizations/{self.organization.slug}/issues/?id={self.group.id}&id={group2.id}"
        with capture_action_log() as log:
            response = self.client.put(url, data={"merge": 1}, format="json")
        assert response.status_code == 200
        log.assert_logged(MergeFromOtherAction)
        log.assert_logged(MergeIntoOtherAction)


class TestUpdateGroupStatusActionLog(APITestCase, SnubaTestCase):
    def test_resolve_emits_action_with_context_source(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        actor = GroupActionActor.user(self.user.id)
        with capture_action_log() as log:
            with action_context_scope(source=ActionSource.SLACK, actor=actor):
                Group.objects.update_group_status(
                    groups=[group],
                    status=GroupStatus.RESOLVED,
                    substatus=None,
                    activity_type=ActivityType.SET_RESOLVED,
                )
        log.assert_logged(ResolveAction, group_id=group.id, source=ActionSource.SLACK, actor=actor)

    def test_ignore_emits_archive_action(self) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)
        with capture_action_log() as log:
            with action_context_scope(source=ActionSource.SYSTEM, actor=SYSTEM_ACTOR):
                Group.objects.update_group_status(
                    groups=[group],
                    status=GroupStatus.IGNORED,
                    substatus=GroupSubStatus.UNTIL_ESCALATING,
                    activity_type=ActivityType.SET_IGNORED,
                )
        log.assert_logged(ArchiveAction, group_id=group.id, source=ActionSource.SYSTEM)


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

    def test_create_external_issue_emits_action(self) -> None:
        with capture_action_log() as log, self.feature("organizations:integrations-issue-basic"):
            response = self.client.post(
                self.base_url, data={"assignee": "foo@sentry.io"}, format="json"
            )
        assert response.status_code == 201
        log.assert_logged(CreateExternalIssueAction, group_id=self.group.id, provider="example")

    def test_link_external_issue_emits_action(self) -> None:
        with capture_action_log() as log, self.feature("organizations:integrations-issue-basic"):
            response = self.client.put(
                self.base_url, data={"externalIssue": "APP-123"}, format="json"
            )
        assert response.status_code == 201
        log.assert_logged(LinkExternalIssueAction, group_id=self.group.id)

    def test_unlink_external_issue_emits_action(self) -> None:
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
        with capture_action_log() as log, self.feature("organizations:integrations-issue-basic"):
            response = self.client.delete(
                f"{self.base_url}?externalIssue={external_issue.id}", format="json"
            )
        assert response.status_code == 204
        log.assert_logged(UnlinkExternalIssueAction, group_id=self.group.id)

    def test_unlink_unlinked_external_issue_skips_action(self) -> None:
        from sentry.integrations.models.external_issue import ExternalIssue

        # The external issue exists but is not linked to this group, so nothing is
        # removed. The endpoint still returns 204, but no action should be recorded.
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="APP-123",
        )
        with capture_action_log() as log, self.feature("organizations:integrations-issue-basic"):
            response = self.client.delete(
                f"{self.base_url}?externalIssue={external_issue.id}", format="json"
            )
        assert response.status_code == 204
        log.assert_not_logged()


class TestPublishActionWrite(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()

    def test_creates_log_entry(self) -> None:
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            publish_action(
                ViewAction(),
                source=ActionSource.API,
                group_id=self.group.id,
                project=self.group.project,
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
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            publish_action(
                ViewAction(),
                source=ActionSource.SYSTEM,
                group_id=self.group.id,
                project=self.group.project,
                actor=SYSTEM_ACTOR,
            )

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.actor_type == GroupActorType.SYSTEM
        assert entry.actor_id == 0

    def test_multiple_entries_ordered(self) -> None:
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            for _ in range(3):
                publish_action(
                    ViewAction(),
                    source=ActionSource.API,
                    group_id=self.group.id,
                    project=self.group.project,
                    actor=GroupActionActor.user(self.user.id),
                )

        entries = list(
            GroupActionLogEntry.objects.filter(group_id=self.group.id).order_by("date_added", "id")
        )
        assert len(entries) == 3
        assert entries[0].id < entries[1].id < entries[2].id

    def test_rolled_back_transaction_does_not_persist(self) -> None:
        with self.feature("projects:issue-action-log-write-to-db"):
            try:
                with transaction.atomic(using=router.db_for_write(CellOutbox)):
                    publish_action(
                        ViewAction(),
                        source=ActionSource.API,
                        group_id=self.group.id,
                        project=self.group.project,
                        actor=GroupActionActor.user(self.user.id),
                    )
                    assert CellOutbox.objects.filter(
                        category=OutboxCategory.GROUP_ACTION_LOG_EVENT
                    ).exists()
                    raise IntentionalRollback()
            except IntentionalRollback:
                pass

        assert not CellOutbox.objects.filter(
            category=OutboxCategory.GROUP_ACTION_LOG_EVENT
        ).exists()
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0

    def test_savepoint_rollback_discards_only_inner(self) -> None:
        with self.feature("projects:issue-action-log-write-to-db"):
            with outbox_runner():
                with transaction.atomic(using=router.db_for_write(CellOutbox)):
                    publish_action(
                        ViewAction(),
                        source=ActionSource.API,
                        group_id=self.group.id,
                        project=self.group.project,
                        actor=GroupActionActor.user(self.user.id),
                    )
                    try:
                        with transaction.atomic(using=router.db_for_write(CellOutbox)):
                            publish_action(
                                ResolveAction(),
                                source=ActionSource.API,
                                group_id=self.group.id,
                                project=self.group.project,
                                actor=GroupActionActor.user(self.user.id),
                            )
                            raise IntentionalRollback()
                    except IntentionalRollback:
                        pass

        entries = list(GroupActionLogEntry.objects.filter(group_id=self.group.id))
        assert len(entries) == 1
        assert entries[0].type == GroupActionType.VIEW

    def test_feature_disabled_skips_write(self) -> None:
        publish_action(
            ViewAction(),
            source=ActionSource.API,
            group_id=self.group.id,
            project=self.group.project,
            actor=GroupActionActor.user(self.user.id),
        )

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0

    def test_flush_false_defers_drain(self) -> None:
        with self.feature("projects:issue-action-log-write-to-db"):
            with outbox_context(flush=False):
                publish_action(
                    ViewAction(),
                    source=ActionSource.API,
                    group_id=self.group.id,
                    project=self.group.project,
                    actor=GroupActionActor.user(self.user.id),
                )

            assert CellOutbox.objects.filter(
                category=OutboxCategory.GROUP_ACTION_LOG_EVENT
            ).exists()
            assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 0

            with outbox_runner():
                pass

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1

    @patch("sentry.issues.derived.processing.process_group_log_task")
    def test_force_async_derived_dispatches_task(self, mock_task: MagicMock) -> None:
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            publish_action(
                ViewAction(),
                source=ActionSource.API,
                group_id=self.group.id,
                project=self.group.project,
                actor=GroupActionActor.user(self.user.id),
                force_async_derived=True,
            )

        # GALE is written
        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1
        # Derived data was NOT processed inline
        assert not GroupDerivedData.objects.filter(group_id=self.group.id).exists()
        # Task was dispatched instead
        mock_task.delay.assert_called_once_with(self.group.id)

    @patch("sentry.issues.derived.processing.process_group_log_task")
    def test_inline_derived_processes_without_task(self, mock_task: MagicMock) -> None:
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            publish_action(
                ViewAction(),
                source=ActionSource.API,
                group_id=self.group.id,
                project=self.group.project,
                actor=GroupActionActor.user(self.user.id),
            )

        assert GroupActionLogEntry.objects.filter(group_id=self.group.id).count() == 1
        # Derived data WAS processed inline
        derived = GroupDerivedData.objects.get(group_id=self.group.id)
        assert derived.view_count == 1
        # No async task needed (single entry = caught up)
        mock_task.delay.assert_not_called()

    def test_idempotency_key_publish(self) -> None:
        idempotency_key = "test_idempotency_key_publish"
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            publish_action(
                ViewAction(),
                source=ActionSource.API,
                group_id=self.group.id,
                project=self.group.project,
                actor=GroupActionActor.user(self.user.id),
                idempotency_key=idempotency_key,
            )

        entry = GroupActionLogEntry.objects.get(group_id=self.group.id)
        assert entry.idempotency_key == idempotency_key

        with (
            self.feature("projects:issue-action-log-write-to-db"),
            outbox_runner(),
        ):
            # Tacitly assert silent failure / no exception
            publish_action(
                ViewAction(),
                source=ActionSource.API,
                group_id=self.group.id,
                project=self.group.project,
                actor=GroupActionActor.user(self.user.id),
                idempotency_key=idempotency_key,
            )


class TestCaptureActionLog(TestCase):
    def _publish(self, action: GroupAction, **kwargs: Any) -> None:
        defaults: dict[str, Any] = {
            "source": ActionSource.WEB,
            "group_id": 1,
            "project": self.project,
            "actor": GroupActionActor.user(self.user.id),
        }
        defaults.update(kwargs)
        publish_action(action, **defaults)

    def test_captures_action(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction(), group_id=42)
        log.assert_logged(ResolveAction, group_id=42)

    def test_no_actions_captured_outside_scope(self) -> None:
        self._publish(ResolveAction())
        with capture_action_log() as log:
            pass
        log.assert_not_logged()

    def test_assert_logged_fails_on_mismatch(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction())
        with pytest.raises(AssertionError):
            log.assert_logged(ViewAction)

    def test_assert_not_logged_fails_on_match(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction())
        with pytest.raises(AssertionError):
            log.assert_not_logged(ResolveAction)

    def test_filters_by_group_id(self) -> None:
        with capture_action_log() as log:
            self._publish(ViewAction(), group_id=1)
            self._publish(ViewAction(), group_id=2)
        assert len(log.for_group(1)) == 1
        assert len(log.for_group(2)) == 1
        log.assert_logged(ViewAction, group_id=1)
        log.assert_not_logged(ViewAction, group_id=3)

    def test_filters_by_source(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction(), source=ActionSource.MCP)
            self._publish(ResolveAction(), source=ActionSource.SLACK)
        log.assert_logged(ResolveAction, source=ActionSource.MCP)
        log.assert_logged(ResolveAction, source=ActionSource.SLACK)
        log.assert_not_logged(ResolveAction, source=ActionSource.API)

    def test_filters_by_actor(self) -> None:
        actor_a = GroupActionActor.user(10)
        actor_b = GroupActionActor.user(20)
        with capture_action_log() as log:
            self._publish(ResolveAction(), actor=actor_a)
            self._publish(ResolveAction(), actor=actor_b)
        log.assert_logged(ResolveAction, actor=actor_a)
        log.assert_not_logged(ResolveAction, actor=SYSTEM_ACTOR)

    def test_filters_by_action_fields(self) -> None:
        with capture_action_log() as log:
            self._publish(SetPriorityAction(priority="high"))
            self._publish(SetPriorityAction(priority="low"))
        log.assert_logged(SetPriorityAction, priority="high")
        log.assert_logged(SetPriorityAction, priority="low")
        log.assert_not_logged(SetPriorityAction, priority="medium")

    def test_count(self) -> None:
        with capture_action_log() as log:
            self._publish(ViewAction())
            self._publish(ViewAction())
            self._publish(ResolveAction())
        log.assert_logged(ViewAction, count=2)
        log.assert_logged(ResolveAction, count=1)

    def test_accepts_action_type_enum(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction())
        log.assert_logged(GroupActionType.RESOLVE)

    def test_nested_captures(self) -> None:
        with capture_action_log() as outer:
            self._publish(ViewAction())
            with capture_action_log() as inner:
                self._publish(ResolveAction())
            self._publish(ArchiveAction())
        # Inner only sees what happened inside its scope
        inner.assert_logged(ResolveAction)
        inner.assert_not_logged(ViewAction)
        inner.assert_not_logged(ArchiveAction)
        # Outer sees everything including actions during the inner scope
        outer.assert_logged(ViewAction)
        outer.assert_logged(ResolveAction)
        outer.assert_logged(ArchiveAction)


class TestActivitiesCreateActions(TestCase):
    def test_basic(self) -> None:
        with capture_action_log() as log:
            Activity.objects.create(
                group=self.group,
                project=self.project,
                type=ActivityType.SET_RESOLVED.value,
                user_id=self.user.id,
                data={},
            )
        log.assert_logged(ResolveAction)

    def test_with_data(self) -> None:
        with capture_action_log() as log:
            Activity.objects.create(
                group=self.group,
                project=self.project,
                type=ActivityType.PULL_REQUEST_CLOSED.value,
                user_id=self.user.id,
                data={"pull_request": 123},
            )
        caption = cast(CapturedAction, log.assert_logged(PullRequestClosedAction))
        action: PullRequestClosedAction = cast(PullRequestClosedAction, caption.action)
        assert action.pull_request == 123

    def test_with_translated_data(self) -> None:
        with capture_action_log() as log:
            Activity.objects.create(
                group=self.group,
                project=self.project,
                type=ActivityType.SET_RESOLVED_BY_AGE.value,
                user_id=self.user.id,
                data={"age": 123},
            )
        caption = cast(CapturedAction, log.assert_logged(SetResolvedByAgeAction))
        action: SetResolvedByAgeAction = cast(SetResolvedByAgeAction, caption.action)
        assert action.auto_resolve_age_threshold == 123
