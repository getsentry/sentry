from unittest import mock
from unittest.mock import MagicMock

from django.db import router, transaction

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.workflow_engine.handlers.workflow.workflow_activity_handlers import (
    SEER_WORKFLOW_ACTIVITIES,
    SUPPORTED_ACTIVITIES,
    activity_handler,
    schedule_process_workflow_activity,
    schedule_smart_assignment_trigger,
    seer_activity_handler,
    smart_assignment_completed_handler,
    smart_assignment_trigger_handler,
)
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.registry import workflow_activity_registry
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType


class ScheduleProcessWorkflowActivityTest(TestCase):
    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.process_workflow_activity"
    )
    def test_schedules_activity_processing_after_commit(
        self, mock_process_workflow_activity: MagicMock
    ) -> None:
        with transaction.atomic(router.db_for_write(Activity)):
            schedule_process_workflow_activity(activity_id=1, group_id=2, detector_id=3)
            mock_process_workflow_activity.delay.assert_not_called()

        mock_process_workflow_activity.delay.assert_called_once_with(
            activity_id=1,
            group_id=2,
            detector_id=3,
        )

    @mock.patch("sentry.tasks.seer.smart_assignment.process_smart_assignment_trigger")
    def test_schedules_smart_assignment_after_commit(
        self, mock_process_smart_assignment_trigger: MagicMock
    ) -> None:
        with transaction.atomic(router.db_for_write(Activity)):
            schedule_smart_assignment_trigger(activity_id=1, group_id=2)
            mock_process_smart_assignment_trigger.delay.assert_not_called()

        mock_process_smart_assignment_trigger.delay.assert_called_once_with(
            activity_id=1,
            group_id=2,
        )


class WorkflowActivityRegistryTest(TestCase):
    def test_registrants(self) -> None:
        assert "seer_activity" in workflow_activity_registry.registrations
        assert "generic_activity" in workflow_activity_registry.registrations
        assert "smart_assignment_trigger" in workflow_activity_registry.registrations
        assert "smart_assignment_completed" in workflow_activity_registry.registrations
        assert len(workflow_activity_registry.registrations) == 4


class SmartAssignmentActivityHandlerTest(TestCase):
    ENABLED = "sentry.seer.smart_assignment.trigger.is_smart_assignment_enabled"
    SCHEDULE = (
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers."
        "schedule_smart_assignment_trigger"
    )

    def setUp(self) -> None:
        self.group = self.create_group()

    @mock.patch(SCHEDULE)
    def test_schedules_relevant_activities(self, mock_schedule: MagicMock) -> None:
        cases = [
            (ActivityType.SEER_RCA_STARTED, None),
            (ActivityType.SEER_SOLUTION_STARTED, None),
            (ActivityType.SEER_CODING_STARTED, None),
            (ActivityType.ASSIGNED, {"assignee": "1", "assigneeType": "user"}),
            (ActivityType.SET_RESOLVED, None),
            (ActivityType.SET_RESOLVED_IN_COMMIT, None),
        ]
        with mock.patch(self.ENABLED, return_value=True):
            for activity_type, data in cases:
                activity = self.create_group_activity(
                    group=self.group, type=activity_type.value, data=data
                )
                mock_schedule.reset_mock()
                smart_assignment_trigger_handler(self.group, activity, None)
                mock_schedule.assert_called_once_with(
                    activity_id=activity.id,
                    group_id=self.group.id,
                )

    @mock.patch(SCHEDULE)
    def test_skips_unrelated_activities(self, mock_schedule: MagicMock) -> None:
        with mock.patch(self.ENABLED, return_value=True):
            for activity_type in (
                # We trigger on Seer AI-step *starts*, not completions or PR creation...
                ActivityType.SEER_SOLUTION_COMPLETED,
                ActivityType.SEER_PR_CREATED,
                # ...and an iteration is a re-run of an already-started autofix, so it's
                # deliberately not a trigger (dedup would make it redundant anyway).
                ActivityType.SEER_ITERATION_STARTED,
                ActivityType.SET_RESOLVED_BY_AGE,
                ActivityType.NOTE,
            ):
                activity = self.create_group_activity(group=self.group, type=activity_type.value)
                smart_assignment_trigger_handler(self.group, activity, None)
        mock_schedule.assert_not_called()

    @mock.patch(SCHEDULE)
    def test_skips_when_feature_disabled(self, mock_schedule: MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )

        with mock.patch(self.ENABLED, return_value=False):
            smart_assignment_trigger_handler(self.group, activity, None)

        mock_schedule.assert_not_called()


