from unittest import mock

from google.api_core.exceptions import RetryError

from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.types.activity import ActivityType
from sentry.workflow_engine.tasks.utils import fetch_event
from sentry.workflow_engine.tasks.workflows import (
    process_workflow_activity,
    workflow_status_update_handler,
)
from sentry.workflow_engine.types import WorkflowEventData


class FetchEventTests(TestCase):
    def test_fetch_event_retries_on_retry_error(self):
        """Test that fetch_event retries when encountering RetryError."""
        event_id = "test_event_id"
        project_id = self.project.id

        # Mock nodestore to fail with RetryError twice, then succeed
        with mock.patch("sentry.workflow_engine.tasks.utils.nodestore.backend.get") as mock_get:
            mock_get.side_effect = [
                RetryError("retry", None),
                RetryError("retry", None),
                {"data": "test"},
            ]

            result = fetch_event(event_id, project_id)

            # Should have been called 3 times (2 failures + 1 success)
            assert mock_get.call_count == 3
            assert result is not None


class WorkflowStatusUpdateHandlerTests(TestCase):
    def test__no_detector_id(self):
        """
        Test that the workflow_status_update_handler does not crash
        when no detector_id is provided in the status change message.
        """
        group = self.create_group(project=self.project)
        activity = Activity(
            project=self.project,
            group=group,
            type=ActivityType.SET_RESOLVED.value,
            data={"fingerprint": ["test_fingerprint"]},
        )

        message = StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=["test_fingerprint"],
            detector_id=None,  # No detector_id provided
            activity_data=None,
        )

        with mock.patch("sentry.workflow_engine.tasks.workflows.metrics.incr") as mock_incr:
            workflow_status_update_handler(group, message, activity)
            mock_incr.assert_called_with("workflow_engine.tasks.error.no_detector_id")

    def test__feature_flag(self):
        detector = self.create_detector(project=self.project)
        group = self.create_group(project=self.project)
        activity = Activity(
            project=self.project,
            group=group,
            type=ActivityType.SET_RESOLVED.value,
            data={"fingerprint": ["test_fingerprint"]},
        )
        message = StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=["test_fingerprint"],
            detector_id=detector.id,
            activity_data={"test": "test"},
        )

        with mock.patch(
            "sentry.workflow_engine.tasks.workflows.process_workflow_activity.delay"
        ) as mock_delay:
            workflow_status_update_handler(group, message, activity)
            mock_delay.assert_not_called()

    @with_feature("organizations:workflow-engine-process-activity")
    def test(self):
        detector = self.create_detector(project=self.project)
        group = self.create_group(project=self.project)
        activity = Activity(
            project=self.project,
            group=group,
            type=ActivityType.SET_RESOLVED.value,
            data={"fingerprint": ["test_fingerprint"]},
        )
        message = StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=["test_fingerprint"],
            detector_id=detector.id,
            activity_data={"test": "test"},
        )

        with mock.patch(
            "sentry.workflow_engine.tasks.workflows.process_workflow_activity.delay"
        ) as mock_delay:
            workflow_status_update_handler(group, message, activity)
            mock_delay.assert_called_once_with(
                activity_id=activity.id,
                group_id=group.id,
                detector_id=detector.id,
            )


class TestProcessWorkflowActivity(TestCase):
    def setUp(self):
        self.group = self.create_group(project=self.project)
        self.activity = Activity(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            data={"fingerprint": ["test_fingerprint"]},
        )
        self.activity.save()
        self.detector = self.create_detector()

    def test_process_workflow_activity__no_workflows(self):
        with mock.patch(
            "sentry.workflow_engine.processors.workflow.evaluate_workflow_triggers",
            return_value=set(),
        ) as mock_evaluate:
            process_workflow_activity.run(
                activity_id=self.activity.id,
                group_id=self.group.id,
                detector_id=self.detector.id,
            )
            # Short-circuit evaluation, no workflows associated
            assert mock_evaluate.call_count == 0

    @mock.patch(
        "sentry.workflow_engine.processors.workflow.evaluate_workflow_triggers", return_value=set()
    )
    @mock.patch(
        "sentry.workflow_engine.processors.workflow.evaluate_workflows_action_filters",
        return_value=set(),
    )
    def test_process_workflow_activity__workflows__no_actions(
        self, mock_eval_actions, mock_evaluate
    ):
        self.workflow = self.create_workflow(organization=self.organization)
        self.create_detector_workflow(
            detector=self.detector,
            workflow=self.workflow,
        )

        process_workflow_activity.run(
            activity_id=self.activity.id,
            group_id=self.group.id,
            detector_id=self.detector.id,
        )

        event_data = WorkflowEventData(
            event=self.activity,
            group=self.group,
        )

        mock_evaluate.assert_called_once_with({self.workflow}, event_data)
        assert mock_eval_actions.call_count == 0

    @mock.patch("sentry.workflow_engine.processors.workflow.filter_recently_fired_workflow_actions")
    def test_process_workflow_activity(self, mock_filter_actions):
        self.workflow = self.create_workflow(organization=self.organization)

        self.action_group = self.create_data_condition_group(logic_type="any-short")
        self.action = self.create_action()
        self.create_data_condition_group_action(
            condition_group=self.action_group,
            action=self.action,
        )
        self.create_workflow_data_condition_group(self.workflow, self.action_group)

        self.create_detector_workflow(
            detector=self.detector,
            workflow=self.workflow,
        )

        expected_event_data = WorkflowEventData(
            event=self.activity,
            group=self.group,
        )

        process_workflow_activity.run(
            activity_id=self.activity.id,
            group_id=self.group.id,
            detector_id=self.detector.id,
        )

        mock_filter_actions.assert_called_once_with({self.action_group}, expected_event_data)

    @with_feature("organizations:workflow-engine-process-activity")
    @mock.patch("sentry.workflow_engine.tasks.workflows.metrics.incr")
    def test__e2e__issue_plat_to_processed(self, mock_incr):
        self.message = StatusChangeMessageData(
            id="test-id",
            fingerprint=["group-1"],
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            detector_id=self.detector.id,
        )

        with self.tasks():
            update_status(self.group, self.message)

            # Ensure task is evaluated in issue platform
            mock_incr.assert_any_call(
                "workflow_engine.issue_platform.status_change",
                tags={"activity_type": self.activity.type},
            )

            # Issue platform is forwarding the activity update
            mock_incr.assert_any_call(
                "workflow_engine.issue_platform.status_change_handler",
                tags={"activity_type": self.activity.type},
            )

            # Workflow engine is correctly registered for the activity update
            mock_incr.assert_any_call(
                "workflow_engine.tasks.process_workflows.activity_update",
                tags={"activity_type": self.activity.type},
            )

            # Workflow engine evaluated activity update in process_workflows
            mock_incr.assert_any_call(
                "workflow_engine.tasks.process_workflow.activity_update.executed",
                tags={"activity_type": self.activity.type},
            )
