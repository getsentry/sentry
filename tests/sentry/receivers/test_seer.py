from unittest.mock import MagicMock, patch

from sentry.models.activity import Activity
from sentry.models.groupassignee import GroupAssignee
from sentry.seer.autofix.constants import FIRST_ASSIGNMENT_SUMMARY_FEATURE
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.activity import ActivityType


class DispatchFirstAssignmentSummaryTest(TestCase):
    @with_feature(FIRST_ASSIGNMENT_SUMMARY_FEATURE)
    @patch("sentry.tasks.seer.autofix.generate_first_assignment_summary.delay")
    def test_dispatches_for_the_assignment_activity(self, mock_delay: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)

        activity = Activity.objects.get(group=self.group, type=ActivityType.ASSIGNED.value)
        mock_delay.assert_called_once_with(
            self.group.id,
            assignment_activity_id=activity.id,
        )

    @patch("sentry.tasks.seer.autofix.generate_first_assignment_summary.delay")
    def test_does_not_dispatch_when_feature_is_disabled(self, mock_delay: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)

        mock_delay.assert_not_called()
