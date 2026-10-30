from typing import Any
from unittest import mock

import pytest
from django.db import OperationalError

from sentry.integrations.example.integration import ExampleIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.assignment_source import AssignmentSource
from sentry.integrations.utils.sync import sync_group_assignee_inbound
from sentry.issues.derived.framework import DerivedDataError
from sentry.issues.derived.processing import PIPELINE
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.models.activity import Activity
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouplink import GroupLink
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.users.services.user.service import user_service
from sentry.viewer_context import (
    Actor,
    ViewerContext,
    get_viewer_context,
    viewer_context_scope,
)
from sentry.viewer_context import ActorType as ViewerActorType

pytestmark = requires_snuba


class GroupAssigneeTestCase(TestCase):
    def test_corrupt_progress_does_not_prevent_assignment(self) -> None:
        self._assert_corrupt_derived_data_allows_assignment("progress", progress="invalid")

    def test_corrupt_blob_does_not_prevent_assignment(self) -> None:
        self._assert_corrupt_derived_data_allows_assignment("none", data=[])

    def _assert_corrupt_derived_data_allows_assignment(
        self, expected_feature: str, **values: Any
    ) -> None:
        derived = self.create_group_derived_data(
            self.group, pipeline_hash=PIPELINE.pipeline_hash, **values
        )
        before = GroupDerivedData.objects.filter(id=derived.id).values().get()
        with (
            mock.patch("sentry.issues.derived.reporting.logger") as logger,
            mock.patch("sentry.issues.derived.reporting.metrics.incr") as incr,
        ):
            self._assign_without_first_assignment_summary()

        assert GroupDerivedData.objects.filter(id=derived.id).values().get() == before
        logger.exception.assert_called_once()
        context = logger.exception.call_args.kwargs["extra"]
        assert context["group_id"] == self.group.id
        assert context["operation"] == "assign"
        assert context["stage"] == "decode"
        assert context["cursor_id"] == derived.cursor_id
        assert context["stored_pipeline_hash"] == PIPELINE.pipeline_hash
        incr.assert_any_call(
            "issues.derived.feature_error",
            sample_rate=1.0,
            tags={
                "operation": "assign",
                "stage": "decode",
                "feature": expected_feature,
                "aggregator": "none",
            },
        )

    def _assign_without_first_assignment_summary(self) -> None:
        with (
            self.feature("organizations:issue-summary-on-first-assignment"),
            mock.patch("sentry.models.groupassignee.issue_assigned.send_robust") as signal,
            # Observe the summary lookup separately from processing the new assignment action.
            mock.patch("sentry.receivers.outbox.cell.trigger_group_log_processing"),
            self.capture_on_commit_callbacks(execute=True),
        ):
            result = GroupAssignee.objects.assign(self.group, self.user)

        assert result == {"new_assignment": True, "updated_assignment": False}
        assert GroupAssignee.objects.filter(group=self.group, user_id=self.user.id).exists()
        signal.assert_called_once()
        assert signal.call_args.kwargs["is_first_assignment"] is False

    def test_failed_replay_without_stored_data_does_not_prevent_assignment(self) -> None:
        context = self._assert_failed_replay_allows_assignment()
        assert context["cursor_id"] is None
        assert context["cursor_date"] is None
        assert context["stored_pipeline_hash"] is None

    def test_failed_replay_with_stale_data_does_not_prevent_assignment(self) -> None:
        derived = self.create_group_derived_data(self.group, pipeline_hash="stale")
        context = self._assert_failed_replay_allows_assignment()
        assert context["cursor_id"] == derived.cursor_id
        assert context["stored_pipeline_hash"] == "stale"

    def _assert_failed_replay_allows_assignment(self) -> dict[str, Any]:
        before = list(GroupDerivedData.objects.filter(group_id=self.group.id).values())
        error = DerivedDataError(
            "aggregate", aggregator_name="track_first_assignment", entry_id=123
        )
        with (
            mock.patch(
                "sentry.models.groupassignee.replay_feature_from_log", side_effect=error
            ) as replay,
            mock.patch("sentry.issues.derived.reporting.logger") as logger,
            mock.patch("sentry.issues.derived.reporting.metrics.incr") as incr,
        ):
            self._assign_without_first_assignment_summary()

        replay.assert_called_once()
        assert list(GroupDerivedData.objects.filter(group_id=self.group.id).values()) == before
        logger.exception.assert_called_once()
        context = logger.exception.call_args.kwargs["extra"]
        assert context["group_id"] == self.group.id
        assert context["operation"] == "assign"
        assert context["stage"] == "aggregate"
        assert context["entry_id"] == 123
        assert context["pipeline_hash"] == PIPELINE.pipeline_hash
        incr.assert_any_call(
            "issues.derived.feature_error",
            sample_rate=1.0,
            tags={
                "operation": "assign",
                "stage": "aggregate",
                "feature": "none",
                "aggregator": "track_first_assignment",
            },
        )
        return context

    def test_derived_data_database_failure_propagates(self) -> None:
        self._assert_database_failure_propagates(
            "sentry.models.groupassignee.GroupDerivedData.objects.get_or_none"
        )

    def test_replay_database_failure_propagates(self) -> None:
        self._assert_database_failure_propagates(
            "sentry.models.groupassignee.replay_feature_from_log"
        )

    def _assert_database_failure_propagates(self, target: str) -> None:
        with (
            self.feature("organizations:issue-summary-on-first-assignment"),
            mock.patch(target, side_effect=OperationalError("database unavailable")),
            mock.patch("sentry.models.groupassignee.report_derived_data_error") as report,
            pytest.raises(OperationalError, match="database unavailable"),
        ):
            GroupAssignee.objects.assign(self.group, self.user)

        report.assert_not_called()
        assert not GroupAssignee.objects.filter(group=self.group).exists()

    def test_assign_preserves_viewer_context_until_on_commit(self) -> None:
        expected_context = ViewerContext(
            actor=Actor(type=ViewerActorType.USER, actor_id=self.user.id),
            organization_id=self.organization.id,
            project_id=self.project.id,
        )
        captured_contexts: list[ViewerContext | None] = []

        with mock.patch("sentry.models.groupassignee.issue_assigned.send_robust") as send_robust:
            send_robust.side_effect = lambda **kwargs: captured_contexts.append(
                get_viewer_context()
            )
            with self.capture_on_commit_callbacks() as callbacks:
                with viewer_context_scope(expected_context):
                    GroupAssignee.objects.assign(self.group, self.user)

            assert get_viewer_context() is None
            for callback in callbacks:
                callback()

        assert captured_contexts == [expected_context]

    def test_constraints(self) -> None:
        # Can't both be assigned
        with pytest.raises(AssertionError):
            GroupAssignee.objects.create(
                group=self.group, project=self.group.project, user_id=self.user.id, team=self.team
            )

        # Can't have nobody assigned
        with pytest.raises(AssertionError):
            GroupAssignee.objects.create(
                group=self.group, project=self.group.project, user_id=None, team=None
            )

    def test_assign_user(self) -> None:
        GroupAssignee.objects.assign(self.group, self.user)

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, user_id=self.user.id, team__isnull=True
        ).exists()

        activity = Activity.objects.get(
            project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
        )

        assert activity.data["assignee"] == str(self.user.id)
        assert activity.data["assigneeEmail"] == self.user.email
        assert activity.data["assigneeName"] == self.user.name
        assert activity.data["assigneeType"] == "user"

    def test_assign_team(self) -> None:
        GroupAssignee.objects.assign(self.group, self.team)

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, team=self.team, user_id__isnull=True
        ).exists()

        activity = Activity.objects.get(
            project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
        )

        assert activity.data["assignee"] == str(self.team.id)
        assert activity.data["assigneeEmail"] is None
        assert activity.data["assigneeName"] == self.team.name
        assert activity.data["assigneeType"] == "team"

    def test_create_only(self) -> None:
        result = GroupAssignee.objects.assign(self.group, self.user)
        assert result == {"new_assignment": True, "updated_assignment": False}

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, user_id=self.user.id, team__isnull=True
        ).exists()
        activity = Activity.objects.get(
            project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
        )
        assert activity.data["assignee"] == str(self.user.id)
        assert activity.data["assigneeEmail"] == self.user.email
        assert activity.data["assigneeName"] == self.user.name
        assert activity.data["assigneeType"] == "user"

        other_user = self.create_user()
        result = GroupAssignee.objects.assign(self.group, other_user, create_only=True)
        assert result == {"new_assignment": False, "updated_assignment": False}
        # Assignee should not have changed
        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, user_id=self.user.id, team__isnull=True
        ).exists()
        # Should be no new activity rows
        activity = Activity.objects.get(
            project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
        )
        assert activity.data["assignee"] == str(self.user.id)
        assert activity.data["assigneeEmail"] == self.user.email
        assert activity.data["assigneeName"] == self.user.name
        assert activity.data["assigneeType"] == "user"

    def test_reassign_user_to_team(self) -> None:
        GroupAssignee.objects.assign(self.group, self.user)

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, user_id=self.user.id, team__isnull=True
        ).exists()

        GroupAssignee.objects.assign(self.group, self.team)

        assert GroupAssignee.objects.filter(
            project=self.group.project, group=self.group, team=self.team, user_id__isnull=True
        ).exists()

        activity = list(
            Activity.objects.filter(
                project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
            ).order_by("id")
        )

        assert activity[0].data["assignee"] == str(self.user.id)
        assert activity[0].data["assigneeEmail"] == self.user.email
        assert activity[0].data["assigneeName"] == self.user.name
        assert activity[0].data["assigneeType"] == "user"

        assert activity[1].data["assignee"] == str(self.team.id)
        assert activity[1].data["assigneeEmail"] is None
        assert activity[1].data["assigneeName"] == self.team.name
        assert activity[1].data["assigneeType"] == "team"

    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    def test_assignee_sync_outbound_assign(
        self, mock_sync_assignee_outbound: mock.MagicMock
    ) -> None:
        group = self.group
        integration = self.create_integration(
            organization=group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        with self.feature({"organizations:integrations-issue-sync": True}):
            with self.tasks():
                GroupAssignee.objects.assign(
                    self.group,
                    self.user,
                )

                mock_sync_assignee_outbound.assert_called_with(
                    external_issue,
                    user_service.get_user(self.user.id),
                    assign=True,
                    assignment_source=None,
                    lifecycle=mock.ANY,
                )

                assert GroupAssignee.objects.filter(
                    project=self.group.project,
                    group=self.group,
                    user_id=self.user.id,
                    team__isnull=True,
                ).exists()

                activity = Activity.objects.get(
                    project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
                )

                assert activity.data["assignee"] == str(self.user.id)
                assert activity.data["assigneeEmail"] == self.user.email
                assert activity.data["assigneeName"] == self.user.name
                assert activity.data["assigneeType"] == "user"

    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    def test_assignee_sync_outbound_assign_with_matching_source_integration(
        self, mock_sync_assignee_outbound
    ):
        group = self.group
        integration = self.create_integration(
            organization=group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        with self.feature({"organizations:integrations-issue-sync": True}):
            with self.tasks():
                # Assert that we don't perform an outbound assignment if
                # the source of the assignment is the same target integration
                GroupAssignee.objects.assign(
                    self.group,
                    self.user,
                    assignment_source=AssignmentSource.from_integration(integration),
                )

                mock_sync_assignee_outbound.assert_not_called()

                assert GroupAssignee.objects.filter(
                    project=self.group.project,
                    group=self.group,
                    user_id=self.user.id,
                    team__isnull=True,
                ).exists()

                activity = Activity.objects.get(
                    project=self.group.project, group=self.group, type=ActivityType.ASSIGNED.value
                )

                assert activity.data["assignee"] == str(self.user.id)
                assert activity.data["assigneeEmail"] == self.user.email
                assert activity.data["assigneeName"] == self.user.name
                assert activity.data["assigneeType"] == "user"

    @mock.patch.object(ExampleIntegration, "sync_assignee_outbound")
    def test_assignee_sync_outbound_unassign(
        self, mock_sync_assignee_outbound: mock.MagicMock
    ) -> None:
        group = self.group

        integration = self.create_integration(
            organization=group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        GroupAssignee.objects.assign(self.group, self.user)

        with self.feature({"organizations:integrations-issue-sync": True}):
            with self.tasks():
                GroupAssignee.objects.deassign(self.group, self.user)
                mock_sync_assignee_outbound.assert_called_with(
                    external_issue,
                    None,
                    assign=False,
                    assignment_source=None,
                    lifecycle=mock.ANY,
                )

                assert not GroupAssignee.objects.filter(
                    project=self.group.project,
                    group=self.group,
                    user_id=self.user.id,
                    team__isnull=True,
                ).exists()

                assert Activity.objects.filter(
                    project=self.group.project, group=self.group, type=ActivityType.UNASSIGNED.value
                ).exists()

    def test_assignee_sync_inbound_assign(self) -> None:
        group = self.group
        user_no_access = self.create_user()
        user_w_access = self.user

        integration = self.create_integration(
            organization=group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        with self.feature("organizations:integrations-issue-sync"):
            # no permissions
            groups_updated = sync_group_assignee_inbound(
                integration, user_no_access.email, "APP-123"
            )

            assert not groups_updated

            # w permissions
            groups_updated = sync_group_assignee_inbound(
                integration, user_w_access.email, "APP-123"
            )

            assert groups_updated[0] == group
            assert GroupAssignee.objects.filter(
                project=group.project, group=group, user_id=user_w_access.id, team__isnull=True
            ).exists()

            # confirm capitalization doesn't affect syncing
            groups_updated = sync_group_assignee_inbound(
                integration, user_w_access.email.title(), "APP-123"
            )

            assert groups_updated[0] == group
            assert GroupAssignee.objects.filter(
                project=group.project, group=group, user_id=user_w_access.id, team__isnull=True
            ).exists()

    def test_assignee_sync_inbound_deassign(self) -> None:
        group = self.group
        integration = self.create_integration(
            organization=group.organization,
            external_id="123456",
            provider="example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=group.organization.id, integration_id=integration.id, key="APP-123"
        )

        GroupLink.objects.create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        GroupAssignee.objects.assign(group, self.user)

        with self.feature("organizations:integrations-issue-sync"):
            groups_updated = sync_group_assignee_inbound(
                integration, self.user.email, "APP-123", assign=False
            )

            assert groups_updated[0] == group
            assert not GroupAssignee.objects.filter(
                project=group.project, group=group, user_id=self.user.id, team__isnull=True
            ).exists()

    def test_assign_deactivated_user_is_noop(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.is_active = False
            self.user.save()

        result = GroupAssignee.objects.assign(self.group, self.user)
        assert result == {"new_assignment": False, "updated_assignment": False}
        assert not GroupAssignee.objects.filter(group=self.group).exists()
        assert not Activity.objects.filter(
            group=self.group, type=ActivityType.ASSIGNED.value
        ).exists()
