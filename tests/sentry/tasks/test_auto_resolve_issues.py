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
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.project import Project
from sentry.silo.base import SiloMode
from sentry.tasks.auto_resolve_issues import auto_resolve_project_issues, schedule_auto_resolution
from sentry.tasks.clear_expired_snoozes import clear_expired_snoozes
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode
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
@pytest.mark.parametrize("reopen", [_reopen_through_api, _reopen_through_manager])
def test_failed_reopening_activity_rolls_back_status(
    factories: Factories, default_project: Project, reopen: Callable[[Group], None]
) -> None:
    group = factories.create_group(project=default_project, status=GroupStatus.RESOLVED)
    with (
        patch.object(Activity.objects, "create", side_effect=RuntimeError("activity failed")),
        patch("sentry.signals.issue_unresolved.send_robust") as unresolved,
        pytest.raises(RuntimeError, match="activity failed"),
    ):
        reopen(group)

    group.refresh_from_db()
    assert group.status == GroupStatus.RESOLVED
    unresolved.assert_not_called()


@django_db_all
@pytest.mark.parametrize(
    "activity_type, expected_status",
    [
        (ActivityType.SET_UNRESOLVED, GroupStatus.UNRESOLVED),
        (ActivityType.AUTO_SET_ONGOING, GroupStatus.RESOLVED),
        (ActivityType.SET_REGRESSION, GroupStatus.RESOLVED),
        (ActivityType.SET_ESCALATING, GroupStatus.RESOLVED),
        (ActivityType.SET_RESOLVED, GroupStatus.RESOLVED),
    ],
)
def test_recent_activity(
    factories: Factories,
    default_project: Project,
    activity_type: ActivityType,
    expected_status: int,
) -> None:
    default_project.update_option("sentry:resolve_age", 24)
    last_seen = timezone.now() - timedelta(days=2)
    group = factories.create_group(project=default_project, last_seen=last_seen)
    factories.create_group_activity(group, type=activity_type.value)

    auto_resolve_project_issues(default_project.id)

    group.refresh_from_db()
    assert group.status == expected_status
    assert group.last_seen == last_seen


