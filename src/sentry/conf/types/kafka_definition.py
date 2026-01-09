from __future__ import annotations

from collections.abc import Mapping, Sequence
from enum import Enum
from typing import Any, Required, TypedDict

import click
from sentry_kafka_schemas import get_codec
from sentry_kafka_schemas.codecs import Codec


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
    OUTCOMES_DLQ = "outcomes-dlq"
    OUTCOMES_BILLING = "outcomes-billing"
    OUTCOMES_BILLING_DLQ = "outcomes-billing-dlq"
    EVENTS_SUBSCRIPTIONS_RESULTS = "events-subscription-results"
    TRANSACTIONS_SUBSCRIPTIONS_RESULTS = "transactions-subscription-results"
    GENERIC_METRICS_SUBSCRIPTIONS_RESULTS = "generic-metrics-subscription-results"
    METRICS_SUBSCRIPTIONS_RESULTS = "metrics-subscription-results"
    INGEST_EVENTS = "ingest-events"
    INGEST_EVENTS_DLQ = "ingest-events-dlq"
    INGEST_EVENTS_BACKLOG = "ingest-events-backlog"
    INGEST_FEEDBACK_EVENTS = "ingest-feedback-events"
    INGEST_FEEDBACK_EVENTS_DLQ = "ingest-feedback-events-dlq"
    INGEST_ATTACHMENTS = "ingest-attachments"
    INGEST_ATTACHMENTS_DLQ = "ingest-attachments-dlq"
    INGEST_TRANSACTIONS = "ingest-transactions"
    INGEST_TRANSACTIONS_DLQ = "ingest-transactions-dlq"
    INGEST_TRANSACTIONS_BACKLOG = "ingest-transactions-backlog"
    INGEST_SPANS = "ingest-spans"
    INGEST_SPANS_DLQ = "ingest-spans-dlq"
    INGEST_METRICS = "ingest-metrics"
    INGEST_METRICS_DLQ = "ingest-metrics-dlq"
    SNUBA_METRICS = "snuba-metrics"
    PROFILES = "profiles"
    PROFILES_CALL_TREE = "profiles-call-tree"
    PROFILE_CHUNKS = "snuba-profile-chunks"
    PROCESSED_PROFILES = "processed-profiles"
    INGEST_PERFORMANCE_METRICS = "ingest-performance-metrics"
    INGEST_GENERIC_METRICS_DLQ = "ingest-generic-metrics-dlq"
    SNUBA_GENERIC_METRICS = "snuba-generic-metrics"
    INGEST_REPLAY_EVENTS = "ingest-replay-events"
    INGEST_REPLAYS_RECORDINGS = "ingest-replay-recordings"
    INGEST_OCCURRENCES = "ingest-occurrences"
    INGEST_MONITORS = "ingest-monitors"
    PREPROD_ARTIFACT_EVENTS = "preprod-artifact-events"
    MONITORS_CLOCK_TICK = "monitors-clock-tick"
    MONITORS_CLOCK_TASKS = "monitors-clock-tasks"
    MONITORS_INCIDENT_OCCURRENCES = "monitors-incident-occurrences"
    UPTIME_RESULTS = "uptime-results"
    EVENTSTREAM_GENERIC = "generic-events"
    GENERIC_EVENTS_COMMIT_LOG = "snuba-generic-events-commit-log"
    GROUP_ATTRIBUTES = "group-attributes"
    SHARED_RESOURCES_USAGE = "shared-resources-usage"
    SNUBA_ITEMS = "snuba-items"
    EAP_ITEMS_SUBSCRIPTIONS_RESULTS = "subscription-results-eap-items"
    BUFFERED_SEGMENTS = "buffered-segments"
    BUFFERED_SEGMENTS_DLQ = "buffered-segments-dlq"

    # Taskworker topics
    TASKWORKER = "taskworker"
    TASKWORKER_DLQ = "taskworker-dlq"
    TASKWORKER_BILLING = "taskworker-billing"
    TASKWORKER_BILLING_DLQ = "taskworker-billing-dlq"
    TASKWORKER_BUFFER = "taskworker-buffer"
    TASKWORKER_BUFFER_DLQ = "taskworker-buffer-dlq"
    TASKWORKER_CONTROL = "taskworker-control"
    TASKWORKER_CONTROL_DLQ = "taskworker-control-dlq"
    TASKWORKER_CONTROL_LIMITED = "taskworker-control-limited"
    TASKWORKER_CONTROL_LIMITED_DLQ = "taskworker-control-limited-dlq"
    TASKWORKER_CUTOVER = "taskworker-cutover"
    TASKWORKER_EMAIL = "taskworker-email"
    TASKWORKER_EMAIL_DLQ = "taskworker-email-dlq"
    TASKWORKER_INGEST = "taskworker-ingest"
    TASKWORKER_INGEST_DLQ = "taskworker-ingest-dlq"
    TASKWORKER_INGEST_ERRORS = "taskworker-ingest-errors"
    TASKWORKER_INGEST_ERRORS_DLQ = "taskworker-ingest-errors-dlq"
    TASKWORKER_INGEST_ERRORS_POSTPROCESS = "taskworker-ingest-errors-postprocess"
    TASKWORKER_INGEST_ERRORS_POSTPROCESS_DLQ = "taskworker-ingest-errors-postprocess-dlq"
    TASKWORKER_INGEST_TRANSACTIONS = "taskworker-ingest-transactions"
    TASKWORKER_INGEST_TRANSACTIONS_DLQ = "taskworker-ingest-transactions-dlq"
    TASKWORKER_INGEST_ATTACHMENTS = "taskworker-ingest-attachments"
    TASKWORKER_INGEST_ATTACHMENTS_DLQ = "taskworker-ingest-attachments-dlq"
    TASKWORKER_INGEST_PROFILING = "taskworker-ingest-profiling"
    TASKWORKER_INGEST_PROFILING_DLQ = "taskworker-ingest-profiling-dlq"
    TASKWORKER_INTERNAL = "taskworker-internal"
    TASKWORKER_INTERNAL_DLQ = "taskworker-internal-dlq"
    TASKWORKER_LIMITED = "taskworker-limited"
    TASKWORKER_LIMITED_DLQ = "taskworker-limited-dlq"
    TASKWORKER_LONG = "taskworker-long"
    TASKWORKER_LONG_DLQ = "taskworker-long-dlq"
    TASKWORKER_PRODUCTS = "taskworker-products"
    TASKWORKER_PRODUCTS_DLQ = "taskworker-products-dlq"
    TASKWORKER_SENTRYAPP = "taskworker-sentryapp"
    TASKWORKER_SENTRYAPP_DLQ = "taskworker-sentryapp-dlq"
    TASKWORKER_SYMBOLICATION = "taskworker-symbolication"
    TASKWORKER_SYMBOLICATION_DLQ = "taskworker-symbolication-dlq"
    TASKWORKER_USAGE = "taskworker-usage"
    TASKWORKER_USAGE_DLQ = "taskworker-usage-dlq"
    TASKWORKER_WORKFLOWS_ENGINE = "taskworker-workflows-engine"
    TASKWORKER_WORKFLOWS_ENGINE_DLQ = "taskworker-workflows-engine-dlq"
    TEST_TOPIC = "test-topic"


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

    # Pass optional kwargs to the strategy factory
    pass_consumer_group: bool
    pass_kafka_slice_id: bool

    require_synchronization: bool
    synchronize_commit_group_default: str
    synchronize_commit_log_topic_default: str

    dlq_topic: Topic
    dlq_max_invalid_ratio: float | None
    dlq_max_consecutive_count: int | None

    stale_topic: Topic


def validate_consumer_definition(consumer_definition: ConsumerDefinition) -> None:
    if "dlq_topic" not in consumer_definition and (
        "dlq_max_invalid_ratio" in consumer_definition
        or "dlq_max_consecutive_count" in consumer_definition
    ):
        raise ValueError(
            "Invalid consumer definition, dlq_max_invalid_ratio/dlq_max_consecutive_count is configured, but dlq_topic is not"
        )


def get_topic_codec(topic: Topic) -> Codec:
    """
    Like sentry_kafka_schemas.get_codec, but only accepts a Topic enum
    """
    return get_codec(topic.value)
