"""
Reprocessing allows a user to re-enqueue all events of a group at the start of
preprocess-event, for example to reattempt symbolication of stacktraces or
reattempt grouping.

How reprocessing works
======================

1. In `start_group_reprocessing`, the group is put into REPROCESSING state. In
   this state it must not be modified or receive events. Much like with group
   merging, all its hashes are detached, they are moved to a new, empty group.

   The group gets a new activity entry that contains metadata about who
   triggered reprocessing with how many events. This is purely to serve UI.

   If a user at this point navigates to the group, they will not be able to
   interact with it at all, but only watch the progress of reprocessing.

2. All events from the group are iterated through and enqueued into
   preprocess_event. The event payload is taken from a backup that was made on
   first ingestion in preprocess_event.

3. `mark_event_reprocessed` will decrement the pending event counter in Redis
   to see if reprocessing is done.

   When the counter reaches zero, it will trigger the `finish_reprocessing` task,
   which will move all associated models like assignee and activity into the new group.

   A group redirect is installed. The old group is deleted, while the new group
   is unresolved. This effectively unsets the REPROCESSING status.

   A user looking at the progress bar on the old group's URL is supposed to be
   redirected at this point. The new group can either:

   a. Have events by itself, but also show a success message based on the data in activity.
   b. Be totally empty but suggest a search for original_issue_id based on data in activity.

   However, there's no special flag for whether that new group has been a
   result of reprocessing.

Why not mutate the group in-place? (and how reprocessing actually works)
========================================================================

Snuba is only able to delete entire groups at once. How group deletion works
internally:

* A new row is inserted into the events table with the same event_id, but a
  `deleted=1` property. This row by itself would naturally appear as a new
  event with the same event ID, however Snuba adds `and not deleted` to every query.

* The group ID is added to a Redis set of "temporarily excluded group IDs".
  This set is now appended to every query: `and group_id not in (<long list of
  deleted group IDs>)`

* Every n hours, ClickHouse folds rows with duplicate primary keys into one
  row. Now only the `deleted=1` row of the deleted event remains. This process
  is basically rewriting the table, and as such itself takes a couple of hours.

  After that the Redis set can be cleared out.

As such, reusing the group ID will not work as the Redis set will prevent
any events in that group from being searchable. We can also not skip the Redis
part specifically for reprocessing: When the user chooses to process `x` out of
`n` events, the other `n - x` events would randomly appear within search
results until the next table rewrite is done.

One could in theory store individual event IDs in Redis that should be excluded
from all queries. However, this blows up the size of all queries within a
project until the next table rewrite is done, and slows down all searches. In
theory this slowdown can also happen if one chose to delete a lot of groups
within a project.

There is the additional complication that the `deleted=1` row "wins" over any
other row one may insert at a later point. So what reprocessing actually does
instead of group deletion is:

* Insert `deleted=1` for all events that are *not* supposed to be reprocessed.
* Mark the group as deleted in Redis.
* All reprocessed events are "just" inserted over the old ones.
"""

import hashlib
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Literal, Sequence, Tuple, Union

import redis
import sentry_sdk
from django.conf import settings
from django.db import router

from sentry import eventstore, models, nodestore, options
from sentry.attachments import CachedAttachment, attachment_cache
from sentry.deletions.defaults.group import DIRECT_GROUP_RELATED_MODELS
from sentry.eventstore.models import Event
from sentry.eventstore.processing import event_processing_store
from sentry.snuba.dataset import Dataset
from sentry.utils import json, metrics, snuba
from sentry.utils.cache import cache_key_for_event
from sentry.utils.dates import to_datetime, to_timestamp
from sentry.utils.redis import redis_clusters
from sentry.utils.safe import get_path, set_path

logger = logging.getLogger("sentry.reprocessing")


# Group-related models are only a few per-group and are migrated at
# once.
GROUP_MODELS_TO_MIGRATE = DIRECT_GROUP_RELATED_MODELS + (models.Activity,)

