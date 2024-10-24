from __future__ import annotations

from datetime import datetime, timezone
from typing import cast
from unittest import mock

import orjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.core.cache import cache
from sentry.testutils.helpers import override_options
from sentry_kafka_schemas.schema_types.snuba_generic_metrics_v1 import GenericMetric

from sentry.constants import DataCategory
from sentry.ingest.billing_metrics_consumer import (
    BillingTxCountMetricConsumerStrategy,
    _get_project_flag_updated_cache_key,
)
from sentry.models.project import Project
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.strings import (
    SPAN_METRICS_NAMES,
    TRANSACTION_METRICS_NAMES,
)
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.outcomes import Outcome
import pytest


@django_db_all
@mock.patch("sentry.ingest.billing_metrics_consumer.track_outcome")
@pytest.mark.parametrize("use_new_counting_strategy", [True, False])
def test_outcomes_consumed(track_outcome, factories, use_new_counting_strategy):
    with override_options({
        "consumers.use_new_counting_strategy": use_new_counting_strategy,
    }):
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

        counter_custom_metric_mri = "c:custom/user_click@none"
        counter_custom_metric_id = cast(
            int, indexer.record(UseCaseID.CUSTOM, organization.id, counter_custom_metric_mri)
        )

        distribution_custom_metric_mri = "d:custom/page_load@ms"
        distribution_custom_metric_id = cast(
            int, indexer.record(UseCaseID.CUSTOM, organization.id, distribution_custom_metric_mri)
        )

        has_profile = "has_profile"
        has_profile_id = 1234

        indexed = "indexed"
        indexed_id = 5678

        empty_tags: dict[str, str] = {}
        profile_tags: dict[str, str] = {str(has_profile_id): "true"}
        profile_and_indexed_tags: dict[str, str] = {str(has_profile_id): "true", str(indexed_id): "true"}
        generic_metrics: list[GenericMetric] = [
            {  # Counter metric with wrong ID will not generate an outcome
                "mapping_meta": {"c": {str(counter_custom_metric_id): counter_custom_metric_mri}},
                "metric_id": counter_custom_metric_id,
                "type": "c",
                "org_id": organization.id,
                "project_id": project_1.id,
                "timestamp": 123,
                "value": 123.4,
                "tags": empty_tags,
                "use_case_id": "custom",
                "retention_days": 90,
            },
            {  # Distribution metric with wrong ID will not generate an outcome
                "mapping_meta": {
                    "c": {str(distribution_custom_metric_id): distribution_custom_metric_mri}
                },
                "metric_id": distribution_custom_metric_id,
                "type": "d",
                "org_id": organization.id,
                "project_id": project_1.id,
                "timestamp": 123456,
                "value": [1.0, 2.0],
                "tags": empty_tags,
                "use_case_id": "custom",
                "retention_days": 90,
            },
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
            {  # Another bucket to introduce some noise
                "mapping_meta": {
                    "c": {str(distribution_custom_metric_id): distribution_custom_metric_mri}
                },
                "metric_id": distribution_custom_metric_id,
                "type": "c",
                "org_id": organization.id,
                "project_id": project_2.id,
                "timestamp": 123456,
                "value": 123.4,
                "tags": empty_tags,
                "use_case_id": "custom",
                "retention_days": 90,
            },
            # Bucket with profiles
            {
                "mapping_meta": {"c": {str(transaction_usage_id): transaction_usage_mri}, "d": {str(has_profile_id): has_profile}},
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
                "mapping_meta": {"c": {str(transaction_duration_id): transaction_duration_mri}, "d": {str(has_profile_id): has_profile}},
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
            # Transaction usage with `indexed = true` should be counted only if the old counting is used:
            {
                "mapping_meta": {"c": {str(transaction_usage_id): transaction_usage_mri}, "d": {str(indexed_id): indexed, str(has_profile_id): has_profile}},
                "metric_id": transaction_usage_id,
                "type": "c",
                "org_id": organization.id,
                "project_id": project_2.id,
                "timestamp": 123456,
                "value": 5.0,
                "tags": profile_and_indexed_tags,
                "use_case_id": "transactions",
                "retention_days": 90,
            },
            # Span usage with `indexed = true` should be counted only if the old counting is used:
            {
                "mapping_meta": {"c": {str(span_usage_id): span_usage_mri}, "d": {str(indexed_id): indexed, str(has_profile_id): has_profile}},
                "metric_id": span_usage_id,
                "type": "d",
                "org_id": organization.id,
                "project_id": project_2.id,
                "timestamp": 123456,
                "value": 65.0,
                "tags": profile_and_indexed_tags,
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

        # Mimic the behavior of `StreamProcessor._run_once`: Call poll repeatedly, then call submit when there is a message.
        strategy.poll()
        strategy.poll()
        assert track_outcome.call_count == 0

        for i, generic_metric in enumerate(generic_metrics):
            strategy.poll()
            assert next_step.submit.call_count == i

            strategy.submit(generate_kafka_message(generic_metric))
            # commit is called for every message, and later debounced by arroyo's policy
            assert next_step.submit.call_count == (i + 1)

            if i < 4:
                assert track_outcome.call_count == 0
                assert Project.objects.get(id=project_1.id).flags.has_custom_metrics
            elif i < 7:
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
                # We have a custom metric in the 7th element, thus we expect that before that we have no flag set and after
                # that yes.
                if i == 6:
                    assert Project.objects.get(id=project_2.id).flags.has_custom_metrics
                else:
                    assert not Project.objects.get(id=project_2.id).flags.has_custom_metrics
            elif i < 9:
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
                    mock.call(
                        org_id=organization.id,
                        project_id=missing_project_id,
                        key_id=None,
                        outcome=Outcome.ACCEPTED,
                        reason=None,
                        timestamp=mock.ANY,
                        event_id=None,
                        category=DataCategory.PROFILE,
                        quantity=1,
                    ),
                ]
                # We double-check that the project does not exist.
                assert not Project.objects.filter(id=2).exists()
            elif i < 10:
                assert track_outcome.mock_calls[3:] == [
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
            elif i < 11:
                if use_new_counting_strategy:
                    assert track_outcome.mock_calls[4:] == []
                else:
                    assert track_outcome.mock_calls[4:] == [
                        mock.call(
                            org_id=organization.id,
                            project_id=project_2.id,
                            key_id=None,
                            outcome=Outcome.ACCEPTED,
                            reason=None,
                            timestamp=mock.ANY,
                            event_id=None,
                            category=DataCategory.TRANSACTION,
                            quantity=5,
                        ),
                        mock.call(
                            org_id=organization.id,
                            project_id=project_2.id,
                            key_id=None,
                            outcome=Outcome.ACCEPTED,
                            reason=None,
                            timestamp=mock.ANY,
                            event_id=None,
                            category=DataCategory.PROFILE,
                            quantity=5,
                        ),
                    ]
            elif i < 12:
                if use_new_counting_strategy:
                    assert track_outcome.mock_calls[4:] == []
                else:
                    assert track_outcome.mock_calls[6:] == [
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
                        mock.call(
                            org_id=organization.id,
                            project_id=project_2.id,
                            key_id=None,
                            outcome=Outcome.ACCEPTED,
                            reason=None,
                            timestamp=mock.ANY,
                            event_id=None,
                            category=DataCategory.PROFILE,
                            quantity=65,
                        ),
                    ]

        assert i == 11
        assert next_step.submit.call_count == 12

        strategy.join()
        assert next_step.join.call_count == 1

        assert cache.get(_get_project_flag_updated_cache_key(organization.id, project_1.id)) is not None
        assert cache.get(_get_project_flag_updated_cache_key(organization.id, project_2.id)) is not None
        assert (
            cache.get(_get_project_flag_updated_cache_key(organization.id, missing_project_id)) is None
        )
