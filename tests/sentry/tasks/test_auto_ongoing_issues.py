from datetime import datetime, timedelta
from unittest import mock

import pytz

from sentry.models import (
    Activity,
    Group,
    GroupHistory,
    GroupHistoryStatus,
    GroupInbox,
    GroupInboxReason,
    GroupStatus,
    add_group_to_inbox,
    record_group_history,
)
from sentry.receivers import create_default_projects
from sentry.tasks.auto_ongoing_issues import (
    TRANSITION_AFTER_DAYS,
    auto_transition_issues_new_to_ongoing,
    schedule_auto_transition_to_ongoing,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers import apply_feature_flag_on_cls
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


@apply_feature_flag_on_cls("organizations:escalating-issues")
class ScheduleAutoNewOngoingIssuesTest(TestCase):
    @mock.patch("sentry.tasks.auto_ongoing_issues.backend")
    def test_simple(self, mock_backend):
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()
        group = self.create_group(
            project=project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        group.first_seen = now - timedelta(days=TRANSITION_AFTER_DAYS, hours=1)
        group.save()

        mock_backend.get_size.return_value = 0

        with self.tasks():
            schedule_auto_transition_to_ongoing()

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ONGOING

        assert not GroupInbox.objects.filter(group=group).exists()

        set_ongoing_activity = Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).get()
        assert set_ongoing_activity.data == {"after_days": 7}

        assert GroupHistory.objects.filter(group=group, status=GroupHistoryStatus.ONGOING).exists()

    @mock.patch("sentry.tasks.auto_ongoing_issues.backend")
    def test_reprocessed(self, mock_backend):
        now = datetime.now(tz=pytz.UTC)

        project = self.create_project()

        group = self.create_group(
            project=project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        group.first_seen = now - timedelta(days=TRANSITION_AFTER_DAYS, hours=1)
        group.save()

        mock_backend.get_size.return_value = 0

        with self.tasks():
            schedule_auto_transition_to_ongoing()

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ONGOING

        assert not GroupInbox.objects.filter(group=group).exists()

    @mock.patch("sentry.tasks.auto_ongoing_issues.backend")
    def test_multiple_old_new(self, mock_backend):
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()
        new_groups = []
        older_groups = []
        for day, hours in [
            (0, 0),
            (1, 1),
            (2, 2),
            (2, 9),  # recent group_inbox should stay the same
            (3, 1),
            (3, 2),
            (3, 3),
            (3, 12),
            (3, 15),
            (3, 18),
            (3, 21),
            (3, 24),  # 3+ day olds ones
            (7, 14),
            (12, 1),
            (15, 5),
            (17, 2),  # really old issues
        ]:
            group = self.create_group(
                project=project,
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.NEW,
            )
            first_seen = now - timedelta(days=day, hours=hours)
            group.first_seen = first_seen
            group.save()

            if (now - first_seen).days >= 7:
                older_groups.append(group)
            else:
                new_groups.append(group)
        # before
        assert Group.objects.filter(project_id=project.id).count() == len(older_groups) + len(
            new_groups
        )

        mock_backend.get_size.return_value = 0

        with self.tasks():
            schedule_auto_transition_to_ongoing()

        # after
        assert Group.objects.filter(project_id=project.id).count() == len(older_groups) + len(
            new_groups
        )
        assert not GroupInbox.objects.filter(group=group).exists()

        assert set(
            Group.objects.filter(
                project=project,
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.NEW,
            ).values_list("id", flat=True)
        ) == {g.id for g in new_groups}
        assert set(
            Group.objects.filter(
                project=project,
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.ONGOING,
            ).values_list("id", flat=True)
        ) == {g.id for g in older_groups}

    @mock.patch("sentry.tasks.auto_ongoing_issues.backend")
    @mock.patch(
        "sentry.tasks.auto_ongoing_issues.auto_transition_issues_new_to_ongoing.delay",
        wraps=lambda project_ids, first_seen_lte, **kwargs: auto_transition_issues_new_to_ongoing(
            project_ids, first_seen_lte, kwargs=kwargs
        ),
    )
    def test_paginated_transition(self, mocked, mock_backend):
        create_default_projects()
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()

        groups = Group.objects.bulk_create(
            [
                Group(
                    project=project,
                    status=GroupStatus.UNRESOLVED,
                    substatus=GroupSubStatus.NEW,
                    first_seen=now - timedelta(days=TRANSITION_AFTER_DAYS, hours=idx, minutes=1),
                )
                for idx in range(12)
            ]
        )

        mock_backend.get_size.return_value = 0

        # before
        assert Group.objects.filter(project_id=project.id).count() == len(groups) == 12

        with self.tasks():
            schedule_auto_transition_to_ongoing()

        # Should create a new task for each project
        assert mocked.call_count == 2

        # after
        assert (
            Group.objects.filter(
                project=project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
            ).count()
            == 0
        )
        assert set(
            Group.objects.filter(
                project=project,
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.ONGOING,
            ).values_list("id", flat=True)
        ) == {g.id for g in groups}


@apply_feature_flag_on_cls("organizations:escalating-issues")
class ScheduleAutoRegressedOngoingIssuesTest(TestCase):
    @mock.patch("sentry.tasks.auto_ongoing_issues.backend")
    def test_simple(self, mock_backend):
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()
        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.REGRESSED,
            first_seen=now - timedelta(days=TRANSITION_AFTER_DAYS, hours=1),
        )
        group_inbox = add_group_to_inbox(group, GroupInboxReason.REGRESSION)
        group_inbox.date_added = now - timedelta(days=TRANSITION_AFTER_DAYS, hours=1)
        group_inbox.save(update_fields=["date_added"])
        group_history = record_group_history(
            group, GroupHistoryStatus.REGRESSED, actor=None, release=None
        )
        group_history.date_added = now - timedelta(days=TRANSITION_AFTER_DAYS, hours=1)
        group_history.save(update_fields=["date_added"])

        mock_backend.get_size.return_value = 0

        with self.tasks():
            schedule_auto_transition_to_ongoing()

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ONGOING

        set_ongoing_activity = Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).get()
        assert set_ongoing_activity.data == {"after_days": 7}

        assert GroupHistory.objects.filter(group=group, status=GroupHistoryStatus.ONGOING).exists()


@apply_feature_flag_on_cls("organizations:escalating-issues")
class ScheduleAutoEscalatingOngoingIssuesTest(TestCase):
    @mock.patch("sentry.tasks.auto_ongoing_issues.backend")
    def test_simple(self, mock_backend):
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()
        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
            first_seen=now - timedelta(days=TRANSITION_AFTER_DAYS, hours=1),
        )
        group_inbox = add_group_to_inbox(group, GroupInboxReason.ESCALATING)
        group_inbox.date_added = now - timedelta(days=TRANSITION_AFTER_DAYS, hours=1)
        group_inbox.save(update_fields=["date_added"])
        group_history = record_group_history(
            group, GroupHistoryStatus.ESCALATING, actor=None, release=None
        )
        group_history.date_added = now - timedelta(days=TRANSITION_AFTER_DAYS, hours=1)
        group_history.save(update_fields=["date_added"])

        mock_backend.get_size.return_value = 0

        with self.tasks():
            schedule_auto_transition_to_ongoing()

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ONGOING

        set_ongoing_activity = Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).get()
        assert set_ongoing_activity.data == {"after_days": 7}

        assert GroupHistory.objects.filter(group=group, status=GroupHistoryStatus.ONGOING).exists()
