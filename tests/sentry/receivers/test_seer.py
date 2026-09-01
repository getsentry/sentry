from unittest.mock import MagicMock, patch

from sentry.issues.grouptype import WebVitalsGroup
from sentry.models.groupassignee import GroupAssignee
from sentry.seer.autofix.constants import (
    FIRST_ASSIGNMENT_SUMMARY_FEATURE,
    SeerAutomationSource,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class DispatchFirstAssignmentSummaryTest(TestCase):
    @with_feature(FIRST_ASSIGNMENT_SUMMARY_FEATURE)
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_dispatches_for_first_assignment(self, mock_delay: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)

        mock_delay.assert_called_once_with(
            self.group.id,
            source=SeerAutomationSource.FIRST_ASSIGNMENT,
        )

    @with_feature(FIRST_ASSIGNMENT_SUMMARY_FEATURE)
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_dispatches_for_non_error_issue(self, mock_delay: MagicMock) -> None:
        group = self.create_group(project=self.project, type=WebVitalsGroup.type_id)

        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(group, self.user)

        mock_delay.assert_called_once_with(
            group.id,
            source=SeerAutomationSource.FIRST_ASSIGNMENT,
        )

    @with_feature(FIRST_ASSIGNMENT_SUMMARY_FEATURE)
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_does_not_dispatch_for_reassignment(self, mock_delay: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)
        mock_delay.reset_mock()

        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.team)

        mock_delay.assert_not_called()

    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_does_not_dispatch_when_feature_is_disabled(self, mock_delay: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)

        mock_delay.assert_not_called()

    @with_feature(FIRST_ASSIGNMENT_SUMMARY_FEATURE)
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_does_not_dispatch_after_unassignment(self, mock_delay: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)
        mock_delay.reset_mock()

        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.deassign(self.group)
            GroupAssignee.objects.assign(self.group, self.team)

        mock_delay.assert_not_called()

    @with_feature(FIRST_ASSIGNMENT_SUMMARY_FEATURE)
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_does_not_dispatch_for_unchanged_assignment(self, mock_delay: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)
        mock_delay.reset_mock()

        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)

        mock_delay.assert_not_called()
