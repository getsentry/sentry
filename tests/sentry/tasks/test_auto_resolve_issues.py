from datetime import datetime, timedelta
from time import time
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from sentry.analytics.events.issue_auto_resolved import IssueAutoResolvedEvent
from sentry.issues.action_log import ActionSource
from sentry.issues.grouptype import (
    PerformanceP95EndpointRegressionGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.models.project import Project
from sentry.tasks.auto_resolve_issues import auto_resolve_project_issues, schedule_auto_resolution
from sentry.tasks.clear_expired_snoozes import clear_expired_snoozes
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType


@django_db_all
@pytest.mark.parametrize(
    "activity_type",
    [ActivityType.AUTO_SET_ONGOING, ActivityType.SET_REGRESSION, ActivityType.SET_ESCALATING],
)
def test_regression_escalation_and_auto_ongoing_do_not_reset_the_clock(
    factories: Factories, default_project: Project, activity_type: ActivityType
) -> None:
    default_project.update_option("sentry:resolve_age", 1)
    group = factories.create_group(
        project=default_project, last_seen=timezone.now() - timedelta(days=1)
    )
    factories.create_group_activity(group, type=activity_type.value)

    auto_resolve_project_issues(default_project.id)

    group.refresh_from_db()
    assert group.status == GroupStatus.RESOLVED


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
        # this should get cleaned up since it had no resolve age set
        assert not project4.get_option("sentry:_last_auto_resolve")
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


class AutoResolutionReopeningTest(APITestCase):
    @freeze_time()
    def test_api_reopening_resets_the_clock(self) -> None:
        self.login_as(self.user)
        self.project.update_option("sentry:resolve_age", 1)
        last_seen = timezone.now() - timedelta(days=1)
        group = self.create_group(last_seen=last_seen)
        auto_resolve_project_issues(self.project.id)
        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED

        response = self.client.put(
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/",
            data={"status": "unresolved"},
            format="json",
        )
        assert response.status_code == 200
        reopened_at = timezone.now()

        other_issues = [self.create_group(last_seen=last_seen) for _ in range(2)]
        with freeze_time(reopened_at + timedelta(minutes=59)), self.tasks():
            auto_resolve_project_issues(self.project.id, chunk_size=1)
        assert set(
            Group.objects.filter(id__in=[issue.id for issue in other_issues]).values_list(
                "status", flat=True
            )
        ) == {GroupStatus.RESOLVED}
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.last_seen == last_seen

        with freeze_time(reopened_at + timedelta(hours=1)):
            auto_resolve_project_issues(self.project.id)
        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED

    def test_reopening_after_selection_preserves_status_and_inbox(self) -> None:
        self.login_as(self.user)
        self.project.update_option("sentry:resolve_age", 1)
        now = timezone.now()
        group = self.create_group(last_seen=now - timedelta(days=1))
        add_group_to_inbox(group, GroupInboxReason.NEW)

        def reopen_before_update() -> datetime:
            group.update(status=GroupStatus.RESOLVED)
            response = self.client.put(
                f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/",
                data={"status": "unresolved"},
                format="json",
            )
            assert response.status_code == 200
            return now

        # The resolution timestamp is read after selection, before the UPDATE.
        with patch("sentry.tasks.auto_resolve_issues.django_timezone") as task_clock:
            task_clock.now.side_effect = reopen_before_update
            auto_resolve_project_issues(
                self.project.id, cutoff=int((now - timedelta(hours=1)).timestamp())
            )

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert GroupInbox.objects.filter(group=group).exists()
        assert not Activity.objects.filter(
            group=group, type=ActivityType.SET_RESOLVED_BY_AGE.value
        ).exists()

    @freeze_time()
    def test_expired_snooze_resets_the_clock(self) -> None:
        self.login_as(self.user)
        self.project.update_option("sentry:resolve_age", 1)
        group = self.create_group(last_seen=timezone.now() - timedelta(days=1))
        response = self.client.put(
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/",
            data={"status": "ignored", "statusDetails": {"ignoreDuration": 60}},
            format="json",
        )
        assert response.status_code == 200

        with freeze_time(timezone.now() + timedelta(hours=1, seconds=1)):
            clear_expired_snoozes()
            auto_resolve_project_issues(self.project.id)

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
