# type:ignore
import uuid
from datetime import datetime
from hashlib import sha1

import msgpack
from arroyo import Message, Partition, Topic
from arroyo.backends.kafka import KafkaPayload

from sentry.models import File
from sentry.replays.consumers.recording.factory import ProcessReplayRecordingStrategyFactory
from sentry.replays.models import ReplayRecordingSegment
from sentry.testutils.cases import TestCase


class TestRecordingsConsumerEndToEnd(TestCase):
    @staticmethod
    def processing_factory():
        return ProcessReplayRecordingStrategyFactory()

    def setUp(self):
        self.replay_id = uuid.uuid4().hex
        self.replay_recording_id = uuid.uuid4().hex

    def test_basic_flow(self):
        processing_strategy = self.processing_factory().create_with_partitions(lambda x: None, None)
        sequence_id = 0
        consumer_messages = [
            {
                "payload": f'{{"sequence_id":{sequence_id}}}\ntest'.encode(),
                "replay_id": self.replay_id,
                "project_id": self.project.id,
                "id": self.replay_recording_id,
                "chunk_index": 0,
                "type": "replay_recording_chunk",
            },
            {
                "payload": b"foobar",
                "replay_id": self.replay_id,
                "project_id": self.project.id,
                "id": self.replay_recording_id,
                "chunk_index": 1,
                "type": "replay_recording_chunk",
            },
            {
                "type": "replay_recording",
                "replay_id": self.replay_id,
                "replay_recording": {
                    "chunks": 2,
                    "id": self.replay_recording_id,
                },
                "project_id": self.project.id,
            },
        ]
        for message in consumer_messages:
            processing_strategy.submit(
                Message(
                    Partition(Topic("ingest-replay-recordings"), 1),
                    1,
                    KafkaPayload(b"key", msgpack.packb(message), [("should_drop", b"1")]),
                    datetime.now(),
                )
            )
        processing_strategy.poll()
        processing_strategy.join(1)

        recording_file_name = f"rr:{self.replay_id}:{sequence_id}"
        recording = File.objects.get(name=recording_file_name)

        assert recording
        assert recording.checksum == sha1(b"testfoobar").hexdigest()
        assert ReplayRecordingSegment.objects.get(replay_id=self.replay_id)
