from datetime import timedelta
from time import time
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.analytics.events.issue_auto_resolved import IssueAutoResolvedEvent
from sentry.issues.action_log import ActionSource
from sentry.issues.grouptype import (
    PerformanceP95EndpointRegressionGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.models.group import Group, GroupStatus
from sentry.models.options.project_option import ProjectOption
from sentry.tasks.auto_resolve_issues import schedule_auto_resolution
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_any_analytics_event


class ScheduleAutoResolutionTest(TestCase):
    def test_task_persistent_name(self) -> None:
        assert schedule_auto_resolution.name == "sentry.tasks.schedule_auto_resolution"

    @patch("sentry.analytics.record")
    @patch("sentry.tasks.auto_resolve_issues.kick_off_status_syncs")
    def test_simple(self, mock_kick_off_status_syncs: MagicMock, mock_record: MagicMock) -> None:
        project = self.create_project()
        project2 = self.create_project()
        project3 = self.create_project()
        project4 = self.create_project()

        current_ts = int(time()) - 1

        project.update_option("sentry:resolve_age", 1)
        project3.update_option("sentry:resolve_age", 1)
        project3.update_option("sentry:_last_auto_resolve", current_ts)
        project4.update_option("sentry:_last_auto_resolve", current_ts)

        group1 = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
        )

        group2 = self.create_group(
            project=project, status=GroupStatus.UNRESOLVED, last_seen=timezone.now()
        )

        group3 = self.create_group(
            project=project3,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
        )

        with self.tasks():
            schedule_auto_resolution()

        assert Group.objects.get(id=group1.id).status == GroupStatus.RESOLVED

        assert Group.objects.get(id=group2.id).status == GroupStatus.UNRESOLVED

        assert Group.objects.get(id=group3.id).status == GroupStatus.UNRESOLVED

        mock_kick_off_status_syncs.apply_async.assert_called_once_with(
            kwargs={"project_id": group1.project_id, "group_id": group1.id}
        )

        assert project.get_option("sentry:_last_auto_resolve") > current_ts
        assert not project2.get_option("sentry:_last_auto_resolve")
        assert project3.get_option("sentry:_last_auto_resolve") == current_ts
        # _last_auto_resolve rows that are disabled are no longer deleted; the project is simply skipped
        assert project4.get_option("sentry:_last_auto_resolve") == current_ts
        assert_any_analytics_event(
            mock_record,
            IssueAutoResolvedEvent(
                project_id=project.id,
                organization_id=project.organization_id,
                group_id=group1.id,
                issue_type="error",
                issue_category="error",
            ),
        )

    @patch("sentry.tasks.auto_resolve_issues.auto_resolve_project_issues")
    def test_explicit_zero_row_survives_and_is_not_dispatched(self, mock_task: MagicMock) -> None:
        project = self.create_project()
        project.update_option("sentry:resolve_age", 0)
        project.update_option("sentry:_last_auto_resolve", 12345)

        schedule_auto_resolution()

        assert mock_task.apply_async.call_count == 0
        # the explicit opt-out row is durable, not garbage collected
        assert ProjectOption.objects.filter(project=project, key="sentry:resolve_age").exists()
        assert ProjectOption.objects.filter(
            project=project, key="sentry:_last_auto_resolve"
        ).exists()

    @patch("sentry.tasks.auto_resolve_issues.auto_resolve_project_issues")
    def test_none_valued_row_survives_and_is_not_dispatched(self, mock_task: MagicMock) -> None:
        project = self.create_project()
        project.update_option("sentry:resolve_age", None)

        schedule_auto_resolution()

        assert mock_task.apply_async.call_count == 0
        assert ProjectOption.objects.filter(project=project, key="sentry:resolve_age").exists()

    @patch("sentry.tasks.auto_resolve_issues.auto_resolve_project_issues")
    def test_debounce_honored(self, mock_task: MagicMock) -> None:
        project = self.create_project()
        project.update_option("sentry:resolve_age", 1)
        project.update_option("sentry:_last_auto_resolve", int(time()))

        schedule_auto_resolution()

        assert mock_task.apply_async.call_count == 0

    @patch("sentry.tasks.auto_resolve_issues.SCHEDULER_CHUNK_SIZE", 2)
    @patch("sentry.tasks.auto_resolve_issues.auto_resolve_project_issues")
    def test_multi_chunk_scan(self, mock_task: MagicMock) -> None:
        projects = [self.create_project() for _ in range(5)]
        for project in projects:
            project.update_option("sentry:resolve_age", 1)

        schedule_auto_resolution()

        assert mock_task.apply_async.call_count == 5
        dispatched_ids = {call.kwargs["args"][0] for call in mock_task.apply_async.call_args_list}
        assert dispatched_ids == {project.id for project in projects}

    @patch("sentry.tasks.auto_resolve_issues.kick_off_status_syncs")
    def test_records_action_log_as_system(self, mock_kick_off_status_syncs: MagicMock) -> None:
        project = self.create_project()
        project.update_option("sentry:resolve_age", 1)

        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
        )

        with self.assertLogs("sentry.issues.action_log", level="INFO") as action_logs:
            with self.tasks():
                schedule_auto_resolution()

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

        records = [
            r
            for r in action_logs.records
            if r.message == "group.action_log" and getattr(r, "group_id") == str(group.id)
        ]
        assert records, "expected the auto-resolve to emit group.action_log records"
        # Attributed to the system, never the unknown fallback.
        assert {getattr(r, "source") for r in records} == {ActionSource.SYSTEM}
        # The resolve itself is recorded, even though it bypasses update_group_status.
        assert "set_resolved_by_age" in {getattr(r, "action") for r in records}

    @patch("sentry.tasks.auto_resolve_issues.kick_off_status_syncs")
    def test_single_event_performance(self, mock_kick_off_status_syncs: MagicMock) -> None:
        project = self.create_project()

        current_ts = int(time()) - 1

        project.update_option("sentry:resolve_age", 1)

        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
            type=PerformanceSlowDBQueryGroupType.type_id,  # Test that auto_resolve is enabled for legacy performance issues
        )

        with self.tasks():
            schedule_auto_resolution()

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

        mock_kick_off_status_syncs.apply_async.assert_called_once_with(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )

        assert project.get_option("sentry:_last_auto_resolve") > current_ts

    def test_aggregate_performance(self) -> None:
        project = self.create_project()

        project.update_option("sentry:resolve_age", 1)

        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
            type=PerformanceP95EndpointRegressionGroupType.type_id,  # Test that auto_resolve is disabled for SD
        )

        with self.tasks():
            schedule_auto_resolution()

        assert Group.objects.get(id=group.id).status == GroupStatus.UNRESOLVED
