import uuid
from io import BytesIO
from time import time
from unittest import mock

import pytest

from sentry import eventstore
from sentry.attachments import attachment_cache
from sentry.event_manager import EventManager
from sentry.eventstore.processing import event_processing_store
from sentry.grouping.enhancer import Enhancements
from sentry.grouping.fingerprinting import FingerprintingRules
from sentry.models import (
    Activity,
    EventAttachment,
    File,
    Group,
    GroupAssignee,
    GroupRedirect,
    UserReport,
)
from sentry.plugins.base.v2 import Plugin2
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.reprocessing2 import is_group_finished
from sentry.tasks.reprocessing2 import reprocess_group
from sentry.tasks.store import preprocess_event
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.types.activity import ActivityType
from sentry.utils.cache import cache_key_for_event


def _create_event_attachment(evt, type):
    file = File.objects.create(name="foo", type=type)
    file.putfile(BytesIO(b"hello world"))
    EventAttachment.objects.create(
        event_id=evt.event_id,
        group_id=evt.group_id,
        project_id=evt.project_id,
        file_id=file.id,
        type=file.type,
        name="foo",
    )


def _create_user_report(evt):
    UserReport.objects.create(
        project_id=evt.project_id,
        event_id=evt.event_id,
        name="User",
    )


@pytest.fixture(autouse=True)
def reprocessing_feature(settings):
    settings.SENTRY_REPROCESSING_PAGE_SIZE = 1

    with Feature({"organizations:reprocessing-v2": True}):
        yield


@pytest.fixture
def process_and_save(default_project, task_runner):
    def inner(data, seconds_ago=1):
        # Set platform to native so all parts of reprocessing fire, symbolication will
        # not happen without this set to certain values
        data.setdefault("platform", "native")
        # Every request to snuba has a timestamp that's clamped in a curious way to
        # ensure data consistency
        data.setdefault("timestamp", iso_format(before_now(seconds=seconds_ago)))
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
@pytest.mark.parametrize("change_groups", (True, False), ids=("new_group", "same_group"))
def test_basic(
    task_runner,
    default_project,
    change_groups,
    reset_snuba,
    process_and_save,
    register_event_preprocessor,
    burst_task_runner,
    monkeypatch,
    django_cache,
):
    from sentry import eventstream

    tombstone_calls = []
    old_tombstone_fn = eventstream.tombstone_events_unsafe

    def tombstone_called(*args, **kwargs):
        tombstone_calls.append((args, kwargs))
        old_tombstone_fn(*args, **kwargs)

    monkeypatch.setattr("sentry.eventstream.tombstone_events_unsafe", tombstone_called)

    # Replace this with an int and nonlocal when we have Python 3
    abs_count = []

    @register_event_preprocessor
    def event_preprocessor(data):
        tags = data.setdefault("tags", [])
        assert all(not x or x[0] != "processing_counter" for x in tags)
        tags.append(("processing_counter", f"x{len(abs_count)}"))
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

    burst(max_jobs=100)

    (event,) = get_event_by_processing_counter("x1")

    # Assert original data is used
    assert event.get_tag("processing_counter") == "x1"
    assert not event.data.get("errors")

    if change_groups:
        assert event.get_hashes() != old_event.get_hashes()
    else:
        assert event.get_hashes() == old_event.get_hashes()

    assert event.group_id != old_event.group_id

    assert event.event_id == old_event.event_id
    assert int(event.data["contexts"]["reprocessing"]["original_issue_id"]) == old_event.group_id

    assert not Group.objects.filter(id=old_event.group_id).exists()

    assert is_group_finished(old_event.group_id)

    # Old event is actually getting tombstoned
    assert not get_event_by_processing_counter("x0")
    if change_groups:
        assert tombstone_calls == [
            (
                (default_project.id, [old_event.event_id]),
                {
                    "from_timestamp": old_event.datetime,
                    "old_primary_hash": old_event.get_primary_hash(),
                    "to_timestamp": old_event.datetime,
                },
            )
        ]
    else:
        assert not tombstone_calls


