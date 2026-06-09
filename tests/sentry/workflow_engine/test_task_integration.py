from unittest import mock

from sentry.issues.ingest import hash_fingerprint
from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.group import GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import TestCase
from sentry.types.group import GroupSubStatus


class IssuePlatformIntegrationTests(TestCase):
    def setUp(self) -> None:
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

    def _resolved_message(self) -> StatusChangeMessageData:
        return StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=[self.fingerprint],
            detector_id=self.detector.id,
            activity_data={"test": "test"},
        )

    @mock.patch("sentry.workflow_engine.tasks.workflows.process_workflow_activity.delay")
    def test_activity_dispatch(self, mock_delay: mock.MagicMock) -> None:
        """
        This test ensures that the activity_handler is properly configured and connected
        to the kafka consumer for status update messages.
        """
        update_status(self.group, self._resolved_message())
        assert mock_delay.call_count == 1
        mock_delay.assert_called_once_with(
            activity_id=mock.ANY,
            group_id=self.group.id,
            detector_id=self.detector.id,
        )
