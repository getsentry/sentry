import pytest
from arroyo.processing.strategies.abstract import ProcessingStrategyFactory

from sentry import consumers
from sentry.conf.types.kafka_definition import ConsumerDefinition
from sentry.utils.imports import import_string


@pytest.mark.parametrize("consumer_def", list(consumers.KAFKA_CONSUMERS.items()))
def test_all_importable(consumer_def, settings):
    name: str
    defn: ConsumerDefinition
    name, defn = consumer_def

    factory = import_string(defn["strategy_factory"])
    assert issubclass(factory, ProcessingStrategyFactory)

    topic = defn["topic"]
    assert topic.value in settings.KAFKA_TOPIC_TO_CLUSTER


@pytest.mark.parametrize("consumer_def", list(consumers.KAFKA_CONSUMERS.items()))
def test_dlq(consumer_def) -> None:
    post_process_forwarders = [
        "post-process-forwarder-errors",
        "post-process-forwarder-transactions",
        "post-process-forwarder-issue-platform",
    ]
    subscription_result_consumers = [
        "events-subscription-results",
        "transactions-subscription-results",
        "generic-metrics-subscription-results",
        "metrics-subscription-results",
    ]
    consumers_that_should_have_dlq_but_dont = [
        "process-spans",
        "detect-performance-issues",
        "ingest-monitors",
        "monitors-clock-tick",
        "monitors-clock-tasks",
        "monitors-incident-occurrences",
        "uptime-results",
        "metrics-last-seen-updater",
        "generic-metrics-last-seen-updater",
        "billing-metrics-consumer",
        "ingest-profiles",
        "ingest-occurrences",
        "ingest-replay-recordings",
        "ingest-replay-recordings-buffered",
    ]

    consumer_name, defn = consumer_def

    if consumer_name not in (
        post_process_forwarders
        + subscription_result_consumers
        + consumers_that_should_have_dlq_but_dont
    ):
        assert defn.get("dlq_topic") is not None, f"{consumer_name} consumer is missing DLQ"
