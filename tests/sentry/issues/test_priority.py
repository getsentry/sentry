from unittest.mock import MagicMock, patch

from sentry.issues.priority import PriorityChangeReason, PriorityLevel, auto_update_priority
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
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

    @patch("sentry.issues.priority.logger.error")
    def test_updates_priority_ongoing_no_history(self, mock_logger: MagicMock) -> None:
        self.group = self.create_group(
            status=GroupStatus.RESOLVED,
            priority=PriorityLevel.MEDIUM,
        )

        auto_update_priority(self.group, PriorityChangeReason.ONGOING)
        mock_logger.assert_called_with("No previous priority history for group %s", self.group.id)
        assert self.group.priority == PriorityLevel.MEDIUM
