from __future__ import absolute_import

import uuid
import hashlib
import six
import logging

from sentry import nodestore, features
from sentry.utils.cache import cache_key_for_event
from sentry.eventstore.processing import event_processing_store

logger = logging.getLogger("sentry.reprocessing")


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

    data = event_processing_store.get(
        cache_key_for_event({"project": project.id, "event_id": event_id}), unprocessed=True
    )
    if data is None:
        return

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


def reprocess_events(project_id, event_ids, start_time):
    node_ids = list(
        _generate_unprocessed_event_node_id(project_id=project_id, event_id=event_id)
        for event_id in event_ids
    )

    node_results = nodestore.get_multi(node_ids)

    # TODO: Passthrough non-reprocessable events

    new_event_ids = {}

    for node_id, data in six.iteritems(node_results):
        # Take unprocessed data from old event and save it as unprocessed data
        # under a new event ID. The second step happens in pre-process. We could
        # save the "original event ID" instead and get away with writing less to
        # nodestore, but doing it this way makes the logic slightly simpler.

        new_event_ids[data["event_id"]] = event_id = data["event_id"] = uuid.uuid4().hex
        # XXX: Only reset received
        data["timestamp"] = data["received"] = start_time
        data.setdefault("fingerprint", ["{{default}}"]).append("__sentry_reprocessed")

        cache_key = event_processing_store.store(data)

        from sentry.tasks.store import preprocess_event_from_reprocessing

        preprocess_event_from_reprocessing(
            cache_key=cache_key, start_time=start_time, event_id=event_id
        )

    return new_event_ids
