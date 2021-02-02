from sentry.testutils import TestCase
from sentry.models import (
    Activity,
    add_group_to_inbox,
    GroupInbox,
    GroupInboxReason,
    GroupInboxRemoveAction,
    remove_group_from_inbox,
)
from sentry.utils.compat.mock import patch


class GroupInboxTestCase(TestCase):
    @patch("sentry.signals.inbox_in.send_robust")
    def test_add_to_inbox(self, inbox_in):
        add_group_to_inbox(self.group, GroupInboxReason.NEW)
        assert GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()
        assert not inbox_in.called
        add_group_to_inbox(self.group, GroupInboxReason.REGRESSION)
        assert GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()
        assert inbox_in.called

    @patch("sentry.signals.inbox_out.send_robust")
    def test_remove_from_inbox(self, inbox_out):
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
        assert activities[0].type == Activity.MARK_REVIEWED
        assert inbox_out.called

    def test_invalid_reason_details(self):
        reason_details = {"meow": 123}
        add_group_to_inbox(self.group, GroupInboxReason.NEW, reason_details)
        assert GroupInbox.objects.get(group=self.group.id).reason_details is None
