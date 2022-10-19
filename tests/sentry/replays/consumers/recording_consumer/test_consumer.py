# type:ignore
import time
import uuid
from datetime import datetime
from hashlib import sha1

import msgpack
from arroyo import Message, Partition, Topic
from arroyo.backends.kafka import KafkaPayload

from sentry.models import File
from sentry.replays.consumers.recording.factory import ProcessReplayRecordingStrategyFactory
from sentry.replays.models import ReplayRecordingSegment
from sentry.testutils import TransactionTestCase


class TestRecordingsConsumerEndToEnd(TransactionTestCase):
    @staticmethod
    def processing_factory():
        return ProcessReplayRecordingStrategyFactory()

    def setUp(self):
        self.replay_id = uuid.uuid4().hex
        self.replay_recording_id = uuid.uuid4().hex

    def test_basic_flow(self):
        processing_strategy = self.processing_factory().create_with_partitions(lambda x: None, None)
        segment_id = 0
        consumer_messages = [
            {
                "payload": f'{{"segment_id":{segment_id}}}\ntest'.encode(),
                "replay_id": self.replay_id,
                "project_id": self.project.id,
                "id": self.replay_recording_id,
                "chunk_index": 0,
                "type": "replay_recording_chunk",
                "org_id": self.organization.id,
                "received": time.time(),
                "key_id": 123,
            },
            {
                "payload": b"foobar",
                "replay_id": self.replay_id,
                "project_id": self.project.id,
                "id": self.replay_recording_id,
                "chunk_index": 1,
                "type": "replay_recording_chunk",
                "org_id": self.organization.id,
                "received": time.time(),
            },
            {
                "type": "replay_recording",
                "replay_id": self.replay_id,
                "replay_recording": {
                    "chunks": 2,
                    "id": self.replay_recording_id,
                },
                "project_id": self.project.id,
                "org_id": self.organization.id,
                "received": time.time(),
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
        processing_strategy.terminate()
        recording_file_name = f"rr:{self.replay_id}:{segment_id}"
        recording = File.objects.get(name=recording_file_name)

        assert recording
        assert recording.checksum == sha1(b"testfoobar").hexdigest()
        assert ReplayRecordingSegment.objects.get(replay_id=self.replay_id)

    def test_duplicate_segment_flow(self):
        processing_strategy = self.processing_factory().create_with_partitions(lambda x: None, None)
        segment_id = 0
        consumer_messages = [
            {
                "payload": f'{{"segment_id":{segment_id}}}\ntest'.encode(),
                "replay_id": self.replay_id,
                "project_id": self.project.id,
                "id": self.replay_recording_id,
                "chunk_index": 0,
                "type": "replay_recording_chunk",
            },
            {
                "payload": f'{{"segment_id":{segment_id}}}\nduplicatedyadada'.encode(),
                "replay_id": self.replay_id,
                "project_id": self.project.id,
                "id": self.replay_recording_id,
                "chunk_index": 0,
                "type": "replay_recording_chunk",
            },
            {
                "type": "replay_recording",
                "replay_id": self.replay_id,
                "replay_recording": {
                    "chunks": 1,
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
        processing_strategy.terminate()

        recording_file_name = f"rr:{self.replay_id}:{segment_id}"

        assert len(File.objects.filter(name=recording_file_name)) == 1
        assert ReplayRecordingSegment.objects.get(replay_id=self.replay_id)
