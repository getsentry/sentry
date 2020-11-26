from __future__ import absolute_import

import random
import functools
import logging
import msgpack

from django.conf import settings
from django.core.cache import cache

import sentry_sdk

from sentry import eventstore, features

from sentry.models import Project
from sentry.signals import event_accepted
from sentry.tasks.store import preprocess_event
from sentry.utils import json, metrics
from sentry.utils.sdk import mark_scope_as_unsafe
from sentry.utils.dates import to_datetime
from sentry.utils.cache import cache_key_for_event
from sentry.utils.kafka import create_batching_kafka_consumer
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker
from sentry.attachments import CachedAttachment, attachment_cache
from sentry.ingest.types import ConsumerType
from sentry.ingest.userreport import Conflict, save_userreport
from sentry.event_manager import save_attachment
from sentry.eventstore.processing import event_processing_store

logger = logging.getLogger(__name__)


CACHE_TIMEOUT = 3600


class IngestConsumerWorker(AbstractBatchWorker):
    def process_message(self, message):
        message = msgpack.unpackb(message.value(), use_list=False)
        return message

    def flush_batch(self, batch):
        mark_scope_as_unsafe()
        with metrics.timer("ingest_consumer.flush_batch"):
            return self._flush_batch(batch)

    def _flush_batch(self, batch):
        attachment_chunks = []
        other_messages = []

        projects_to_fetch = set()

        with metrics.timer("ingest_consumer.prepare_messages"):
            for message in batch:
                message_type = message["type"]
                projects_to_fetch.add(message["project_id"])

                if message_type == "event":
                    other_messages.append((process_event, message))
                elif message_type == "attachment_chunk":
                    attachment_chunks.append(message)
                elif message_type == "attachment":
                    other_messages.append((process_individual_attachment, message))
                elif message_type == "user_report":
                    other_messages.append((process_userreport, message))
                else:
                    raise ValueError("Unknown message type: {}".format(message_type))
                metrics.incr(
                    "ingest_consumer.flush.messages_seen", tags={"message_type": message_type}
                )

        with metrics.timer("ingest_consumer.fetch_projects"):
            projects = {p.id: p for p in Project.objects.get_many_from_cache(projects_to_fetch)}

        if attachment_chunks:
            # attachment_chunk messages need to be processed before attachment/event messages.
            with metrics.timer("ingest_consumer.process_attachment_chunk_batch"):
                for attachment_chunk in attachment_chunks:
                    process_attachment_chunk(attachment_chunk, projects=projects)

        if other_messages:
            with metrics.timer("ingest_consumer.process_other_messages_batch"):
                for processing_func, message in other_messages:
                    processing_func(message, projects=projects)

    def shutdown(self):
        pass


def trace_func(**span_kwargs):
    def wrapper(f):
        @functools.wraps(f)
        def inner(*args, **kwargs):
            span_kwargs["sampled"] = random.random() < getattr(
                settings, "SENTRY_INGEST_CONSUMER_APM_SAMPLING", 0
            )
            with sentry_sdk.start_transaction(**span_kwargs):
                return f(*args, **kwargs)

        return inner

    return wrapper


@metrics.wraps("ingest_consumer.process_event")
def _do_process_event(message, projects):
    payload = message["payload"]
    start_time = float(message["start_time"])
    event_id = message["event_id"]
    project_id = int(message["project_id"])
    remote_addr = message.get("remote_addr")
    attachments = message.get("attachments") or ()

    # check that we haven't already processed this event (a previous instance of the forwarder
    # died before it could commit the event queue offset)
    #
    # XXX(markus): I believe this code is extremely broken:
    #
    # * it practically uses memcached in prod which has no consistency
    #   guarantees (no idea how we don't run into issues there)
    #
    # * a TTL of 1h basically doesn't guarantee any deduplication at all. It
    #   just guarantees a good error message... for one hour.
    #
    # This code has been ripped from the old python store endpoint. We're
    # keeping it around because it does provide some protection against
    # reprocessing good events if a single consumer is in a restart loop.
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

    cache_key = event_processing_store.store(data)

    if attachments:
        attachment_objects = [
            CachedAttachment(type=attachment.pop("attachment_type"), **attachment)
            for attachment in attachments
        ]

        attachment_cache.set(cache_key, attachments=attachment_objects, timeout=CACHE_TIMEOUT)

    # Preprocess this event, which spawns either process_event or
    # save_event. Pass data explicitly to avoid fetching it again from the
    # cache.
    with sentry_sdk.start_span(op="ingest_consumer.process_event.preprocess_event"):
        preprocess_event(
            cache_key=cache_key,
            data=data,
            start_time=start_time,
            event_id=event_id,
            project=project,
        )

    # remember for an 1 hour that we saved this event (deduplication protection)
    cache.set(deduplication_key, "", CACHE_TIMEOUT)

    # emit event_accepted once everything is done
    event_accepted.send_robust(ip=remote_addr, data=data, project=project, sender=process_event)


@trace_func(name="ingest_consumer.process_event")
def process_event(message, projects):
    return _do_process_event(message, projects)


@trace_func(name="ingest_consumer.process_attachment_chunk")
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


@trace_func(name="ingest_consumer.process_individual_attachment")
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
    if attachment.type != "event.attachment":
        logger.exception("invalid individual attachment type: %s", attachment.type)
        return

    save_attachment(
        cache_key,
        attachment,
        project,
        event_id,
        key_id=None,  # TODO: Inject this from Relay
        group_id=group_id,
        start_time=None,  # TODO: Inject this from Relay
    )

    attachment.delete()


@trace_func(name="ingest_consumer.process_userreport")
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


def get_ingest_consumer(consumer_types, once=False, **options):
    """
    Handles events coming via a kafka queue.

    The events should have already been processed (normalized... ) upstream (by Relay).
    """
    topic_names = set(
        ConsumerType.get_topic_name(consumer_type) for consumer_type in consumer_types
    )
    return create_batching_kafka_consumer(
        topic_names=topic_names, worker=IngestConsumerWorker(), **options
    )
