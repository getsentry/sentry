from __future__ import absolute_import

import logging

from django.conf import settings


logger = logging.getLogger(__name__)


class ProducerManager(object):
    """\
    Manages one `confluent_kafka.Producer` per Kafka cluster.

    See `KAFKA_CLUSTERS` and `KAFKA_TOPICS` in settings.
    """

    def __init__(self):
        self.__producers = {}

    def get(self, key):
        cluster_name = settings.KAFKA_TOPICS[key]['cluster']
        producer = self.__producers.get(cluster_name)

        if producer:
            return producer

        from confluent_kafka import Producer

        cluster_options = settings.KAFKA_CLUSTERS[cluster_name]
        producer = self.__producers[cluster_name] = Producer(cluster_options)
        return producer


producers = ProducerManager()


def delivery_callback(error, message):
    if error is not None:
        logger.error('Could not publish message (error: %s): %r', error, message)


def produce_sync(topic_key, **kwargs):
    producer = producers.get(topic_key)

    try:
        producer.produce(
            topic=settings.KAFKA_TOPICS[topic_key]['topic'],
            on_delivery=delivery_callback,
            **kwargs
        )
    except Exception as error:
        logger.error('Could not publish message: %s', error, exc_info=True)
        return

    producer.flush()
