from __future__ import absolute_import

import time
import uuid
import hashlib

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


def delete_unprocessed_event(project_id, event_id):
    node_id = _generate_unprocessed_event_node_id(project_id=project_id, event_id=event_id)
    nodestore.delete(node_id)


def reprocess_event(project_id, event_id):
    node_id = _generate_unprocessed_event_node_id(project_id=project_id, event_id=event_id)
    data = nodestore.get(node_id)
    if data is None:
        return

    # Take unprocessed data from old event and save it as unprocessed data
    # under a new event ID. The second step happens in pre-process. We could
    # save the "original event ID" instead and get away with writing less to
    # nodestore, but doing it this way makes the logic slightly simpler.

    event_id = data["event_id"] = uuid.uuid4().hex
    cache_key = event_processing_store.store(data)
    start_time = time.time()

    from sentry.tasks.store import preprocess_event_from_reprocessing

    preprocess_event_from_reprocessing.delay(
        cache_key=cache_key, start_time=start_time, event_id=event_id
    )

    return event_id
