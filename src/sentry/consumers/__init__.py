from __future__ import annotations

import logging
import uuid
from typing import List, Mapping, Optional, Sequence

import click
from arroyo.backends.abstract import Consumer
from arroyo.backends.kafka import KafkaProducer
from arroyo.dlq import DlqLimit, DlqPolicy, KafkaDlqProducer
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import Healthcheck
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from django.conf import settings

from sentry.conf.types.consumer_definition import ConsumerDefinition, validate_consumer_definition
from sentry.consumers.validate_schema import ValidateSchema
from sentry.utils.imports import import_string
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


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
        click.Option(["--input-block-size"], type=int, default=None),
        click.Option(["--output-block-size"], type=int, default=None),
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
            help="Maximum time (in milliseconds) to wait before flushing a batch.",
        ),
    ]


def ingest_replay_recordings_options() -> List[click.Option]:
    """Return a list of ingest-replay-recordings options."""
    options = multiprocessing_options(default_max_batch_size=10)
    options.append(click.Option(["--threads", "num_threads"], type=int, default=4))
    return options


_METRICS_INDEXER_OPTIONS = [
    click.Option(["--input-block-size"], type=int, default=None),
    click.Option(["--output-block-size"], type=int, default=None),
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

_METRICS_LAST_SEEN_UPDATER_OPTIONS = [
    click.Option(
        ["--max-batch-size"],
        default=100,
        type=int,
        help="Maximum number of messages to batch before flushing.",
    ),
    click.Option(
        ["--max-batch-time-ms", "max_batch_time"],
        default=1000,
        callback=convert_max_batch_time,
        type=int,
        help="Maximum time (in milliseconds) to wait before flushing a batch.",
    ),
    click.Option(["--indexer-db"], default="postgres"),
]

_POST_PROCESS_FORWARDER_OPTIONS = multiprocessing_options(
    default_max_batch_size=1000, default_max_batch_time_ms=1000
) + [
    click.Option(
        ["--concurrency"],
        default=5,
        type=int,
        help="Thread pool size for post process worker.",
    ),
    click.Option(
        ["--mode"],
        default="multithreaded",
        type=click.Choice(["multithreaded", "multiprocess"]),
        help="Mode to run post process forwarder in.",
    ),
]


_INGEST_SPANS_OPTIONS = multiprocessing_options(default_max_batch_size=100) + [
    click.Option(["--output-topic", "output_topic"], type=str, default="snuba-spans"),
]

# consumer name -> consumer definition
# XXX: default_topic is needed to lookup the schema even if the actual topic name has been
# overridden. This is because the current topic override mechanism means the default topic name
# is no longer available anywhere in code. We should probably fix this later so we don't need both
#  "topic" and "default_topic" here though.
KAFKA_CONSUMERS: Mapping[str, ConsumerDefinition] = {
    "ingest-profiles": {
        "topic": settings.KAFKA_PROFILES,
        "strategy_factory": "sentry.profiles.consumers.process.factory.ProcessProfileStrategyFactory",
    },
    "ingest-replay-recordings": {
        "topic": settings.KAFKA_INGEST_REPLAYS_RECORDINGS,
        "strategy_factory": "sentry.replays.consumers.recording.ProcessReplayRecordingStrategyFactory",
        "click_options": ingest_replay_recordings_options(),
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
        "default_topic": "generic-metrics-subscription-results",
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
        "strategy_factory": "sentry.ingest.consumer.factory.IngestStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=100),
        "static_args": {
            "consumer_type": "events",
        },
    },
    "ingest-attachments": {
        "topic": settings.KAFKA_INGEST_ATTACHMENTS,
        "strategy_factory": "sentry.ingest.consumer.factory.IngestStrategyFactory",
        "click_options": multiprocessing_options(default_max_batch_size=100),
        "static_args": {
            "consumer_type": "attachments",
        },
    },
    "ingest-transactions": {
        "topic": settings.KAFKA_INGEST_TRANSACTIONS,
        "strategy_factory": "sentry.ingest.consumer.factory.IngestStrategyFactory",
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
        "dlq_topic": settings.KAFKA_INGEST_METRICS_DLQ,
        "dlq_max_invalid_ratio": 0.01,
        "dlq_max_consecutive_count": 1000,
    },
    "ingest-generic-metrics": {
        "topic": settings.KAFKA_INGEST_PERFORMANCE_METRICS,
        "strategy_factory": "sentry.sentry_metrics.consumers.indexer.parallel.MetricsConsumerStrategyFactory",
        "click_options": _METRICS_INDEXER_OPTIONS,
        "static_args": {
            "ingest_profile": "performance",
        },
        "dlq_topic": settings.KAFKA_INGEST_GENERIC_METRICS_DLQ,
        "dlq_max_invalid_ratio": 0.01,
        "dlq_max_consecutive_count": 1000,
    },
    "generic-metrics-last-seen-updater": {
        "topic": settings.KAFKA_SNUBA_GENERIC_METRICS,
        "strategy_factory": "sentry.sentry_metrics.consumers.last_seen_updater.LastSeenUpdaterStrategyFactory",
        "click_options": _METRICS_LAST_SEEN_UPDATER_OPTIONS,
        "static_args": {
            "ingest_profile": "performance",
        },
    },
    "metrics-last-seen-updater": {
        "topic": settings.KAFKA_SNUBA_METRICS,
        "strategy_factory": "sentry.sentry_metrics.consumers.last_seen_updater.LastSeenUpdaterStrategyFactory",
        "click_options": _METRICS_LAST_SEEN_UPDATER_OPTIONS,
        "static_args": {
            "ingest_profile": "release-health",
        },
    },
    "post-process-forwarder-issue-platform": {
        "topic": settings.KAFKA_EVENTSTREAM_GENERIC,
        "strategy_factory": "sentry.eventstream.kafka.dispatch.EventPostProcessForwarderStrategyFactory",
        "synchronize_commit_log_topic_default": "snuba-generic-events-commit-log",
        "synchronize_commit_group_default": "generic_events_group",
        "click_options": _POST_PROCESS_FORWARDER_OPTIONS,
    },
    "post-process-forwarder-transactions": {
        "topic": settings.KAFKA_TRANSACTIONS,
        "strategy_factory": "sentry.eventstream.kafka.dispatch.EventPostProcessForwarderStrategyFactory",
        "synchronize_commit_log_topic_default": "snuba-transactions-commit-log",
        "synchronize_commit_group_default": "transactions_group",
        "click_options": _POST_PROCESS_FORWARDER_OPTIONS,
    },
    "post-process-forwarder-errors": {
        "topic": settings.KAFKA_EVENTS,
        "strategy_factory": "sentry.eventstream.kafka.dispatch.EventPostProcessForwarderStrategyFactory",
        "synchronize_commit_log_topic_default": "snuba-commit-log",
        "synchronize_commit_group_default": "snuba-consumers",
        "click_options": _POST_PROCESS_FORWARDER_OPTIONS,
    },
    "ingest-spans": {
        "click_options": _INGEST_SPANS_OPTIONS,
        "topic": settings.KAFKA_INGEST_SPANS,
        "strategy_factory": "sentry.spans.consumers.process.factory.ProcessSpansStrategyFactory",
    },
    **settings.SENTRY_KAFKA_CONSUMERS,
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
    max_poll_interval_ms: Optional[int],
    synchronize_commit_log_topic: Optional[str],
    synchronize_commit_group: Optional[str],
    healthcheck_file_path: Optional[str],
    enable_dlq: bool,
    validate_schema: bool = False,
    group_instance_id: Optional[str] = None,
) -> StreamProcessor:
    try:
        consumer_definition = KAFKA_CONSUMERS[consumer_name]
    except KeyError:
        raise click.ClickException(
            f"No consumer named {consumer_name} in sentry.consumers.KAFKA_CONSUMERS. "
            f"Most likely there is another subcommand in 'sentry run' "
            f"responsible for this consumer"
        )
    try:
        validate_consumer_definition(consumer_definition)
    except ValueError as e:
        raise click.ClickException(
            f"Invalid consumer definition configured for {consumer_name}"
        ) from e

    strategy_factory_cls = import_string(consumer_definition["strategy_factory"])
    logical_topic = consumer_definition["topic"]
    if not isinstance(logical_topic, str):
        logical_topic = logical_topic()

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

    def build_consumer_config(group_id: str):
        assert cluster is not None

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
            # HACK: If the max poll interval is less than 45 seconds, set the session timeout
            # to the same. (it's default is 45 seconds and it must be <= to max.poll.interval.ms)
            if max_poll_interval_ms < 45000:
                consumer_config["session.timeout.ms"] = max_poll_interval_ms

        if group_instance_id is not None:
            consumer_config["group.instance.id"] = group_instance_id

        return consumer_config

    consumer: Consumer = KafkaConsumer(build_consumer_config(group_id))

    if synchronize_commit_group is None:
        synchronize_commit_group = consumer_definition.get("synchronize_commit_group_default")

    if synchronize_commit_log_topic is None:
        synchronize_commit_log_topic = consumer_definition.get(
            "synchronize_commit_log_topic_default"
        )

    if synchronize_commit_group or synchronize_commit_log_topic:
        if bool(synchronize_commit_log_topic) != bool(synchronize_commit_group):
            raise click.BadParameter(
                "Both --synchronize_commit_group and --synchronize_commit_log_topic must be passed, or neither."
            )

        assert synchronize_commit_group is not None
        assert synchronize_commit_log_topic is not None

        commit_log_consumer = KafkaConsumer(
            build_consumer_config(f"sentry-commit-log-{uuid.uuid1().hex}")
        )

        from sentry.consumers.synchronized import SynchronizedConsumer

        consumer = SynchronizedConsumer(
            consumer=consumer,
            commit_log_consumer=commit_log_consumer,
            commit_log_topic=Topic(synchronize_commit_log_topic),
            commit_log_groups={synchronize_commit_group},
        )
    elif consumer_definition.get("require_synchronization"):
        click.BadParameter(
            "--synchronize_commit_group and --synchronize_commit_log_topic are required arguments for this consumer"
        )

    # Validate schema if "default_topic" is set
    default_topic = consumer_definition.get("default_topic")
    if default_topic:
        strategy_factory = ValidateSchemaStrategyFactoryWrapper(
            default_topic, validate_schema, strategy_factory
        )

    if healthcheck_file_path is not None:
        strategy_factory = HealthcheckStrategyFactoryWrapper(
            healthcheck_file_path, strategy_factory
        )

    if enable_dlq:
        try:
            dlq_topic = consumer_definition["dlq_topic"]
        except KeyError as e:
            raise click.BadParameter(
                f"Cannot enable DLQ for consumer: {consumer_name}, no DLQ topic has been defined for it"
            ) from e
        try:
            cluster_setting = get_topic_definition(dlq_topic)["cluster"]
        except ValueError as e:
            raise click.BadParameter(
                f"Cannot enable DLQ for consumer: {consumer_name}, DLQ topic {dlq_topic} is not configured in this environment"
            ) from e

        producer_config = get_kafka_producer_cluster_options(cluster_setting)
        dlq_producer = KafkaProducer(producer_config)

        dlq_policy = DlqPolicy(
            KafkaDlqProducer(dlq_producer, Topic(dlq_topic)),
            DlqLimit(
                max_invalid_ratio=consumer_definition["dlq_max_invalid_ratio"],
                max_consecutive_count=consumer_definition["dlq_max_consecutive_count"],
            ),
            None,
        )
    else:
        dlq_policy = None

    return StreamProcessor(
        consumer=consumer,
        topic=Topic(topic),
        processor_factory=strategy_factory,
        commit_policy=ONCE_PER_SECOND,
        join_timeout=join_timeout,
        dlq_policy=dlq_policy,
    )


class ValidateSchemaStrategyFactoryWrapper(ProcessingStrategyFactory):
    """
    This wrapper is used to validate the schema of the event before
    passing to the rest of the pipeline. Since the message is currently decoded
    twice, it should only be run in dev or on a small fraction of prod data.
    """

    def __init__(self, topic: str, enforce_schema: bool, inner: ProcessingStrategyFactory) -> None:
        self.topic = topic
        self.enforce_schema = enforce_schema
        self.inner = inner

    def create_with_partitions(self, commit, partitions) -> ProcessingStrategy:
        rv = self.inner.create_with_partitions(commit, partitions)

        return ValidateSchema(self.topic, self.enforce_schema, rv)


class HealthcheckStrategyFactoryWrapper(ProcessingStrategyFactory):
    def __init__(self, healthcheck_file_path: str, inner: ProcessingStrategyFactory):
        self.healthcheck_file_path = healthcheck_file_path
        self.inner = inner

    def create_with_partitions(self, commit, partitions):
        rv = self.inner.create_with_partitions(commit, partitions)
        return Healthcheck(self.healthcheck_file_path, rv)
