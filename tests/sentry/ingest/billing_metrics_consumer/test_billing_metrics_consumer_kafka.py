from datetime import datetime
from unittest import mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.types import Message, Partition, Position, Topic
from freezegun import freeze_time

from sentry.ingest.billing_metrics_consumer import (
    BillingTxCountMetricConsumerStrategy,
    MetricsBucket,
)
from sentry.utils import json

pytestmark = pytest.mark.sentry_metrics


@freeze_time("1985-10-26 21:00:00")
def test_outcomes_consumed():
    # Based on test_ingest_consumer_kafka.py

    time = datetime(1985, 10, 26, 21, 00, 00)
    metrics_topic = Topic("snuba-generic-metrics")
    mapping = {
        "a": {},
        "b": {
            "123": "d:transactions/duration@millisecond",
            "456": "some_metric_name",
        },
    }

    buckets = [
        {  # Counter metric with wrong ID will not generate an outcome
            "metric_id": 456,
            "type": "c",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 111,
            "value": 123.4,
            "mapping_meta": mapping,
        },
        {  # Distribution metric with wrong ID will not generate an outcome
            "metric_id": 456,
            "type": "d",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 111,
            "value": [1.0, 2.0],
            "mapping_meta": mapping,
        },
        {  # Empty distribution will not generate an outcome
            # NOTE: Should not be emitted by Relay anyway
            "metric_id": 123,
            "type": "d",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 111,
            "value": [],
            "mapping_meta": mapping,
        },
        {  # Valid distribution bucket emits an outcome
            "metric_id": 123,
            "type": "d",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 123456,
            "value": [1.0, 2.0, 3.0],
            "mapping_meta": mapping,
        },
        {  # Another bucket to introduce some noise
            "metric_id": 456,
            "type": "c",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 111,
            "value": 123.4,
            "mapping_meta": mapping,
        },
    ]

    fake_commit = mock.MagicMock()
    strategy = BillingTxCountMetricConsumerStrategy(
        commit=fake_commit,
        max_buffer_size=5,
    )
    strategy._produce = mock.MagicMock()
    assert not fake_commit.mock_calls

    def generate_kafka_message(bucket: MetricsBucket) -> Message[KafkaPayload]:
        encoded = json.dumps(bucket).encode()
        payload = KafkaPayload(key=None, value=encoded, headers=[])
        message = Message(
            Partition(metrics_topic, index=0),
            generate_kafka_message.counter,
            payload,
            time,
        )
        generate_kafka_message.counter += 1
        return message

    generate_kafka_message.counter = 0

    # Mimick the behavior of StreamProcessor._run_once: Call poll repeatedly,
    # then call submit when there is a message.
    strategy.poll()
    strategy.poll()

    for bucket in buckets:
        strategy.poll()
        strategy.submit(generate_kafka_message(bucket))

    assert strategy._produce.call_count == 1
    expected_payload = json.dumps(
        {
            "timestamp": time,
            "org_id": 1,
            "project_id": 2,
            "key_id": None,
            "outcome": 0,
            "reason": None,
            "event_id": None,
            "category": 2,
            "quantity": 3,
        }
    )
    assert strategy._produce.mock_calls[0] == mock.call("default", "outcomes", expected_payload)

    assert fake_commit.mock_calls == [
        mock.call(
            {Partition(topic=metrics_topic, index=0): Position(offset=1, timestamp=time)}, False
        ),
        mock.call(
            {Partition(topic=metrics_topic, index=0): Position(offset=2, timestamp=time)}, False
        ),
        mock.call(
            {Partition(topic=metrics_topic, index=0): Position(offset=3, timestamp=time)}, False
        ),
        mock.call(
            {Partition(topic=metrics_topic, index=0): Position(offset=4, timestamp=time)}, False
        ),
    ]
    fake_commit.reset_mock()

    # A join must commit the last submitted message
    strategy.join()
    assert fake_commit.mock_calls == [
        mock.call(
            {Partition(topic=metrics_topic, index=0): Position(offset=5, timestamp=time)}, True
        )
    ]

    # The consumer rejects new messages after closing
    strategy.close()
    with pytest.raises(AssertionError):
        strategy.poll()
        strategy.submit(generate_kafka_message(buckets[0]))


def test_consumer_backpressure():
    bucket = {
        "metric_id": 123,
        "type": "d",
        "org_id": 1,
        "project_id": 2,
        "timestamp": 123456,
        "value": [1.0, 2.0, 3.0],
        "mapping_meta": {
            "a": {},
            "b": {
                "123": "d:transactions/duration@millisecond",
                "456": "some_metric_name",
            },
        },
    }
    consumer = BillingTxCountMetricConsumerStrategy(commit=mock.Mock(), max_buffer_size=0)

    with pytest.raises(MessageRejected):
        consumer.submit(bucket)
