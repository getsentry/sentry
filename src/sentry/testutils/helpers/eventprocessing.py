from typing import Any

from sentry.event_manager import EventManager
from sentry.eventstore.models import Event
from sentry.eventstore.processing import event_processing_store
from sentry.models.project import Project
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.outbox import outbox_runner


def write_event_to_cache(event):
    cache_data = dict(event.data)
    cache_data["event_id"] = event.event_id
    cache_data["project"] = event.project_id
    return event_processing_store.store(cache_data)


def save_new_event(event_data: dict[str, Any], project: Project) -> Event:
    """
    Save a new event with the given data, returning the Event object.

    Note: Runs async tasks, like updating group metadata and synchronizing DB records between hybrid
    cloud silos, synchronously, so the results can be tested.
    """
    with (
        # This makes async tasks synchronous, by setting `CELERY_ALWAYS_EAGER = True`.
        TaskRunner(),
        # This does a similar thing for syncing the DB across silos
        outbox_runner(),
    ):
        event = EventManager(event_data).save(project.id)

    return event
