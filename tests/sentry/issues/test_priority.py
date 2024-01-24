from sentry.issues.priority import PriorityChangeReason, PriorityLevel, auto_update_priority
from sentry.models.group import GroupStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls


@apply_feature_flag_on_cls("projects:issue-priority")
class TestUpdatesPriority(TestCase):
    def test_updates_priority_escalating(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.IGNORED,
            priority=PriorityLevel.LOW,
        )
        auto_update_priority(self.group, PriorityChangeReason.ESCALATING)
        assert self.group.priority == PriorityLevel.MEDIUM

    def test_updates_priority_escalating_no_status(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.IGNORED,
            priority=None,
        )
        auto_update_priority(self.group, PriorityChangeReason.ESCALATING)
        assert self.group.priority == PriorityLevel.HIGH

    def test_updates_priority_escalating_remains_high(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.IGNORED,
            priority=PriorityLevel.HIGH,
        )
        auto_update_priority(self.group, PriorityChangeReason.ESCALATING)
        assert self.group.priority == PriorityLevel.HIGH
