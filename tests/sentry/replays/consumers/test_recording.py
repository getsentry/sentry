import time
import uuid
import zlib
from datetime import datetime
from typing import Any, Dict, List
from unittest.mock import ANY, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.test import override_settings

from sentry.models.organizationonboardingtask import OnboardingTask, OnboardingTaskStatus
from sentry.replays.consumers.recording import ProcessReplayRecordingStrategyFactory
from sentry.replays.lib.storage import FilestoreBlob, StorageBlob
from sentry.replays.models import ReplayRecordingSegment
from sentry.testutils import TransactionTestCase


class RecordingTestCaseMixin:
    @staticmethod
    def processing_factory():
        return ProcessReplayRecordingStrategyFactory()

    def setUp(self):
        self.replay_id = uuid.uuid4().hex
        self.replay_recording_id = uuid.uuid4().hex

    def submit(self, messages):
        strategy = self.processing_factory().create_with_partitions(
            lambda x, force=False: None, None
        )

        for message in messages:
            strategy.submit(
                Message(
                    BrokerValue(
                        KafkaPayload(b"key", msgpack.packb(message), [("should_drop", b"1")]),
                        Partition(Topic("ingest-replay-recordings"), 1),
                        1,
                        datetime.now(),
                    )
                )
            )
        strategy.poll()
        strategy.join(1)
        strategy.terminate()

    def chunked_messages(
        self,
        message: bytes = b'[{"hello":"world"}]',
        segment_id: int = 0,
        compressed: bool = False,
    ) -> List[Dict[str, Any]]:
        message = zlib.compress(message) if compressed else message
        return [
            {
                "payload": f'{{"segment_id":{segment_id}}}\n'.encode() + message,
                "replay_id": self.replay_id,
                "project_id": self.project.id,
                "id": self.replay_recording_id,
                "chunk_index": 0,
                "type": "replay_recording_chunk",
                "org_id": self.organization.id,
                "received": time.time(),
                "retention_days": 30,
                "key_id": 123,
            },
            {
                "type": "replay_recording",
                "replay_id": self.replay_id,
                "replay_recording": {
                    "chunks": 1,
                    "id": self.replay_recording_id,
                },
                "project_id": self.project.id,
                "org_id": self.organization.id,
                "received": time.time(),
                "retention_days": 30,
            },
        ]

    def nonchunked_messages(
        self,
        message: bytes = b'[{"hello":"world"}]',
        segment_id: int = 0,
        compressed: bool = False,
    ) -> List[Dict[str, Any]]:
        message = zlib.compress(message) if compressed else message
        return [
            {
                "type": "replay_recording_not_chunked",
                "replay_id": self.replay_id,
                "org_id": self.organization.id,
                "key_id": 123,
                "project_id": self.project.id,
                "received": time.time(),
                "retention_days": 30,
                "payload": f'{{"segment_id":{segment_id}}}\n'.encode() + message,
            }
        ]

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    def test_chunked_compressed_segment_ingestion(self, mock_record, mock_onboarding_task):
        segment_id = 0
        self.submit(self.chunked_messages(segment_id=segment_id, compressed=True))

        recording_segment = ReplayRecordingSegment.objects.first()
        assert recording_segment.org_id == self.organization.id
        assert recording_segment.project_id == self.project.id
        assert recording_segment.replay_id == self.replay_id
        assert recording_segment.segment_id == segment_id
        assert recording_segment.size > 0
        assert recording_segment.retention_days == 30
        self.assert_replay_recording_segment(recording_segment)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        bytes = self.get_recording_data(recording_segment)
        assert bytes == b'[{"hello":"world"}]'
        assert len(bytes) != recording_segment.size
        assert len(zlib.compress(bytes)) == recording_segment.size

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )

        mock_record.assert_called_with(
            "first_replay.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            platform=self.project.platform,
            user_id=self.organization.default_owner_id,
        )

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    def test_chunked_uncompressed_segment_ingestion(self, mock_record, mock_onboarding_task):
        segment_id = 0
        self.submit(self.chunked_messages(segment_id=segment_id, compressed=False))

        recording_segment = ReplayRecordingSegment.objects.first()
        assert recording_segment.org_id == self.organization.id
        assert recording_segment.project_id == self.project.id
        assert recording_segment.replay_id == self.replay_id
        assert recording_segment.segment_id == segment_id
        assert recording_segment.size > 0
        assert recording_segment.retention_days == 30
        self.assert_replay_recording_segment(recording_segment)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        bytes = self.get_recording_data(recording_segment)
        assert bytes == b'[{"hello":"world"}]'
        assert len(bytes) == recording_segment.size

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )

        mock_record.assert_called_with(
            "first_replay.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            platform=self.project.platform,
            user_id=self.organization.default_owner_id,
        )

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    def test_compressed_segment_ingestion(self, mock_record, mock_onboarding_task):
        segment_id = 0
        self.submit(self.nonchunked_messages(segment_id=segment_id, compressed=True))

        recording_segment = ReplayRecordingSegment.objects.first()
        assert recording_segment.org_id == self.organization.id
        assert recording_segment.project_id == self.project.id
        assert recording_segment.replay_id == self.replay_id
        assert recording_segment.segment_id == segment_id
        assert recording_segment.size > 0
        assert recording_segment.retention_days == 30
        self.assert_replay_recording_segment(recording_segment)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        bytes = self.get_recording_data(recording_segment)
        assert bytes == b'[{"hello":"world"}]'
        assert len(bytes) != recording_segment.size
        assert len(zlib.compress(bytes)) == recording_segment.size

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )

        mock_record.assert_called_with(
            "first_replay.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            platform=self.project.platform,
            user_id=self.organization.default_owner_id,
        )

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    def test_uncompressed_segment_ingestion(self, mock_record, mock_onboarding_task):
        segment_id = 0
        self.submit(self.nonchunked_messages(segment_id=segment_id, compressed=False))

        recording_segment = ReplayRecordingSegment.objects.first()
        assert recording_segment.org_id == self.organization.id
        assert recording_segment.project_id == self.project.id
        assert recording_segment.replay_id == self.replay_id
        assert recording_segment.segment_id == segment_id
        assert recording_segment.size > 0
        assert recording_segment.retention_days == 30
        self.assert_replay_recording_segment(recording_segment)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

        bytes = self.get_recording_data(recording_segment)
        assert bytes == b'[{"hello":"world"}]'
        assert len(bytes) == recording_segment.size

        mock_onboarding_task.assert_called_with(
            organization_id=self.project.organization_id,
            task=OnboardingTask.SESSION_REPLAY,
            status=OnboardingTaskStatus.COMPLETE,
            date_completed=ANY,
        )

        mock_record.assert_called_with(
            "first_replay.sent",
            organization_id=self.organization.id,
            project_id=self.project.id,
            platform=self.project.platform,
            user_id=self.organization.default_owner_id,
        )


