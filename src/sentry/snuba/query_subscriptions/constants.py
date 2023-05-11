from typing import Dict

from django.conf import settings

from sentry.snuba.dataset import Dataset

topic_to_dataset: Dict[str, Dataset] = {
    settings.KAFKA_EVENTS_SUBSCRIPTIONS_RESULTS: Dataset.Events,
    settings.KAFKA_TRANSACTIONS_SUBSCRIPTIONS_RESULTS: Dataset.Transactions,
    settings.KAFKA_GENERIC_METRICS_SUBSCRIPTIONS_RESULTS: Dataset.PerformanceMetrics,
    settings.KAFKA_SESSIONS_SUBSCRIPTIONS_RESULTS: Dataset.Sessions,
    settings.KAFKA_METRICS_SUBSCRIPTIONS_RESULTS: Dataset.Metrics,
}
dataset_to_logical_topic = {
    Dataset.Events: "events-subscription-results",
    Dataset.Transactions: "transactions-subscription-results",
    Dataset.PerformanceMetrics: "generic-metrics-subscription-results",
    Dataset.Sessions: "sessions-subscription-results",
    Dataset.Metrics: "metrics-subscription-results",
}