@django_db_all
@freeze_time()
@pytest.mark.parametrize(
    "seconds_after_cutoff, expected_status",
    [(-1, GroupStatus.RESOLVED), (0, GroupStatus.RESOLVED), (1, GroupStatus.UNRESOLVED)],
)
def test_reopening_cutoff(
    factories: Factories,
    default_project: Project,
    seconds_after_cutoff: int,
    expected_status: int,
) -> None:
    default_project.update_option("sentry:resolve_age", 2)
    group = factories.create_group(
        project=default_project, last_seen=timezone.now() - timedelta(days=2)
    )
    factories.create_group_activity(
        group,
        type=ActivityType.SET_UNRESOLVED.value,
        datetime=timezone.now() - timedelta(hours=2) + timedelta(seconds=seconds_after_cutoff),
    )

    auto_resolve_project_issues(default_project.id)

    group.refresh_from_db()
    assert group.status == expected_status


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

    def test_recently_reopened_issues_do_not_fill_chunks(self) -> None:
        self.project.update_option("sentry:resolve_age", 1)
        reopened = self.create_group(last_seen=timezone.now() - timedelta(days=1))
        self.create_group_activity(reopened, type=ActivityType.SET_UNRESOLVED.value)
        eligible = self.create_group(last_seen=timezone.now() - timedelta(days=1))
        another_eligible = self.create_group(last_seen=timezone.now() - timedelta(days=1))

        with self.tasks():
            auto_resolve_project_issues(self.project.id, chunk_size=1)

        reopened.refresh_from_db()
        eligible.refresh_from_db()
        another_eligible.refresh_from_db()
        assert reopened.status == GroupStatus.UNRESOLVED
        assert eligible.status == GroupStatus.RESOLVED
        assert another_eligible.status == GroupStatus.RESOLVED

    def test_activity_without_group_does_not_exclude_every_issue(self) -> None:
        self.project.update_option("sentry:resolve_age", 1)
        group = self.create_group(last_seen=timezone.now() - timedelta(days=1))
        activity = self.create_group_activity(group, type=ActivityType.SET_UNRESOLVED.value)
        activity.update(group=None)

        auto_resolve_project_issues(self.project.id)

        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED

    def test_failed_resolution_rolls_back_without_notifications(self) -> None:
        self.project.update_option("sentry:resolve_age", 1)
        group = self.create_group(last_seen=timezone.now() - timedelta(days=1))
        add_group_to_inbox(group, GroupInboxReason.NEW)

        with (
            patch(
                "sentry.tasks.auto_resolve_issues.record_group_history",
                side_effect=RuntimeError("history failed"),
            ),
            patch("sentry.tasks.auto_resolve_issues.kick_off_status_syncs") as sync,
            patch("sentry.signals.issue_resolved.send_robust") as resolved,
            pytest.raises(RuntimeError, match="history failed"),
        ):
            auto_resolve_project_issues(self.project.id)

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert GroupInbox.objects.filter(group=group).exists()
        assert not Activity.objects.filter(
            group=group, type=ActivityType.SET_RESOLVED_BY_AGE.value
        ).exists()
        sync.apply_async.assert_not_called()
        resolved.assert_not_called()

    def test_reopening_after_selection_is_rechecked(self) -> None:
        self.project.update_option("sentry:resolve_age", 1)
        group = self.create_group(last_seen=timezone.now() - timedelta(days=1))
        add_group_to_inbox(group, GroupInboxReason.NEW)
        open_period = GroupOpenPeriod.objects.get(group=group)
        select_for_update = Group.objects.select_for_update

        def reopen_before_lock(*args, **kwargs):
            # Another resolver closes the selected issue, then a user reopens it.
            group.update(status=GroupStatus.RESOLVED)
            Group.objects.update_group_status(
                groups=[group],
                status=GroupStatus.UNRESOLVED,
                substatus=group.substatus,
                activity_type=ActivityType.SET_UNRESOLVED,
            )
            return select_for_update(*args, **kwargs)

        with (
            patch.object(Group.objects, "select_for_update", side_effect=reopen_before_lock),
            patch("sentry.tasks.auto_resolve_issues.kick_off_status_syncs") as sync,
            patch("sentry.tasks.auto_resolve_issues.issue_resolved.send_robust") as resolved,
            patch("sentry.tasks.auto_resolve_issues.analytics.record") as analytics,
        ):
            auto_resolve_project_issues(self.project.id)

        group.refresh_from_db()
        open_period.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert open_period.date_ended is None
        assert GroupInbox.objects.filter(group=group).exists()
        assert not Activity.objects.filter(
            group=group, type=ActivityType.SET_RESOLVED_BY_AGE.value
        ).exists()
        sync.apply_async.assert_not_called()
        resolved.assert_not_called()
        analytics.assert_not_called()


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

        with freeze_time(reopened_at + timedelta(minutes=59)):
            auto_resolve_project_issues(self.project.id)
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.last_seen == last_seen

        with freeze_time(reopened_at + timedelta(hours=1)):
            auto_resolve_project_issues(self.project.id)
        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED

    def test_sentry_app_reopening_resets_the_clock(self) -> None:
        self.project.update_option("sentry:resolve_age", 1)
        app = self.create_sentry_app(
            organization=self.organization, scopes=["event:write", "event:read"]
        )
        installation = self.create_sentry_app_installation(
            organization=self.organization, slug=app.slug, user=self.user
        )
        group = self.create_group(
            status=GroupStatus.RESOLVED, last_seen=timezone.now() - timedelta(days=1)
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = installation.api_token.token

        response = self.client.put(
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/",
            data={"status": "unresolved"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        assert response.status_code == 200
        auto_resolve_project_issues(self.project.id)

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED

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
