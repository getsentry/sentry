from __future__ import absolute_import

import uuid
import hashlib
import logging
import sentry_sdk

from django.conf import settings

from sentry import nodestore, features, eventstore
from sentry.attachments import CachedAttachment, attachment_cache
from sentry.models import EventAttachment
from sentry.utils import snuba
from sentry.utils.cache import cache_key_for_event
from sentry.utils.redis import redis_clusters
from sentry.eventstore.processing import event_processing_store

logger = logging.getLogger("sentry.reprocessing")

_REDIS_SYNC_TTL = 3600


def _generate_unprocessed_event_node_id(project_id, event_id):
    return hashlib.md5(
        u"{}:{}:unprocessed".format(project_id, event_id).encode("utf-8")
    ).hexdigest()


def save_unprocessed_event(project, event_id):
    """
    Move event from event_processing_store into nodestore. Only call if event
    has outcome=accepted.
    """
    if not features.has("projects:reprocessing-v2", project, actor=None):
        return

    with sentry_sdk.start_span(
        op="sentry.reprocessing2.save_unprocessed_event.get_unprocessed_event"
    ):
        data = event_processing_store.get(
            cache_key_for_event({"project": project.id, "event_id": event_id}), unprocessed=True
        )
        if data is None:
            return

    with sentry_sdk.start_span(op="sentry.reprocessing2.save_unprocessed_event.set_nodestore"):
        node_id = _generate_unprocessed_event_node_id(project_id=project.id, event_id=event_id)
        nodestore.set(node_id, data)


def backup_unprocessed_event(project, data):
    """
    Backup unprocessed event payload into redis. Only call if event should be
    able to be reprocessed.
    """

    if not features.has("projects:reprocessing-v2", project, actor=None):
        return

    event_processing_store.store(data, unprocessed=True)


def delete_unprocessed_events(events):
    node_ids = [
        _generate_unprocessed_event_node_id(event.project_id, event.event_id) for event in events
    ]
    nodestore.delete_multi(node_ids)


def reprocess_event(project_id, event_id, start_time):
    node_id = _generate_unprocessed_event_node_id(project_id=project_id, event_id=event_id)

    with sentry_sdk.start_span(op="reprocess_events.nodestore.get"):
        data = nodestore.get(node_id)
    if data is None:
        return

    from sentry.event_manager import set_tag
    from sentry.tasks.store import preprocess_event_from_reprocessing
    from sentry.ingest.ingest_consumer import CACHE_TIMEOUT

    # Take unprocessed data from old event and save it as unprocessed data
    # under a new event ID. The second step happens in pre-process. We could
    # save the "original event ID" instead and get away with writing less to
    # nodestore, but doing it this way makes the logic slightly simpler.

    # Step 1: Fix up the event payload for reprocessing and put it in event
    # cache/event_processing_store
    orig_event_id = data["event_id"]
    set_tag(data, "original_event_id", orig_event_id)

    event = eventstore.get_event_by_id(project_id, orig_event_id)
    if event is None:
        return

    set_tag(data, "original_group_id", event.group_id)

    # XXX: reuse event IDs
    event_id = data["event_id"] = uuid.uuid4().hex

    cache_key = event_processing_store.store(data)

    # Step 2: Copy attachments into attachment cache
    queryset = EventAttachment.objects.filter(
        project_id=project_id, event_id=orig_event_id
    ).select_related("file")

    attachment_objects = []

    for attachment_id, attachment in enumerate(queryset):
        with sentry_sdk.start_span(op="reprocess_event._copy_attachment_into_cache") as span:
            span.set_data("attachment_id", attachment.id)
            attachment_objects.append(
                _copy_attachment_into_cache(
                    attachment_id=attachment_id,
                    attachment=attachment,
                    cache_key=cache_key,
                    cache_timeout=CACHE_TIMEOUT,
                )
            )

    if attachment_objects:
        with sentry_sdk.start_span(op="reprocess_event.set_attachment_meta"):
            attachment_cache.set(cache_key, attachments=attachment_objects, timeout=CACHE_TIMEOUT)

    preprocess_event_from_reprocessing(
        cache_key=cache_key, start_time=start_time, event_id=event_id
    )


def _copy_attachment_into_cache(attachment_id, attachment, cache_key, cache_timeout):
    fp = attachment.file.getfile()
    chunk = None
    chunk_index = 0
    size = 0
    while True:
        chunk = fp.read(settings.SENTRY_REPROCESSING_ATTACHMENT_CHUNK_SIZE)
        if not chunk:
            break

        size += len(chunk)

        attachment_cache.set_chunk(
            key=cache_key,
            id=attachment_id,
            chunk_index=chunk_index,
            chunk_data=chunk,
            timeout=cache_timeout,
        )
        chunk_index += 1

    assert size == attachment.file.size

    return CachedAttachment(
        key=cache_key,
        id=attachment_id,
        name=attachment.name,
        # XXX: Not part of eventattachment model, but not strictly
        # necessary for processing
        content_type=None,
        type=attachment.file.type,
        chunks=chunk_index,
        size=size,
    )


def is_reprocessed_event(data):
    return bool(_get_original_event_id(data))


def _get_original_event_id(data):
    from sentry.event_manager import get_tag

    # XXX: Get rid of this tag once we reuse event IDs
    return get_tag(data, "original_event_id")


def _get_original_group_id(data):
    from sentry.event_manager import get_tag

    # XXX: Have real snuba column
    return get_tag(data, "original_group_id")


def _get_sync_redis_client():
    return redis_clusters.get(settings.SENTRY_REPROCESSING_SYNC_REDIS_CLUSTER)


def _get_sync_counter_key(group_id):
    return "re2:count:{}".format(group_id)


def mark_event_reprocessed(data):
    """
    This function is supposed to be unconditionally called when an event has
    finished reprocessing, regardless of whether it has been saved or not.
    """
    if not is_reprocessed_event(data):
        return

    key = _get_sync_counter_key(_get_original_group_id(data))
    _get_sync_redis_client().decr(key)


def start_group_reprocessing(project_id, group_id, max_events=None):
    from sentry.models.group import Group, GroupStatus
    from sentry.models.grouphash import GroupHash
    from django.db import transaction

    with transaction.atomic():
        Group.objects.filter(id=group_id).update(status=GroupStatus.REPROCESSING)
        # Remove all grouphashes such that new events get sorted into a
        # different group.
        GroupHash.objects.filter(group_id=group_id).delete()

    # Get event counts of issue (for all environments etc). This was copypasted
    # and simplified from groupserializer.
    event_count = snuba.aliased_query(
        aggregations=[["count()", "", "times_seen"]],  # select
        dataset=snuba.Dataset.Events,  # from
        conditions=[["group_id", "=", group_id], ["project_id", "=", project_id]],  # where
        referrer="reprocessing2.start_group_reprocessing",
    )["data"][0]["times_seen"]

    if max_events is not None:
        event_count = min(event_count, max_events)

    key = _get_sync_counter_key(group_id)
    _get_sync_redis_client().setex(key, _REDIS_SYNC_TTL, event_count)


def is_group_finished(group_id):
    """
    Checks whether a group has finished reprocessing.
    """

    pending = int(_get_sync_redis_client().get(_get_sync_counter_key(group_id)))
    return pending <= 0