# If we were to move groupinbox to the new, empty group, inbox would show the
# empty, unactionable group while it is reprocessing. Let post-process take
# care of assigning GroupInbox like normally.
GROUP_MODELS_TO_MIGRATE = tuple(x for x in GROUP_MODELS_TO_MIGRATE if x != models.GroupInbox)

# Event attachments and group reports are per-event. This means that:
#
# 1. they are migrated as part of the processing pipeline (post-process/save-event)
# 2. there are a lot of them per group. For remaining events, we need to chunk
#    up those queries for them to not get too slow
EVENT_MODELS_TO_MIGRATE = (models.EventAttachment, models.UserReport)

# The amount of seconds after which we assume there was no progress during reprocessing,
# and after which we just give up and mark the group as finished.
REPROCESSING_TIMEOUT = 20 * 60


# Note: This list of reasons is exposed in the EventReprocessableEndpoint to
# the frontend.
CannotReprocessReason = Union[
    # Can have many reasons. The event is too old to be reprocessed (very
    # unlikely!) or was not a native event.
    Literal["unprocessed_event.not_found"],
    # The event does not exist.
    Literal["event.not_found"],
    # A required attachment, such as the original minidump, is missing.
    Literal["attachment.not_found"],
]


class CannotReprocess(Exception):
    def __init__(self, reason: CannotReprocessReason):
        Exception.__init__(self, reason)


def _generate_unprocessed_event_node_id(project_id, event_id):
    return hashlib.md5(f"{project_id}:{event_id}:unprocessed".encode()).hexdigest()


def save_unprocessed_event(project, event_id):
    """
    Move event from event_processing_store into nodestore. Only call if event
    has outcome=accepted.
    """
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


def backup_unprocessed_event(data):
    """
    Backup unprocessed event payload into redis. Only call if event should be
    able to be reprocessed.
    """

    if options.get("store.reprocessing-force-disable"):
        return

    event_processing_store.store(dict(data), unprocessed=True)


@dataclass
class ReprocessableEvent:
    event: Event
    data: Dict[str, Any]
    attachments: List[models.EventAttachment]


def pull_event_data(project_id, event_id) -> ReprocessableEvent:
    from sentry.lang.native.processing import get_required_attachment_types

    with sentry_sdk.start_span(op="reprocess_events.eventstore.get"):
        event = eventstore.backend.get_event_by_id(project_id, event_id)

    if event is None:
        raise CannotReprocess("event.not_found")

    with sentry_sdk.start_span(op="reprocess_events.nodestore.get"):
        node_id = Event.generate_node_id(project_id, event_id)
        data = nodestore.get(node_id, subkey="unprocessed")
        if data is None:
            node_id = _generate_unprocessed_event_node_id(project_id=project_id, event_id=event_id)
            data = nodestore.get(node_id)

    # Check data after checking presence of event to avoid too many instances.
    if data is None:
        raise CannotReprocess("unprocessed_event.not_found")

    required_attachment_types = get_required_attachment_types(data)
    attachments = list(
        models.EventAttachment.objects.filter(
            project_id=project_id, event_id=event_id, type__in=list(required_attachment_types)
        )
    )
    missing_attachment_types = required_attachment_types - {ea.type for ea in attachments}

    if missing_attachment_types:
        raise CannotReprocess("attachment.not_found")

    return ReprocessableEvent(event=event, data=data, attachments=attachments)


