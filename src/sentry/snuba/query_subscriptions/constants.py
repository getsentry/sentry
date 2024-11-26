from sentry.conf.types.kafka_definition import Topic
from sentry.snuba.dataset import Dataset
from sentry.utils.kafka_config import get_topic_definition

dataset_to_logical_topic = {
    Dataset.Events: "events-subscription-results",
    Dataset.Transactions: "transactions-subscription-results",
    Dataset.PerformanceMetrics: "generic-metrics-subscription-results",
    Dataset.Metrics: "metrics-subscription-results",
    Dataset.EventsAnalyticsPlatform: "eap-spans-subscription-results",
}

topic_to_dataset = {
    get_topic_definition(Topic(logical_topic))["real_topic_name"]: dataset
    for (dataset, logical_topic) in dataset_to_logical_topic.items()
}
