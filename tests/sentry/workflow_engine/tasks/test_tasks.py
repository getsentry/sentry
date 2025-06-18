from unittest import mock

from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.tasks.workflow_tasks import (
    process_workflows_task,
    workflow_status_update_handler,
)
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class IssuePlatformIntegrationTest(TestCase):
    def test_handler_invoked__when_resolved(self):
        """
        Integration test to ensure the `update_status` method
        will correctly invoke the `workflow_state_update_handler`
        and increment the metric.
        """
        detector = self.create_detector()
        group = self.create_group(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
        )

        message = StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=["test_fingerprint"],
            detector_id=detector.id,
        )

        with mock.patch("sentry.workflow_engine.tasks.workflow_tasks.metrics.incr") as mock_incr:
            update_status(group, message)
            mock_incr.assert_called_with(
                "workflow_engine.process_workflow.activity_update",
                tags={"activity_type": ActivityType.SET_RESOLVED.value},
            )


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
        )

        with mock.patch("sentry.workflow_engine.tasks.workflow_tasks.metrics.incr") as mock_incr:
            workflow_status_update_handler(group, message, activity)
            mock_incr.assert_called_with("workflow_engine.error.tasks.no_detector_id")


class TestProcessWorkflowTask(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.group = self.create_group(project=self.project)
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event)

    def test_calls_process_workflows(self):
        with mock.patch(
            "sentry.workflow_engine.tasks.workflow_tasks.process_workflows"
        ) as mock_process_workflows:
            process_workflows_task.run(self.event_data)
            mock_process_workflows.assert_called_once_with(self.event_data)

    def test_gathering_data(self):
        pass
