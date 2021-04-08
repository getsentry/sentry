from datetime import timedelta

from django.utils import timezone

from sentry.models import GroupInbox, GroupStatus
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
from sentry.tasks.auto_remove_inbox import auto_remove_inbox
from sentry.testutils import TestCase


class ClearExpiredSnoozesTest(TestCase):
    def test_task_persistent_name(self):
        assert auto_remove_inbox.name == "sentry.tasks.auto_remove_inbox"

    def test_old_group_inbox_is_removed(self):
        project = self.create_project()
        group1 = self.create_group(status=GroupStatus.UNRESOLVED, project=project)
        add_group_to_inbox(group1, GroupInboxReason.NEW)

        group2 = self.create_group(status=GroupStatus.UNRESOLVED, project=project)
        group_inbox = add_group_to_inbox(group2, GroupInboxReason.NEW)
        group_inbox.date_added = timezone.now() - timedelta(days=8)
        group_inbox.save()

        auto_remove_inbox()

        assert GroupInbox.objects.filter(group=group1).exists()
        assert GroupInbox.objects.filter(group=group2).exists() is False
