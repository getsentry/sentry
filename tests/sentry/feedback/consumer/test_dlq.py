from unittest.mock import Mock

import msgpack
import pytest
from arroyo.dlq import InvalidMessage
from arroyo.types import Partition, Topic

from sentry.conf.types.kafka_definition import Topic as TopicNames
from sentry.ingest.types import ConsumerType
from sentry.testutils.pytest.fixtures import django_db_all

from .test_utils import make_broker_message, make_ingest_message

"""
Based on ingest_consumer/test_dlq.py. Feedback uses the same IngestStrategyFactory as Events,
but moving its tests here makes it easier to migrate to a separate StrategyFactory later.
"""


@django_db_all
def test_process_invalid_messages(default_project, feedback_strategy_factory_cls) -> None:
    # Kafka payloads (bytes)
    payload_invalid = b"bogus message"
    payload_empty_message = msgpack.packb({})
    # required fields for ingest message (not tested individually): type, event_id, project_id, start_time, payload

    payload_invalid_event = msgpack.packb(make_ingest_message(b"hello world", default_project)[0])
    payload_empty_event = msgpack.packb(make_ingest_message({}, default_project)[0])
    # required fields: event_id, ??

    strategy_factory = feedback_strategy_factory_cls(
        ConsumerType.Feedback,
        reprocess_only_stuck_events=False,
        num_processes=1,
        max_batch_size=1,
        max_batch_time=1,
        input_block_size=None,
        output_block_size=None,
    )
    strategy = strategy_factory.create_with_partitions(Mock(), Mock())
    partition = Partition(Topic(TopicNames.INGEST_FEEDBACK_EVENTS.value), 0)
    offset = 5

    for payload in [
        payload_invalid,
        payload_empty_message,
        payload_invalid_event,
        payload_empty_event,
    ]:
        message = make_broker_message(payload, partition, offset)
        with pytest.raises(InvalidMessage) as exc_info:
            strategy.submit(message)
        assert exc_info.value.partition == partition
        assert exc_info.value.offset == offset