@pytest.mark.django_db
@pytest.mark.snuba
def test_concurrent_events_go_into_new_group(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
    burst_task_runner,
    default_user,
    django_cache,
):
    """
    Assert that both unmodified and concurrently inserted events go into "the
    new group", i.e. the successor of the reprocessed (old) group that
    inherited the group hashes.
    """

    @register_event_preprocessor
    def event_preprocessor(data):
        extra = data.setdefault("extra", {})
        extra.setdefault("processing_counter", 0)
        extra["processing_counter"] += 1
        return data

    event_id = process_and_save({"message": "hello world"})

    event = eventstore.get_event_by_id(default_project.id, event_id)
    original_short_id = event.group.short_id
    assert original_short_id
    original_issue_id = event.group.id

    original_assignee = GroupAssignee.objects.create(
        group_id=original_issue_id, project=default_project, user=default_user
    )

    with burst_task_runner() as burst_reprocess:
        reprocess_group(default_project.id, event.group_id)

    assert not is_group_finished(event.group_id)

    event_id2 = process_and_save({"message": "hello world"})
    event2 = eventstore.get_event_by_id(default_project.id, event_id2)
    assert event2.event_id != event.event_id
    assert event2.group_id != event.group_id

    burst_reprocess(max_jobs=100)

    event3 = eventstore.get_event_by_id(default_project.id, event_id)
    assert event3.event_id == event.event_id
    assert event3.group_id != event.group_id

    assert is_group_finished(event.group_id)

    assert event2.group_id == event3.group_id
    assert event.get_hashes() == event2.get_hashes() == event3.get_hashes()

    group = event3.group

    assert group.short_id == original_short_id
    assert GroupAssignee.objects.get(group=group) == original_assignee
    activity = Activity.objects.get(group=group, type=ActivityType.REPROCESS.value)
    assert activity.ident == str(original_issue_id)


@pytest.mark.django_db
@pytest.mark.snuba
@pytest.mark.parametrize("remaining_events", ["delete", "keep"])
@pytest.mark.parametrize("max_events", [2, None])
def test_max_events(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
    burst_task_runner,
    monkeypatch,
    remaining_events,
    max_events,
):
    @register_event_preprocessor
    def event_preprocessor(data):
        extra = data.setdefault("extra", {})
        extra.setdefault("processing_counter", 0)
        extra["processing_counter"] += 1
        return data

    event_ids = [
        process_and_save({"message": "hello world"}, seconds_ago=i + 1) for i in reversed(range(5))
    ]

    old_events = {
        event_id: eventstore.get_event_by_id(default_project.id, event_id) for event_id in event_ids
    }

    for evt in old_events.values():
        _create_user_report(evt)

    (group_id,) = {e.group_id for e in old_events.values()}

    with burst_task_runner() as burst:
        reprocess_group(
            default_project.id,
            group_id,
            max_events=max_events,
            remaining_events=remaining_events,
        )

    burst(max_jobs=100)

    event = None
    for i, event_id in enumerate(event_ids):
        event = eventstore.get_event_by_id(default_project.id, event_id)
        if max_events is not None and i < (len(event_ids) - max_events):
            if remaining_events == "delete":
                assert event is None
            elif remaining_events == "keep":
                assert event.group_id != group_id
                assert dict(event.data) == dict(old_events[event_id].data)
                assert (
                    UserReport.objects.get(
                        project_id=default_project.id, event_id=event_id
                    ).group_id
                    != group_id
                )
            else:
                raise ValueError(remaining_events)
        else:
            assert event.group_id != group_id
            assert int(event.data["contexts"]["reprocessing"]["original_issue_id"]) == group_id
            assert dict(event.data) != dict(old_events[event_id].data)

    if remaining_events == "delete":
        assert event.group.times_seen == (max_events or 5)
    elif remaining_events == "keep":
        assert event.group.times_seen == 5
    else:
        raise ValueError(remaining_events)

    assert is_group_finished(group_id)


