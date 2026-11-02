from collections.abc import Callable
from datetime import timedelta
from time import time
from unittest.mock import MagicMock, patch

import pytest
from django.db import connections
from django.utils import timezone

from sentry.analytics.events.issue_auto_resolved import IssueAutoResolvedEvent
from sentry.api.helpers.group_index.update import handle_other_status_updates
from sentry.issues.action_log import ActionSource
from sentry.issues.grouptype import (
    PerformanceP95EndpointRegressionGroupType,
    PerformanceSlowDBQueryGroupType,
)
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.tasks.auto_resolve_issues import auto_resolve_project_issues, schedule_auto_resolution
from sentry.tasks.clear_expired_snoozes import clear_expired_snoozes
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor


def _reopen_through_api(group: Group) -> None:
    handle_other_status_updates(
        result={"status": "unresolved"},
        group_list=[group],
        projects=[group.project],
        project_lookup={group.project_id: group.project},
        status_details={},
        acting_user=None,
    )


def _reopen_through_manager(group: Group) -> None:
    Group.objects.update_group_status(
        groups=[group],
        status=GroupStatus.UNRESOLVED,
        substatus=GroupSubStatus.ONGOING,
        activity_type=ActivityType.SET_UNRESOLVED,
    )


@django_db_all(transaction=True)
@pytest.mark.parametrize("reopen", [_reopen_through_api, _reopen_through_manager])
def test_reopening_and_activity_are_visible_together(
    factories: Factories, default_project: Project, reopen: Callable[[Group], None]
) -> None:
    group = factories.create_group(project=default_project, status=GroupStatus.RESOLVED)
    create_activity = Activity.objects.create

    def read_status() -> int:
        try:
            return Group.objects.get(id=group.id, project_id=default_project.id).status
        finally:
            connections.close_all()

    with ContextPropagatingThreadPoolExecutor(max_workers=1) as executor:

        def observe_status_before_activity(**kwargs):
            # A second connection must still see RESOLVED until the Activity is
            # written and the reopening transaction commits.
            assert executor.submit(read_status).result(timeout=10) == GroupStatus.RESOLVED
            return create_activity(**kwargs)

        with patch.object(Activity.objects, "create", side_effect=observe_status_before_activity):
            reopen(group)

        assert executor.submit(read_status).result(timeout=10) == GroupStatus.UNRESOLVED

    assert Activity.objects.filter(group=group, type=ActivityType.SET_UNRESOLVED.value).exists()


@django_db_all
@pytest.mark.parametrize(
    "activity_type",
    [ActivityType.AUTO_SET_ONGOING, ActivityType.SET_REGRESSION, ActivityType.SET_ESCALATING],
)
def test_automatic_transitions_do_not_reset_the_clock(
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
