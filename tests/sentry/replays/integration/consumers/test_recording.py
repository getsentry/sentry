"""Test Arroyo recording-consumer integration."""

import zlib
from datetime import datetime
from typing import Any
from unittest import mock

import msgpack
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.replays.consumers.recording import ProcessReplayRecordingStrategyFactory
from sentry.utils import json


@pytest.fixture
def consumer() -> ProcessingStrategy[KafkaPayload]:
    return ProcessReplayRecordingStrategyFactory(
        input_block_size=1,
        max_batch_size=1,
        max_batch_time=1,
        num_processes=1,
        num_threads=1,
        output_block_size=1,
    ).create_with_partitions(lambda x, force=False: None, {})


def submit(consumer: ProcessingStrategy[KafkaPayload], message: dict[str, Any]) -> None:
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


@mock.patch("sentry.options.get")
def test_recording_consumer(options_get, consumer: ProcessingStrategy[KafkaPayload]) -> None:  # type: ignore[no-untyped-def]
    options_get.return_value = True

    headers = json.dumps({"segment_id": 42}).encode()
    recording_payload = headers + b"\n" + zlib.compress(json.dumps(MOCK_EVENTS).encode())

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

        # Assert parsing yield measured output.
        actions = commit.call_args[0][0].actions_event
        assert actions is not None
        assert actions.canvas_sizes == []
        assert len(actions.click_events) == 3
        assert actions.click_events[0].is_dead == 0
        assert actions.click_events[0].is_rage == 0
        assert actions.click_events[1].is_dead == 1
        assert actions.click_events[1].is_rage == 0
        assert actions.click_events[2].is_dead == 1
        assert actions.click_events[2].is_rage == 1
        assert actions.multiclick_events == []
        assert len(actions.hydration_errors) == 1
        assert actions.hydration_errors[0].timestamp == 1.0
        assert actions.hydration_errors[0].url == "https://sentry.io"
        assert actions.request_response_sizes == [(1002, 8001)]

        # Probablistic fields are ignored... Needs to be refactored such that the integration
        # tests can pass the state directly.
        #
        # assert actions.mutation_events == ...
        # assert actions.options_events == ...


def test_recording_consumer_invalid_message(consumer: ProcessingStrategy[KafkaPayload]) -> None:
    with mock.patch("sentry.replays.consumers.recording.commit_recording_message") as commit:
        submit(consumer, {})

        # Message was not successfully processed and the result was dropped.
        assert not commit.called


MOCK_EVENTS = [
    # Every event other than type 5.
    {"type": 0, "data": {"anything": "goes"}},
    {"type": 1, "data": {"anything": "goes"}},
    {"type": 2, "data": {"anything": "goes"}},
    {"type": 3, "data": {"anything": "goes"}},
    {"type": 4, "data": {"anything": "goes"}},
    {"type": 6, "data": {"anything": "goes"}},
    # Invalid event types.
    {"type": 5, "data": None},
    {"type": 5},
    # Canvas Events
    {"type": 3, "data": {"source": 9, "id": 2440, "type": 0, "commands": [{"a": "b"}]}},
    # Mutation Events
    {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {"category": "replay.mutations", "data": {"count": 1738}},
        },
    },
    # SDK Option Events
    {
        "data": {
            "payload": {
                "blockAllMedia": True,
                "errorSampleRate": 0,
                "maskAllInputs": True,
                "maskAllText": True,
                "networkCaptureBodies": True,
                "networkDetailHasUrls": False,
                "networkRequestHasHeaders": True,
                "networkResponseHasHeaders": True,
                "sessionSampleRate": 1,
                "useCompression": False,
                "useCompressionOption": True,
            },
            "tag": "options",
        },
        "timestamp": 1680009712.507,
        "type": 5,
    },
    # Hydration Error Events
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
    },
    # Request Response Size Event
    {
        "type": 5,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.xhr",
                "data": {"requestBodySize": 1002, "responseBodySize": 8001},
            },
        },
    },
    # Click Event
    {
        "type": 5,
        "timestamp": 1674298825,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1674298825.403,
                "type": "default",
                "category": "ui.click",
                "message": "div#hello.hello.world",
                "data": {
                    "nodeId": 1,
                    "node": {
                        "id": 1,
                        "tagName": "div",
                        "attributes": {
                            "id": "hello",
                            "class": "hello world",
                            "aria-label": "test",
                            "role": "button",
                            "alt": "1",
                            "data-testid": "2",
                            "title": "3",
                            "data-sentry-component": "SignUpForm",
                        },
                        "textContent": "Hello, world!",
                    },
                },
            },
        },
    },
    # Test Dead Click Event
    {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "category": "ui.slowClickDetected",
                "timestamp": 1674298825.403,
                "message": "button.slow",
                "data": {
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "clickCount": 3,
                    "node": {
                        "id": 456,
                        "tagName": "a",
                        "textContent": "Slow button",
                        "attributes": {},
                    },
                },
            },
        },
    },
    # Test Rage Click Event
    {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "category": "ui.slowClickDetected",
                "timestamp": 1674298825.403,
                "message": "button.slow",
                "data": {
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "clickCount": 5,
                    "node": {
                        "id": 456,
                        "tagName": "a",
                        "textContent": "Slow button",
                        "attributes": {},
                    },
                },
            },
        },
    },
]
