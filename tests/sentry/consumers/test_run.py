import pytest
from arroyo.processing.strategies.abstract import ProcessingStrategyFactory

from sentry import consumers
from sentry.conf.types.consumer_definition import ConsumerDefinition
from sentry.utils.imports import import_string


@pytest.mark.parametrize("consumer_def", list(consumers.KAFKA_CONSUMERS.items()))
def test_all_importable(consumer_def, settings):
    name: str
    defn: ConsumerDefinition
    name, defn = consumer_def

    factory = import_string(defn["strategy_factory"])
    assert issubclass(factory, ProcessingStrategyFactory)

    topic = defn["topic"]
    assert topic is None or topic in settings.KAFKA_TOPICS


@pytest.mark.parametrize("consumer_def", list(consumers.KAFKA_CONSUMERS.items()))
def test_stream_processor(consumer_def, settings):
    name: str
    defn: ConsumerDefinition
    name, defn = consumer_def

    processor = consumers.get_stream_processor(
        name,
        [],
        None,
        None,
        "hello",
        auto_offset_reset="latest",
        strict_offset_reset=False,
        join_timeout=None,
        max_poll_interval_ms=None,
        synchronize_commit_log_topic=None,
        synchronize_commit_group=None,
        healthcheck_file_path=None,
    )

    processor.signal_shutdown()
