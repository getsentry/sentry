from typing import List

import pytest

from sentry.conf.types.consumer_definition import ConsumerDefinition, validate_consumer_definition
from sentry.consumers import KAFKA_CONSUMERS
from sentry.testutils.cases import TestCase


class ConsumersDefinitionTest(TestCase):
    def test_exception_on_invalid_consumer_definition(self):
        invalid_definitions: List[ConsumerDefinition] = [
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
