from sentry.issues.update_inbox import update_inbox
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.testutils.cases import TestCase
from sentry.types.group import GroupSubStatus


class MarkReviewedTest(TestCase):
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
            sender=self,
        )
        assert not GroupInbox.objects.filter(group=self.group).exists()

    def test_mark_escalating_reviewed(self) -> None:
        self.group.update(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ESCALATING)
        update_inbox(
            in_inbox=False,
            group_list=self.group_list,
            project_lookup=self.project_lookup,
            acting_user=self.user,
            sender=self,
        )
        assert not GroupInbox.objects.filter(group=self.group).exists()
        # Group is now ongoing
        assert Group.objects.filter(
            id=self.group.id, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING
        ).exists()
        # Mark reviewed activity created
        assert GroupHistory.objects.filter(
            group=self.group,
            status=GroupHistoryStatus.REVIEWED,
        ).exists()

    def test_no_group_list(self) -> None:
        update_inbox(
            in_inbox=False,
            group_list=[],
            project_lookup=self.project_lookup,
            acting_user=self.user,
            sender=self,
        )
        assert GroupInbox.objects.filter(group=self.group).exists()

    def test_add_to_inbox(self) -> None:
        new_group = self.create_group()
        update_inbox(
            in_inbox=True,
            group_list=self.group_list + [new_group],
            project_lookup=self.project_lookup,
            acting_user=self.user,
            sender=self,
        )

        assert GroupInbox.objects.filter(group=self.group).exists()
        assert GroupInbox.objects.filter(group=new_group).exists()