def reprocess_event(project_id, event_id, start_time):
    from sentry.ingest.consumer.processors import CACHE_TIMEOUT
    from sentry.tasks.store import preprocess_event_from_reprocessing

    reprocessable_event = pull_event_data(project_id, event_id)

    data = reprocessable_event.data
    event = reprocessable_event.event
    attachments = reprocessable_event.attachments

    # Step 1: Fix up the event payload for reprocessing and put it in event
    # cache/event_processing_store
    set_path(data, "contexts", "reprocessing", "original_issue_id", value=event.group_id)
    set_path(
        data, "contexts", "reprocessing", "original_primary_hash", value=event.get_primary_hash()
    )
    cache_key = event_processing_store.store(data)

    # Step 2: Copy attachments into attachment cache. Note that we can only
    # consider minidumps because filestore just stays as-is after reprocessing
    # (we simply update group_id on the EventAttachment models in post_process)
    attachment_objects = []

    files = {
        f.id: f
        for f in models.File.objects.filter(id__in=[ea.file_id for ea in attachments if ea.file_id])
    }

    for attachment_id, attachment in enumerate(attachments):
        with sentry_sdk.start_span(op="reprocess_event._copy_attachment_into_cache") as span:
            span.set_data("attachment_id", attachment.id)
            attachment_objects.append(
                _copy_attachment_into_cache(
                    attachment_id=attachment_id,
                    attachment=attachment,
                    file=files[attachment.file_id] if attachment.file_id else None,
                    cache_key=cache_key,
                    cache_timeout=CACHE_TIMEOUT,
                )
            )

    if attachment_objects:
        with sentry_sdk.start_span(op="reprocess_event.set_attachment_meta"):
            attachment_cache.set(cache_key, attachments=attachment_objects, timeout=CACHE_TIMEOUT)

    preprocess_event_from_reprocessing(
        cache_key=cache_key,
        start_time=start_time,
        event_id=event_id,
        data=data,
    )


def get_original_group_id(event):
    return get_path(event.data, "contexts", "reprocessing", "original_issue_id")


def get_original_primary_hash(event):
    return get_path(event.data, "contexts", "reprocessing", "original_primary_hash")


def _get_old_primary_hash_subset_key(project_id: int, group_id: int, primary_hash: str):
    return f"re2:tombstones:{{{project_id}:{group_id}:{primary_hash}}}"


def _send_delete_old_primary_hash_messages(
    client,
    project_id: int,
    group_id: int,
    old_primary_hashes: Sequence[str],
    force_flush_batch: bool,
):
    # Events for a group are split and bucketed by their primary hashes. If flushing is to be
    # performed on a per-group basis, the event count needs to be summed up across all buckets
    # belonging to a single group.
    event_count = 0
    for primary_hash in old_primary_hashes:
        key = _get_old_primary_hash_subset_key(project_id, group_id, primary_hash)
        event_count += client.llen(key)

    if (
        not force_flush_batch
        and event_count <= settings.SENTRY_REPROCESSING_REMAINING_EVENTS_BUF_SIZE
    ):
        return

    for primary_hash in old_primary_hashes:
        event_key = _get_old_primary_hash_subset_key(project_id, group_id, primary_hash)
        event_ids, from_date, to_date = pop_batched_events_from_redis(event_key)

        # Racing might be happening between two different tasks. Give up on the
        # task that's lagging behind by prematurely terminating flushing.
        if len(event_ids) == 0:
            logger.error("reprocessing2.buffered_delete_old_primary_hash.empty_batch")
            return

        from sentry import eventstream

        assert primary_hash is not None

        # In the worst case scenario, a group will have a 1:1 mapping of primary hashes to
        # events, which means 1 insert per event.
        # The overall performance of this will be marginally better than the unbatched version
        # if a group has a lot of old primary hashes.
        eventstream.tombstone_events_unsafe(
            project_id,
            event_ids,
            old_primary_hash=primary_hash,
            from_timestamp=from_date,
            to_timestamp=to_date,
        )

    # Try to track counts so if it turns out that tombstoned events trend towards a ratio of 1
    # event per hash, a different solution may need to be considered.
    ratio = 0 if len(old_primary_hashes) == 0 else event_count / len(old_primary_hashes)
    metrics.distribution(
        key="reprocessing2.buffered_delete_old_primary_hash.event_count",
        value=event_count,
    )
    metrics.distribution(
        key="reprocessing2.buffered_delete_old_primary_hash.primary_hash_count",
        value=len(old_primary_hashes),
    )
    metrics.distribution(
        key="reprocessing2.buffered_delete_old_primary_hash.primary_hash_to_event_ratio",
        value=ratio,
    )


