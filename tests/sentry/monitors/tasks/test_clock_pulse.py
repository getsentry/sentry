from collections.abc import Generator, MutableMapping
from datetime import timedelta
from unittest import mock

import pytest
from arroyo import Partition, Topic
from arroyo.backends.kafka import KafkaPayload
from confluent_kafka.admin import PartitionMetadata  # type: ignore[attr-defined]
from django.test import override_settings

from sentry.monitors.tasks.clock_pulse import MONITOR_CODEC, _get_partitions, clock_pulse
from sentry.testutils.helpers.datetime import freeze_time


@pytest.fixture(autouse=True)
def reset_partitions_cache() -> Generator[None]:
    # https://github.com/python/mypy/issues/5107
    _get_partitions.cache_clear()  # type: ignore[attr-defined]
    yield
    _get_partitions.cache_clear()  # type: ignore[attr-defined]


def make_partitions(partition_count: int) -> MutableMapping[int, PartitionMetadata]:
    partitions: MutableMapping[int, PartitionMetadata] = {}
    for idx in range(partition_count):
        partitions[idx] = PartitionMetadata()
        partitions[idx].id = idx
    return partitions


@override_settings(
    KAFKA_TOPIC_OVERRIDES={"ingest-monitors": "monitors-test-topic"},
    KAFKA_TOPIC_TO_CLUSTER={"monitors-test-topic": "default"},
)
@override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
@mock.patch("sentry.monitors.tasks.clock_pulse._checkin_producer")
def test_clock_pulse(checkin_producer_mock: mock.MagicMock) -> None:
    partition_count = 3
    mock_partitions = make_partitions(partition_count)

    with mock.patch("sentry.monitors.tasks.clock_pulse._get_partitions", lambda: mock_partitions):
        clock_pulse()

    # One clock pulse per partition
    assert checkin_producer_mock.produce.call_count == len(mock_partitions.items())
    for idx in range(partition_count):
        assert checkin_producer_mock.produce.mock_calls[idx] == mock.call(
            Partition(Topic("monitors-test-topic"), idx),
            KafkaPayload(
                None,
                MONITOR_CODEC.encode({"message_type": "clock_pulse", "partition_ids": [0, 1, 2]}),
                [],
            ),
        )

    # Each pulse carries the full partition list and passes schema validation
    for call in checkin_producer_mock.produce.mock_calls:
        payload: KafkaPayload = call.args[1]
        message = MONITOR_CODEC.decode(payload.value, validate=True)
        assert message == {"message_type": "clock_pulse", "partition_ids": [0, 1, 2]}


@override_settings(
    KAFKA_TOPIC_OVERRIDES={"ingest-monitors": "monitors-test-topic"},
    KAFKA_TOPIC_TO_CLUSTER={"monitors-test-topic": "default"},
)
@mock.patch("sentry.monitors.tasks.clock_pulse.AdminClient")
def test_get_partitions_refreshes_after_ttl(admin_client_mock: mock.MagicMock) -> None:
    def set_partition_count(partition_count: int) -> None:
        topic_metadata = mock.Mock(partitions=make_partitions(partition_count))
        admin_client_mock.return_value.list_topics.return_value = mock.Mock(
            topics={"monitors-test-topic": topic_metadata}
        )

    with freeze_time() as frozen_time:
        set_partition_count(2)
        assert list(_get_partitions()) == [0, 1]

        # A partition is added. The cached list is kept until the TTL expires
        set_partition_count(3)
        frozen_time.shift(timedelta(minutes=4))
        assert list(_get_partitions()) == [0, 1]

        # After the TTL expires the new partition list is read
        frozen_time.shift(timedelta(minutes=2))
        assert list(_get_partitions()) == [0, 1, 2]

    assert admin_client_mock.return_value.list_topics.call_count == 2