class SmartAssignmentCompletedHandlerTest(TestCase):
    COMPLETION = "sentry.seer.smart_assignment.completion.process_smart_assignment_completion"

    def setUp(self) -> None:
        self.group = self.create_group()

    @mock.patch(COMPLETION)
    def test_delegates_for_completed_activity(self, mock_completion: MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SMART_ASSIGNMENT_COMPLETED.value,
        )
        # create_group_activity invokes the registered handlers itself, so the delegate
        # is already called once for the real activity; assert on a direct call to keep
        # this focused on the handler's own filtering + delegation.
        mock_completion.reset_mock()
        smart_assignment_completed_handler(self.group, activity, None)
        mock_completion.assert_called_once_with(self.group, activity)

    @mock.patch(COMPLETION)
    def test_skips_unrelated_activities(self, mock_completion: MagicMock) -> None:
        for activity_type in (
            ActivityType.SEER_RCA_STARTED,
            ActivityType.SEER_PR_CREATED,
            ActivityType.SET_RESOLVED,
            ActivityType.NOTE,
        ):
            activity = self.create_group_activity(group=self.group, type=activity_type.value)
            mock_completion.reset_mock()
            smart_assignment_completed_handler(self.group, activity, None)
            mock_completion.assert_not_called()


class SeerActivityHandlerTest(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_PR_READY_FOR_REVIEW.value
        )
        self.detector = Detector.objects.get(project=self.project, type=ErrorGroupType.slug)

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    def test_all_supported_activity_types_dispatch(
        self, mock_schedule_process_workflow_activity: MagicMock
    ) -> None:
        for activity_type in SEER_WORKFLOW_ACTIVITIES:
            mock_schedule_process_workflow_activity.reset_mock()
            activity = self.create_group_activity(group=self.group, type=activity_type.value)
            seer_activity_handler(self.group, activity, None)
            assert mock_schedule_process_workflow_activity.called, (
                f"Task not dispatched for {activity_type.value}"
            )
            mock_schedule_process_workflow_activity.assert_called_once_with(
                activity_id=activity.id,
                group_id=self.group.id,
                detector_id=self.detector.id,
            )

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    def test_skips_unsupported_activity_type(
        self, mock_schedule_process_workflow_activity: MagicMock
    ) -> None:
        activity = self.create_group_activity(group=self.group, type=ActivityType.NOTE.value)
        seer_activity_handler(self.group, activity, None)

        mock_schedule_process_workflow_activity.assert_not_called()

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.get_preferred_detector",
        side_effect=Detector.DoesNotExist,
    )
    def test_skips_when_no_detector(
        self, mock_get_detector: MagicMock, mock_schedule_process_workflow_activity: MagicMock
    ) -> None:
        seer_activity_handler(self.group, self.activity, None)

        mock_schedule_process_workflow_activity.assert_not_called()

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    def test_uses_group_detector(self, mock_schedule_process_workflow_activity: MagicMock) -> None:
        detector = self.create_detector(
            name="linked_detector", type=MetricIssue.slug, project=self.project
        )
        self.create_detector_group(detector=detector, group=self.group)

        seer_activity_handler(self.group, self.activity, None)

        mock_schedule_process_workflow_activity.assert_called_once_with(
            activity_id=self.activity.id,
            group_id=self.group.id,
            detector_id=detector.id,
        )

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    def test_falls_back_to_issue_stream_detector(
        self, mock_schedule_process_workflow_activity: MagicMock
    ) -> None:
        Detector.objects.filter(project=self.project, type=ErrorGroupType.slug).delete()
        issue_stream_detector = Detector.objects.get(
            project=self.project, type=IssueStreamGroupType.slug
        )

        seer_activity_handler(self.group, self.activity, None)

        mock_schedule_process_workflow_activity.assert_called_once_with(
            activity_id=self.activity.id,
            group_id=self.group.id,
            detector_id=issue_stream_detector.id,
        )


