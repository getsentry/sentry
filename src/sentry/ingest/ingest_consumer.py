from __future__ import absolute_import

import atexit
import logging
import msgpack
from six import BytesIO

import multiprocessing.dummy
import multiprocessing as _multiprocessing

from django.conf import settings
from django.core.cache import cache

from sentry import eventstore, features, options
from sentry.cache import default_cache
from sentry.models import Project, File, EventAttachment
from sentry.signals import event_accepted
from sentry.tasks.store import preprocess_event
from sentry.utils import json, metrics
from sentry.utils.dates import to_datetime
from sentry.utils.cache import cache_key_for_event
from sentry.utils.kafka import create_batching_kafka_consumer
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker
from sentry.attachments import CachedAttachment, MissingAttachmentChunks, attachment_cache
from sentry.ingest.userreport import Conflict, save_userreport
from sentry.event_manager import save_transaction_events

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
    def __init__(self, concurrency):
        self.pool = _multiprocessing.dummy.Pool(concurrency)
        atexit.register(self.pool.close)

    def process_message(self, message):
        message = msgpack.unpackb(message.value(), use_list=False)
        return message

    def flush_batch(self, batch):
        attachment_chunks = []
        other_messages = []
        transactions = []

        projects_to_fetch = set()

        with metrics.timer("ingest_consumer.prepare_messages"):
            for message in batch:
                message_type = message["type"]
                projects_to_fetch.add(message["project_id"])

                if message_type == "event":
                    other_messages.append((process_event, message))
                elif message_type == "transaction":
                    transactions.append(message)
                elif message_type == "attachment_chunk":
                    attachment_chunks.append(message)
                elif message_type == "attachment":
                    other_messages.append((process_individual_attachment, message))
                elif message_type == "user_report":
                    other_messages.append((process_userreport, message))
                else:
                    raise ValueError("Unknown message type: {}".format(message_type))

        with metrics.timer("ingest_consumer.fetch_projects"):
            projects = {p.id: p for p in Project.objects.get_many_from_cache(projects_to_fetch)}

        if attachment_chunks:
            # attachment_chunk messages need to be processed before attachment/event messages.
            with metrics.timer("ingest_consumer.process_attachment_chunk_batch"):
                for _ in self.pool.imap_unordered(
                    lambda msg: process_attachment_chunk(msg, projects=projects),
                    attachment_chunks,
                    chunksize=100,
                ):
                    pass

        if other_messages:
            with metrics.timer("ingest_consumer.process_other_messages_batch"):
                for _ in self.pool.imap_unordered(
                    lambda args: args[0](args[1], projects=projects), other_messages, chunksize=100
                ):
                    pass

        if transactions:
            process_transactions_batch(transactions, projects)

    def shutdown(self):
        pass


@metrics.wraps("ingest_consumer.process_transactions_batch")
def process_transactions_batch(messages, projects):
    if options.get("store.transactions-celery") is True:
        for message in messages:
            process_event(message, projects)
        return

    jobs = []
    for message in messages:
        payload = message["payload"]
        project_id = int(message["project_id"])
        start_time = float(message["start_time"])

        if project_id not in projects:
            continue

        with metrics.timer("ingest_consumer.decode_transaction_json"):
            data = json.loads(payload)
        jobs.append({"data": data, "start_time": start_time})

    save_transaction_events(jobs, projects)


@metrics.wraps("ingest_consumer.process_event")
def process_event(message, projects):
    payload = message["payload"]
    start_time = float(message["start_time"])
    event_id = message["event_id"]
    project_id = int(message["project_id"])
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
        project = projects[project_id]
    except KeyError:
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


@metrics.wraps("ingest_consumer.process_attachment_chunk")
def process_attachment_chunk(message, projects):
    payload = message["payload"]
    event_id = message["event_id"]
    project_id = message["project_id"]
    id = message["id"]
    chunk_index = message["chunk_index"]
    cache_key = cache_key_for_event({"event_id": event_id, "project": project_id})
    attachment_cache.set_chunk(
        key=cache_key, id=id, chunk_index=chunk_index, chunk_data=payload, timeout=CACHE_TIMEOUT
    )


@metrics.wraps("ingest_consumer.process_individual_attachment")
def process_individual_attachment(message, projects):
    event_id = message["event_id"]
    project_id = int(message["project_id"])
    cache_key = cache_key_for_event({"event_id": event_id, "project": project_id})

    try:
        project = projects[project_id]
    except KeyError:
        logger.error("Project for ingested event does not exist: %s", project_id)
        return

    if not features.has("organizations:event-attachments", project.organization, actor=None):
        logger.info("Organization has no event attachments: %s", project_id)
        return

    # Attachments may be uploaded for events that already exist. Fetch the
    # existing group_id, so that the attachment can be fetched by group-level
    # APIs. This is inherently racy.
    events = eventstore.get_unfetched_events(
        filter=eventstore.Filter(event_ids=[event_id], project_ids=[project.id]), limit=1
    )

    group_id = None
    if events:
        group_id = events[0].group_id

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

    try:
        data = attachment.data
    except MissingAttachmentChunks:
        logger.exception("Missing chunks for cache_key=%s", cache_key)
        return

    file.putfile(BytesIO(data))
    EventAttachment.objects.create(
        project_id=project.id, group_id=group_id, event_id=event_id, name=attachment.name, file=file
    )

    attachment.delete()


@metrics.wraps("ingest_consumer.process_userreport")
def process_userreport(message, projects):
    project_id = int(message["project_id"])
    start_time = to_datetime(message["start_time"])
    feedback = json.loads(message["payload"])

    try:
        project = projects[project_id]
    except KeyError:
        logger.error("Project for ingested event does not exist: %s", project_id)
        return False

    try:
        save_userreport(project, feedback, start_time=start_time)
        return True
    except Conflict as e:
        logger.info("Invalid userreport: %s", e)
        return False


def get_ingest_consumer(consumer_type, once=False, concurrency=None, **options):
    """
    Handles events coming via a kafka queue.

    The events should have already been processed (normalized... ) upstream (by Relay).
    """
    topic_name = ConsumerType.get_topic_name(consumer_type)
    return create_batching_kafka_consumer(
        topic_name=topic_name, worker=IngestConsumerWorker(concurrency=concurrency), **options
    )
