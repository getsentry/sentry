from __future__ import absolute_import

import logging
import msgpack
from six import BytesIO


from django.conf import settings
from django.core.cache import cache

from sentry import features
from sentry.cache import default_cache
from sentry.models import Project, File, EventAttachment
from sentry.signals import event_accepted
from sentry.tasks.store import preprocess_event
from sentry.utils import json
from sentry.utils.dates import to_datetime
from sentry.utils.cache import cache_key_for_event
from sentry.utils.kafka import create_batching_kafka_consumer
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker
from sentry.attachments import CachedAttachment, attachment_cache
from sentry.ingest.userreport import Conflict, save_userreport

logger = logging.getLogger(__name__)


CACHE_TIMEOUT = 3600


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


class IngestConsumerWorker(AbstractBatchWorker):
    def process_message(self, message):
        message = msgpack.unpackb(message.value(), use_list=False)
        message_type = message["type"]

        if message_type in ("event", "transaction"):
            process_event(message)
        elif message_type == "attachment_chunk":
            process_attachment_chunk(message)
        elif message_type == "attachment":
            process_individual_attachment(message)
        elif message_type == "user_report":
            process_userreport(message)
        else:
            raise ValueError("Unknown message type: {}".format(message_type))

        # Return *something* so that it counts against batch size
        return True

    def flush_batch(self, batch):
        pass

    def shutdown(self):
        pass


def process_event(message):
    payload = message["payload"]
    start_time = float(message["start_time"])
    event_id = message["event_id"]
    project_id = message["project_id"]
    remote_addr = message.get("remote_addr")
    attachments = message.get("attachments") or ()

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

    cache_key = cache_key_for_event(data)
    default_cache.set(cache_key, data, CACHE_TIMEOUT)

    if attachments:
        attachment_objects = [
            CachedAttachment(type=attachment.pop("attachment_type"), **attachment)
            for attachment in attachments
        ]

        attachment_cache.set(cache_key, attachments=attachment_objects, timeout=CACHE_TIMEOUT)

    # Preprocess this event, which spawns either process_event or
    # save_event. Pass data explicitly to avoid fetching it again from the
    # cache.
    preprocess_event(
        cache_key=cache_key, data=data, start_time=start_time, event_id=event_id, project=project
    )

    # remember for an 1 hour that we saved this event (deduplication protection)
    cache.set(deduplication_key, "", CACHE_TIMEOUT)

    # emit event_accepted once everything is done
    event_accepted.send_robust(ip=remote_addr, data=data, project=project, sender=process_event)


def process_attachment_chunk(message):
    payload = message["payload"]
    event_id = message["event_id"]
    project_id = message["project_id"]
    id = message["id"]
    chunk_index = message["chunk_index"]
    cache_key = cache_key_for_event({"event_id": event_id, "project": project_id})
    attachment_cache.set_chunk(
        key=cache_key, id=id, chunk_index=chunk_index, chunk_data=payload, timeout=CACHE_TIMEOUT
    )


def process_individual_attachment(message):
    event_id = message["event_id"]
    project_id = message["project_id"]
    cache_key = cache_key_for_event({"event_id": event_id, "project": project_id})

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        logger.error("Project for ingested event does not exist: %s", project_id)
        return

    if not features.has("organizations:event-attachments", project.organization, actor=None):
        logger.info("Organization has no event attachments: %s", project_id)
        return

    attachment = message["attachment"]
    attachment = attachment_cache.get_from_chunks(
        key=cache_key, type=attachment.pop("attachment_type"), **attachment
    )
    assert attachment.type == "event.attachment", attachment.type

    file = File.objects.create(
        name=attachment.name,
        type=attachment.type,
        headers={"Content-Type": attachment.content_type},
    )

    file.putfile(BytesIO(attachment.data))
    EventAttachment.objects.create(
        project_id=project.id, event_id=event_id, name=attachment.name, file=file
    )

    attachment.delete()


def process_userreport(message):
    project_id = message["project_id"]
    start_time = to_datetime(message["start_time"])
    feedback = json.loads(message["payload"])

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        logger.error("Project for ingested event does not exist: %s", project_id)
        return False

    try:
        save_userreport(project, feedback, start_time=start_time)
        return True
    except Conflict as e:
        logger.info("Invalid userreport: %s", e)
        return False


def get_ingest_consumer(consumer_type, once=False, **options):
    """
    Handles events coming via a kafka queue.

    The events should have already been processed (normalized... ) upstream (by Relay).
    """
    topic_name = ConsumerType.get_topic_name(consumer_type)
    return create_batching_kafka_consumer(
        topic_name=topic_name, worker=IngestConsumerWorker(), **options
    )
