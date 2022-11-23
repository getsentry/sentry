from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic

from sentry.constants import DataCategory
from sentry.ingest.billing_metrics_consumer import (
    BillingTxCountMetricConsumerStrategy,
    MetricsBucket,
)
from sentry.sentry_metrics.indexer.strings import TRANSACTION_METRICS_NAMES
from sentry.utils import json
from sentry.utils.outcomes import Outcome


@mock.patch("sentry.ingest.billing_metrics_consumer.track_outcome")
def test_outcomes_consumed(track_outcome):
    # Based on test_ingest_consumer_kafka.py

    topic = Topic("snuba-generic-metrics")

    # admin = kafka_admin(settings)
    # admin.delete_topic(metrics_topic)
    # producer = kafka_producer(settings)

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
        max_batch_size=2,
        max_batch_time=10000,
    )

    def generate_kafka_message(bucket: MetricsBucket) -> Message[KafkaPayload]:
        encoded = json.dumps(bucket).encode()
        payload = KafkaPayload(key=None, value=encoded, headers=[])
        message = Message(
            Partition(topic, index=0), generate_kafka_message.counter, payload, datetime.now()
        )
        generate_kafka_message.counter += 1
        return message

    generate_kafka_message.counter = 0

    # Mimick the behavior of StreamProcessor._run_once: Call poll repeatedly,
    # then call submit when there is a message.
    strategy.poll()
    strategy.poll()
    assert track_outcome.call_count == 0
    for i, bucket in enumerate(buckets):
        strategy.poll()
        strategy.submit(generate_kafka_message(bucket))
        # commit is called for every two messages:
        assert fake_commit.call_count == i // 2
        if i < 3:
            assert track_outcome.call_count == 0
        else:
            assert track_outcome.mock_calls == [
                mock.call(
                    org_id=1,
                    project_id=2,
                    key_id=None,
                    outcome=Outcome.ACCEPTED,
                    reason=None,
                    timestamp=datetime(1970, 1, 2, 10, 17, 36),
                    event_id=None,
                    category=DataCategory.TRANSACTION,
                    quantity=3,
                )
            ]

    # There's been 5 messages, 2 x 2 of them have their offsets committed:
    assert fake_commit.call_count == 2

    # Joining should commit the offset of the last message:
    strategy.join()

    assert fake_commit.call_count == 3
