import logging
from typing import Any, Dict

from confluent_kafka import Producer
from django.conf import settings

from sentry.sentry_metrics import indexer
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker
from sentry.utils.kafka import create_batching_kafka_consumer

logger = logging.getLogger(__name__)

snuba_metrics = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS]


def get_metrics_consumer(topic=None, **options) -> None:
    return create_batching_kafka_consumer(
        {"ingest-metrics"}, worker=MetricsIndexerWorker(), **options
    )


class MetricsIndexerWorker(AbstractBatchWorker):
    def process_message(self, message):
        parsed_message: Dict[str, Any] = json.loads(message.value(), use_rapid_json=True)

        org_id = int(parsed_message["org_id"])
        metric_name = parsed_message["name"]
        tags = parsed_message["tags"]

        strings = {metric_name}
        strings.update(tags.keys())
        strings.update(tags.values())

        mapping = indexer.bulk_record(org_id, list(strings))

        new_tags = {}
        for tag_k, tag_v in tags.items():
            new_k = mapping[tag_k]
            new_v = mapping[tag_v]
            new_tags[new_k] = new_v

        parsed_message["tags"] = new_tags
        parsed_message["metric_id"] = mapping[metric_name]
        parsed_message["retention_days"] = 90
        return parsed_message

    def flush_batch(self, batch):
        # produce the translated message to snuba-metrics topic
        global snuba_metrics
        messages = 0
        cluster_name = snuba_metrics["cluster"]
        snuba_metrics_producer = Producer(
            kafka_config.get_kafka_producer_cluster_options(cluster_name),
        )
        for message in batch:
            snuba_metrics_producer.produce(
                topic=snuba_metrics["topic"],
                key=None,
                value=json.dumps(message),
                on_delivery=self.callback,
            )
            messages += snuba_metrics_producer.poll(0.5)

        if messages < len(batch):
            raise Exception("didn't get all the callbacks")

    def shutdown(self):
        # do any other processes need to be shutdown?
        return

    def callback(self, error, message):
        if error is not None:
            raise Exception(error.str())
