from sentry.models.activity import Activity
from sentry.models.groupinbox import (
    GroupInbox,
    GroupInboxReason,
    GroupInboxRemoveAction,
    add_group_to_inbox,
    remove_group_from_inbox,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType


@region_silo_test
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

    def test_invalid_reason_details(self):
        reason_details = {"meow": 123}
        add_group_to_inbox(self.group, GroupInboxReason.NEW, reason_details)
        assert GroupInbox.objects.get(group=self.group.id).reason_details is None
