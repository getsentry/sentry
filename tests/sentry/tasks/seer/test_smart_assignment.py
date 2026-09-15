from unittest.mock import MagicMock, patch

import pytest

from sentry.tasks.seer.smart_assignment import process_smart_assignment_trigger
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.utils.locking import UnableToAcquireLock


class ProcessSmartAssignmentTriggerTest(TestCase):
    LOCKS = "sentry.tasks.seer.smart_assignment.locks"
    TRIGGER = "sentry.tasks.seer.smart_assignment.trigger_smart_assignment"

    @patch(LOCKS)
    @patch(TRIGGER)
    def test_processes_persisted_activity(
        self,
        mock_trigger: MagicMock,
        mock_locks: MagicMock,
    ) -> None:
        group = self.create_group()
        activity = self.create_group_activity(
            group=group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )

        process_smart_assignment_trigger(group_id=group.id, activity_id=activity.id)

        mock_trigger.assert_called_once_with(group, ActivityType.SEER_RCA_STARTED, activity)
        mock_locks.get.assert_called_once_with(
            f"smart_assignment:trigger:{group.id}",
            duration=180,
            name="smart_assignment_trigger",
        )
        mock_locks.get.return_value.acquire.assert_called_once_with()

    @patch(LOCKS)
    @patch(TRIGGER)
    def test_retries_lock_contention(
        self,
        mock_trigger: MagicMock,
        mock_locks: MagicMock,
    ) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        mock_locks.get.return_value.acquire.side_effect = UnableToAcquireLock

        with pytest.raises(UnableToAcquireLock):
            process_smart_assignment_trigger(group_id=self.group.id, activity_id=activity.id)

        mock_trigger.assert_not_called()

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
