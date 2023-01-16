from datetime import datetime
from unittest.mock import Mock, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.profiles.consumers.process.factory import ProcessProfileStrategyFactory
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
