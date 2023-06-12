from typing import Mapping, TypedDict

from django.conf import settings


class ConsumerDefinition(TypedDict):
    topic: str
    strategy_factory: str


# consumer name -> consumer definition
KAFKA_CONSUMERS: Mapping[str, ConsumerDefinition] = {
    "ingest-profiles": {
        "topic": settings.KAFKA_PROFILES,
        "strategy_factory": "sentry.profiles.consumers.process.factory.ProcessProfileStrategyFactory",
    },
    "ingest-replay-recordings": {
        "topic": settings.KAFKA_INGEST_REPLAYS_RECORDINGS,
        "strategy_factory": "sentry.replays.consumers.recording.ProcessReplayRecordingStrategyFactory",
    },
    "ingest-monitors": {
        "topic": settings.KAFKA_INGEST_MONITORS,
        "strategy_factory": "sentry.monitors.consumers.monitor_consumer.StoreMonitorCheckInStrategyFactory",
    },
    "billing-metrics-consumer": {
        "topic": settings.KAFKA_SNUBA_GENERIC_METRICS,
        "strategy_factory": "sentry.ingest.billing_metrics_consumer.BillingMetricsConsumerStrategyFactory",
    },
}

for consumer in KAFKA_CONSUMERS:
    assert KAFKA_CONSUMERS[consumer]["topic"] in settings.KAFKA_TOPICS, consumer


def print_deprecation_warning(name, group_id):
    import click

    click.echo(
        f"WARNING: Deprecated command, use sentry run consumer {name} --consumer-group {group_id}"
    )
