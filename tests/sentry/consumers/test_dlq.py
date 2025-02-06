import time
from datetime import datetime, timedelta, timezone
from typing import cast
from unittest.mock import Mock

import msgpack
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.consumers.dlq import DlqStaleMessagesStrategyFactoryWrapper
from sentry.testutils.pytest.fixtures import django_db_all


def make_message(payload: bytes, partition: Partition, offset: int, timestamp: datetime) -> Message:
    return Message(
        BrokerValue(
            KafkaPayload(None, payload, []),
            partition,
            offset,
            timestamp,
        )
    )


@pytest.mark.parametrize("stale_threshold_sec", [300])
@django_db_all
def test_dlq_stale_messages_timestamps(factories, stale_threshold_sec) -> None:

    organization = factories.create_organization()
    project = factories.create_project(organization=organization)

    empty_event_payload = msgpack.packb(
        {
            "type": "event",
            "project_id": project.id,
            "payload": b"{}",
            "start_time": int(time.time()),
            "event_id": "aaa",
        }
    )

    partition = Partition(Topic("topic"), 0)
    offset = 10
    inner_factory_mock = Mock()
    inner_strategy_mock = Mock()
    inner_factory_mock.create_with_partitions = Mock(return_value=inner_strategy_mock)
    factory = DlqStaleMessagesStrategyFactoryWrapper(
        stale_threshold_sec=stale_threshold_sec,
        inner=inner_factory_mock,
    )
    strategy = factory.create_with_partitions(Mock(), Mock())

    test_cases = [
        {
            "timestamp": datetime.now() - timedelta(seconds=stale_threshold_sec - 60),
            "should_raise": False,
        },
        {
            "timestamp": datetime.now() - timedelta(seconds=stale_threshold_sec + 60),
            "should_raise": True,
        },
        {
            "timestamp": datetime.now(timezone.utc) - timedelta(seconds=stale_threshold_sec + 60),
            "should_raise": True,
        },
        {
            "timestamp": datetime.now(timezone.utc) - timedelta(seconds=stale_threshold_sec - 60),
            "should_raise": False,
        },
    ]

    for idx, case in enumerate(test_cases):
        message = make_message(
            empty_event_payload,
            partition,
            offset + idx,
            timestamp=cast(datetime, case["timestamp"]),
        )

        if case["should_raise"]:
            with pytest.raises(InvalidMessage) as exc_info:
                strategy.submit(message)

            assert exc_info.value.partition == partition
            assert exc_info.value.offset == offset + idx
        else:
            strategy.submit(message)

    valid_messages = sum(1 for case in test_cases if not case["should_raise"])
    assert inner_strategy_mock.submit.call_count == valid_messages
