"""Test Arroyo recording-consumer integration."""

import zlib
from datetime import datetime
from unittest import mock

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.replays.consumers.recording import ProcessReplayRecordingStrategyFactory
from sentry.testutils.cases import TransactionTestCase
from sentry.utils import json


class TestRecordingConsumer(TransactionTestCase):
    def get_consumer(self):
        return ProcessReplayRecordingStrategyFactory(
            input_block_size=1,
            max_batch_size=1,
            max_batch_time=1,
            num_processes=1,
            num_threads=1,
            output_block_size=1,
        ).create_with_partitions(lambda x, force=False: None, {})

    def submit(self, consumer, message):
        consumer.submit(
            Message(
                BrokerValue(
                    payload=KafkaPayload(b"key", msgpack.packb(message), [("should_drop", b"1")]),
                    partition=Partition(Topic("topic"), 1),
                    offset=0,
                    timestamp=datetime.now(),
                )
            )
        )
        consumer.poll()
        consumer.join(1)
        consumer.terminate()

    def test_recording_consumer(self) -> None:
        headers = json.dumps({"segment_id": 42}).encode()
        recording_payload = headers + b"\n" + zlib.compress(b"")

        message = {
            "type": "replay_recording_not_chunked",
            "org_id": self.organization.id,
            "project_id": self.project.id,
            "replay_id": "1",
            "received": 2,
            "retention_days": 30,
            "payload": recording_payload,
            "key_id": 1,
            "replay_event": b"{}",
            "replay_video": b"",
            "version": 0,
        }

        consumer = self.get_consumer()
        with mock.patch("sentry.replays.consumers.recording.options.get", return_value=False):
            with mock.patch(
                "sentry.replays.consumers.recording.commit_recording_message"
            ) as commit:
                self.submit(consumer, message)

                # Message was successfully processed and the result was committed.
                assert commit.called

    def test_recording_consumer_invalid_message(self) -> None:
        consumer = self.get_consumer()
        with mock.patch("sentry.replays.consumers.recording.commit_recording_message") as commit:
            self.submit(consumer, {})

            # Message was not successfully processed and the result was dropped.
            assert not commit.called
