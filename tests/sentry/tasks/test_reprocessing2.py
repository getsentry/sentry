from __future__ import absolute_import

from time import time
import pytest

from sentry import eventstore
from sentry.event_manager import EventManager
from sentry.eventstore.processing import event_processing_store
from sentry.plugins.base.v2 import Plugin2
from sentry.tasks.reprocessing2 import reprocess_group
from sentry.tasks.store import preprocess_event
from sentry.testutils.helpers import Feature


@pytest.mark.django_db
def test_basic(task_runner, default_project, register_plugin):
    def event_preprocessor(data):
        data.setdefault("test_processed", 0)
        data["test_processed"] += 1
        return data

    class ReprocessingTestPlugin(Plugin2):
        def get_event_preprocessors(self, data):
            return [event_preprocessor]

        def is_enabled(self, project=None):
            return True

    register_plugin(globals(), ReprocessingTestPlugin)

    mgr = EventManager(data={}, project=default_project)
    mgr.normalize()
    data = mgr.get_data()
    event_id = data["event_id"]
    cache_key = event_processing_store.store(data)

    with task_runner(), Feature({"projects:reprocessing-v2": True}):
        preprocess_event(start_time=time(), cache_key=cache_key, data=data)

    event = eventstore.get_event_by_id(default_project.id, event_id)

    assert event
    assert event.data["test_processed"] == 1
    assert not event.data.get("errors")

    with task_runner(), Feature({"projects:reprocessing-v2": True}):
        new_event_id = reprocess_group(default_project.id, event.group_id)

    assert new_event_id != event_id

    event = eventstore.get_event_by_id(default_project.id, event_id)

    assert event
    # Assert original data is used
    assert event.data["test_processed"] == 1
    assert not event.data.get("errors")

    # TODO: Assert old event is deleted
