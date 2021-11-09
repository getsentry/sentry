from sentry.models import GroupHistoryStatus, get_prev_history
from sentry.testutils import TestCase


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
