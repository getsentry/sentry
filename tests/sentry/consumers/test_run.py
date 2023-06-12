import pytest
from arroyo.processing.strategies.abstract import ProcessingStrategyFactory

from sentry import consumers
from sentry.utils.imports import import_string


@pytest.mark.parametrize("consumer_def", list(consumers.KAFKA_CONSUMERS.items()))
def test_all_importable(consumer_def):
    name: str
    defn: consumers.ConsumerDefinition
    name, defn = consumer_def

    factory = import_string(defn["strategy_factory"])
    assert issubclass(factory, ProcessingStrategyFactory)
