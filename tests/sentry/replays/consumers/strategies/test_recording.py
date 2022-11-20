# type:ignore
import time
import uuid
import zlib
from datetime import datetime
from hashlib import sha1
from unittest.mock import ANY, patch

import msgpack
from arroyo import Message, Partition, Topic
from arroyo.backends.kafka import KafkaPayload

from sentry.models import File, OnboardingTask, OnboardingTaskStatus
from sentry.replays.consumers.strategies.recording import RecordingProcessorStrategyFactory
from sentry.replays.models import ReplayRecordingSegment
from sentry.testutils import TransactionTestCase


class RecordingConsumerTestCase(TransactionTestCase):
    @staticmethod
    def processing_factory():
        return RecordingProcessorStrategyFactory()

    def setUp(self):
        self.replay_id = uuid.uuid4().hex
        self.replay_recording_id = uuid.uuid4().hex

        self.processing_strategy = self.processing_factory().create_with_partitions(
            lambda x: None, None
        )
        self.processing_strategy.teardown()
        self.processing_strategy.setup(always_eager=True)

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    def test_basic_flow_compressed(self, mock_record, mock_onboarding_task):
        segment_id = 0

        self.processing_strategy.submit(
            Message(
                Partition(Topic("ingest-replay-recordings"), 1),
                1,
                KafkaPayload(
                    b"key",
                    msgpack.packb(
                        {
                            "type": "replay_recording_not_chunked",
                            "replay_id": self.replay_id,
                            "org_id": self.organization.id,
                            "key_id": 123,
                            "project_id": self.project.id,
                            "received": time.time(),
                            "payload": b'{"segment_id":0}\n' + zlib.compress(b"test"),
                        }
                    ),
                    [("should_drop", b"1")],
                ),
                datetime.now(),
            )
        )
        self.processing_strategy.poll()
        self.processing_strategy.join(1)
        self.processing_strategy.terminate()
        recording_file_name = f"rr:{self.replay_id}:{segment_id}"
        recording = File.objects.get(name=recording_file_name)

        assert recording
        assert recording.checksum == sha1(zlib.compress(b"test")).hexdigest()
        assert ReplayRecordingSegment.objects.get(replay_id=self.replay_id)

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
    def test_basic_flow(self, mock_record, mock_onboarding_task):
        segment_id = 0

        self.processing_strategy.submit(
            Message(
                Partition(Topic("ingest-replay-recordings"), 1),
                1,
                KafkaPayload(
                    b"key",
                    msgpack.packb(
                        {
                            "type": "replay_recording_not_chunked",
                            "replay_id": self.replay_id,
                            "org_id": self.organization.id,
                            "key_id": 123,
                            "project_id": self.project.id,
                            "received": time.time(),
                            "payload": b'{"segment_id":0}\n' + b"test",
                        }
                    ),
                    [("should_drop", b"1")],
                ),
                datetime.now(),
            )
        )
        self.processing_strategy.poll()
        self.processing_strategy.join(1)
        self.processing_strategy.terminate()
        recording_file_name = f"rr:{self.replay_id}:{segment_id}"
        recording = File.objects.get(name=recording_file_name)

        assert recording
        assert recording.checksum == sha1(b"test").hexdigest()
        assert ReplayRecordingSegment.objects.get(replay_id=self.replay_id)

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
