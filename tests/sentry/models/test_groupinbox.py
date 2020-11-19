from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.models import add_group_to_inbox, GroupInbox, GroupInboxReason, remove_group_from_inbox


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
        remove_group_from_inbox(self.group)
        assert not GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()

    def test_invalid_reason_details(self):
        reason_details = {"meow": 123}
        add_group_to_inbox(self.group, GroupInboxReason.NEW, reason_details)
        assert GroupInbox.objects.get(group=self.group.id).reason_details is None
