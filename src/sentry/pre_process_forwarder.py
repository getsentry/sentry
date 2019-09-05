from __future__ import absolute_import

import logging
import msgpack

from django.conf import settings
from django.core.cache import cache
import confluent_kafka as kafka

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

    @staticmethod
    def get_topic_name(consumer_type, settings):
        if consumer_type == ConsumerType.Events:
            return settings.KAFKA_INGEST_EVENTS
        elif consumer_type == ConsumerType.Attachments:
            return settings.KAFKA_INGEST_ATTACHMENTS
        elif consumer_type == ConsumerType.Transactions:
            return settings.KAFKA_INGEST_TRANSACTIONS
        raise ValueError("Invalid consumer type", consumer_type)


def _create_consumer(consumer_group, consumer_type, settings):
    """
    Creates a kafka consumer based on the
    :param consumer_group:
    :return:
    """
    topic_name = ConsumerType.get_topic_name(consumer_type, settings)
    cluster_name = settings.KAFKA_TOPICS[topic_name]["cluster"]
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


def run_pre_process_forwarder(
    commit_batch_size,
    consumer_group,
    consumer_type,
    max_batch_time_seconds,
    is_shutdown_requested=lambda: False,
):
    """
    Handles events coming via a kafka queue.

    The events should have already been processed (normalized... ) upstream (by Relay).

    :param commit_batch_size: the number of message the consumer will try to process/commit in one loop
    :param consumer_group: kafka consumer group name
    :param consumer_type: an enumeration defining the types of ingest messages see `ConsumerType`
    :param max_batch_time_seconds: the maximum number of seconds a consume operation will be blocked waiting
        for the specified commit_batch_size number of messages to appear in the queue before it returns. At the
        end of the specified time the consume operation will return however many messages it has ( including
        an empty array if no new messages are available).
    :param is_shutdown_requested: Callable[[],bool] predicate checked after each loop, if it returns
        True the forwarder stops (by default is lambda: False). In normal operation this should be left to default.
        For unit testing it offers a way to cleanly stop the forwarder after some particular condition is achieved.
    """

    logger.debug("Starting pre-process-forwarder...")
    consumer = _create_consumer(consumer_group, consumer_type, settings)

    consumer.subscribe([ConsumerType.get_topic_name(consumer_type, settings)])

    try:
        while not is_shutdown_requested():
            # get up to commit_batch_size messages
            messages = consumer.consume(
                num_messages=commit_batch_size, timeout=max_batch_time_seconds
            )

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

                message = msgpack.unpackb(message.value(), use_list=False)
                body = message["payload"]
                start_time = float(message["start_time"])
                event_id = message["event_id"]
                project_id = message["project_id"]

                # check that we haven't already processed this event (a previous instance of the forwarder
                # died before it could commit the event queue offset)
                deduplication_key = "ev:{}:{}".format(project_id, event_id)
                if cache.get(deduplication_key) is not None:
                    logger.warning(
                        "pre-process-forwarder detected a duplicated event"
                        " with id:{} for project:{}.".format(event_id, project_id)
                    )
                    continue

                cache_key = cache_key_from_project_id_and_event_id(
                    project_id=project_id, event_id=event_id
                )
                cache_timeout = 3600
                default_cache.set(cache_key, body, cache_timeout, raw=True)
                preprocess_event.delay(
                    cache_key=cache_key, start_time=start_time, event_id=event_id
                )

                # remember for an 1 hour that we saved this event (deduplication protection)
                cache.set(deduplication_key, "", 3600)

            if len(messages) > 0:
                # we have read some messages in the previous consume, commit the offset
                consumer.commit(asynchronous=False)

    except KeyboardInterrupt:
        pass

    logger.debug("Closing consumer {}...".format(consumer_type))
    consumer.close()
