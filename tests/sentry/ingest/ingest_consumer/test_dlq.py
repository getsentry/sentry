from datetime import datetime
from unittest.mock import Mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.ingest.consumer.factory import IngestStrategyFactory
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_dlq_invalid_messages() -> None:
    partition = Partition(Topic("ingest-events"), 0)
    offset = 5

    invalid_message = Message(
        BrokerValue(
            KafkaPayload(None, b"bogus message", []),
            partition,
            offset,
            datetime.now(),
        )
    )

    # DLQ is defined
    factory = IngestStrategyFactory(
        "events",
        reprocess_only_stuck_events=False,
        num_processes=1,
        max_batch_size=1,
        max_batch_time=1,
        input_block_size=None,
        output_block_size=None,
    )

    strategy = factory.create_with_partitions(Mock(), Mock())

    with pytest.raises(InvalidMessage) as exc_info:
        strategy.submit(invalid_message)

    assert exc_info.value.partition == partition
    assert exc_info.value.offset == offset

    # Transactions has no DLQ so we still get the original value error
    factory = IngestStrategyFactory(
        "transactions",
        reprocess_only_stuck_events=False,
        num_processes=1,
        max_batch_size=1,
        max_batch_time=1,
        input_block_size=None,
        output_block_size=None,
    )

    strategy = factory.create_with_partitions(Mock(), Mock())

    with pytest.raises(ValueError):
        strategy.submit(invalid_message)
