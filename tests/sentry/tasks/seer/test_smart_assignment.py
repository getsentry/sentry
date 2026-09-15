from unittest.mock import MagicMock, patch

from sentry.tasks.seer.smart_assignment import process_smart_assignment_trigger
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class ProcessSmartAssignmentTriggerTest(TestCase):
    TRIGGER = "sentry.tasks.seer.smart_assignment.trigger_smart_assignment"

    @patch(TRIGGER)
    def test_processes_persisted_activity(self, mock_trigger: MagicMock) -> None:
        group = self.create_group()
        activity = self.create_group_activity(
            group=group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )

        process_smart_assignment_trigger(group_id=group.id, activity_id=activity.id)

        mock_trigger.assert_called_once_with(group, ActivityType.SEER_RCA_STARTED, activity)

    @patch(TRIGGER)
    def test_missing_activity_is_noop(self, mock_trigger: MagicMock) -> None:
        process_smart_assignment_trigger(group_id=self.group.id, activity_id=0)

        mock_trigger.assert_not_called()

    @patch(TRIGGER)
    def test_activity_must_belong_to_group(self, mock_trigger: MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        other_group = self.create_group()

        process_smart_assignment_trigger(group_id=other_group.id, activity_id=activity.id)

        mock_trigger.assert_not_called()

    @patch(TRIGGER)
    def test_unsupported_activity_is_noop(self, mock_trigger: MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.NOTE.value,
        )

        process_smart_assignment_trigger(group_id=self.group.id, activity_id=activity.id)

        mock_trigger.assert_not_called()
