import time
import uuid
import zlib
from datetime import datetime
from typing import Any, Dict, List
from unittest.mock import ANY, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

# from sentry import options
from sentry.models import File
from sentry.models.organizationonboardingtask import OnboardingTask, OnboardingTaskStatus
from sentry.replays.consumers.recording import ProcessReplayRecordingStrategyFactory
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
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
        self.assert_replay_recording_segment(segment_id, compressed=True)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

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
        self.assert_replay_recording_segment(segment_id, compressed=False)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

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
        self.assert_replay_recording_segment(segment_id, compressed=True)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

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
        self.assert_replay_recording_segment(segment_id, False)

        self.project.refresh_from_db()
        assert self.project.flags.has_replays

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


class FilestoreRecordingTestCase(RecordingTestCaseMixin, TransactionTestCase):
    def setUp(self):
        self.replay_id = uuid.uuid4().hex
        self.replay_recording_id = uuid.uuid4().hex

    def assert_replay_recording_segment(self, segment_id: int, compressed: bool):
        # Assert a recording segment model was created for filestore driver types.
        recording_segment = ReplayRecordingSegment.objects.first()
        assert recording_segment.project_id == self.project.id
        assert recording_segment.replay_id == self.replay_id
        assert recording_segment.segment_id == segment_id
        assert recording_segment.file_id is not None

        bytes = self.get_recording_data(segment_id)

        # The bytes stored are always the bytes received from Relay.  Therefore, the size the
        # len of bytes regardless of compression.
        assert len(bytes) == recording_segment.size

        # Assert (depending on compression) that the bytes are equal to our default mock value.
        if compressed:
            assert zlib.decompress(bytes) == b'[{"hello":"world"}]'
        else:
            assert bytes == b'[{"hello":"world"}]'

    def get_recording_data(self, segment_id):
        file = File.objects.first()

        recording_segment = RecordingSegmentStorageMeta(
            project_id=self.project.id,
            replay_id=self.replay_id,
            segment_id=segment_id,
            retention_days=30,
            file_id=file.id,
        )
        return FilestoreBlob().get(recording_segment)


# class StorageRecordingTestCase(RecordingTestCaseMixin, TransactionTestCase):
#     def setUp(self):
#         self.replay_id = uuid.uuid4().hex
#         self.replay_recording_id = uuid.uuid4().hex
#         options.set("replay.storage.direct-storage-sample-rate", 100)

#     def assert_replay_recording_segment(self, segment_id: int, compressed: bool):
#         # Assert no recording segment is written for direct-storage.  Direct-storage does not
#         # use a metadata database.
#         recording_segment = ReplayRecordingSegment.objects.first()
#         assert recording_segment is None

#         bytes = self.get_recording_data(segment_id)

#         # Assert (depending on compression) that the bytes are equal to our default mock value.
#         if compressed:
#             assert zlib.decompress(bytes) == b'[{"hello":"world"}]'
#         else:
#             assert bytes == b'[{"hello":"world"}]'

#     def get_recording_data(self, segment_id):
#         recording_segment = RecordingSegmentStorageMeta(
#             project_id=self.project.id,
#             replay_id=self.replay_id,
#             segment_id=segment_id,
#             retention_days=30,
#         )
#         return StorageBlob().get(recording_segment)
