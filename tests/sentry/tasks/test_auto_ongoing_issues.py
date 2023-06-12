from datetime import datetime, timedelta
from unittest.mock import patch

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
from sentry.tasks.auto_ongoing_issues import (
    schedule_auto_transition_new,
    schedule_auto_transition_regressed,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers import apply_feature_flag_on_cls
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


@apply_feature_flag_on_cls("organizations:escalating-issues")
class ScheduleAutoNewOngoingIssuesTest(TestCase):
    @patch("sentry.signals.inbox_in.send_robust")
    def test_simple(self, inbox_in):
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()
        group = self.create_group(
            project=project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        group.first_seen = now - timedelta(days=3, hours=1)
        group.save()

        with self.tasks():
            schedule_auto_transition_new()

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ONGOING

        ongoing_inbox = GroupInbox.objects.filter(group=group).get()
        assert ongoing_inbox.reason == GroupInboxReason.ONGOING.value
        assert ongoing_inbox.date_added >= now
        assert inbox_in.called

        set_ongoing_activity = Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).get()
        assert set_ongoing_activity.data == {"after_days": 3}

        assert GroupHistory.objects.filter(group=group, status=GroupHistoryStatus.ONGOING).exists()

    @patch("sentry.signals.inbox_in.send_robust")
    def test_reprocessed(self, inbox_in):
        now = datetime.now(tz=pytz.UTC)

        project = self.create_project()

        group = self.create_group(
            project=project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        group.first_seen = now - timedelta(days=3, hours=1)
        group.save()

        with self.tasks():
            schedule_auto_transition_new()

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ONGOING

        ongoing_inbox = GroupInbox.objects.filter(group=group).get()
        assert ongoing_inbox.reason == GroupInboxReason.ONGOING.value
        assert ongoing_inbox.date_added >= now
        assert inbox_in.called

    def test_multiple_old_new(self):
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

            if (now - first_seen).days >= 3:
                older_groups.append(group)
            else:
                new_groups.append(group)
        # before
        assert Group.objects.filter(project_id=project.id).count() == len(older_groups) + len(
            new_groups
        )

        with self.tasks():
            schedule_auto_transition_new()

        # after
        assert Group.objects.filter(project_id=project.id).count() == len(older_groups) + len(
            new_groups
        )
        assert GroupInbox.objects.filter(project=project).count() == len(older_groups)
        assert GroupInbox.objects.filter(
            project_id=project.id, reason=GroupInboxReason.ONGOING.value
        ).count() == len(older_groups)

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

    def test_paginated_transition(self):
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()

        groups = Group.objects.bulk_create(
            [
                Group(
                    project=project,
                    status=GroupStatus.UNRESOLVED,
                    substatus=GroupSubStatus.NEW,
                    first_seen=now - timedelta(days=3, hours=idx, minutes=1),
                )
                for idx in range(1010)
            ]
        )

        # before
        assert Group.objects.filter(project_id=project.id).count() == len(groups) == 1010

        with self.tasks():
            schedule_auto_transition_new()

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
        assert set(
            GroupInbox.objects.filter(
                project=project, reason=GroupInboxReason.ONGOING.value
            ).values_list("group_id", flat=True)
        ) == {g.id for g in groups}


@apply_feature_flag_on_cls("organizations:escalating-issues")
class ScheduleAutoRegressedOngoingIssuesTest(TestCase):
    @patch("sentry.signals.inbox_in.send_robust")
    def test_simple(self, inbox_in):
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()
        group = self.create_group(
            project=project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.REGRESSED,
            first_seen=now - timedelta(days=3, hours=1),
        )
        group_inbox = add_group_to_inbox(group, GroupInboxReason.REGRESSION)
        group_inbox.date_added = now - timedelta(days=3, hours=1)
        group_inbox.save(update_fields=["date_added"])
        group_history = record_group_history(
            group, GroupHistoryStatus.REGRESSED, actor=None, release=None
        )
        group_history.date_added = now - timedelta(days=3, hours=1)
        group_history.save(update_fields=["date_added"])

        with self.tasks():
            schedule_auto_transition_regressed()

        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ONGOING

        ongoing_inbox = GroupInbox.objects.filter(group=group).get()
        assert ongoing_inbox.reason == GroupInboxReason.ONGOING.value
        assert ongoing_inbox.date_added >= now
        assert inbox_in.called

        set_ongoing_activity = Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).get()
        assert set_ongoing_activity.data == {"after_days": 3}

        assert GroupHistory.objects.filter(group=group, status=GroupHistoryStatus.ONGOING).exists()
