from __future__ import annotations

from collections.abc import Mapping, Sequence
from enum import Enum
from typing import Any, Required, TypedDict

import click


class Topic(Enum):
    """
    These are the default topic names used by Sentry. They must match
    the registered values in sentry-kafka-schemas.
    """

    EVENTS = "events"
    EVENTS_COMMIT_LOG = "snuba-commit-log"
    TRANSACTIONS = "transactions"
    TRANSACTIONS_COMMIT_LOG = "snuba-transactions-commit-log"
    OUTCOMES = "outcomes"
    OUTCOMES_BILLING = "outcomes-billing"
    EVENTS_SUBSCRIPTIONS_RESULTS = "events-subscription-results"
    TRANSACTIONS_SUBSCRIPTIONS_RESULTS = "transactions-subscription-results"
    GENERIC_METRICS_SUBSCRIPTIONS_RESULTS = "generic-metrics-subscription-results"
    SESSIONS_SUBSCRIPTIONS_RESULTS = "sessions-subscription-results"
    METRICS_SUBSCRIPTIONS_RESULTS = "metrics-subscription-results"
    INGEST_EVENTS = "ingest-events"
    INGEST_EVENTS_DLQ = "ingest-events-dlq"
    INGEST_FEEDBACK_EVENTS = "ingest-feedback-events"
    INGEST_FEEDBACK_EVENTS_DLQ = "ingest-feedback-events-dlq"
    INGEST_ATTACHMENTS = "ingest-attachments"
    INGEST_ATTACHMENTS_DLQ = "ingest-attachments-dlq"
    INGEST_TRANSACTIONS = "ingest-transactions"
    INGEST_TRANSACTIONS_DLQ = "ingest-transactions-dlq"
    INGEST_METRICS = "ingest-metrics"
    INGEST_METRICS_DLQ = "ingest-metrics-dlq"
    SNUBA_METRICS = "snuba-metrics"
    PROFILES = "profiles"
    INGEST_PERFORMANCE_METRICS = "ingest-performance-metrics"
    INGEST_GENERIC_METRICS_DLQ = "ingest-generic-metrics-dlq"
    SNUBA_GENERIC_METRICS = "snuba-generic-metrics"
    INGEST_REPLAY_EVENTS = "ingest-replay-events"
    INGEST_REPLAYS_RECORDINGS = "ingest-replay-recordings"
    INGEST_OCCURRENCES = "ingest-occurrences"
    INGEST_MONITORS = "ingest-monitors"
    EVENTSTREAM_GENERIC = "generic-events"
    GENERIC_EVENTS_COMMIT_LOG = "snuba-generic-events-commit-log"
    GROUP_ATTRIBUTES = "group-attributes"
    SHARED_RESOURCES_USAGE = "shared-resources-usage"
    SNUBA_SPANS = "snuba-spans"
    BUFFERED_SEGMENTS = "buffered-segments"


class ConsumerDefinition(TypedDict, total=False):

    # Default topic
    topic: Required[Topic]

    # Schema validation will be run if true
    validate_schema: bool | None

    strategy_factory: Required[str]

    # Additional CLI options the consumer should accept. These arguments are
    # passed as kwargs to the strategy_factory.
    click_options: Sequence[click.Option]

    # Hardcoded additional kwargs for strategy_factory
    static_args: Mapping[str, Any]

    require_synchronization: bool
    synchronize_commit_group_default: str
    synchronize_commit_log_topic_default: str

    dlq_topic: Topic
    dlq_max_invalid_ratio: float | None
    dlq_max_consecutive_count: int | None


def validate_consumer_definition(consumer_definition: ConsumerDefinition) -> None:
    if "dlq_topic" not in consumer_definition and (
        "dlq_max_invalid_ratio" in consumer_definition
        or "dlq_max_consecutive_count" in consumer_definition
    ):
        raise ValueError(
            "Invalid consumer definition, dlq_max_invalid_ratio/dlq_max_consecutive_count is configured, but dlq_topic is not"
        )