def buffered_delete_old_primary_hash(
    project_id,
    group_id,
    event_id=None,
    datetime=None,
    old_primary_hash=None,
    current_primary_hash=None,
    force_flush_batch: bool = False,
):
    """
    In case the primary hash changed during reprocessing, we need to tell
    Snuba before reinserting the event. Snuba may then insert a tombstone row
    depending on whether the primary_hash is part of the PK/sortkey or not.

    Only when the primary_hash changed and is part of the sortkey, we need to
    explicitly tombstone the old row.

    If the primary_hash is not part of the PK/sortkey, or if the primary_hash
    did not change, nothing needs to be done as ClickHouse's table merge will
    merge the two rows together.

    Like `buffered_handle_remaining_events`, this is a quick and dirty way to
    batch event IDs so requests to tombstone rows are not being individually
    sent over to Snuba.

    This also includes the same constraints for optimal performance as
    `buffered_handle_remaining_events` in that events being fed to this should
    have datetimes as close to each other as possible. Unfortunately, this
    function is invoked by tasks that are run asynchronously and therefore the
    guarantee from `buffered_handle_remaining_events` regarding events being
    sorted by timestamps is not applicable here.

    This function also does not batch events which have different old primary
    hashes together into one operation. This means that if the data being fed
    in tends to have a 1:1 ratio of event:old primary hashes, then the buffering
    in this effectively does nothing.
    """

    from sentry import killswitches

    if killswitches.killswitch_matches_context(
        "reprocessing2.drop-delete-old-primary-hash", {"project_id": project_id}
    ):
        return

    client = _get_sync_redis_client()

    # This is a meta key that contains old primary hashes. These hashes are then
    # combined with other values to construct a key that points to a list of
    # tombstonable events.
    primary_hash_set_key = f"re2:tombstone-primary-hashes:{project_id}:{group_id}"
    old_primary_hashes = client.smembers(primary_hash_set_key)

    if old_primary_hash is not None and old_primary_hash != current_primary_hash:
        event_key = _get_old_primary_hash_subset_key(project_id, group_id, old_primary_hash)
        client.lpush(event_key, f"{to_timestamp(datetime)};{event_id}")
        client.expire(event_key, settings.SENTRY_REPROCESSING_TOMBSTONES_TTL)

        if old_primary_hash not in old_primary_hashes:
            old_primary_hashes.add(old_primary_hash)
            client.sadd(primary_hash_set_key, old_primary_hash)
            client.expire(primary_hash_set_key, settings.SENTRY_REPROCESSING_TOMBSTONES_TTL)

    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("project_id", project_id)
        scope.set_tag("old_group_id", group_id)
        scope.set_tag("old_primary_hash", old_primary_hash)

    with sentry_sdk.start_span(
        op="sentry.reprocessing2.buffered_delete_old_primary_hash.flush_events"
    ):
        _send_delete_old_primary_hash_messages(
            client, project_id, group_id, old_primary_hashes, force_flush_batch
        )


def _copy_attachment_into_cache(attachment_id, attachment, file, cache_key, cache_timeout):
    fp = file.getfile()
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

    expected_size = attachment.size or file.size
    assert size == expected_size

    return CachedAttachment(
        key=cache_key,
        id=attachment_id,
        name=attachment.name,
        # XXX: Not part of eventattachment model, but not strictly
        # necessary for processing
        content_type=None,
        type=attachment.type,
        chunks=chunk_index,
        size=size,
    )


def is_reprocessed_event(data):
    return bool(_get_original_issue_id(data))


def _get_original_issue_id(data):
    return get_path(data, "contexts", "reprocessing", "original_issue_id")


def _get_sync_redis_client():
    return redis_clusters.get(settings.SENTRY_REPROCESSING_SYNC_REDIS_CLUSTER)


def _get_sync_counter_key(group_id):
    return f"re2:count:{group_id}"


def _get_info_reprocessed_key(group_id):
    return f"re2:info:{group_id}"


