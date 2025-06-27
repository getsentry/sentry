from unittest import mock

from sentry.issues.ingest import hash_fingerprint
from sentry.issues.occurrence_consumer import _process_message
from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.group import GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from tests.sentry.issues.test_status_change_consumer import get_test_message_status_change


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