# The "filestore" and "storage" drivers should behave identically barring some tweaks to how
# metadata is tracked and where the data is stored.  The tests are abstracted into a mixin to
# prevent accidental modification between the types.  The testsuite is run twice with different
# configuration values.


@override_settings(SENTRY_REPLAYS_BLOB_DRIVER="filestore")
class FilestoreRecordingTestCase(RecordingTestCaseMixin, TransactionTestCase):
    def setUp(self):
        self.replay_id = uuid.uuid4().hex
        self.replay_recording_id = uuid.uuid4().hex

    def assert_replay_recording_segment(self, recording_segment):
        assert recording_segment.driver == ReplayRecordingSegment.FILESTORE
        assert recording_segment.file_id is not None

    def get_recording_data(self, recording_segment):
        return FilestoreBlob().get(recording_segment)


@override_settings(SENTRY_REPLAYS_BLOB_DRIVER="storage")
class StorageRecordingTestCase(RecordingTestCaseMixin, TransactionTestCase):
    def setUp(self):
        self.replay_id = uuid.uuid4().hex
        self.replay_recording_id = uuid.uuid4().hex

    def assert_replay_recording_segment(self, recording_segment):
        assert recording_segment.driver == ReplayRecordingSegment.STORAGE
        assert recording_segment.file_id is None

    def get_recording_data(self, recording_segment):
        return StorageBlob().get(recording_segment)
