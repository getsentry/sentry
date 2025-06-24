from unittest import mock

from google.api_core.exceptions import RetryError
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.occurrence_consumer import _process_message
from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.workflow_engine.tasks import fetch_event, workflow_status_update_handler
from tests.sentry.issues.test_status_change_consumer import get_test_message_status_change


class FetchEventTests(TestCase):
    def test_fetch_event_retries_on_retry_error(self):
        """Test that fetch_event retries when encountering RetryError."""
        event_id = "test_event_id"
        project_id = self.project.id

        # Mock nodestore to fail with RetryError twice, then succeed
        with mock.patch("sentry.workflow_engine.tasks.nodestore.backend.get") as mock_get:
            mock_get.side_effect = [
                RetryError("retry", None),
                RetryError("retry", None),
                {"data": "test"},
            ]

            result = fetch_event(event_id, project_id)

            # Should have been called 3 times (2 failures + 1 success)
            assert mock_get.call_count == 3
            assert result is not None


class IssuePlatformIntegrationTests(TestCase):
    def setUp(self):
        super().setUp()
        self.detector = self.create_detector(project=self.project)
        self.group = self.create_group(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
        )
        self.fingerprint = f"detector:{self.detector.id}"
        self.hashed_fingerprint = hash_fingerprint([self.fingerprint])
        GroupHash.objects.create(
            project=self.project,
            hash=self.hashed_fingerprint[0],
            group=self.group,
        )

    def test_handler_invoked__when_update_status_called(self):
        """
        Integration test to ensure the `update_status` method
        will correctly invoke the `workflow_status_update_handler`
        and increment the metric.
        """
        message = get_test_message_status_change(
            project_id=self.project.id,
            fingerprint=[self.fingerprint],
            detector_id=self.detector.id,
        )

        with mock.patch("sentry.workflow_engine.tasks.metrics.incr") as mock_incr:
            _process_message(message)

            mock_incr.assert_called_with(
                "workflow_engine.process_workflow.activity_update",
                tags={"activity_type": ActivityType.SET_RESOLVED.value},
            )

    def test_handler_invoked__when_resolved(self):
        """
        Integration test to ensure the `update_status` method
        will correctly invoke the `workflow_state_update_handler`
        and increment the metric.
        """
        message = StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=[self.fingerprint],
            detector_id=self.detector.id,
        )

        with mock.patch("sentry.workflow_engine.tasks.metrics.incr") as mock_incr:
            update_status(self.group, message)
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

        with mock.patch("sentry.workflow_engine.tasks.metrics.incr") as mock_incr:
            workflow_status_update_handler(group, message, activity)
            mock_incr.assert_called_with("workflow_engine.error.tasks.no_detector_id")
