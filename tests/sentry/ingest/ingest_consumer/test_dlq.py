import time
from datetime import datetime
from unittest.mock import Mock

import msgpack
import orjson
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.conf.types.kafka_definition import Topic as TopicNames
from sentry.event_manager import EventManager
from sentry.ingest.consumer.factory import IngestStrategyFactory
from sentry.ingest.types import ConsumerType
from sentry.testutils.pytest.fixtures import django_db_all


def make_message(payload: bytes, partition: Partition, offset: int) -> Message:
    return Message(
        BrokerValue(
            KafkaPayload(None, payload, []),
            partition,
            offset,
            datetime.now(),
        )
    )


@pytest.mark.parametrize(
    ("topic_name", "consumer_type"),
    [
        (TopicNames.INGEST_EVENTS.value, ConsumerType.Events),
        (TopicNames.INGEST_ATTACHMENTS.value, ConsumerType.Attachments),
        (TopicNames.INGEST_TRANSACTIONS.value, ConsumerType.Transactions),
    ],
)
@django_db_all
def test_dlq_invalid_messages(factories, topic_name, consumer_type) -> None:
    # Test is for all consumers that share the IngestStrategyFactory
    # Feedback test is located in feedback/consumers
    organization = factories.create_organization()
    project = factories.create_project(organization=organization)

    bogus_payload = b"bogus message"
    empty_event_payload = msgpack.packb(
        {
            "type": "event",
            "project_id": project.id,
            "payload": b"{}",
            "start_time": int(time.time()),
            "event_id": "aaa",
        }
    )

    em = EventManager({}, project=project)
    em.normalize()  # hack to get a sample event
    sample_event = dict(em.get_data())
    unsupported_message_type_payload = msgpack.packb(
        {
            "type": "unsupported type",
            "project_id": project.id,
            "payload": orjson.dumps(sample_event),
            "start_time": int(time.time()),
            "event_id": "aaa",
        }
    )

    partition = Partition(Topic(topic_name), 0)
    offset = 5
    factory = IngestStrategyFactory(
        consumer_type,
        reprocess_only_stuck_events=False,
        stop_at_timestamp=False,
        num_processes=1,
        max_batch_size=1,
        max_batch_time=1,
        input_block_size=None,
        output_block_size=None,
    )
    strategy = factory.create_with_partitions(Mock(), Mock())

    for payload in [bogus_payload, empty_event_payload, unsupported_message_type_payload]:
        with pytest.raises(InvalidMessage) as exc_info:
            message = make_message(payload, partition, offset)
            strategy.submit(message)

        assert exc_info.value.partition == partition
        assert exc_info.value.offset == offset
