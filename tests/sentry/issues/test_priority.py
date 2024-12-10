from unittest.mock import MagicMock, patch

from sentry.issues.priority import (
    PRIORITY_TO_GROUP_HISTORY_STATUS,
    PriorityChangeReason,
    auto_update_priority,
    update_priority,
)
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus, PriorityLevel


class TestUpdatesPriority(TestCase):
    def assert_activity_grouphistory_set(
        self, group: Group, priority: PriorityLevel, reason: PriorityChangeReason
    ) -> None:
        activity = Activity.objects.filter(
            group=group, type=ActivityType.SET_PRIORITY.value
        ).order_by("-datetime")[0]
        assert activity.data == {
            "priority": priority.to_str(),
            "reason": reason.value,
        }

        grouphistory = GroupHistory.objects.filter(group=group).order_by("-date_added")[0]
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
        assert not Activity.objects.filter(
            group=self.group, type=ActivityType.SET_PRIORITY.value
        ).exists()
        assert not GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.PRIORITY_HIGH
        ).exists()

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

    def test_updates_priority_ongoing(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.NEW,
            priority=PriorityLevel.LOW,
        )
        self.group.data.get("metadata", {})["initial_priority"] = PriorityLevel.LOW
        auto_update_priority(self.group, PriorityChangeReason.ESCALATING)
        auto_update_priority(self.group, PriorityChangeReason.ONGOING)
        self.group.refresh_from_db()

        assert self.group.priority == PriorityLevel.LOW
        self.assert_activity_grouphistory_set(
            self.group, PriorityLevel.LOW, PriorityChangeReason.ONGOING
        )

    @patch("sentry.issues.priority.logger.error")
    def test_updates_priority_ongoing_no_initial_priority(self, mock_logger: MagicMock) -> None:
        self.group = self.create_group(
            status=GroupStatus.RESOLVED,
        )
        self.group.data.get("metadata", {})["initial_priority"] = None
        self.group.save()

        auto_update_priority(self.group, PriorityChangeReason.ONGOING)
        mock_logger.assert_called_with(
            "get_priority_for_ongoing_group.initial_priority_not_found",
            extra={"group": self.group.id},
        )
        assert not self.group.priority

        assert Activity.objects.filter(group=self.group).count() == 0
        assert GroupHistory.objects.filter(group=self.group).count() == 0

    @patch("sentry.issues.attributes.send_snapshot_values")
    def test_priority_update_sends_snapshot(self, mock_send_snapshot_values: MagicMock) -> None:
        self.group = self.create_group(
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ONGOING,
            priority=PriorityLevel.HIGH,
        )

        update_priority(
            group=self.group,
            priority=PriorityLevel.MEDIUM,
            sender="test",
            reason=PriorityChangeReason.ONGOING,
            project=self.project,
        )
        assert self.group.priority == PriorityLevel.MEDIUM
        mock_send_snapshot_values.assert_called_with(None, self.group, False)
