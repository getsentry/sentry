import atexit
import logging
import signal

from sentry.utils.batching_kafka_consumer import BatchingKafkaConsumer
from sentry.utils import metrics

from django.conf import settings

from sentry.utils.kafka_config import get_kafka_producer_cluster_options

logger = logging.getLogger(__name__)


class ProducerManager:
    """
    Manages one `confluent_kafka.Producer` per Kafka cluster.

    See `KAFKA_CLUSTERS` and `KAFKA_TOPICS` in settings.
    """

    def __init__(self):
        self.__producers = {}

    def get(self, key):
        cluster_name = settings.KAFKA_TOPICS[key]["cluster"]
        producer = self.__producers.get(cluster_name)

        if producer:
            return producer

        from confluent_kafka import Producer

        cluster_options = get_kafka_producer_cluster_options(cluster_name)
        producer = self.__producers[cluster_name] = Producer(cluster_options)

        @atexit.register
        def exit_handler():
            pending_count = len(producer)
            if pending_count == 0:
                return

            logger.debug(
                "Waiting for %d messages to be flushed from %s before exiting...",
                pending_count,
                cluster_name,
            )
            producer.flush()

        return producer


producers = ProducerManager()


def create_batching_kafka_consumer(topic_names, worker, **options):
    # In some cases we want to override the configuration stored in settings from the command line
    force_topic = options.pop("force_topic", None)
    force_cluster = options.pop("force_cluster", None)

    if force_topic and force_cluster:
        topic_names = {force_topic}
        cluster_names = {force_cluster}
    elif force_topic or force_cluster:
        raise ValueError(
            "Both 'force_topic' and 'force_cluster' have to be provided to override the configuration"
        )
    else:
        cluster_names = {settings.KAFKA_TOPICS[topic_name]["cluster"] for topic_name in topic_names}

    if len(cluster_names) > 1:
        raise ValueError(
            f"Cannot launch Kafka consumer listening to multiple topics ({topic_names}) on different clusters ({cluster_names})"
        )

    (cluster_name,) = cluster_names

    consumer = BatchingKafkaConsumer(
        topics=topic_names,
        cluster_name=cluster_name,
        worker=worker,
        metrics=metrics,
        metrics_default_tags={
            "topics": ",".join(sorted(topic_names)),
            "group_id": options.get("group_id"),
        },
        **options,
    )

    def handler(signum, frame):
        consumer.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    return consumer
