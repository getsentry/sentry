import logging
from typing import Any, Dict

from django.conf import settings

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.base import UseCase
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker
from sentry.utils.kafka import create_batching_kafka_consumer
from sentry.utils.pubsub import KafkaPublisher

logger = logging.getLogger(__name__)

snuba_metrics = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS]


def get_metrics_consumer(topic=None, **options) -> None:
    return create_batching_kafka_consumer(
        {"ingest-metrics"}, worker=MetricsIndexerWorker(), **options
    )


class MetricsIndexerWorker(AbstractBatchWorker):
    def process_message(self, message):
        original: Dict[str, Any] = json.loads(message.value())
        new_message = original.copy()
        project_id = int(new_message["project_id"])

        metric_id = indexer.resolve(project_id, UseCase.METRIC, new_message["name"])

        tags = new_message["tags"]
        new_tags = {}
        for tag_k, tag_v in tags.items():
            new_k = indexer.resolve(project_id, UseCase.TAG_KEY, tag_k)
            new_v = indexer.resolve(project_id, UseCase.TAG_VALUE, tag_v)
            new_tags[new_k] = new_v

        new_message["tags"] = new_tags
        new_message["metric_id"] = metric_id
        new_message["retention_days"] = 90
        return new_message

    def flush_batch(self, batch):
        # produce to the snuba-metrics topic
        global snuba_metrics
        for message in batch:
            cluster_name = snuba_metrics["cluster"]
            snuba_metrics_publisher = KafkaPublisher(
                kafka_config.get_kafka_producer_cluster_options(cluster_name),
                asynchronous=False,
            )
            snuba_metrics_publisher.publish(snuba_metrics["topic"], json.dumps(message))

    def shutdown(self):
        # do any other processes need to be shutdown?
        return