@pytest.mark.django_db
@pytest.mark.snuba
def test_attachments_and_userfeedback(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
    burst_task_runner,
    monkeypatch,
):
    @register_event_preprocessor
    def event_preprocessor(data):
        extra = data.setdefault("extra", {})
        extra.setdefault("processing_counter", 0)
        extra["processing_counter"] += 1

        cache_key = cache_key_for_event(data)
        attachments = attachment_cache.get(cache_key)
        extra.setdefault("attachments", []).append([attachment.type for attachment in attachments])

        return data

    # required such that minidump is loaded into attachments cache
    MINIDUMP_PLACEHOLDER = {
        "platform": "native",
        "exception": {"values": [{"mechanism": {"type": "minidump"}, "type": "test bogus"}]},
    }

    event_id_to_delete = process_and_save(
        {"message": "hello world", **MINIDUMP_PLACEHOLDER}, seconds_ago=5
    )
    event_to_delete = eventstore.get_event_by_id(default_project.id, event_id_to_delete)

    event_id = process_and_save(
        {"message": "hello world", "platform": "native", **MINIDUMP_PLACEHOLDER}
    )
    event = eventstore.get_event_by_id(default_project.id, event_id)

    for evt in (event, event_to_delete):
        for type in ("event.attachment", "event.minidump"):
            _create_event_attachment(evt, type)

        _create_user_report(evt)

    with burst_task_runner() as burst:
        reprocess_group(default_project.id, event.group_id, max_events=1)

    burst(max_jobs=100)

    new_event = eventstore.get_event_by_id(default_project.id, event_id)
    assert new_event.group_id != event.group_id

    assert new_event.data["extra"]["attachments"] == [["event.minidump"]]

    att, mdmp = EventAttachment.objects.filter(project_id=default_project.id).order_by("type")
    assert att.group_id == mdmp.group_id == new_event.group_id
    assert att.event_id == mdmp.event_id == event_id
    assert att.type == "event.attachment"
    assert mdmp.type == "event.minidump"

    (rep,) = UserReport.objects.filter(project_id=default_project.id)
    assert rep.group_id == new_event.group_id
    assert rep.event_id == event_id

    assert is_group_finished(event.group_id)


@pytest.mark.django_db
@pytest.mark.snuba
@pytest.mark.parametrize("remaining_events", ["keep", "delete"])
def test_nodestore_missing(
    default_project,
    reset_snuba,
    process_and_save,
    burst_task_runner,
    monkeypatch,
    remaining_events,
    django_cache,
):
    logs = []
    monkeypatch.setattr("sentry.reprocessing2.logger.error", logs.append)

    event_id = process_and_save({"message": "hello world", "platform": "python"})
    event = eventstore.get_event_by_id(default_project.id, event_id)
    old_group = event.group

    with burst_task_runner() as burst:
        reprocess_group(
            default_project.id, event.group_id, max_events=1, remaining_events=remaining_events
        )

    burst(max_jobs=100)

    assert is_group_finished(event.group_id)

    new_event = eventstore.get_event_by_id(default_project.id, event_id)

    if remaining_events == "delete":
        assert new_event is None
    else:
        assert not new_event.data.get("errors")
        assert new_event.group_id != event.group_id

        assert new_event.group.times_seen == 1

        assert not Group.objects.filter(id=old_group.id).exists()
        assert (
            GroupRedirect.objects.get(previous_group_id=old_group.id).group_id == new_event.group_id
        )

    assert logs == ["reprocessing2.unprocessed_event.not_found"]


