from datetime import datetime
from unittest.mock import Mock, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

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
            "received": int(datetime.utcnow().timestamp()),
            "payload": json.dumps({"platform": "android", "profile": ""}),
        }

        processing_strategy.submit(
            Message(
                BrokerValue(
                    KafkaPayload(
                        b"key",
                        msgpack.packb(message_dict),
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

        profile = json.loads(message_dict["payload"], use_rapid_json=True)
        profile.update(
            {
                "organization_id": message_dict["organization_id"],
                "project_id": message_dict["project_id"],
                "received": message_dict["received"],
            }
        )

        process_profile_task.assert_called_with(profile=profile)


def test_adjust_instruction_addr_sample_format():
    profile = {
        "version": "1",
        "profile": {
            "frames": [
                {"instruction_addr": "0xdeadbeef", "platform": "native"},
                {"instruction_addr": "0xbeefdead", "platform": "native"},
            ],
            "stacks": [[1, 0]],
        },
        "debug_meta": {"images": []},
    }

    _, stacktraces = _prepare_frames_from_profile(profile)
    frames = stacktraces[0]["frames"]

    assert "adjust_instruction_addr" not in frames[0]
    assert not frames[1]["adjust_instruction_addr"]


def test_adjust_instruction_addr_original_format():
    profile = {
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

    _, stacktraces = _prepare_frames_from_profile(profile)
    frames = stacktraces[0]["frames"]

    assert not frames[0]["adjust_instruction_addr"]
    assert "adjust_instruction_addr" not in frames[1]
