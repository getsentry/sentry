from __future__ import absolute_import

import logging
import msgpack

from django.conf import settings
from django.core.cache import cache

from sentry.coreapi import cache_key_for_event
from sentry.cache import default_cache
from sentry.models import Project
from sentry.signals import event_accepted
from sentry.tasks.store import preprocess_event
from sentry.utils import json
from sentry.utils.kafka import SimpleKafkaConsumer

logger = logging.getLogger(__name__)


class ConsumerType(object):
    """
    Defines the types of ingestion consumers
    """

    Events = "events"  # consumes simple events ( from the Events topic)
    Attachments = "attachments"  # consumes events with attachments ( from the Attachments topic)
    Transactions = "transactions"  # consumes transaction events ( from the Transactions topic)

    @staticmethod
    def get_topic_name(consumer_type):
        if consumer_type == ConsumerType.Events:
            return settings.KAFKA_INGEST_EVENTS
        elif consumer_type == ConsumerType.Attachments:
            return settings.KAFKA_INGEST_ATTACHMENTS
        elif consumer_type == ConsumerType.Transactions:
            return settings.KAFKA_INGEST_TRANSACTIONS
        raise ValueError("Invalid consumer type", consumer_type)


class IngestConsumer(SimpleKafkaConsumer):
    def process_message(self, message):
        message = msgpack.unpackb(message.value(), use_list=False)
        payload = message["payload"]
        start_time = float(message["start_time"])
        event_id = message["event_id"]
        project_id = message["project_id"]
        remote_addr = message.get("remote_addr")

        # check that we haven't already processed this event (a previous instance of the forwarder
        # died before it could commit the event queue offset)
        deduplication_key = "ev:{}:{}".format(project_id, event_id)
        if cache.get(deduplication_key) is not None:
            logger.warning(
                "pre-process-forwarder detected a duplicated event" " with id:%s for project:%s.",
                event_id,
                project_id,
            )
            return  # message already processed do not reprocess

        try:
            project = Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            logger.error("Project for ingested event does not exist: %s", project_id)
            return

        # Parse the JSON payload. This is required to compute the cache key and
        # call process_event. The payload will be put into Kafka raw, to avoid
        # serializing it again.
        # XXX: Do not use CanonicalKeyDict here. This may break preprocess_event
        # which assumes that data passed in is a raw dictionary.
        data = json.loads(payload)

        cache_timeout = 3600
        cache_key = cache_key_for_event(data)
        default_cache.set(cache_key, data, cache_timeout)

        # Preprocess this event, which spawns either process_event or
        # save_event. Pass data explicitly to avoid fetching it again from the
        # cache.
        preprocess_event(cache_key=cache_key, data=data, start_time=start_time, event_id=event_id)

        # remember for an 1 hour that we saved this event (deduplication protection)
        cache.set(deduplication_key, "", 3600)

        # emit event_accepted once everything is done
        event_accepted.send_robust(
            ip=remote_addr, data=data, project=project, sender=self.process_message
        )


def run_ingest_consumer(
    commit_batch_size,
    consumer_group,
    consumer_type,
    max_fetch_time_seconds,
    initial_offset_reset="latest",
    is_shutdown_requested=lambda: False,
):
    """
    Handles events coming via a kafka queue.

    The events should have already been processed (normalized... ) upstream (by Relay).

    :param commit_batch_size: the number of message the consumer will try to process/commit in one loop
    :param consumer_group: kafka consumer group name
    :param consumer_type: an enumeration defining the types of ingest messages see `ConsumerType`
    :param max_fetch_time_seconds: the maximum number of seconds a consume operation will be blocked waiting
        for the specified commit_batch_size number of messages to appear in the queue before it returns. At the
        end of the specified time the consume operation will return however many messages it has ( including
        an empty array if no new messages are available).
    :param initial_offset_reset: offset reset policy when there's no available offset for the consumer
    :param is_shutdown_requested: Callable[[],bool] predicate checked after each loop, if it returns
        True the forwarder stops (by default is lambda: False). In normal operation this should be left to default.
        For unit testing it offers a way to cleanly stop the forwarder after some particular condition is achieved.
    """
    logger.debug("Starting ingest-consumer...")
    topic_name = ConsumerType.get_topic_name(consumer_type)

    ingest_consumer = IngestConsumer(
        commit_batch_size=commit_batch_size,
        consumer_group=consumer_group,
        topic_name=topic_name,
        max_fetch_time_seconds=max_fetch_time_seconds,
        initial_offset_reset=initial_offset_reset,
    )

    ingest_consumer.run(is_shutdown_requested)

    logger.debug("ingest-consumer terminated.")
