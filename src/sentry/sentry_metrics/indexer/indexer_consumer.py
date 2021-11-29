import logging
from typing import Any, Dict, MutableMapping, Optional, Sequence

from confluent_kafka import Producer
from django.conf import settings

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.indexer.tasks import process_indexed_metrics
from sentry.utils import json, kafka_config, metrics
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker, BatchingKafkaConsumer
from sentry.utils.kafka import create_batching_kafka_consumer

logger = logging.getLogger(__name__)


def get_metrics_consumer(
    topic: Optional[str] = None, **options: Dict[str, str]
) -> BatchingKafkaConsumer:
    snuba_metrics = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS]
    snuba_metrics_producer = Producer(
        kafka_config.get_kafka_producer_cluster_options(snuba_metrics["cluster"]),
    )
    return create_batching_kafka_consumer(
        {topic},
        worker=MetricsIndexerWorker(producer=snuba_metrics_producer),
        **options,
    )


class MetricsIndexerWorker(AbstractBatchWorker):  # type: ignore
    def __init__(self, producer: Producer) -> None:
        self.__producer = producer
        self.__producer_topic = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_METRICS].get(
            "topic", "snuba-metrics"
        )

    def process_message(self, message: Any) -> MutableMapping[str, Any]:
        parsed_message: MutableMapping[str, Any] = json.loads(message.value(), use_rapid_json=True)

        metric_name = parsed_message["name"]
        tags = parsed_message.get("tags", {})

        strings = {
            metric_name,
            *tags.keys(),
            *tags.values(),
        }

        with metrics.timer("metrics_consumer.bulk_record"):
            mapping = indexer.bulk_record(list(strings))  # type: ignore

        new_tags = {mapping[k]: mapping[v] for k, v in tags.items()}

        parsed_message["tags"] = new_tags
        parsed_message["metric_id"] = mapping[metric_name]
        parsed_message["retention_days"] = 90
        return parsed_message

    def flush_batch(self, batch: Sequence[MutableMapping[str, Any]]) -> None:
        # produce the translated message to snuba-metrics topic
        for message in batch:
            self.__producer.produce(
                topic=self.__producer_topic,
                key=None,
                value=json.dumps(message).encode(),
                on_delivery=self.callback,
            )
            message_type = message.get("type", "unknown")
            metrics.incr(
                "metrics_consumer.producer.messages_seen", tags={"metric_type": message_type}
            )
        with metrics.timer("metrics_consumer.producer.flush"):
            messages_left = self.__producer.flush(5.0)

        if messages_left != 0:
            # TODO(meredith): We are not currently keeping track of
            # which callbacks failed. This means could potentially
            # be duplicating messages since we don't commit offsets
            # unless all the callbacks are successful.
            #
            # In the future if we know which callback failed, we can
            # commit only up to that point and retry on the remaining
            # messages.
            metrics.incr("metrics_consumer.producer.messages_left")
            raise Exception(f"didn't get all the callbacks: {messages_left} left")

        # if we have successfully produced messages to the snuba-metrics topic
        # then enque task to send a slimmed down payload to the product metrics data model.
        # TODO(meredith): once we know more about what the product data model needs
        # adjust payload to send the necessary data
        messages = [{"tags": m["tags"], "name": m["name"], "org_id": m["org_id"]} for m in batch]
        process_indexed_metrics.apply_async(kwargs={"messages": messages})

    def shutdown(self) -> None:
        return

    def callback(self, error: Any, message: Any) -> None:
        if error is not None:
            raise Exception(error.str())
