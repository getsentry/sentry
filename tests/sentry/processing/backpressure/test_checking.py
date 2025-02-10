from datetime import datetime
from unittest.mock import Mock, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.utils import timezone
from pytest import raises

from sentry.ingest.consumer.factory import IngestStrategyFactory
from sentry.ingest.types import ConsumerType
from sentry.processing.backpressure.health import record_consumer_health
from sentry.profiles.consumers.process.factory import ProcessProfileStrategyFactory
from sentry.testutils.helpers.options import override_options
from sentry.utils import json

PROFILES_MSG = json.dumps({"platform": "android", "profile": ""})
EVENTS_MSG = json.dumps(
    {
        "message": "test-event",
        "event_id": "10101",
    }
)


@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.checking.interval": 5,
        "backpressure.monitoring.enabled": True,
        "backpressure.status_ttl": 60,
    }
)
def test_backpressure_unhealthy_profiles():
    record_consumer_health(
        {
            "celery": Exception("Couldn't check celery"),
            "attachments-store": [],
            "processing-store": [],
            "processing-store-transactions": [],
            "processing-locks": [],
            "post-process-locks": [],
        }
    )
    with raises(MessageRejected):
        process_one_message(consumer_type="profiles", topic="profiles", payload=PROFILES_MSG)


@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.checking.interval": 5,
        "backpressure.monitoring.enabled": False,
        "backpressure.status_ttl": 60,
    }
)
def test_bad_config():
    with raises(MessageRejected):
        process_one_message(consumer_type="profiles", topic="profiles", payload=PROFILES_MSG)


@patch("sentry.profiles.consumers.process.factory.process_profile_task.s")
@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.checking.interval": 5,
        "backpressure.monitoring.enabled": True,
        "backpressure.status_ttl": 60,
    }
)
def test_backpressure_healthy_profiles(process_profile_task):
    record_consumer_health(
        {
            "celery": [],
            "attachments-store": [],
            "processing-store": [],
            "processing-store-transactions": [],
            "processing-locks": [],
            "post-process-locks": [],
        }
    )
    process_one_message(consumer_type="profiles", topic="profiles", payload=PROFILES_MSG)

    process_profile_task.assert_called_once()


@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.checking.interval": 5,
        "backpressure.monitoring.enabled": True,
        "backpressure.status_ttl": 60,
    }
)
def test_backpressure_unhealthy_events():
    record_consumer_health(
        {
            "celery": Exception("Couldn't check celery"),
            "attachments-store": [],
            "processing-store": [],
            "processing-store-transactions": [],
            "processing-locks": [],
            "post-process-locks": [],
        }
    )
    with raises(MessageRejected):
        process_one_message(consumer_type="ingest", topic="ingest-events", payload=EVENTS_MSG)


@patch("sentry.ingest.consumer.factory.maybe_multiprocess_step")
@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.checking.interval": 5,
        "backpressure.monitoring.enabled": True,
        "backpressure.status_ttl": 60,
    }
)
def test_backpressure_healthy_events(preprocess_event):
    record_consumer_health(
        {
            "celery": [],
            "attachments-store": [],
            "processing-store": [],
            "processing-store-transactions": [],
            "processing-locks": [],
            "post-process-locks": [],
        }
    )
    process_one_message(consumer_type="ingest", topic="ingest-events", payload=EVENTS_MSG)

    preprocess_event.assert_called_once()


@patch("sentry.profiles.consumers.process.factory.process_profile_task.s")
@override_options(
    {
        "backpressure.checking.enabled": False,
        "backpressure.checking.interval": 5,
    }
)
def test_backpressure_not_enabled(process_profile_task):
    process_one_message(consumer_type="profiles", topic="profiles", payload=PROFILES_MSG)

    process_profile_task.assert_called_once()


def process_one_message(consumer_type: str, topic: str, payload: str):
    if consumer_type == "profiles":
        processing_strategy = ProcessProfileStrategyFactory().create_with_partitions(
            commit=Mock(), partitions={}
        )
    elif consumer_type == "ingest":
        processing_strategy = IngestStrategyFactory(
            consumer_type=ConsumerType.Events,
            reprocess_only_stuck_events=False,
            stop_at_timestamp=None,
            num_processes=1,
            max_batch_size=10,
            max_batch_time=10,
            input_block_size=None,
            output_block_size=None,
        ).create_with_partitions(commit=Mock(), partitions={})
    message_dict = {
        "organization_id": 1,
        "project_id": 1,
        "key_id": 1,
        "received": int(timezone.now().timestamp()),
        "payload": payload,
    }
    msgpack_payload = msgpack.packb(message_dict)

    processing_strategy.submit(
        Message(
            BrokerValue(
                KafkaPayload(
                    b"key",
                    msgpack_payload,
                    [],
                ),
                Partition(Topic(topic), 1),
                1,
                datetime.now(),
            )
        )
    )
    processing_strategy.poll()
    processing_strategy.join(1)
    processing_strategy.terminate()
