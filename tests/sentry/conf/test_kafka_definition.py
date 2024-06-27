import pytest
import sentry_kafka_schemas
from django.conf import settings

from sentry.conf.types.kafka_definition import (
    ConsumerDefinition,
    Topic,
    validate_consumer_definition,
)
from sentry.consumers import KAFKA_CONSUMERS
from sentry.testutils.cases import TestCase


def test_topic_definition() -> None:
    # All topic are registered
    # TODO: Remove this once these topics are actually registered in sentry-kafka-schemas
    currently_unregistered_topics = [
        "outcomes-billing",
        "ingest-attachments",
        "ingest-transactions",
        "profiles",
        "ingest-occurrences",
        "monitors-clock-pulse",
        "monitors-mark-missing",
        "monitors-mark-timeout",
    ]

    for topic in Topic:
        if topic.value not in currently_unregistered_topics:
            assert sentry_kafka_schemas.get_topic(topic.value) is not None

    for topic in Topic:
        cluster_name = settings.KAFKA_TOPIC_TO_CLUSTER[topic.value]
        assert (
            cluster_name in settings.KAFKA_CLUSTERS
        ), f"{cluster_name} is not defined in KAFKA_CLUSTERS"

    for default_topic in settings.KAFKA_TOPIC_OVERRIDES:
        # Ensure all override topics are in the enum
        Topic(default_topic)

    assert len(Topic) == len(settings.KAFKA_TOPIC_TO_CLUSTER)


class ConsumersDefinitionTest(TestCase):
    def test_exception_on_invalid_consumer_definition(self):
        invalid_definitions: list[ConsumerDefinition] = [
            {
                "topic": Topic.INGEST_METRICS,
                "strategy_factory": "sentry.sentry_metrics.consumers.indexer.parallel.MetricsConsumerStrategyFactory",
                "static_args": {
                    "ingest_profile": "release-health",
                },
                "dlq_max_invalid_ratio": 0.01,
                "dlq_max_consecutive_count": 1000,
            }
        ]
        for invalid_definition in invalid_definitions:
            with pytest.raises(ValueError):
                validate_consumer_definition(invalid_definition)

    def test_kafka_consumer_definition_validity(self):
        for definition in KAFKA_CONSUMERS.values():
            validate_consumer_definition(definition)
