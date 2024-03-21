import time
from datetime import datetime
from unittest.mock import Mock

import msgpack
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.conf.types.kafka_definition import Topic as TopicNames
from sentry.ingest.consumer.factory import IngestStrategyFactory
from sentry.ingest.types import ConsumerType
from sentry.testutils.pytest.fixtures import django_db_all

"""
Copied from ingest_consumer/test_dlq.py. That test can be parametrized (and should be, for txns + attachments),
but moving feedback tests to this pkg makes it easier to migrate to a separate StrategyFactory later.
"""


def make_message(payload: bytes, partition: Partition, offset: int) -> Message:
    return Message(
        BrokerValue(
            KafkaPayload(None, payload, []),
            partition,
            offset,
            datetime.now(),
        )
    )


@django_db_all
def test_dlq_invalid_messages(factories) -> None:
    organization = factories.create_organization()
    project = factories.create_project(organization=organization)

    valid_payload = msgpack.packb(
        {
            "type": "event",
            "project_id": project.id,
            "payload": b"{}",
            "start_time": int(time.time()),
            "event_id": "aaa",
        }
    )

    bogus_payload = b"bogus message"

    partition = Partition(Topic(TopicNames.INGEST_FEEDBACK_EVENTS.value), 0)
    offset = 5

    factory = IngestStrategyFactory(
        ConsumerType.Feedback,
        reprocess_only_stuck_events=False,
        num_processes=1,
        max_batch_size=1,
        max_batch_time=1,
        input_block_size=None,
        output_block_size=None,
    )
    strategy = factory.create_with_partitions(Mock(), Mock())

    # Valid payload raises original error
    with pytest.raises(Exception) as exc_info:
        message = make_message(valid_payload, partition, offset)
        strategy.submit(message)
    assert not isinstance(exc_info.value, InvalidMessage)

    # Invalid payload raises InvalidMessage error

    with pytest.raises(InvalidMessage) as exc_info:
        message = make_message(bogus_payload, partition, offset)
        strategy.submit(message)

    assert exc_info.value.partition == partition
    assert exc_info.value.offset == offset


"""
TODO: assert event.payload.type == "feedback", and other feedback-specific invalid msg formats.

Right we're using the generic IngestStrategyFactory, which does zero validation on the event payload (sdk event).
Kafka schema just says bytes. So this is only a TODO if
 1) we write a dedicated FeedbackStrategy
 2) we decide to do more validation in the consumer
"""
