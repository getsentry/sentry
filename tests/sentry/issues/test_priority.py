from sentry.issues.priority import (
    PRIORITY_LEVEL_TO_STR,
    PRIORITY_TO_GROUP_HISTORY_STATUS,
    PriorityChangeReason,
    PriorityLevel,
    auto_update_priority,
)
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.types.activity import ActivityType


@apply_feature_flag_on_cls("projects:issue-priority")
class TestUpdatesPriority(TestCase):
    def assert_activity_grouphistory_set(self, group, priority, reason) -> None:
        activity = Activity.objects.get(group=group, type=ActivityType.SET_PRIORITY.value)
        assert activity.data == {
            "priority": PRIORITY_LEVEL_TO_STR[priority],
            "reason": reason.value,
        }

        grouphistory = GroupHistory.objects.filter(group=group).order_by("-date_added").first()
        assert grouphistory.status == PRIORITY_TO_GROUP_HISTORY_STATUS[priority]

    def test_updates_priority_escalating(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.IGNORED,
            priority=PriorityLevel.LOW,
        )
        auto_update_priority(self.group, PriorityChangeReason.ESCALATING)
        assert self.group.priority == PriorityLevel.MEDIUM
        self.assert_activity_grouphistory_set(
            self.group, PriorityLevel.MEDIUM, PriorityChangeReason.ESCALATING
        )

    def test_updates_priority_escalating_no_status(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.IGNORED,
            priority=None,
        )
        auto_update_priority(self.group, PriorityChangeReason.ESCALATING)
        assert self.group.priority == PriorityLevel.HIGH
        self.assert_activity_grouphistory_set(
            self.group, PriorityLevel.HIGH, PriorityChangeReason.ESCALATING
        )

    def test_updates_priority_escalating_remains_high(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.IGNORED,
            priority=PriorityLevel.HIGH,
        )
        auto_update_priority(self.group, PriorityChangeReason.ESCALATING)
        assert self.group.priority == PriorityLevel.HIGH
        self.assert_activity_grouphistory_set(
            self.group, PriorityLevel.HIGH, PriorityChangeReason.ESCALATING
        )

    def test_skips_if_priority_locked(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.IGNORED,
            priority=PriorityLevel.LOW,
            priority_locked_at=before_now(days=1),
        )
        auto_update_priority(self.group, PriorityChangeReason.ESCALATING)
        assert self.group.priority == PriorityLevel.LOW

        assert Activity.objects.filter(group=self.group).count() == 0
        assert GroupHistory.objects.filter(group=self.group).count() == 0
