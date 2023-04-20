from unittest.mock import MagicMock, patch

from sentry.issues.update_inbox import update_inbox
from sentry.models import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.testutils import TestCase
from sentry.testutils.helpers.features import with_feature


class MarkReviewedTest(TestCase):  # type: ignore
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.group_list = [self.group]
        self.group_ids = [self.group]
        self.project_lookup = {self.group.project_id: self.group.project}
        add_group_to_inbox(self.group, GroupInboxReason.NEW)

    def test_mark_reviewed(self) -> None:
        update_inbox(
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
        update_inbox(
            in_inbox=True,
            group_list=self.group_list + [new_group],
            project_lookup=self.project_lookup,
            acting_user=self.user,
            http_referrer="",
            sender=self,
        )

        assert GroupInbox.objects.filter(group=self.group).exists()
        assert GroupInbox.objects.filter(group=new_group).exists()

    @with_feature("organizations:issue-states")  # type: ignore
    @patch("sentry.signals.issue_mark_reviewed.send_robust")
    def test_mark_reviewed_disabled(self, issue_mark_reviewed: MagicMock) -> None:
        add_group_to_inbox(self.group, GroupInboxReason.NEW)
        update_inbox(
            in_inbox=False,
            group_list=self.group_list,
            project_lookup=self.project_lookup,
            acting_user=self.user,
            http_referrer="",
            sender=self,
        )
        assert GroupInbox.objects.filter(group=self.group).exists()
        assert not issue_mark_reviewed.called
