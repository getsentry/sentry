from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupInbox, GroupStatus
from sentry.models.groupinbox import add_group_to_inbox, GroupInboxReason
from sentry.tasks.auto_review_inbox import schedule_auto_review_inbox
from sentry.testutils import TestCase


class ClearExpiredSnoozesTest(TestCase):
    def test_task_persistent_name(self):
        assert schedule_auto_review_inbox.name == "sentry.tasks.schedule_auto_review_inbox"

    def test_old_group_inbox_is_removed(self):
        project = self.create_project()
        group1 = self.create_group(status=GroupStatus.UNRESOLVED, project=project)
        add_group_to_inbox(group1, GroupInboxReason.NEW)

        group2 = self.create_group(status=GroupStatus.UNRESOLVED, project=project)
        group_inbox = add_group_to_inbox(group2, GroupInboxReason.NEW)
        group_inbox.date_added = timezone.now() - timedelta(days=8)
        group_inbox.save()

        with self.tasks():
            schedule_auto_review_inbox()

        assert GroupInbox.objects.filter(group=group1).exists()
        assert GroupInbox.objects.filter(group=group2).exists() is False
