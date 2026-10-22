from unittest.mock import MagicMock, patch

from django.test import override_settings

from sentry.issues.action_log.publish import publish_action
from sentry.issues.action_log.types import ActionSource, GroupActionType, ViewAction
from sentry.issues.grouptype import FeedbackGroup
from sentry.issues.models.groupderiveddata import GroupDerivedData
from sentry.models.groupassignee import GroupAssignee
from sentry.receivers.seer import dispatch_first_assignment_summary
from sentry.seer.autofix.constants import SeerAutomationSource
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.outbox import outbox_runner


@override_settings(SENTRY_SELF_HOSTED=False)
class DispatchFirstAssignmentSummaryTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project.update_option("sentry:seer_scanner_automation", False)

    @with_feature("organizations:issue-summary-on-first-assignment")
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_dispatches_for_category_ineligible_for_automation(self, mock_delay: MagicMock) -> None:
        group = self.create_group(project=self.project, type=FeedbackGroup.type_id)

        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(group, self.user)

        mock_delay.assert_called_once_with(
            group.id,
            source=SeerAutomationSource.FIRST_ASSIGNMENT.value,
        )

    @with_feature(
        ["organizations:issue-summary-on-first-assignment", "organizations:seat-based-seer-enabled"]
    )
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_does_not_dispatch_for_seat_based_seer(self, mock_delay: MagicMock) -> None:
        dispatch_first_assignment_summary(
            project=self.project, group=self.group, is_first_assignment=True
        )

        mock_delay.assert_not_called()

    @with_feature("organizations:issue-summary-on-first-assignment")
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    def test_does_not_dispatch_for_automation_eligible_issue(
        self, mock_quota: MagicMock, mock_delay: MagicMock
    ) -> None:
        self.project.update_option("sentry:seer_scanner_automation", True)

        dispatch_first_assignment_summary(
            project=self.project, group=self.group, is_first_assignment=True
        )

        mock_delay.assert_not_called()

    @with_feature("organizations:issue-summary-on-first-assignment")
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_only_dispatches_for_first_assignment(self, mock_delay: MagicMock) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)
        mock_delay.assert_called_once_with(
            self.group.id, source=SeerAutomationSource.FIRST_ASSIGNMENT.value
        )

        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.team)
            GroupAssignee.objects.deassign(self.group)
            GroupAssignee.objects.assign(self.group, self.user)

        mock_delay.assert_called_once_with(
            self.group.id, source=SeerAutomationSource.FIRST_ASSIGNMENT.value
        )

    @with_feature({"organizations:issue-summary-on-first-assignment": False})
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_does_not_read_derived_data_when_feature_is_disabled(
        self, mock_delay: MagicMock
    ) -> None:
        group = self.group
        user = self.user
        with (
            patch.object(
                GroupDerivedData.objects,
                "get_or_none",
                wraps=GroupDerivedData.objects.get_or_none,
            ) as mock_derived_read,
            self.capture_on_commit_callbacks(execute=True),
        ):
            GroupAssignee.objects.assign(group, user)

        mock_derived_read.assert_not_called()
        mock_delay.assert_not_called()

    @with_feature(
        ["organizations:issue-summary-on-first-assignment", "projects:issue-action-log-write-to-db"]
    )
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_does_not_dispatch_for_historical_assignment_with_stale_data(
        self, mock_delay: MagicMock
    ) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)
            GroupAssignee.objects.deassign(self.group)
        mock_delay.assert_called_once_with(
            self.group.id, source=SeerAutomationSource.FIRST_ASSIGNMENT.value
        )
        GroupDerivedData.objects.filter(group_id=self.group.id).update(
            pipeline_hash="outdated", data={}
        )
        before = GroupDerivedData.objects.values().get(group_id=self.group.id)

        with (
            patch("sentry.receivers.outbox.cell.trigger_group_log_processing"),
            self.capture_on_commit_callbacks(execute=True),
        ):
            GroupAssignee.objects.assign(self.group, self.team)

        mock_delay.assert_called_once_with(
            self.group.id, source=SeerAutomationSource.FIRST_ASSIGNMENT.value
        )
        assert GroupDerivedData.objects.values().get(group_id=self.group.id) == before

    @with_feature(
        ["organizations:issue-summary-on-first-assignment", "projects:issue-action-log-write-to-db"]
    )
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_does_not_dispatch_for_historical_assignment_with_missing_derived_data(
        self, mock_delay: MagicMock
    ) -> None:
        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(self.group, self.user)
        mock_delay.assert_called_once_with(
            self.group.id, source=SeerAutomationSource.FIRST_ASSIGNMENT.value
        )
        GroupDerivedData.objects.filter(group_id=self.group.id).delete()

        with (
            patch("sentry.receivers.outbox.cell.trigger_group_log_processing"),
            self.capture_on_commit_callbacks(execute=True),
        ):
            GroupAssignee.objects.assign(self.group, self.team)

        mock_delay.assert_called_once_with(
            self.group.id, source=SeerAutomationSource.FIRST_ASSIGNMENT.value
        )
        assert not GroupDerivedData.objects.filter(group_id=self.group.id).exists()

    @with_feature(
        ["organizations:issue-summary-on-first-assignment", "projects:issue-action-log-write-to-db"]
    )
    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_dispatches_with_stale_derived_data_and_only_non_assignment_history(
        self, mock_delay: MagicMock
    ) -> None:
        group = self.group
        self.create_group_action_log_entry(self.create_group(), type=GroupActionType.ASSIGN)
        with outbox_runner():
            publish_action(
                ViewAction(), source=ActionSource.API, group_id=group.id, project=group.project
            )
        GroupDerivedData.objects.filter(group_id=group.id).update(pipeline_hash=None)

        with self.capture_on_commit_callbacks(execute=True):
            GroupAssignee.objects.assign(group, self.user)

        mock_delay.assert_called_once_with(
            group.id, source=SeerAutomationSource.FIRST_ASSIGNMENT.value
        )

    @patch("sentry.tasks.seer.autofix.summarize_issue.delay")
    def test_does_not_dispatch_for_assignment_before_feature_was_enabled(
        self, mock_delay: MagicMock
    ) -> None:
        with (
            self.feature({"organizations:issue-summary-on-first-assignment": False}),
            self.capture_on_commit_callbacks(execute=True),
        ):
            GroupAssignee.objects.assign(self.group, self.user)

        mock_delay.assert_not_called()

        with (
            self.feature("organizations:issue-summary-on-first-assignment"),
            self.capture_on_commit_callbacks(execute=True),
        ):
            GroupAssignee.objects.assign(self.group, self.team)

        mock_delay.assert_not_called()