def buffered_handle_remaining_events(
    project_id: int,
    old_group_id: int,
    new_group_id: int,
    datetime_to_event: List[Tuple[datetime, str]],
    remaining_events,
    force_flush_batch: bool = False,
):
    """
    A quick-and-dirty wrapper around `handle_remaining_events` that batches up
    event IDs in Redis. We need this because Snuba cannot handle many tiny
    messages and prefers big ones instead.

    For optimal performance, the datetimes should be close to each other. This
    "soft" precondition is fulfilled in `reprocess_group` by iterating through
    events in timestamp order.

    Ideally we'd have batching implemented via a service like buffers, but for
    more than counters.
    """

    client = _get_sync_redis_client()
    # We explicitly cluster by only project_id and group_id here such that our
    # RENAME command later succeeds.
    key = f"re2:remaining:{{{project_id}:{old_group_id}}}"

    if datetime_to_event:
        llen = client.lpush(
            key,
            *(f"{to_timestamp(datetime)};{event_id}" for datetime, event_id in datetime_to_event),
        )
        client.expire(key, settings.SENTRY_REPROCESSING_SYNC_TTL)
    else:
        llen = client.llen(key)

    if force_flush_batch or llen > settings.SENTRY_REPROCESSING_REMAINING_EVENTS_BUF_SIZE:
        new_key = f"{key}:{uuid.uuid4().hex}"

        try:
            # Rename `key` to a new temp key that is passed to celery task. We
            # use `renamenx` instead of `rename` only to detect UUID collisions.
            assert client.renamenx(key, new_key), "UUID collision for new_key?"
        except redis.exceptions.ResponseError:
            # `key` does not exist in Redis. `ResponseError` is a bit too broad
            # but it seems we'd have to do string matching on error message
            # otherwise.
            return

        from sentry.tasks.reprocessing2 import handle_remaining_events

        handle_remaining_events.delay(
            project_id=project_id,
            old_group_id=old_group_id,
            new_group_id=new_group_id,
            remaining_events=remaining_events,
            event_ids_redis_key=new_key,
        )


def pop_batched_events_from_redis(key):
    """
    For redis key pointing to a list of buffered events structured like
    `event id;datetime of event`, returns a list of event IDs, the
    earliest datetime, and the latest datetime.
    """
    client = _get_sync_redis_client()
    event_ids_batch = []
    min_datetime = None
    max_datetime = None

    for row in client.lrange(key, 0, -1):
        datetime_raw, event_id = row.split(";")
        datetime = to_datetime(float(datetime_raw))

        assert datetime is not None

        if min_datetime is None or datetime < min_datetime:
            min_datetime = datetime
        if max_datetime is None or datetime > max_datetime:
            max_datetime = datetime

        event_ids_batch.append(event_id)

    client.delete(key)

    return event_ids_batch, min_datetime, max_datetime


def mark_event_reprocessed(data=None, group_id=None, project_id=None, num_events=1):
    """
    This function is supposed to be unconditionally called when an event has
    finished reprocessing, regardless of whether it has been saved or not.
    """
    if data is not None:
        assert group_id is None
        assert project_id is None
        group_id = _get_original_issue_id(data)
        if group_id is None:
            return

        project_id = data["project"]

    client = _get_sync_redis_client()
    # refresh the TTL of the metadata:
    client.expire(_get_info_reprocessed_key(group_id), settings.SENTRY_REPROCESSING_SYNC_TTL)
    key = _get_sync_counter_key(group_id)
    client.expire(key, settings.SENTRY_REPROCESSING_SYNC_TTL)
    if client.decrby(key, num_events) == 0:
        from sentry.tasks.reprocessing2 import finish_reprocessing

        finish_reprocessing.delay(project_id=project_id, group_id=group_id)


