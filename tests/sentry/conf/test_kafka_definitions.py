import pytest
from django.conf import settings

from sentry.conf.types.kafka_definition import (
    ConsumerDefinition,
    Topic,
    validate_consumer_definition,
)
from sentry.consumers import KAFKA_CONSUMERS
from sentry.testutils.cases import TestCase


def test_topic_definition() -> None:
    for topic in Topic:
        cluster_name = settings.KAFKA_TOPIC_TO_CLUSTER[topic.value]
        assert (
            cluster_name in settings.KAFKA_CLUSTERS
        ), f"{cluster_name} is not defined in KAFKA_CLUSTERS"
    assert len(Topic) == len(settings.KAFKA_TOPIC_TO_CLUSTER)


class ConsumersDefinitionTest(TestCase):
    def test_exception_on_invalid_consumer_definition(self):
        invalid_definitions: list[ConsumerDefinition] = [
            {
                "topic": "topic",
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
