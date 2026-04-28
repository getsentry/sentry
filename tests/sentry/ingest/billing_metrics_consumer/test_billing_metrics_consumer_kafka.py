from __future__ import annotations

from datetime import datetime, timezone
from unittest import mock

import orjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from sentry_kafka_schemas.schema_types.snuba_generic_metrics_v1 import GenericMetric

from sentry.constants import DataCategory
from sentry.ingest.billing_metrics_consumer import BillingTxCountMetricConsumerStrategy
from sentry.sentry_metrics.indexer.strings import (
    SHARED_TAG_STRINGS,
    SPAN_METRICS_NAMES,
    TRANSACTION_METRICS_NAMES,
)
from sentry.utils.outcomes import Outcome


@mock.patch("sentry.ingest.billing_metrics_consumer.track_outcome")
def test_outcomes_consumed_span_segments(track_outcome) -> None:
    topic = Topic("snuba-generic-metrics")

    organization = 123
    project_1 = 56789

    span_usage_mri = "c:spans/usage@none"
    span_usage_id = SPAN_METRICS_NAMES[span_usage_mri]
    transaction_usage_mri = "c:transactions/usage@none"
    transaction_usage_id = TRANSACTION_METRICS_NAMES[transaction_usage_mri]

    generic_metrics: list[GenericMetric] = [
        # Transaction metric is ignored.
        {
            "mapping_meta": {"c": {str(transaction_usage_id): transaction_usage_mri}},
            "metric_id": transaction_usage_id,
            "type": "c",
            "org_id": organization,
            "project_id": project_1,
            "timestamp": 123456,
            "value": 99.0,
            "tags": {},
            "use_case_id": "transactions",
            "retention_days": 90,
        },
        {
            "mapping_meta": {"c": {str(span_usage_id): span_usage_mri}},
            "metric_id": span_usage_id,
            "type": "d",
            "org_id": organization,
            "project_id": project_1,
            "timestamp": 123456,
            "value": 65.0,
            "tags": {},
            "use_case_id": "spans",
            "retention_days": 90,
        },
        {
            "mapping_meta": {"c": {str(span_usage_id): span_usage_mri}},
            "metric_id": span_usage_id,
            "type": "d",
            "org_id": organization,
            "project_id": project_1,
            "timestamp": 123456,
            "value": 12.0,
            "tags": {str(SHARED_TAG_STRINGS["is_segment"]): "true"},
            "use_case_id": "spans",
            "retention_days": 90,
        },
    ]

    next_step = mock.MagicMock()

    strategy = BillingTxCountMetricConsumerStrategy(
        next_step=next_step,
    )

    generate_kafka_message_counter = 0

    def generate_kafka_message(generic_metric: GenericMetric) -> Message[KafkaPayload]:
        nonlocal generate_kafka_message_counter

        encoded = orjson.dumps(generic_metric)
        payload = KafkaPayload(key=None, value=encoded, headers=[])
        message = Message(
            BrokerValue(
                payload,
                Partition(topic, index=0),
                generate_kafka_message_counter,
                datetime.now(timezone.utc),
            )
        )
        generate_kafka_message_counter += 1
        return message

    # Mimick the behavior of StreamProcessor._run_once: Call poll repeatedly,
    # then call submit when there is a message.
    strategy.poll()
    strategy.poll()
    assert track_outcome.call_count == 0
    for generic_metric in generic_metrics:
        strategy.poll()
        strategy.submit(generate_kafka_message(generic_metric))

    assert track_outcome.mock_calls == [
        mock.call(
            org_id=organization,
            project_id=project_1,
            key_id=None,
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=mock.ANY,
            event_id=None,
            category=DataCategory.SPAN,
            quantity=65,
        ),
        mock.call(
            org_id=organization,
            project_id=project_1,
            key_id=None,
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=mock.ANY,
            event_id=None,
            category=DataCategory.SPAN,
            quantity=12,
        ),
        mock.call(
            org_id=organization,
            project_id=project_1,
            key_id=None,
            outcome=Outcome.ACCEPTED,
            reason=None,
            timestamp=mock.ANY,
            event_id=None,
            category=DataCategory.TRANSACTION,
            quantity=12,
        ),
    ]

    strategy.join()
    assert next_step.join.call_count == 1
