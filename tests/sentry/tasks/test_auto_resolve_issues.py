from datetime import timedelta
from time import time
from unittest.mock import patch

from django.utils import timezone

from sentry.issues.grouptype import (
    PerformanceDurationRegressionGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.models.group import Group, GroupStatus
from sentry.tasks.auto_resolve_issues import schedule_auto_resolution
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class ScheduleAutoResolutionTest(TestCase):
    @patch("sentry.tasks.auto_ongoing_issues.backend")
    def test_task_persistent_name(self, mock_backend):
        mock_backend.get_size.return_value = 0
        assert schedule_auto_resolution.name == "sentry.tasks.schedule_auto_resolution"

    @patch("sentry.analytics.record")
    @patch("sentry.tasks.auto_ongoing_issues.backend")
    @patch("sentry.tasks.auto_resolve_issues.kick_off_status_syncs")
    def test_simple(self, mock_kick_off_status_syncs, mock_backend, mock_record):
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

        mock_backend.get_size.return_value = 0

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
        # this should get cleaned up since it had no resolve age set
        assert not project4.get_option("sentry:_last_auto_resolve")
        mock_record.assert_any_call(
            "issue.auto_resolved",
            project_id=project.id,
            organization_id=project.organization_id,
            group_id=group1.id,
            issue_type="error",
            issue_category="error",
        )

    @patch("sentry.tasks.auto_ongoing_issues.backend")
    @patch("sentry.tasks.auto_resolve_issues.kick_off_status_syncs")
    def test_single_event_performance(self, mock_kick_off_status_syncs, mock_backend):
        project = self.create_project()

        current_ts = int(time()) - 1

        project.update_option("sentry:resolve_age", 1)

        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
            type=PerformanceSlowDBQueryGroupType.type_id,  # Test that auto_resolve is enabled for legacy performance issues
        )

        mock_backend.get_size.return_value = 0

        with self.tasks():
            schedule_auto_resolution()

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

        mock_kick_off_status_syncs.apply_async.assert_called_once_with(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )

        assert project.get_option("sentry:_last_auto_resolve") > current_ts

    @patch("sentry.tasks.auto_ongoing_issues.backend")
    @patch("sentry.tasks.auto_resolve_issues.kick_off_status_syncs")
    @with_feature("organizations:issue-platform-crons-sd")
    def test_single_event_performance_ff_enabled(self, mock_kick_off_status_syncs, mock_backend):
        project = self.create_project()

        current_ts = int(time()) - 1

        project.update_option("sentry:resolve_age", 1)

        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
            type=PerformanceSlowDBQueryGroupType.type_id,  # Test that auto_resolve is enabled for legacy performance issues
        )

        mock_backend.get_size.return_value = 0

        with self.tasks():
            schedule_auto_resolution()

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

        mock_kick_off_status_syncs.apply_async.assert_called_once_with(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )

        assert project.get_option("sentry:_last_auto_resolve") > current_ts

    @patch("sentry.tasks.auto_ongoing_issues.backend")
    @patch("sentry.tasks.auto_resolve_issues.kick_off_status_syncs")
    def test_aggregate_performance(self, mock_kick_off_status_syncs, mock_backend):
        project = self.create_project()

        current_ts = int(time()) - 1

        project.update_option("sentry:resolve_age", 1)

        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
            type=PerformanceDurationRegressionGroupType.type_id,  # Test that auto_resolve is disabled for SD
        )

        mock_backend.get_size.return_value = 0

        with self.tasks():
            schedule_auto_resolution()

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

        mock_kick_off_status_syncs.apply_async.assert_called_once_with(
            kwargs={"project_id": group.project_id, "group_id": group.id}
        )

        assert project.get_option("sentry:_last_auto_resolve") > current_ts

    @patch("sentry.tasks.auto_ongoing_issues.backend")
    @with_feature("organizations:issue-platform-crons-sd")
    def test_aggregate_performance_ff_enabled(self, mock_backend):
        project = self.create_project()

        project.update_option("sentry:resolve_age", 1)

        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            last_seen=timezone.now() - timedelta(days=1),
            type=PerformanceDurationRegressionGroupType.type_id,  # Test that auto_resolve is disabled for SD
        )

        mock_backend.get_size.return_value = 0

        with self.tasks():
            schedule_auto_resolution()

        assert Group.objects.get(id=group.id).status == GroupStatus.UNRESOLVED
