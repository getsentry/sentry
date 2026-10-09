from typing import Any

from sentry.event_manager import EventManager
from sentry.models.project import Project
from sentry.services.eventstore.models import Event
from sentry.testutils.helpers.task_runner import TaskRunner
from sentry.testutils.outbox import outbox_runner


def save_new_event(event_data: dict[str, Any], project: Project) -> Event:
    """
    Save a new event with the given data, returning the Event object.

    Note: Runs async tasks, like updating group metadata and synchronizing DB records between hybrid
    cloud silos, synchronously, so the results can be tested.
    """
    with (
        # This makes async tasks synchronous, by setting `TASKWORKER_ALWAYS_EAGER = True`.
        TaskRunner(),
        # This does a similar thing for syncing the DB across silos
        outbox_runner(),
    ):
        event = EventManager(event_data).save(project=project)

    return event