def start_group_reprocessing(
    project_id, group_id, remaining_events, max_events=None, acting_user_id=None
):
    from django.db import transaction

    with transaction.atomic(router.db_for_write(models.Group)):
        group = models.Group.objects.get(id=group_id)
        original_status = group.status
        original_substatus = group.substatus
        if original_status == models.GroupStatus.REPROCESSING:
            # This is supposed to be a rather unlikely UI race when two people
            # click reprocessing in the UI at the same time.
            #
            # During reprocessing the button is greyed out.
            raise RuntimeError("Cannot reprocess group that is currently being reprocessed")

        original_short_id = group.short_id
        group.status = models.GroupStatus.REPROCESSING
        group.substatus = None
        # satisfy unique constraint of (project_id, short_id)
        # we manually tested that multiple groups with (project_id=1,
        # short_id=null) can exist in postgres
        group.short_id = None
        group.save()

        # Create a duplicate row that has the same attributes by nulling out
        # the primary key and saving
        group.pk = group.id = None
        new_group = group  # rename variable just to avoid confusion
        del group
        new_group.status = original_status
        new_group.substatus = original_substatus
        new_group.short_id = original_short_id

        # this will be incremented by either the events that are
        # reprocessed, or handle_remaining_events
        #
        # XXX(markus): times_seen etc are unlikely to be correct ootb,
        # especially if handle_remaining_events is used a lot.
        new_group.times_seen = 0

        new_group.save()

        # This migrates all models that are associated with a group but not
        # directly with an event, i.e. everything but event attachments and user
        # reports. Those other updates are run per-event (in
        # post-process-forwarder) to not cause too much load on pg.
        for model in GROUP_MODELS_TO_MIGRATE:
            model.objects.filter(group_id=group_id).update(group_id=new_group.id)

    # Get event counts of issue (for all environments etc). This was copypasted
    # and simplified from groupserializer.
    event_count = sync_count = snuba.aliased_query(
        aggregations=[["count()", "", "times_seen"]],  # select
        dataset=Dataset.Events,  # from
        conditions=[["group_id", "=", group_id], ["project_id", "=", project_id]],  # where
        referrer="reprocessing2.start_group_reprocessing",
    )["data"][0]["times_seen"]

    sentry_sdk.set_extra("event_count", event_count)

    if max_events is not None:
        event_count = min(max_events, event_count)

    # Create activity on *old* group as that will serve the landing page for our
    # reprocessing status
    #
    # Later the activity is migrated to the new group where it is used to serve
    # the success message.
    new_activity = models.Activity.objects.create(
        type=models.ActivityType.REPROCESS.value,
        project=new_group.project,
        ident=str(group_id),
        group_id=group_id,
        user_id=acting_user_id,
        data={"eventCount": event_count, "oldGroupId": group_id, "newGroupId": new_group.id},
    )

    # New Activity Timestamp
    date_created = new_activity.datetime

    client = _get_sync_redis_client()
    client.setex(_get_sync_counter_key(group_id), settings.SENTRY_REPROCESSING_SYNC_TTL, sync_count)
    client.setex(
        _get_info_reprocessed_key(group_id),
        settings.SENTRY_REPROCESSING_SYNC_TTL,
        json.dumps(
            {"dateCreated": date_created, "syncCount": sync_count, "totalEvents": event_count}
        ),
    )

    return new_group.id


def is_group_finished(group_id):
    """
    Checks whether a group has finished reprocessing.
    """

    pending, _ = get_progress(group_id)
    return pending <= 0


def get_progress(group_id, project_id=None):
    client = _get_sync_redis_client()
    pending_key = _get_sync_counter_key(group_id)
    pending = client.get(pending_key)
    ttl = client.ttl(pending_key)
    info = client.get(_get_info_reprocessed_key(group_id))
    if pending is None:
        logger.error("reprocessing2.missing_counter")
        return 0, None
    if info is None:
        logger.error("reprocessing2.missing_info")
        return 0, None

    # We expect reprocessing to make progress every now and then, by bumping the
    # TTL of the "counter" key. If that TTL wasn't bumped in a while, we just
    # assume that reprocessing is stuck, and will just call finish on it.
    if project_id is not None and ttl is not None and ttl > 0:
        default_ttl = settings.SENTRY_REPROCESSING_SYNC_TTL
        age = default_ttl - ttl
        if age > REPROCESSING_TIMEOUT:
            from sentry.tasks.reprocessing2 import finish_reprocessing

            finish_reprocessing.delay(project_id=project_id, group_id=group_id)

    info = json.loads(info)
    # Our internal sync counters are counting over *all* events, but the
    # progressbar in the frontend goes until max_events. Advance progressbar
    # proportionally.
    pending = int(int(pending) * info["totalEvents"] / float(info.get("syncCount") or 1))
    return pending, info
