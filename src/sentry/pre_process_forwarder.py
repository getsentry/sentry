from __future__ import absolute_import

import logging
from django.conf import settings
import confluent_kafka as kafka
import msgpack

from sentry.coreapi import cache_key_from_project_id_and_event_id
from sentry.cache import default_cache
from sentry.tasks.store import preprocess_event

logger = logging.getLogger(__name__)


class ConsumerType(object):
    """
    Defines the types of ingestion consumers
    """

    Events = "events"  # consumes simple events ( from the Events topic)
    Attachments = "attachments"  # consumes events with attachments ( from the Attachments topic)
    Transactions = "transactions"  # consumes transaction events ( from the Transactions topic)


def _create_consumer(consumer_group):
    """
    Creates a kafka consumer based on the
    :param consumer_group:
    :return:
    """
    cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_EVENTS]["cluster"]
    bootstrap_servers = settings.KAFKA_CLUSTERS[cluster_name]["bootstrap.servers"]

    consumer_configuration = {
        "bootstrap.servers": bootstrap_servers,
        "group.id": consumer_group,
        "enable.auto.commit": "false",  # we commit manually
        "enable.auto.offset.store": "true",  # we let the broker keep count of the current offset (when committing)
        "enable.partition.eof": "false",  # stop EOF errors when we read all messages in the topic
        "default.topic.config": {
            "auto.offset.reset": "earliest"  # TODO RaduW check what we want to do earliest/latest/error
        },
    }

    return kafka.Consumer(consumer_configuration)


def run_pre_process_forwarder(commit_batch_size, consumer_group, consumer_type):
    logger.debug("Starting pre-process-forwarder...")
    consumer = _create_consumer(consumer_group)

    try:
        while True:
            # get up to commit_batch_size messages
            messages = consumer.consume(num_messages=commit_batch_size, timeout=0.1)

            for message in messages:
                message_error = message.error()
                if message_error is not None:
                    logger.error(
                        "Received message with error on %s, error:'%s'",
                        consumer_type,
                        message_error,
                    )
                    raise ValueError(
                        "Bad message received from consumer", consumer_type, message_error
                    )

                message = msgpack.unpackb(message.value(), raw=False, use_list=False)
                body = message["payload"]
                # body = body.decode('utf-8')

                start_time = float(message("start_time"))
                event_id = message["event_id"]
                project_id = message["project_id"]

                cache_key = cache_key_from_project_id_and_event_id(
                    project_id=project_id, event_id=event_id
                )
                cache_timeout = 3600
                default_cache.set(cache_key, body, cache_timeout, raw=True)
                preprocess_event.delay(
                    cache_key=cache_key, start_time=start_time, event_id=event_id
                )

            if len(messages) > 0:
                # we have read some messages in the previous consume, commit the offset
                consumer.commit(asynchronous=False)

    except KeyboardInterrupt:
        pass

    logger.debug("Closing consumer {}...".format(consumer_type))
    consumer.close()
