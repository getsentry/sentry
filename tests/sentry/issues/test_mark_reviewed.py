from sentry.issues.mark_reviewed import mark_reviewed
from sentry.models import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.testutils import TestCase


class MarkReviewedTest(TestCase):  # type: ignore
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.group_list = [self.group]
        self.group_ids = [self.group]
        self.project_lookup = {self.group.project_id: self.group.project}
        add_group_to_inbox(self.group, GroupInboxReason.NEW)

    def test_mark_reviewed(self) -> None:
        mark_reviewed(
            in_inbox=False,
            group_list=self.group_list,
            project_lookup=self.project_lookup,
            acting_user=self.user,
            http_referrer="",
            sender=self,
        )
        assert not GroupInbox.objects.filter(group=self.group).exists()

    def test_add_to_inbox(self) -> None:
        new_group = self.create_group()
        _ = mark_reviewed(
            in_inbox=True,
            group_list=self.group_list + [new_group],
            project_lookup=self.project_lookup,
            acting_user=self.user,
            http_referrer="",
            sender=self,
        )

        assert GroupInbox.objects.filter(group=self.group).exists()
        assert GroupInbox.objects.filter(group=new_group).exists()
