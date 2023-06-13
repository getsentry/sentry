from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence, TypedDict

import click
from django.conf import settings
from typing_extensions import Required

DEFAULT_BLOCK_SIZE = int(32 * 1e6)


class ConsumerDefinition(TypedDict, total=False):
    topic: Required[str]
    strategy_factory: Required[str]

    # Additional CLI options the consumer should accept. These arguments are
    # passed as kwargs to the strategy_factory.
    click_options: Sequence[click.Option]

    # Hardcoded additional kwargs for strategy_factory
    static_args: Mapping[str, Any]


def convert_max_batch_time(ctx, param, value):
    if value <= 0:
        raise click.BadParameter("--max-batch-time must be greater than 0")

    # Our CLI arguments are written in ms, but the strategy requires seconds
    return int(value / 1000.0)


def multiprocessing_options(
    default_max_batch_size: Optional[int] = None, default_max_batch_time_ms: Optional[int] = 1000
):
    return [
        click.Option(["--processes", "num_processes"], default=1, type=int),
        click.Option(["--input-block-size"], type=int, default=DEFAULT_BLOCK_SIZE),
        click.Option(["--output-block-size"], type=int, default=DEFAULT_BLOCK_SIZE),
        click.Option(
            ["--max-batch-size"],
            default=default_max_batch_size,
            type=int,
            help="Maximum number of messages to batch before flushing.",
        ),
        click.Option(
            ["--max-batch-time-ms", "max_batch_time"],
            default=default_max_batch_time_ms,
            callback=convert_max_batch_time,
            type=int,
            help="Maximum time (in seconds) to wait before flushing a batch.",
        ),
    ]


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
    # Known differences to 'sentry run occurrences-ingest-consumer':
    # - ingest_consumer_types metric tag is missing. Use the kafka_topic and
    #   group_id tags provided by run_basic_consumer instead
    "ingest-occurrences": {
        "topic": settings.KAFKA_INGEST_OCCURRENCES,
        "strategy_factory": "sentry.issues.run.OccurrenceStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=20),
    },
    "events-subscription-results": {
        "topic": settings.KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS,
        "strategy_factory": "sentry.snuba.query_subscriptions.run.QuerySubscriptionStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=100),
        "static_args": {
            "topic": settings.KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS,
        },
    },
    "transactions-subscription-results": {
        "topic": settings.KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS,
        "strategy_factory": "sentry.snuba.query_subscriptions.run.QuerySubscriptionStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=100),
        "static_args": {
            "topic": settings.KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS,
        },
    },
    "generic-metrics-subscription-results": {
        "topic": settings.KAFKA_GENERIC_METRICS_SUBSCRIPTIONS_RESULTS,
        "strategy_factory": "sentry.snuba.query_subscriptions.run.QuerySubscriptionStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=100),
        "static_args": {
            "topic": settings.KAFKA_GENERIC_METRICS_SUBSCRIPTIONS_RESULTS,
        },
    },
    "sessions-subscription-results": {
        "topic": settings.KAFKA_SESSIONS_SUBSCRIPTIONS_RESULTS,
        "strategy_factory": "sentry.snuba.query_subscriptions.run.QuerySubscriptionStrategyFactory",
        "click_options": multiprocessing_options(),
        "static_args": {
            "topic": settings.KAFKA_SESSIONS_SUBSCRIPTIONS_RESULTS,
        },
    },
    "metrics-subscription-results": {
        "topic": settings.KAFKA_METRICS_SUBSCRIPTIONS_RESULTS,
        "strategy_factory": "sentry.snuba.query_subscriptions.run.QuerySubscriptionStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=100),
        "static_args": {
            "topic": settings.KAFKA_METRICS_SUBSCRIPTIONS_RESULTS,
        },
    },
    "ingest-events": {
        "topic": settings.KAFKA_INGEST_EVENTS,
        "strategy_factory": "sentry.ingest.consumer_v2.factory.IngestStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=100),
        "static_args": {
            "consumer_type": "events",
        },
    },
    "ingest-attachments": {
        "topic": settings.KAFKA_INGEST_ATTACHMENTS,
        "strategy_factory": "sentry.ingest.consumer_v2.factory.IngestStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=100),
        "static_args": {
            "consumer_type": "attachments",
        },
    },
    "ingest-transactions": {
        "topic": settings.KAFKA_INGEST_TRANSACTIONS,
        "strategy_factory": "sentry.ingest.consumer_v2.factory.IngestStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=100),
        "static_args": {
            "consumer_type": "transactions",
        },
    },
}


def print_deprecation_warning(name, group_id):
    import click

    click.echo(
        f"WARNING: Deprecated command, use sentry run consumer {name} "
        f"--consumer-group {group_id} ..."
    )
