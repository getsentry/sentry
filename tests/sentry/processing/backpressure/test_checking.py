from datetime import datetime
from unittest.mock import MagicMock, Mock, patch

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.utils import timezone
from pytest import raises

from sentry.ingest.consumer.factory import IngestStrategyFactory
from sentry.ingest.types import ConsumerType
from sentry.processing.backpressure.health import record_consumer_health
from sentry.testutils.helpers.options import override_options
from sentry.utils import json

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
def test_backpressure_unhealthy_events() -> None:
    record_consumer_health(
        {
            "attachments-store": Exception("Couldn't check attachments-store"),
            "processing-store": [],
            "processing-store-transactions": [],
            "processing-locks": [],
            "post-process-locks": [],
        }
    )
    with raises(MessageRejected):
        process_one_message(payload=EVENTS_MSG)


@patch("sentry.ingest.consumer.factory.maybe_multiprocess_step")
@override_options(
    {
        "backpressure.checking.enabled": True,
        "backpressure.checking.interval": 5,
        "backpressure.monitoring.enabled": True,
        "backpressure.status_ttl": 60,
    }
)
def test_backpressure_healthy_events(preprocess_event: MagicMock) -> None:
    record_consumer_health(
        {
            "attachments-store": [],
            "processing-store": [],
            "processing-store-transactions": [],
            "processing-locks": [],
            "post-process-locks": [],
        }
    )
    process_one_message(payload=EVENTS_MSG)

    preprocess_event.assert_called_once()


def process_one_message(payload: str) -> None:
    processing_strategy = IngestStrategyFactory(
        consumer_type=ConsumerType.Events,
        reprocess_only_stuck_events=False,
        reprocess_only_events_not_in_nodestore=False,
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
                Partition(Topic("ingest-events"), 1),
                1,
                datetime.now(),
            )
        )
    )
    processing_strategy.poll()
    processing_strategy.join(1)
    processing_strategy.terminate()
