# type:ignore
import uuid
from hashlib import sha1

import msgpack

from sentry.models import File
from sentry.replays.consumers.recording.process_recording import ReplayRecordingBatchWorker
from sentry.replays.models import ReplayRecordingSegment
from sentry.testutils import TestCase


class TestRecordingsConsumerEndToEnd(TestCase):
    def setUp(self):
        self.replay_id = uuid.uuid4().hex
        self.replay_recording_id = uuid.uuid4().hex

    def test_basic_flow(self):
        worker = ReplayRecordingBatchWorker()

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
        batch = [worker.process_message(msgpack.packb(message)) for message in consumer_messages]
        worker.flush_batch(batch)

        recording_file_name = f"rr:{self.replay_id}:{segment_id}"
        recording = File.objects.get(name=recording_file_name)

        assert recording
        assert recording.checksum == sha1(b"testfoobar").hexdigest()
        assert ReplayRecordingSegment.objects.get(replay_id=self.replay_id)

    def test_duplicate_segment_flow(self):
        worker = ReplayRecordingBatchWorker()

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
                "type": "replay_recording",
                "replay_id": self.replay_id,
                "replay_recording": {
                    "chunks": 1,
                    "id": self.replay_recording_id,
                },
                "project_id": self.project.id,
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
        batch = [worker.process_message(msgpack.packb(message)) for message in consumer_messages]
        worker.flush_batch(batch)

        recording_file_name = f"rr:{self.replay_id}:{segment_id}"

        assert len(File.objects.filter(name=recording_file_name)) == 2
        # right now both files should be inserted, but only one segment is created,
        # so the second one is "lost".
        assert ReplayRecordingSegment.objects.get(replay_id=self.replay_id)
