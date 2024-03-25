from unittest.mock import MagicMock, patch

from sentry.issues.priority import (
    PRIORITY_TO_GROUP_HISTORY_STATUS,
    PriorityChangeReason,
    auto_update_priority,
)
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel


@apply_feature_flag_on_cls("projects:issue-priority")
class TestUpdatesPriority(TestCase):
    def assert_activity_grouphistory_set(self, group, priority, reason) -> None:
        activity = Activity.objects.get(group=group, type=ActivityType.SET_PRIORITY.value)
        assert activity.data == {
            "priority": priority.to_str(),
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
            status=GroupStatus.RESOLVED,
            priority=PriorityLevel.MEDIUM,
        )
        GroupHistory.objects.create(
            group=self.group,
            organization_id=self.group.project.organization_id,
            project_id=self.group.project_id,
            status=GroupHistoryStatus.PRIORITY_LOW,
        )
        auto_update_priority(self.group, PriorityChangeReason.ONGOING)
        self.group.refresh_from_db()

        assert self.group.priority == PriorityLevel.LOW
        self.assert_activity_grouphistory_set(
            self.group, PriorityLevel.LOW, PriorityChangeReason.ONGOING
        )

    def test_updates_priority_ongoing_multiple_histories(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.RESOLVED,
            priority=PriorityLevel.HIGH,
        )
        group_history_data = {
            "group": self.group,
            "organization_id": self.group.project.organization_id,
            "project_id": self.group.project_id,
        }
        GroupHistory.objects.create(
            **group_history_data,
            status=GroupHistoryStatus.PRIORITY_LOW,
        )
        GroupHistory.objects.create(
            **group_history_data,
            status=GroupHistoryStatus.PRIORITY_MEDIUM,
        )
        GroupHistory.objects.create(
            **group_history_data,
            status=GroupHistoryStatus.PRIORITY_HIGH,
        )
        auto_update_priority(self.group, PriorityChangeReason.ONGOING)
        assert self.group.priority == PriorityLevel.HIGH
        assert not Activity.objects.filter(
            group=self.group, type=ActivityType.SET_PRIORITY.value
        ).exists()
        assert (
            GroupHistory.objects.filter(
                group=self.group, status=GroupHistoryStatus.PRIORITY_HIGH
            ).count()
            == 1
        )

    def test_updates_priority_ongoing_no_history(self) -> None:
        self.group = self.create_group(
            status=GroupStatus.RESOLVED,
        )
        self.group.data.get("metadata", {})["initial_priority"] = PriorityLevel.MEDIUM
        self.group.save()

        auto_update_priority(self.group, PriorityChangeReason.ONGOING)
        assert self.group.priority == PriorityLevel.MEDIUM
        self.assert_activity_grouphistory_set(
            self.group, PriorityLevel.MEDIUM, PriorityChangeReason.ONGOING
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
            "Unable to determine previous priority value after transitioning group to ongoing",
            extra={"group": self.group.id},
        )
        assert not self.group.priority

        assert Activity.objects.filter(group=self.group).count() == 0
        assert GroupHistory.objects.filter(group=self.group).count() == 0
