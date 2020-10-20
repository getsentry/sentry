from __future__ import absolute_import

from time import time
import pytest
import uuid

from sentry import eventstore
from sentry.models.group import Group
from sentry.event_manager import EventManager
from sentry.eventstore.processing import event_processing_store
from sentry.plugins.base.v2 import Plugin2
from sentry.reprocessing2 import is_group_finished
from sentry.tasks.reprocessing2 import reprocess_group
from sentry.tasks.store import preprocess_event
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import iso_format, before_now


@pytest.fixture(autouse=True)
def reprocessing_feature():
    with Feature({"projects:reprocessing-v2": True}):
        yield


@pytest.fixture
def process_and_save(default_project, task_runner):
    def inner(data):
        data.setdefault("timestamp", iso_format(before_now(seconds=1)))
        mgr = EventManager(data=data, project=default_project)
        mgr.normalize()
        data = mgr.get_data()
        event_id = data["event_id"]
        cache_key = event_processing_store.store(data)

        with task_runner():
            # factories.store_event would almost be suitable for this, but let's
            # actually run through stacktrace processing once
            preprocess_event(start_time=time(), cache_key=cache_key, data=data)

        return event_id

    return inner


@pytest.fixture
def register_event_preprocessor(register_plugin):
    def inner(f):
        class ReprocessingTestPlugin(Plugin2):
            def get_event_preprocessors(self, data):
                return [f]

            def is_enabled(self, project=None):
                return True

        register_plugin(globals(), ReprocessingTestPlugin)

    return inner


@pytest.mark.django_db
@pytest.mark.snuba
@pytest.mark.skip(reason="Some of these tests deadlock on CI")
@pytest.mark.parametrize("change_groups", (True, False), ids=("new_group", "same_group"))
def test_basic(
    task_runner,
    default_project,
    change_groups,
    reset_snuba,
    process_and_save,
    register_event_preprocessor,
    burst_task_runner,
):
    # Replace this with an int and nonlocal when we have Python 3
    abs_count = []

    @register_event_preprocessor
    def event_preprocessor(data):
        tags = data.setdefault("tags", [])
        assert all(not x or x[0] != "processing_counter" for x in tags)
        tags.append(("processing_counter", "x{}".format(len(abs_count))))
        abs_count.append(None)

        if change_groups:
            data["fingerprint"] = [uuid.uuid4().hex]
        else:
            data["fingerprint"] = ["foo"]

        return data

    event_id = process_and_save({"tags": [["key1", "value"], None, ["key2", "value"]]})

    def get_event_by_processing_counter(n):
        return list(
            eventstore.get_events(
                eventstore.Filter(
                    project_ids=[default_project.id],
                    conditions=[["tags[processing_counter]", "=", n]],
                )
            )
        )

    event = eventstore.get_event_by_id(default_project.id, event_id)
    assert event.get_tag("processing_counter") == "x0"
    assert not event.data.get("errors")

    assert get_event_by_processing_counter("x0")[0].event_id == event.event_id

    old_event = event

    with burst_task_runner() as burst:
        reprocess_group(default_project.id, event.group_id)

    burst()

    new_events = get_event_by_processing_counter("x1")

    (event,) = new_events

    # Assert original data is used
    assert event.get_tag("processing_counter") == "x1"
    assert not event.data.get("errors")

    if change_groups:
        assert event.get_hashes() != old_event.get_hashes()
    else:
        assert event.get_hashes() == old_event.get_hashes()

    assert event.group_id != old_event.group_id

    assert event.get_tag("original_event_id") == old_event.event_id
    assert int(event.get_tag("original_group_id")) == old_event.group_id

    assert not Group.objects.filter(id=old_event.group_id).exists()
    assert not eventstore.get_event_by_id(default_project.id, old_event.event_id)

    assert is_group_finished(old_event.group_id)


@pytest.mark.django_db
@pytest.mark.snuba
@pytest.mark.skip(reason="Some of these tests deadlock on CI")
def test_concurrent_events_go_into_new_group(
    default_project, reset_snuba, register_event_preprocessor, process_and_save, burst_task_runner
):
    @register_event_preprocessor
    def event_preprocessor(data):
        extra = data.setdefault("extra", {})
        extra.setdefault("processing_counter", 0)
        extra["processing_counter"] += 1
        return data

    event_id = process_and_save({"message": "hello world"})

    event = eventstore.get_event_by_id(default_project.id, event_id)

    with burst_task_runner() as burst_reprocess:
        reprocess_group(default_project.id, event.group_id)

    assert not is_group_finished(event.group_id)

    event_id2 = process_and_save({"message": "hello world"})
    event2 = eventstore.get_event_by_id(default_project.id, event_id2)
    assert event2.event_id != event.event_id
    assert event2.group_id != event.group_id

    burst_reprocess()

    (event3,) = eventstore.get_events(
        eventstore.Filter(
            project_ids=[default_project.id],
            conditions=[["tags[original_event_id]", "=", event_id]],
        )
    )

    assert is_group_finished(event.group_id)

    assert event2.group_id == event3.group_id
    assert event.get_hashes() == event2.get_hashes() == event3.get_hashes()


@pytest.mark.django_db
@pytest.mark.snuba
@pytest.mark.skip(reason="Some of these tests deadlock on CI")
def test_max_events(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
    task_runner,
    monkeypatch,
):
    @register_event_preprocessor
    def event_preprocessor(data):
        extra = data.setdefault("extra", {})
        extra.setdefault("processing_counter", 0)
        extra["processing_counter"] += 1
        return data

    event_id = process_and_save({"message": "hello world"})

    event = eventstore.get_event_by_id(default_project.id, event_id)

    # Make sure it never gets called
    monkeypatch.setattr("sentry.tasks.reprocessing2.reprocess_event", None)

    with task_runner():
        reprocess_group(default_project.id, event.group_id, max_events=0)

    assert is_group_finished(event.group_id)
