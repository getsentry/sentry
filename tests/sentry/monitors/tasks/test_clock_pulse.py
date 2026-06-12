from collections.abc import MutableMapping
from unittest import mock

from arroyo import Partition, Topic
from arroyo.backends.kafka import KafkaPayload
from confluent_kafka.admin import PartitionMetadata  # type: ignore[attr-defined]
from django.test import override_settings

from sentry.monitors.tasks.clock_pulse import MONITOR_CODEC, clock_pulse
from sentry.testutils.helpers.options import override_options


@override_options({"tasks.producer.clock-pulse.rollout": 0.0})
@override_settings(
    KAFKA_TOPIC_OVERRIDES={"ingest-monitors": "monitors-test-topic"},
    KAFKA_TOPIC_TO_CLUSTER={"monitors-test-topic": "default"},
)
@override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
@mock.patch("sentry.monitors.tasks.clock_pulse._checkin_producer")
def test_clock_pulse(checkin_producer_mock: mock.MagicMock) -> None:
    partition_count = 2

    mock_partitions: MutableMapping[int, PartitionMetadata] = {}
    for idx in range(partition_count):
        mock_partitions[idx] = PartitionMetadata()
        mock_partitions[idx].id = idx

    with mock.patch("sentry.monitors.tasks.clock_pulse._get_partitions", lambda: mock_partitions):
        clock_pulse()

    # One clock pulse per partition
    assert checkin_producer_mock.produce.call_count == len(mock_partitions.items())
    for idx in range(partition_count):
        assert checkin_producer_mock.produce.mock_calls[idx] == mock.call(
            Partition(Topic("monitors-test-topic"), idx),
            KafkaPayload(
                None,
                MONITOR_CODEC.encode({"message_type": "clock_pulse"}),
                [],
            ),
        )


@override_options({"tasks.producer.clock-pulse.rollout": 1.0})
@override_settings(
    KAFKA_TOPIC_OVERRIDES={"ingest-monitors": "monitors-test-topic"},
    KAFKA_TOPIC_TO_CLUSTER={"monitors-test-topic": "default"},
)
@override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
@mock.patch("sentry.monitors.tasks.clock_pulse._checkin_task_producer")
def test_clock_pulse_task_producer(checkin_task_producer_mock: mock.MagicMock) -> None:
    partition_count = 2

    mock_partitions: MutableMapping[int, PartitionMetadata] = {}
    for idx in range(partition_count):
        mock_partitions[idx] = PartitionMetadata()
        mock_partitions[idx].id = idx

    with mock.patch("sentry.monitors.tasks.clock_pulse._get_partitions", lambda: mock_partitions):
        clock_pulse()

    # One clock pulse per partition
    assert checkin_task_producer_mock.produce.call_count == len(mock_partitions.items())
    for idx in range(partition_count):
        assert checkin_task_producer_mock.produce.mock_calls[idx] == mock.call(
            Partition(Topic("monitors-test-topic"), idx),
            KafkaPayload(
                None,
                MONITOR_CODEC.encode({"message_type": "clock_pulse"}),
                [],
            ),
        )
