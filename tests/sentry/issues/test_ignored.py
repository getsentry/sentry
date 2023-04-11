from sentry.issues.ignored import handle_ignored
from sentry.models import GroupInbox, GroupInboxReason, GroupSnooze, add_group_to_inbox
from sentry.testutils import TestCase


class HandleIgnored(TestCase):  # type: ignore
    def setUp(self):
        super().setUp()
        self.group = self.create_group()
        self.group_list = [self.group]
        self.group_ids = [self.group]
        add_group_to_inbox(self.group, GroupInboxReason.NEW)

    def test_ignored_forever(self) -> None:
        status_details = handle_ignored(self.group_ids, self.group_list, {}, self.user, self.user)
        assert status_details == {}
        assert not GroupInbox.objects.filter(group=self.group).exists()
        assert not GroupSnooze.objects.filter(group=self.group).exists()

    def test_ignored_duration(self) -> None:
        status_details = handle_ignored(
            self.group_ids, self.group_list, {"ignoreDuration": 30}, self.user, self.user
        )
        assert status_details is not None
        assert not GroupInbox.objects.filter(group=self.group).exists()
        snooze = GroupSnooze.objects.filter(group=self.group).first()
        assert snooze.until == status_details.get("ignoreUntil")

    def test_ignored_count(self) -> None:
        status_details = handle_ignored(
            self.group_ids, self.group_list, {"ignoreCount": 50}, self.user, self.user
        )
        assert status_details is not None
        assert not GroupInbox.objects.filter(group=self.group).exists()
        snooze = GroupSnooze.objects.filter(group=self.group).first()
        assert snooze.count == status_details.get("ignoreCount")

    def test_ignored_user_count(self) -> None:
        status_details = handle_ignored(
            self.group_ids, self.group_list, {"ignoreUserCount": 100}, self.user, self.user
        )
        assert status_details is not None
        assert not GroupInbox.objects.filter(group=self.group).exists()
        snooze = GroupSnooze.objects.filter(group=self.group).first()
        assert snooze.user_count == status_details.get("ignoreUserCount")
