from datetime import datetime, timedelta
from unittest.mock import patch

import pytz

from sentry.models import Group, GroupInbox, GroupInboxReason, GroupStatus, add_group_to_inbox
from sentry.tasks.auto_ongoing_issues import schedule_auto_transition
from sentry.testutils import TestCase
from sentry.testutils.helpers import apply_feature_flag_on_cls
from sentry.types.group import GroupSubStatus


@apply_feature_flag_on_cls("organizations:issue-states-auto-transition-new-ongoing")
class ScheduleAutoOngoingIssuesTest(TestCase):
    @patch("sentry.signals.inbox_in.send_robust")
    def test_simple(self, inbox_in):
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()
        group = self.create_group(
            project=project,
        )
        group_inbox = add_group_to_inbox(group, GroupInboxReason.NEW)
        group_inbox.date_added = now - timedelta(days=3, hours=1)
        group_inbox.save()

        with self.tasks():
            schedule_auto_transition()

        ongoing_inbox = GroupInbox.objects.filter(group=group).get()
        assert ongoing_inbox.reason == GroupInboxReason.ONGOING.value
        assert ongoing_inbox.date_added >= now
        assert inbox_in.called

    @patch("sentry.signals.inbox_in.send_robust")
    def test_reprocessed(self, inbox_in):
        now = datetime.now(tz=pytz.UTC)

        project = self.create_project()

        group = self.create_group(
            project=project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW
        )
        group_inbox = add_group_to_inbox(group, GroupInboxReason.REPROCESSED)
        group_inbox.date_added = now - timedelta(days=3, hours=1)
        group_inbox.save()

        with self.tasks():
            schedule_auto_transition()

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

            group_inbox = add_group_to_inbox(group, GroupInboxReason.NEW)
            date_added = now - timedelta(days=day, hours=hours)
            group_inbox.date_added = date_added
            group_inbox.save()

            if (now - date_added).days >= 3:
                older_groups.append(group)
            else:
                new_groups.append(group)
        # before
        assert Group.objects.filter(project_id=project.id).count() == len(older_groups) + len(
            new_groups
        )
        assert GroupInbox.objects.filter(
            project=project, reason=GroupInboxReason.NEW.value
        ).count() == len(new_groups) + len(older_groups)

        with self.tasks():
            schedule_auto_transition()

        # after
        assert Group.objects.filter(project_id=project.id).count() == len(older_groups) + len(
            new_groups
        )
        assert GroupInbox.objects.filter(project=project).count() == len(older_groups) + len(
            new_groups
        )
        assert GroupInbox.objects.filter(
            project=project, reason=GroupInboxReason.NEW.value
        ).count() == len(new_groups)

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
        groups = []
        for hours in range(1, 2011):
            group = self.create_group(
                project=project,
                status=GroupStatus.UNRESOLVED,
                substatus=GroupSubStatus.NEW,
            )

            group_inbox = add_group_to_inbox(group, GroupInboxReason.NEW)
            date_added = now - timedelta(days=3, hours=hours)
            group_inbox.date_added = date_added
            group_inbox.save()
            groups.append(group)

        # before
        assert Group.objects.filter(project_id=project.id).count() == len(groups) == 2010
        assert (
            GroupInbox.objects.filter(project=project, reason=GroupInboxReason.NEW.value).count()
            == len(groups)
            == 2010
        )

        with self.tasks():
            schedule_auto_transition()

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
