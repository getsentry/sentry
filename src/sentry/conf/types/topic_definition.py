from enum import Enum
from typing import TypedDict


class Topic(Enum):
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
    INGEST_ATTACHMENTS = "ingest-attachments"
    INGEST_TRANSACTIONS = "ingest-transactions"
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


class TopicDefinition(TypedDict):
    cluster: str
