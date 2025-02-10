from __future__ import annotations

from datetime import datetime, timezone
from unittest import mock

import orjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from sentry_kafka_schemas.schema_types.snuba_generic_metrics_v1 import GenericMetric

from sentry.constants import DataCategory
from sentry.ingest.billing_metrics_consumer import BillingTxCountMetricConsumerStrategy
from sentry.models.project import Project
from sentry.sentry_metrics.indexer.strings import (
    SHARED_TAG_STRINGS,
    SPAN_METRICS_NAMES,
    TRANSACTION_METRICS_NAMES,
)
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.outcomes import Outcome


@django_db_all
@mock.patch("sentry.ingest.billing_metrics_consumer.track_outcome")
def test_outcomes_consumed(track_outcome, factories):
    # Based on test_ingest_consumer_kafka.py
    topic = Topic("snuba-generic-metrics")

    # NOTE: For a more realistic test, the usage metric is always emitted
    # alongside the transaction duration metric. Formerly, the consumer used the
    # duration metric to generate outcomes.

    organization = factories.create_organization()
    project_1 = factories.create_project(organization=organization)
    project_2 = factories.create_project(organization=organization)
    missing_project_id = 2

    transaction_usage_mri = "c:transactions/usage@none"
    transaction_usage_id = TRANSACTION_METRICS_NAMES[transaction_usage_mri]

    transaction_duration_mri = "d:transactions/duration@millisecond"
    transaction_duration_id = TRANSACTION_METRICS_NAMES[transaction_duration_mri]

    span_usage_mri = "c:spans/usage@none"
    span_usage_id = SPAN_METRICS_NAMES[span_usage_mri]

    empty_tags: dict[str, str] = {}
    profile_tags: dict[str, str] = {str(SHARED_TAG_STRINGS["has_profile"]): "true"}
    generic_metrics: list[GenericMetric] = [
        # Usage with `0.0` will not generate an outcome
        # NOTE: Should not be emitted by Relay anyway
        {
            "mapping_meta": {"c": {str(transaction_usage_id): transaction_usage_mri}},
            "metric_id": transaction_usage_id,
            "type": "c",
            "org_id": organization.id,
            "project_id": project_1.id,
            "timestamp": 123456,
            "value": 0.0,
            "tags": empty_tags,
            "use_case_id": "transactions",
            "retention_days": 90,
        },
        {
            "mapping_meta": {"c": {str(transaction_duration_id): transaction_duration_mri}},
            "metric_id": transaction_duration_id,
            "type": "d",
            "org_id": organization.id,
            "project_id": project_1.id,
            "timestamp": 123456,
            "value": [],
            "tags": empty_tags,
            "use_case_id": "transactions",
            "retention_days": 90,
        },
        # Usage buckets with positive counter emit an outcome
        {
            "mapping_meta": {"c": {str(transaction_usage_id): transaction_usage_mri}},
            "metric_id": transaction_usage_id,
            "type": "c",
            "org_id": organization.id,
            "project_id": project_2.id,
            "timestamp": 123456,
            "value": 3.0,
            "tags": empty_tags,
            "use_case_id": "transactions",
            "retention_days": 90,
        },
        {
            "mapping_meta": {"c": {str(transaction_duration_id): transaction_duration_mri}},
            "metric_id": transaction_duration_id,
            "type": "d",
            "org_id": organization.id,
            "project_id": project_2.id,
            "timestamp": 123456,
            "value": [1.0, 2.0, 3.0],
            "tags": empty_tags,
            "use_case_id": "transactions",
            "retention_days": 90,
        },
        # Bucket with profiles
        {
            "mapping_meta": {"c": {str(transaction_usage_id): transaction_usage_mri}},
            "metric_id": transaction_usage_id,
            "type": "c",
            "org_id": organization.id,
            "project_id": missing_project_id,
            "timestamp": 123456,
            "value": 1.0,
            "tags": profile_tags,
            "use_case_id": "transactions",
            "retention_days": 90,
        },
        {
            "mapping_meta": {"c": {str(transaction_duration_id): transaction_duration_mri}},
            "metric_id": transaction_duration_id,
            "type": "d",
            "org_id": organization.id,
            "project_id": missing_project_id,
            "timestamp": 123456,
            "value": [4.0],
            "tags": profile_tags,
            "use_case_id": "transactions",
            "retention_days": 90,
        },
        # Span usage metric should be counted:
        {
            "mapping_meta": {"c": {str(span_usage_id): span_usage_mri}},
            "metric_id": span_usage_id,
            "type": "d",
            "org_id": organization.id,
            "project_id": project_2.id,
            "timestamp": 123456,
            "value": 65.0,
            "tags": empty_tags,
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
    for i, generic_metric in enumerate(generic_metrics):
        strategy.poll()
        assert next_step.submit.call_count == i
        strategy.submit(generate_kafka_message(generic_metric))
        # commit is called for every message, and later debounced by arroyo's policy
        assert next_step.submit.call_count == (i + 1)
        if i < 2:
            assert track_outcome.call_count == 0
        elif i < 4:
            assert track_outcome.mock_calls == [
                mock.call(
                    org_id=organization.id,
                    project_id=project_2.id,
                    key_id=None,
                    outcome=Outcome.ACCEPTED,
                    reason=None,
                    timestamp=mock.ANY,
                    event_id=None,
                    category=DataCategory.TRANSACTION,
                    quantity=3,
                ),
            ]
        elif i < 6:
            assert track_outcome.mock_calls[1:] == [
                mock.call(
                    org_id=organization.id,
                    project_id=missing_project_id,
                    key_id=None,
                    outcome=Outcome.ACCEPTED,
                    reason=None,
                    timestamp=mock.ANY,
                    event_id=None,
                    category=DataCategory.TRANSACTION,
                    quantity=1,
                ),
            ]
            # We double-check that the project does not exist.
            assert not Project.objects.filter(id=2).exists()
        else:
            assert track_outcome.mock_calls[2:] == [
                mock.call(
                    org_id=organization.id,
                    project_id=project_2.id,
                    key_id=None,
                    outcome=Outcome.ACCEPTED,
                    reason=None,
                    timestamp=mock.ANY,
                    event_id=None,
                    category=DataCategory.SPAN,
                    quantity=65,
                ),
            ]

    assert i == 6
    assert next_step.submit.call_count == 7

    strategy.join()
    assert next_step.join.call_count == 1
