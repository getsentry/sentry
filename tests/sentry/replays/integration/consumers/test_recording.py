"""Test Arroyo recording-consumer integration."""

import zlib
from datetime import datetime
from unittest import mock

import msgpack
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import MessageRejected
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.replays.consumers.recording import ProcessReplayRecordingStrategyFactory
from sentry.utils import json


@pytest.fixture
def consumer():
    return ProcessReplayRecordingStrategyFactory(
        input_block_size=1,
        max_batch_size=1,
        max_batch_time=1,
        num_processes=1,
        num_threads=1,
        output_block_size=1,
    ).create_with_partitions(lambda x, force=False: None, {})


def submit(consumer, message):
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


def test_recording_consumer(consumer) -> None:
    headers = json.dumps({"segment_id": 42}).encode()
    recording_payload = headers + b"\n" + zlib.compress(b"")

    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": recording_payload,
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }
    with mock.patch("sentry.replays.consumers.recording.commit_recording_message") as commit:
        submit(consumer, message)

        # Message was successfully processed and the result was committed.
        assert commit.called


def test_recording_consumer_invalid_message(consumer) -> None:
    with mock.patch("sentry.replays.consumers.recording.commit_recording_message") as commit:
        submit(consumer, {})

        # Message was not successfully processed and the result was dropped.
        assert not commit.called


def test_recording_consumer_throttled(consumer) -> None:
    def raised(_):
        raise MessageRejected()

    headers = json.dumps({"segment_id": 42}).encode()
    recording_payload = headers + b"\n" + zlib.compress(b"{}")

    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": recording_payload,
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }

    with mock.patch("sentry.replays.consumers.recording.RunTaskInThreads.submit") as sub:
        sub.side_effect = raised
        with pytest.raises(MessageRejected):
            submit(consumer, message)

    # Consumer now has a rejected message.
    assert consumer.rejected_message is not None

    with mock.patch("sentry.replays.consumers.recording.RunTaskInThreads.submit") as sub:
        # Retry will succeed.
        submit(consumer, message)

        # The next step was called and the rejected_message attribute was cleared.
        assert sub.call_count == 1
        assert consumer.rejected_message is None


def test_recording_consumer_throttled_new_message(consumer) -> None:
    def raised(_):
        raise MessageRejected()

    headers = json.dumps({"segment_id": 42}).encode()
    recording_payload = headers + b"\n" + zlib.compress(b"{}")

    message = {
        "type": "replay_recording_not_chunked",
        "org_id": 3,
        "project_id": 4,
        "replay_id": "1",
        "received": 2,
        "retention_days": 30,
        "payload": recording_payload,
        "key_id": 1,
        "replay_event": b"{}",
        "replay_video": b"",
        "version": 0,
    }
    with mock.patch("sentry.replays.consumers.recording.RunTaskInThreads.submit") as sub:
        sub.side_effect = raised
        with pytest.raises(MessageRejected):
            submit(consumer, message)

    # Consumer now has a rejected message.
    assert consumer.rejected_message is not None

    with mock.patch("sentry.replays.consumers.recording.RunTaskInThreads.submit") as sub:
        # We're changing the message so the hashes don't match. This should trigger both the
        # rejected message and the new message to be submitted to the next step.
        message["org_id"] = 22

        # New message will succeed.
        submit(consumer, message)

        # The next step was called twice and the rejected_message attribute was cleared.
        assert sub.call_count == 2
        assert consumer.rejected_message is None
