from __future__ import absolute_import

import atexit
import logging
import signal

from sentry.utils.batching_kafka_consumer import BatchingKafkaConsumer
from sentry.utils import metrics

from django.conf import settings

logger = logging.getLogger(__name__)


class ProducerManager(object):
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
    cluster_names = set(settings.KAFKA_TOPICS[topic_name]["cluster"] for topic_name in topic_names)
    if len(cluster_names) > 1:
        raise ValueError(
            "Cannot launch Kafka consumer listening to multiple topics ({}) on different clusters ({})".format(
                topic_names, cluster_names
            )
        )

    (cluster_name,) = cluster_names

    cluster_options = get_kafka_consumer_cluster_options(cluster_name)

    consumer = BatchingKafkaConsumer(
        topics=topic_names,
        cluster_options=cluster_options,
        worker=worker,
        metrics=metrics,
        metrics_default_tags={
            "topics": ",".join(sorted(topic_names)),
            "group_id": options.get("group_id"),
        },
        **options
    )

    def handler(signum, frame):
        consumer.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    return consumer


def _get_legacy_kafka_cluster_options(cluster_name):
    options = settings.KAFKA_CLUSTERS[cluster_name]

    options = {k: v for k, v in options.items() if k not in ("common", "producers", "consumers")}
    if options:
        logger.warning(
            "You are running with legacy kafka configuration. "
            "Please check src/sentry/conf/server.py for the new way of configuring kafka"
        )
    return options


def _get_kafka_cluster_options(cluster_name, config_section):
    options = {}
    legacy_options = _get_legacy_kafka_cluster_options(cluster_name)
    custom_options = settings.KAFKA_CLUSTERS[cluster_name].get(config_section, {})
    common_options = settings.KAFKA_CLUSTERS[cluster_name].get("common", {})
    options.update(legacy_options)
    options.update(custom_options)
    options.update(common_options)
    return options


def get_kafka_producer_cluster_options(cluster_name):
    return _get_kafka_cluster_options(cluster_name, "producers")


def get_kafka_consumer_cluster_options(cluster_name):
    return _get_kafka_cluster_options(cluster_name, "consumers")
