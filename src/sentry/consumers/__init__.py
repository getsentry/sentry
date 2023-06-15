from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence, TypedDict

import click
from arroyo.processing.processor import StreamProcessor
from django.conf import settings
from typing_extensions import Required

from sentry.utils.imports import import_string

DEFAULT_BLOCK_SIZE = int(32 * 1e6)


class ConsumerDefinition(TypedDict, total=False):
    # Which logical topic from settings to use.
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


_METRICS_INDEXER_OPTIONS = [
    click.Option(["--input-block-size"], type=int, default=DEFAULT_BLOCK_SIZE),
    click.Option(["--output-block-size"], type=int, default=DEFAULT_BLOCK_SIZE),
    click.Option(["--indexer-db"], default="postgres"),
    click.Option(["max_msg_batch_size", "--max-msg-batch-size"], type=int, default=50),
    click.Option(["max_msg_batch_time", "--max-msg-batch-time-ms"], type=int, default=10000),
    click.Option(["max_parallel_batch_size", "--max-parallel-batch-size"], type=int, default=50),
    click.Option(
        ["max_parallel_batch_time", "--max-parallel-batch-time-ms"], type=int, default=10000
    ),
    click.Option(
        ["--processes"],
        default=1,
        type=int,
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
    "ingest-metrics": {
        "topic": settings.KAFKA_INGEST_METRICS,
        "strategy_factory": "sentry.sentry_metrics.consumers.indexer.parallel.MetricsConsumerStrategyFactory",
        "click_options": _METRICS_INDEXER_OPTIONS,
        "static_args": {
            "ingest_profile": "release-health",
        },
    },
    "ingest-generic-metrics": {
        "topic": settings.KAFKA_INGEST_PERFORMANCE_METRICS,
        "strategy_factory": "sentry.sentry_metrics.consumers.indexer.parallel.MetricsConsumerStrategyFactory",
        "click_options": _METRICS_INDEXER_OPTIONS,
        "static_args": {
            "ingest_profile": "performance",
        },
    },
}


def print_deprecation_warning(name, group_id):
    import click

    click.echo(
        f"WARNING: Deprecated command, use sentry run consumer {name} "
        f"--consumer-group {group_id} ..."
    )


def get_stream_processor(
    consumer_name: str,
    consumer_args: Sequence[str],
    topic: Optional[str],
    cluster: Optional[str],
    group_id: str,
    auto_offset_reset: str,
    strict_offset_reset: bool,
    join_timeout: Optional[float],
    max_poll_interval_ms: Optional[int] = None,
    **options,
) -> StreamProcessor:
    try:
        consumer_definition = KAFKA_CONSUMERS[consumer_name]
    except KeyError:
        raise click.ClickException(
            f"No consumer named {consumer_name} in sentry.consumers.KAFKA_CONSUMERS"
        )

    try:
        strategy_factory_cls = import_string(consumer_definition["strategy_factory"])
        logical_topic = consumer_definition["topic"]
    except KeyError:
        raise click.ClickException(
            f"The consumer group {consumer_name} does not have a strategy factory"
            f"registered. Most likely there is another subcommand in 'sentry run' "
            f"responsible for this consumer"
        )

    if topic is None:
        topic = logical_topic

    cmd = click.Command(
        name=consumer_name, params=list(consumer_definition.get("click_options") or ())
    )
    cmd_context = cmd.make_context(consumer_name, list(consumer_args))
    strategy_factory = cmd_context.invoke(
        strategy_factory_cls, **cmd_context.params, **consumer_definition.get("static_args") or {}
    )

    from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
    from arroyo.backends.kafka.consumer import KafkaConsumer
    from arroyo.commit import ONCE_PER_SECOND
    from arroyo.types import Topic
    from django.conf import settings

    from sentry.utils import kafka_config

    topic_def = settings.KAFKA_TOPICS[logical_topic]
    assert topic_def is not None
    if cluster is None:
        cluster = topic_def["cluster"]

    consumer_config = build_kafka_consumer_configuration(
        kafka_config.get_kafka_consumer_cluster_options(
            cluster,
        ),
        group_id=group_id,
        auto_offset_reset=auto_offset_reset,
        strict_offset_reset=strict_offset_reset,
    )

    if max_poll_interval_ms is not None:
        consumer_config["max.poll.interval.ms"] = max_poll_interval_ms

    consumer = KafkaConsumer(consumer_config)

    return StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=strategy_factory,
        commit_policy=ONCE_PER_SECOND,
        join_timeout=join_timeout,
    )
