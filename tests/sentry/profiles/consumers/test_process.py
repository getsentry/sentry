from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import Mock, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.utils import timezone

from sentry.profiles.consumers.process.factory import ProcessProfileStrategyFactory
from sentry.profiles.task import _prepare_frames_from_profile
from sentry.testutils.cases import TestCase
from sentry.utils import json


class TestProcessProfileConsumerStrategy(TestCase):
    @staticmethod
    def processing_factory():
        return ProcessProfileStrategyFactory()

    @patch("sentry.profiles.consumers.process.factory.process_profile_task.s")
    def test_basic_profile_to_celery(self, process_profile_task):
        processing_strategy = self.processing_factory().create_with_partitions(
            commit=Mock(), partitions=None
        )
        message_dict = {
            "organization_id": 1,
            "project_id": 1,
            "key_id": 1,
            "received": int(timezone.now().timestamp()),
            "payload": json.dumps({"platform": "android", "profile": ""}),
        }
        payload = msgpack.packb(message_dict)

        processing_strategy.submit(
            Message(
                BrokerValue(
                    KafkaPayload(
                        b"key",
                        payload,
                        [],
                    ),
                    Partition(Topic("profiles"), 1),
                    1,
                    datetime.now(),
                )
            )
        )
        processing_strategy.poll()
        processing_strategy.join(1)
        processing_strategy.terminate()

        process_profile_task.assert_called_with(payload=payload, sampled=True)


def test_adjust_instruction_addr_sample_format():
    original_frames = [
        {"instruction_addr": "0xdeadbeef"},
        {"instruction_addr": "0xbeefdead"},
        {"instruction_addr": "0xfeedface"},
    ]
    profile: dict[str, Any] = {
        "version": "1",
        "platform": "cocoa",
        "profile": {
            "frames": original_frames.copy(),
            "stacks": [[1, 0], [0, 1, 2]],
        },
        "debug_meta": {"images": []},
    }

    _, stacktraces, _ = _prepare_frames_from_profile(profile, profile["platform"])
    assert profile["profile"]["stacks"] == [[3, 0], [4, 1, 2]]
    frames = stacktraces[0]["frames"]

    for i in range(3):
        assert frames[i] == original_frames[i]

    assert frames[3] == {"instruction_addr": "0xbeefdead", "adjust_instruction_addr": False}
    assert frames[4] == {"instruction_addr": "0xdeadbeef", "adjust_instruction_addr": False}


def test_adjust_instruction_addr_original_format():
    profile = {
        "platform": "cocoa",
        "sampled_profile": {
            "samples": [
                {
                    "frames": [
                        {"instruction_addr": "0xdeadbeef", "platform": "native"},
                        {"instruction_addr": "0xbeefdead", "platform": "native"},
                    ],
                }
            ]
        },
        "debug_meta": {"images": []},
    }

    _, stacktraces, _ = _prepare_frames_from_profile(profile, str(profile["platform"]))
    frames = stacktraces[0]["frames"]

    assert not frames[0]["adjust_instruction_addr"]
    assert "adjust_instruction_addr" not in frames[1]