class GenericActivityHandlerTest(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.activity = self.create_group_activity(
            group=self.group, type=ActivityType.SET_RESOLVED.value
        )
        self.detector = Detector.objects.get(project=self.project, type=ErrorGroupType.slug)

    @mock.patch("sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.metrics")
    def test_invalid_activity_type(self, mock_metrics: MagicMock) -> None:
        self.activity.type = -1
        activity_handler(self.group, self.activity, self.detector.id)
        mock_metrics.incr.assert_not_called()

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    def test_skips_unsupported_activity_type(
        self, mock_schedule_process_workflow_activity: MagicMock
    ) -> None:
        activity = self.create_group_activity(group=self.group, type=ActivityType.NOTE.value)
        activity_handler(self.group, activity, self.detector.id)

        mock_schedule_process_workflow_activity.assert_not_called()

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    def test_dispatches_with_provided_detector_id(
        self, mock_schedule_process_workflow_activity: MagicMock
    ) -> None:
        activity_handler(self.group, self.activity, self.detector.id)

        mock_schedule_process_workflow_activity.assert_called_once_with(
            activity_id=self.activity.id,
            group_id=self.group.id,
            detector_id=self.detector.id,
        )

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    def test_resolution_activity_types_dispatch(
        self, mock_schedule_process_workflow_activity: MagicMock
    ) -> None:
        # Enumerate the resolution types explicitly (rather than looping over
        # SUPPORTED_ACTIVITIES) so that removing any of these from the source list makes
        # this test fail rather than silently test fewer types.
        resolution_activity_types = [
            ActivityType.SET_RESOLVED,
            ActivityType.SET_RESOLVED_IN_RELEASE,
            ActivityType.SET_RESOLVED_BY_AGE,
            ActivityType.SET_RESOLVED_IN_COMMIT,
        ]
        assert set(resolution_activity_types) <= set(SUPPORTED_ACTIVITIES)

        for activity_type in resolution_activity_types:
            mock_schedule_process_workflow_activity.reset_mock()
            activity = self.create_group_activity(group=self.group, type=activity_type.value)
            activity_handler(self.group, activity, self.detector.id)
            assert mock_schedule_process_workflow_activity.called, (
                f"Task not dispatched for {activity_type.value}"
            )
            mock_schedule_process_workflow_activity.assert_called_once_with(
                activity_id=activity.id,
                group_id=self.group.id,
                detector_id=self.detector.id,
            )

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    def test_falls_back_to_preferred_detector(
        self, mock_schedule_process_workflow_activity: MagicMock
    ) -> None:
        # No detector_id provided (e.g. a non-issue-platform resolve) -> resolve from the group.
        activity_handler(self.group, self.activity, None)

        mock_schedule_process_workflow_activity.assert_called_once_with(
            activity_id=self.activity.id,
            group_id=self.group.id,
            detector_id=self.detector.id,
        )

    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.schedule_process_workflow_activity"
    )
    @mock.patch(
        "sentry.workflow_engine.handlers.workflow.workflow_activity_handlers.get_preferred_detector",
        side_effect=Detector.DoesNotExist,
    )
    def test_skips_when_no_detector(
        self, mock_get_detector: MagicMock, mock_schedule_process_workflow_activity: MagicMock
    ) -> None:
        activity_handler(self.group, self.activity, None)

        mock_schedule_process_workflow_activity.assert_not_called()
