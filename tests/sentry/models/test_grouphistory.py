from sentry.models import GroupAssignee, GroupHistory, GroupHistoryStatus, get_prev_history
from sentry.testutils import TestCase


class FilterToTeamTest(TestCase):
    def test(self):
        other_org = self.create_organization()
        other_team = self.create_team(other_org, members=[self.user])
        other_project = self.create_project(organization=other_org, teams=[other_team])
        GroupAssignee.objects.assign(self.group, self.user)

        history = GroupHistory.objects.filter(group=self.group).get()
        other_group = self.store_event(data={}, project_id=other_project.id).group
        GroupAssignee.objects.assign(other_group, self.user)
        other_history = GroupHistory.objects.filter(group=other_group).get()

        # Even though the user is a member of both orgs, and is assigned to both groups, we should
        # filter down to just the history that each team has access to here.
        assert list(GroupHistory.objects.filter_to_team(self.team)) == [history]
        assert list(GroupHistory.objects.filter_to_team(other_team)) == [other_history]


class GetPrevHistoryTest(TestCase):
    def test_no_history(self):
        # Test both statuses with/without a previous status
        assert get_prev_history(self.group, GroupHistoryStatus.UNRESOLVED) is None
        assert get_prev_history(self.group, GroupHistoryStatus.DELETED) is None

    def test_history(self):
        prev_history = self.create_group_history(self.group, GroupHistoryStatus.UNRESOLVED)
        assert get_prev_history(self.group, GroupHistoryStatus.RESOLVED) == prev_history
        assert get_prev_history(self.group, GroupHistoryStatus.DELETED) is None

    def test_multi_history(self):
        other_group = self.create_group()
        self.create_group_history(other_group, GroupHistoryStatus.UNRESOLVED)
        assert get_prev_history(self.group, GroupHistoryStatus.UNRESOLVED) is None
        prev_history = self.create_group_history(self.group, GroupHistoryStatus.UNRESOLVED)
        assert get_prev_history(self.group, GroupHistoryStatus.RESOLVED) == prev_history
        prev_history = self.create_group_history(
            self.group, GroupHistoryStatus.RESOLVED, prev_history=prev_history
        )
        assert get_prev_history(self.group, GroupHistoryStatus.UNRESOLVED) == prev_history
        prev_history = self.create_group_history(
            self.group, GroupHistoryStatus.UNRESOLVED, prev_history=prev_history
        )
        assert get_prev_history(self.group, GroupHistoryStatus.RESOLVED) == prev_history
