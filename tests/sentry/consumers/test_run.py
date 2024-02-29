import pytest
from arroyo.processing.strategies.abstract import ProcessingStrategyFactory

from sentry import consumers
from sentry.conf.types.kafka_definition import ConsumerDefinition, Topic
from sentry.utils.imports import import_string


@pytest.mark.parametrize("consumer_def", list(consumers.KAFKA_CONSUMERS.items()))
def test_all_importable(consumer_def, settings):
    name: str
    defn: ConsumerDefinition
    name, defn = consumer_def

    factory = import_string(defn["strategy_factory"])
    assert issubclass(factory, ProcessingStrategyFactory)

    topic = defn["topic"]
    if isinstance(topic, Topic):
        assert topic.value in settings.KAFKA_TOPIC_TO_CLUSTER
    else:
        # TODO: Legacy way, will be deprecated once all consumer definitions
        # are migrated
        assert topic in settings.KAFKA_TOPICS
