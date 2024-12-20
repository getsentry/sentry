import time
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import msgpack
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.consumers.dlq import DlqStaleMessagesStrategyFactoryWrapper
from sentry.testutils.pytest.fixtures import django_db_all


def make_message(
    payload: bytes, partition: Partition, offset: int, timestamp: datetime | None = None
) -> Message:
    return Message(
        BrokerValue(
            KafkaPayload(None, payload, []),
            partition,
            offset,
            timestamp if timestamp else datetime.now(),
        )
    )


@pytest.mark.parametrize("stale_threshold_sec", [300])
@django_db_all
def test_dlq_stale_messages(factories, stale_threshold_sec) -> None:
    # Tests messages that have gotten stale (default longer than 5 minutes)

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

    for time_diff in range(10, 0, -1):
        message = make_message(
            empty_event_payload,
            partition,
            offset - time_diff,
            timestamp=datetime.now(timezone.utc) - timedelta(minutes=time_diff),
        )
        if time_diff < 5:
            strategy.submit(message)
        else:
            with pytest.raises(InvalidMessage) as exc_info:
                strategy.submit(message)

            assert exc_info.value.partition == partition
            assert exc_info.value.offset == offset - time_diff

    assert inner_strategy_mock.submit.call_count == 4
