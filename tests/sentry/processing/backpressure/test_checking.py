from datetime import datetime
from unittest.mock import Mock, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import BrokerValue, Message, Partition, Topic
from pytest import raises

from sentry.processing.backpressure.health import record_consumer_health
from sentry.profiles.consumers.process.factory import ProcessProfileStrategyFactory
from sentry.testutils.helpers.options import override_options
from sentry.utils import json


@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.checking.interval": 5,
        "backpressure.status_ttl": 60,
    }
)
def test_backpressure_unhealthy():
    record_consumer_health({"celery": False})
    with raises(MessageRejected):
        process_one_message()


@patch("sentry.profiles.consumers.process.factory.process_profile_task.s")
@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.checking.interval": 5,
        "backpressure.status_ttl": 60,
    }
)
def test_backpressure_healthy(process_profile_task):
    record_consumer_health(
        {
            "celery": True,
            "attachments-store": True,
            "processing-store": True,
            "processing-locks": True,
            "post-process-locks": True,
        }
    )
    process_one_message()

    process_profile_task.assert_called_once()


@patch("sentry.profiles.consumers.process.factory.process_profile_task.s")
@override_options(
    {
        "backpressure.checking.enabled": False,
        "backpressure.checking.interval": 5,
    }
)
def test_backpressure_not_enabled(process_profile_task):
    process_one_message()

    process_profile_task.assert_called_once()


def process_one_message():
    processing_strategy = ProcessProfileStrategyFactory().create_with_partitions(
        commit=Mock(), partitions={}
    )
    message_dict = {
        "organization_id": 1,
        "project_id": 1,
        "key_id": 1,
        "received": int(datetime.utcnow().timestamp()),
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
