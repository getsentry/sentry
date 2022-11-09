from datetime import datetime
from unittest import mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Position, Topic
from freezegun import freeze_time

from sentry.ingest.billing_metrics_consumer import (
    BillingTxCountMetricConsumerStrategy,
    MetricsBucket,
)
from sentry.sentry_metrics.indexer.strings import TRANSACTION_METRICS_NAMES
from sentry.utils import json


@freeze_time("1985-10-26 21:00:00")
@mock.patch(
    "sentry.ingest.billing_metrics_consumer.BillingTxCountMetricConsumerStrategy._get_billing_producer"
)
def test_outcomes_consumed(_gbp):
    # Based on test_ingest_consumer_kafka.py

    time = datetime(1985, 10, 26, 21, 00, 00)
    metrics_topic = Topic("snuba-generic-metrics")
    billing_topic = Topic("outcomes-billing")

    buckets = [
        {  # Counter metric with wrong ID will not generate an outcome
            "metric_id": 123,
            "type": "c",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 123,
            "value": 123.4,
        },
        {  # Distribution metric with wrong ID will not generate an outcome
            "metric_id": 123,
            "type": "d",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 123,
            "value": [1.0, 2.0],
        },
        {  # Empty distribution will not generate an outcome
            # NOTE: Should not be emitted by Relay anyway
            "metric_id": TRANSACTION_METRICS_NAMES["d:transactions/duration@millisecond"],
            "type": "d",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 123,
            "value": [],
        },
        {  # Valid distribution bucket emits an outcome
            "metric_id": TRANSACTION_METRICS_NAMES["d:transactions/duration@millisecond"],
            "type": "d",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 123456,
            "value": [1.0, 2.0, 3.0],
        },
        {  # Another bucket to introduce some noise
            "metric_id": 123,
            "type": "c",
            "org_id": 1,
            "project_id": 2,
            "timestamp": 123,
            "value": 123.4,
        },
    ]

    fake_commit = mock.MagicMock()
    strategy = BillingTxCountMetricConsumerStrategy(
        commit=fake_commit,
    )
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

    assert strategy._billing_producer.produce.call_count == 1
    called_payload = KafkaPayload(
        key=None,
        value=json.dumps(
            {
                "timestamp": time,
                "org_id": 1,
                "project_id": 2,
                "outcome": 0,
                "category": 2,
                "quantity": 3,
            }
        ).encode("utf-8"),
        headers=[],
    )
    assert strategy._billing_producer.produce.mock_calls[0] == mock.call(
        destination=billing_topic,
        payload=called_payload,
    )

    assert fake_commit.mock_calls == [
        mock.call({Partition(topic=metrics_topic, index=0): Position(offset=1, timestamp=time)}),
        mock.call({Partition(topic=metrics_topic, index=0): Position(offset=2, timestamp=time)}),
        mock.call({Partition(topic=metrics_topic, index=0): Position(offset=3, timestamp=time)}),
        mock.call({Partition(topic=metrics_topic, index=0): Position(offset=4, timestamp=time)}),
    ]
    fake_commit.reset_mock()

    # A join must commit the last submitted message
    strategy.join()
    assert fake_commit.mock_calls == [
        mock.call({Partition(topic=metrics_topic, index=0): Position(offset=5, timestamp=time)})
    ]

    # The consumer rejects new messages after closing
    strategy.close()
    with pytest.raises(AssertionError):
        strategy.poll()
        strategy.submit(generate_kafka_message(buckets[0]))
