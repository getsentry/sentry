from __future__ import absolute_import

import time
import uuid
import hashlib
import six

from sentry import nodestore, features
from sentry.eventstore.processing import event_processing_store


def _generate_unprocessed_event_node_id(project_id, event_id):
    return hashlib.md5(
        u"{}:{}:unprocessed".format(project_id, event_id).encode("utf-8")
    ).hexdigest()


def backup_unprocessed_event(project, event_id, data):
    """
    Save normalized event from Relay as backup in nodestore. Only call if
    processing or symbolication applies to this event.
    """
    if not features.has("projects:reprocessing-v2", project, actor=None):
        return

    node_id = _generate_unprocessed_event_node_id(project_id=project.id, event_id=event_id)
    nodestore.set(node_id, data)


def delete_unprocessed_events(events):
    node_ids = [
        _generate_unprocessed_event_node_id(event.project_id, event.event_id) for event in events
    ]
    nodestore.delete_multi(node_ids)


def reprocess_event(project_id, event_id):
    rv = reprocess_events(project_id, [event_id])
    return rv and rv[0] or None


def reprocess_events(project_id, event_ids, start_time):
    node_ids = list(
        _generate_unprocessed_event_node_id(project_id=project_id, event_id=event_id)
        for event_id in event_ids
    )

    node_results = nodestore.get_multi(node_ids)

    # TODO: Passthrough non-reprocessable events

    new_event_ids = []

    for node_id, data in six.iteritems(node_results):
        # Take unprocessed data from old event and save it as unprocessed data
        # under a new event ID. The second step happens in pre-process. We could
        # save the "original event ID" instead and get away with writing less to
        # nodestore, but doing it this way makes the logic slightly simpler.

        event_id = data["event_id"] = uuid.uuid4().hex
        data["received"] = start_time
        cache_key = event_processing_store.store(data)
        start_time = time.time()

        from sentry.tasks.store import preprocess_event_from_reprocessing

        preprocess_event_from_reprocessing(
            cache_key=cache_key, start_time=start_time, event_id=event_id
        )

        new_event_ids.append(event_id)

    return new_event_ids
