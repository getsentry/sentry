from __future__ import absolute_import

import logging
import six

from django.conf import settings


logger = logging.getLogger(__name__)


_topic_to_config = {}


def get_topic_config(topic):
    if not _topic_to_config:
        for topic_key, config in six.iteritems(settings.KAFKA_TOPICS):
            _topic_to_config[config['topic']] = config

    return _topic_to_config[topic]


def get_topic_key_config(topic_key):
    return settings.KAFKA_TOPICS[topic_key]


class ProducerManager(object):
    """\
    Manages one `confluent_kafka.Producer` per Kafka cluster.

    See `KAFKA_CLUSTERS` and `KAFKA_TOPICS` in settings.
    """

    def __init__(self):
        self.__producers = {}

    def get(self, topic_key):
        cluster_name = get_topic_key_config(topic_key)['cluster']
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
            topic=get_topic_key_config(topic_key)['topic'],
            on_delivery=delivery_callback,
            **kwargs
        )

        producer.flush()
    except Exception as error:
        logger.error('Could not publish message: %s', error, exc_info=True)
        return
