from __future__ import absolute_import

import functools

from django.conf import settings


class ProducerManager(object):
    """\
    Manages one `confluent_kafka.Producer` per topic.

    * Allows overriding the cluster used on a per topic basis.
    * Allows overriding the cluster options used on a per topic basis.
    * Allows overriding the underlying topic name used.

    See `KAFKA_CLUSTERS` and `KAFKA_TOPICS` in settings.
    """

    def __init__(self):
        self.__producers = {}

    def get(self, key):
        producer = self.__producers.get(key)

        if producer:
            return producer

        from confluent_kafka import Producer

        topic_options = settings.KAFKA_TOPICS.get(key, {})
        cluster_name = topic_options.get('cluster', 'default')
        topic_name = topic_options.get('topic', key)

        cluster_options = settings.KAFKA_CLUSTERS.get(
            cluster_name, settings.KAFKA_CLUSTERS.get('default')
        )

        producer = functools.partial(Producer(cluster_options), topic=topic_name)
        self.__producers[key] = producer

        return producer


producers = ProducerManager()
