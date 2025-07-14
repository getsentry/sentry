from __future__ import annotations

import time
import uuid
import zlib
from datetime import datetime
from unittest.mock import ANY, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from sentry_kafka_schemas.schema_types.ingest_replay_recordings_v1 import ReplayRecording

from sentry.models.organizationonboardingtask import OnboardingTask, OnboardingTaskStatus
from sentry.replays.consumers.recording import ProcessReplayRecordingStrategyFactory
from sentry.replays.lib.storage import _make_recording_filename, storage_kv
from sentry.replays.usecases.pack import unpack
from sentry.testutils.cases import TransactionTestCase
from sentry.utils import json


class RecordingTestCase(TransactionTestCase):
    replay_id = uuid.uuid4().hex
    replay_recording_id = uuid.uuid4().hex
    force_synchronous = True

    def get_recording_data(self, segment_id):
        result = storage_kv.get(
            _make_recording_filename(
                project_id=self.project.id,
                replay_id=self.replay_id,
                segment_id=segment_id,
                retention_days=30,
            )
        )
        if result:
            return unpack(zlib.decompress(result))[1]

    def get_video_data(self, segment_id):
        result = storage_kv.get(
            _make_recording_filename(
                project_id=self.project.id,
                replay_id=self.replay_id,
                segment_id=segment_id,
                retention_days=30,
            )
        )
        if result:
            return unpack(zlib.decompress(result))[0]

    def processing_factory(self):
        return ProcessReplayRecordingStrategyFactory(
            input_block_size=1,
            max_batch_size=1,
            max_batch_time=1,
            num_processes=1,
            num_threads=1,
            output_block_size=1,
            force_synchronous=self.force_synchronous,
        )

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

    def nonchunked_messages(
        self,
        message: bytes = b'[{"hello":"world"}]',
        segment_id: int = 0,
        compressed: bool = False,
        replay_event: bytes | None = None,
        replay_video: bytes | None = None,
    ) -> list[ReplayRecording]:
        message = zlib.compress(message) if compressed else message
        return [
            {
                "type": "replay_recording_not_chunked",
                "replay_id": self.replay_id,
                "org_id": self.organization.id,
                "key_id": 123,
                "project_id": self.project.id,
                "received": int(time.time()),
                "retention_days": 30,
                "payload": f'{{"segment_id":{segment_id}}}\n'.encode() + message,  # type: ignore[typeddict-item]
                "replay_event": replay_event,  # type: ignore[typeddict-item]
                "replay_video": replay_video,  # type: ignore[typeddict-item]
            }
        ]

    @patch("sentry.models.OrganizationOnboardingTask.objects.record")
    @patch("sentry.analytics.record")
    @patch("sentry.replays.usecases.ingest.track_outcome")
    @patch("sentry.replays.usecases.ingest.report_hydration_error")
    def test_end_to_end_consumer_processing(
        self,
        report_hydration_issue,
        track_outcome,
        mock_record,
        mock_onboarding_task,
    ):
        data = [
            {
                "type": 5,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "replay.hydrate-error",
                        "timestamp": 1.0,
                        "data": {"url": "https://sentry.io"},
                    },
                },
            }
        ]
        segment_id = 0
        self.submit(
            self.nonchunked_messages(
                message=json.dumps(data).encode(),
                segment_id=segment_id,
                compressed=True,
                replay_event=json.dumps({"platform": "javascript"}).encode(),
                replay_video=b"hello, world!",
            )
        )

        dat = self.get_recording_data(segment_id)
        assert json.loads(bytes(dat).decode("utf-8")) == data
        assert self.get_video_data(segment_id) == b"hello, world!"

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

        assert track_outcome.called
        assert report_hydration_issue.called
