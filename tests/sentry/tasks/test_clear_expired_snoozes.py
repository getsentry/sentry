from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.models import Group, GroupSnooze, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.tasks.clear_expired_snoozes import clear_expired_snoozes
from sentry.testutils import TestCase


class ClearExpiredSnoozesTest(TestCase):
    def test_task_persistent_name(self):
        assert clear_expired_snoozes.name == "sentry.tasks.clear_expired_snoozes"

    @patch("sentry.signals.issue_unignored.send_robust")
    def test_simple(self, send_robust):
        group1 = self.create_group(status=GroupStatus.IGNORED)
        snooze1 = GroupSnooze.objects.create(
            group=group1, until=timezone.now() - timedelta(minutes=1)
        )

        group2 = self.create_group(status=GroupStatus.IGNORED)
        snooze2 = GroupSnooze.objects.create(
            group=group2, until=timezone.now() + timedelta(minutes=1)
        )

        clear_expired_snoozes()

        assert Group.objects.get(id=group1.id).status == GroupStatus.UNRESOLVED

        assert Group.objects.get(id=group2.id).status == GroupStatus.IGNORED

        assert not GroupSnooze.objects.filter(id=snooze1.id).exists()
        assert GroupSnooze.objects.filter(id=snooze2.id).exists()
        assert GroupHistory.objects.filter(
            group=group1, status=GroupHistoryStatus.UNIGNORED
        ).exists()
        assert not GroupHistory.objects.filter(
            group=group2, status=GroupHistoryStatus.UNIGNORED
        ).exists()

        assert send_robust.called

    def test_resolved_group(self):
        group1 = self.create_group(status=GroupStatus.RESOLVED)
        snooze1 = GroupSnooze.objects.create(
            group=group1, until=timezone.now() - timedelta(minutes=1)
        )

        clear_expired_snoozes()

        assert Group.objects.get(id=group1.id).status == GroupStatus.RESOLVED
        # Validate that even though the group wasn't modified, we still remove the snooze
        assert not GroupSnooze.objects.filter(id=snooze1.id).exists()