@pytest.mark.django_db
@pytest.mark.snuba
def test_apply_new_fingerprinting_rules(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
    burst_task_runner,
):
    """
    Assert that after changing fingerprinting rules, the new fingerprinting config
    is respected by reprocessing.
    """

    @register_event_preprocessor
    def event_preprocessor(data):
        extra = data.setdefault("extra", {})
        extra.setdefault("processing_counter", 0)
        extra["processing_counter"] += 1
        return data

    event_id1 = process_and_save({"message": "hello world 1"})
    event_id2 = process_and_save({"message": "hello world 2"})

    event1 = eventstore.get_event_by_id(default_project.id, event_id1)
    event2 = eventstore.get_event_by_id(default_project.id, event_id2)

    # Same group, because grouping scrubs integers from message:
    assert event1.group.id == event2.group.id
    original_issue_id = event1.group.id
    assert event1.group.message == "hello world 2"

    # Change fingerprinting rules
    new_rules = FingerprintingRules.from_config_string(
        """
    message:"hello world 1" -> hw1 title="HW1"
    """
    )

    with mock.patch(
        "sentry.event_manager.get_fingerprinting_config_for_project", return_value=new_rules
    ):
        # Reprocess
        with burst_task_runner() as burst_reprocess:
            reprocess_group(default_project.id, event1.group_id)
        burst_reprocess(max_jobs=100)

    assert is_group_finished(event1.group_id)

    # Events should now be in different groups:
    event1 = eventstore.get_event_by_id(default_project.id, event_id1)
    event2 = eventstore.get_event_by_id(default_project.id, event_id2)
    assert event1.group.id != original_issue_id
    assert event1.group.id != event2.group.id
    assert event1.group.message == "hello world 1 HW1"
    assert event2.group.message == "hello world 2"


@pytest.mark.django_db
@pytest.mark.snuba
def test_apply_new_stack_trace_rules(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
    burst_task_runner,
):
    """
    Assert that after changing stack trace rules, the new grouping config
    is respected by reprocessing.
    """

    @register_event_preprocessor
    def event_preprocessor(data):
        extra = data.setdefault("extra", {})
        extra.setdefault("processing_counter", 0)
        extra["processing_counter"] += 1
        return data

    event_id1 = process_and_save(
        {
            "platform": "native",
            "stacktrace": {
                "frames": [
                    {
                        "function": "a",
                    },
                    {
                        "function": "b",
                    },
                ]
            },
        }
    )
    event_id2 = process_and_save(
        {
            "platform": "native",
            "stacktrace": {
                "frames": [
                    {
                        "function": "a",
                    },
                    {
                        "function": "b",
                    },
                    {
                        "function": "c",
                    },
                ]
            },
        }
    )

    event1 = eventstore.get_event_by_id(default_project.id, event_id1)
    event2 = eventstore.get_event_by_id(default_project.id, event_id2)

    original_grouping_config = event1.data["grouping_config"]

    # Different group, because different stack trace
    assert event1.group.id != event2.group.id
    original_issue_id = event1.group.id

    with mock.patch(
        "sentry.event_manager.get_grouping_config_dict_for_project",
        return_value={
            "id": DEFAULT_GROUPING_CONFIG,
            "enhancements": Enhancements.from_config_string(
                "function:c -group",
                bases=[],
            ).dumps(),
        },
    ):
        # Reprocess
        with burst_task_runner() as burst_reprocess:
            reprocess_group(default_project.id, event1.group_id)
            reprocess_group(default_project.id, event2.group_id)
        burst_reprocess(max_jobs=100)

    assert is_group_finished(event1.group_id)
    assert is_group_finished(event2.group_id)

    # Events should now be in same group because of stack trace rule
    event1 = eventstore.get_event_by_id(default_project.id, event_id1)
    event2 = eventstore.get_event_by_id(default_project.id, event_id2)
    assert event1.group.id != original_issue_id
    assert event1.group.id == event2.group.id

    assert event1.data["grouping_config"] != original_grouping_config
