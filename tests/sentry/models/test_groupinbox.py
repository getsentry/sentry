from sentry.models.activity import Activity
from sentry.models.groupinbox import (
    GroupInbox,
    GroupInboxReason,
    GroupInboxRemoveAction,
    add_group_to_inbox,
    remove_group_from_inbox,
)
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class GroupInboxTestCase(TestCase):
    def test_add_to_inbox(self):
        add_group_to_inbox(self.group, GroupInboxReason.NEW)
        assert GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()

        add_group_to_inbox(self.group, GroupInboxReason.REGRESSION)
        assert GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()

    def test_remove_from_inbox(self):
        add_group_to_inbox(self.group, GroupInboxReason.NEW)
        assert GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()
        remove_group_from_inbox(
            self.group, user=self.user, action=GroupInboxRemoveAction.MARK_REVIEWED
        )
        assert not GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()
        activities = Activity.objects.all()
        assert len(activities) == 1
        assert activities[0].type == ActivityType.MARK_REVIEWED.value
