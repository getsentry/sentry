from __future__ import annotations

import uuid
from io import BytesIO
from time import time
from unittest import mock

import pytest

from sentry import eventstore
from sentry.attachments import attachment_cache
from sentry.event_manager import EventManager
from sentry.eventstore.models import Event
from sentry.eventstore.processing import event_processing_store
from sentry.grouping.enhancer import Enhancements
from sentry.grouping.fingerprinting import FingerprintingRules
from sentry.models.activity import Activity
from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupredirect import GroupRedirect
from sentry.models.userreport import UserReport
from sentry.plugins.base.v2 import Plugin2
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.reprocessing2 import is_group_finished
from sentry.tasks.reprocessing2 import finish_reprocessing, reprocess_group
from sentry.tasks.store import preprocess_event
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.task_runner import BurstTaskRunner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.utils.cache import cache_key_for_event

pytestmark = [requires_snuba]


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
        size=file.size,
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

    yield


@pytest.fixture
def process_and_save(default_project, task_runner):
    def inner(data, seconds_ago=1):
        # Set platform to native so all parts of reprocessing fire, symbolication will
        # not happen without this set to certain values
        data.setdefault("platform", "native")
        # Every request to snuba has a timestamp that's clamped in a curious way to
        # ensure data consistency
        data.setdefault(
            "timestamp", before_now(seconds=seconds_ago).replace(microsecond=0).isoformat()
        )
        mgr = EventManager(data=data, project=default_project)
        mgr.normalize()
        data = mgr.get_data()
        event_id = data["event_id"]
        cache_key = event_processing_store.store(dict(data))

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


@django_db_all
@pytest.mark.snuba
@pytest.mark.parametrize("change_groups", (True, False), ids=("new_group", "same_group"))
def test_basic(
    task_runner,
    default_project,
    change_groups,
    reset_snuba,
    process_and_save,
    register_event_preprocessor,
    monkeypatch,
    django_cache,
):
    from sentry import eventstream

    tombstone_calls = []
    old_tombstone_fn = eventstream.backend.tombstone_events_unsafe

    def tombstone_called(*args, **kwargs):
        tombstone_calls.append((args, kwargs))
        old_tombstone_fn(*args, **kwargs)

    monkeypatch.setattr("sentry.eventstream.backend.tombstone_events_unsafe", tombstone_called)

    abs_count = 0

    @register_event_preprocessor
    def event_preprocessor(data):
        nonlocal abs_count

        tags = data.setdefault("tags", [])
        assert all(not x or x[0] != "processing_counter" for x in tags)
        tags.append(("processing_counter", f"x{abs_count}"))
        abs_count += 1

        if change_groups:
            data["fingerprint"] = [uuid.uuid4().hex]
        else:
            data["fingerprint"] = ["foo"]

        return data

    event_id = process_and_save({"tags": [["key1", "value"], None, ["key2", "value"]]})

    def get_event_by_processing_counter(n: str) -> list[Event]:
        return list(
            eventstore.backend.get_events(
                eventstore.Filter(
                    project_ids=[default_project.id],
                    conditions=[["tags[processing_counter]", "=", n]],
                ),
                tenant_ids={"organization_id": 1234, "referrer": "eventstore.get_events"},
            )
        )

    event = eventstore.backend.get_event_by_id(
        default_project.id,
        event_id,
        tenant_ids={"organization_id": 1234, "referrer": "eventstore.get_events"},
    )
    assert event is not None
    assert event.get_tag("processing_counter") == "x0"
    assert not event.data.get("errors")

    assert get_event_by_processing_counter("x0")[0].event_id == event.event_id

    old_event = event

    with BurstTaskRunner() as burst:
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


@django_db_all
@pytest.mark.snuba
def test_concurrent_events_go_into_new_group(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
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

    event = eventstore.backend.get_event_by_id(default_project.id, event_id)
    assert event is not None
    assert event.group is not None
    original_short_id = event.group.short_id
    assert original_short_id
    original_issue_id = event.group.id

    original_assignee = GroupAssignee.objects.create(
        group_id=original_issue_id, project=default_project, user_id=default_user.id
    )

    with BurstTaskRunner() as burst_reprocess:
        reprocess_group(default_project.id, event.group_id)

        assert event.group_id is not None
        assert not is_group_finished(event.group_id)

        # this triggers an async task as well: allow it to complete
        with burst_reprocess.temporarily_enable_normal_task_processing():
            event_id2 = process_and_save({"message": "hello world"})

        event2 = eventstore.backend.get_event_by_id(default_project.id, event_id2)
        assert event2 is not None
        assert event2.event_id != event.event_id
        assert event2.group_id != event.group_id

        burst_reprocess(max_jobs=100)

    event3 = eventstore.backend.get_event_by_id(default_project.id, event_id)
    assert event3 is not None
    assert event3.group is not None
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


@django_db_all
@pytest.mark.snuba
@pytest.mark.parametrize("remaining_events", ["delete", "keep"])
@pytest.mark.parametrize("max_events", [2, None])
def test_max_events(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
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

    old_events = {}
    for event_id in event_ids:
        old_event = eventstore.backend.get_event_by_id(default_project.id, event_id)
        assert old_event is not None
        old_events[event_id] = old_event

    for evt in old_events.values():
        _create_user_report(evt)

    (group_id,) = {e.group_id for e in old_events.values()}
    assert group_id is not None

    with BurstTaskRunner() as burst:
        reprocess_group(
            default_project.id,
            group_id,
            max_events=max_events,
            remaining_events=remaining_events,
        )

        burst(max_jobs=100)

    for i, event_id in enumerate(event_ids):
        event = eventstore.backend.get_event_by_id(default_project.id, event_id)
        if max_events is not None and i < (len(event_ids) - max_events):
            if remaining_events == "delete":
                assert event is None
            elif remaining_events == "keep":
                assert event is not None
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
            assert event is not None
            assert event.group_id != group_id
            assert int(event.data["contexts"]["reprocessing"]["original_issue_id"]) == group_id
            assert dict(event.data) != dict(old_events[event_id].data)

    if remaining_events == "delete":
        assert event is not None
        assert event.group is not None
        assert event.group.times_seen == (max_events or 5)
    elif remaining_events == "keep":
        assert event is not None
        assert event.group is not None
        assert event.group.times_seen == 5
    else:
        raise ValueError(remaining_events)

    assert is_group_finished(group_id)


@django_db_all
@pytest.mark.snuba
def test_attachments_and_userfeedback(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
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
    event_to_delete = eventstore.backend.get_event_by_id(default_project.id, event_id_to_delete)

    event_id = process_and_save(
        {"message": "hello world", "platform": "native", **MINIDUMP_PLACEHOLDER}
    )
    event = eventstore.backend.get_event_by_id(default_project.id, event_id)
    assert event is not None

    for evt in (event, event_to_delete):
        for type in ("event.attachment", "event.minidump"):
            _create_event_attachment(evt, type)

        _create_user_report(evt)

    with BurstTaskRunner() as burst:
        reprocess_group(default_project.id, event.group_id, max_events=1)

        burst(max_jobs=100)

    new_event = eventstore.backend.get_event_by_id(default_project.id, event_id)
    assert new_event is not None
    assert new_event.group_id is not None
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

    assert event.group_id is not None
    assert is_group_finished(event.group_id)


@django_db_all
@pytest.mark.snuba
@pytest.mark.parametrize("remaining_events", ["keep", "delete"])
@mock.patch("sentry.reprocessing2.logger")
def test_nodestore_missing(
    mock_logger,
    default_project,
    reset_snuba,
    process_and_save,
    monkeypatch,
    remaining_events,
    django_cache,
):

    event_id = process_and_save({"message": "hello world", "platform": "python"})
    event = eventstore.backend.get_event_by_id(default_project.id, event_id)
    assert event is not None
    assert event.group is not None
    old_group = event.group

    with BurstTaskRunner() as burst:
        reprocess_group(
            default_project.id, event.group_id, max_events=1, remaining_events=remaining_events
        )

        burst(max_jobs=100)

    assert event.group_id is not None
    assert is_group_finished(event.group_id)

    new_event = eventstore.backend.get_event_by_id(default_project.id, event_id)

    if remaining_events == "delete":
        assert new_event is None
    else:
        assert new_event is not None
        assert new_event.group is not None
        assert not new_event.data.get("errors")
        assert new_event.group_id != event.group_id

        assert new_event.group.times_seen == 1

        assert not Group.objects.filter(id=old_group.id).exists()
        assert (
            GroupRedirect.objects.get(previous_group_id=old_group.id).group_id == new_event.group_id
        )

    mock_logger.error.assert_called_once_with("reprocessing2.%s", "unprocessed_event.not_found")


@django_db_all
@pytest.mark.snuba
def test_apply_new_fingerprinting_rules(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
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

    event1 = eventstore.backend.get_event_by_id(default_project.id, event_id1)
    event2 = eventstore.backend.get_event_by_id(default_project.id, event_id2)
    assert event1 is not None
    assert event2 is not None
    assert event1.group is not None
    assert event2.group is not None

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
        "sentry.grouping.ingest.hashing.get_fingerprinting_config_for_project",
        return_value=new_rules,
    ):
        # Reprocess
        with BurstTaskRunner() as burst_reprocess:
            reprocess_group(default_project.id, event1.group_id)
            burst_reprocess(max_jobs=100)

    assert event1.group_id is not None
    assert is_group_finished(event1.group_id)

    # Events should now be in different groups
    event1 = eventstore.backend.get_event_by_id(default_project.id, event_id1)
    event2 = eventstore.backend.get_event_by_id(default_project.id, event_id2)
    assert event1 is not None
    assert event2 is not None
    assert event1.group is not None
    assert event2.group is not None
    # Both events end up with new group ids because the entire group is reprocessed, so even though
    # nothing has changed for event2, it's still put into a new group
    assert event1.group.id != original_issue_id
    assert event2.group.id != original_issue_id
    assert event1.group.id != event2.group.id
    # The group `message` value is taken from the `search_message` attribute, which is basically
    # just all the event's `metadata` entries shoved together (so that they can all be searhed on -
    # hence the name). Thus group1 includes both the event's message and its title.
    assert event1.group.message == "hello world 1 HW1"
    assert event2.group.message == "hello world 2"


@django_db_all
@pytest.mark.snuba
def test_apply_new_stack_trace_rules(
    default_project,
    reset_snuba,
    register_event_preprocessor,
    process_and_save,
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

    event1 = eventstore.backend.get_event_by_id(default_project.id, event_id1)
    event2 = eventstore.backend.get_event_by_id(default_project.id, event_id2)
    assert event1 is not None
    assert event2 is not None
    assert event1.group is not None
    assert event2.group is not None

    original_grouping_config = event1.data["grouping_config"]

    # Different group, because different stack trace
    assert event1.group.id != event2.group.id
    original_issue_id = event1.group.id

    with mock.patch(
        "sentry.grouping.ingest.hashing.get_grouping_config_dict_for_project",
        return_value={
            "id": DEFAULT_GROUPING_CONFIG,
            "enhancements": Enhancements.from_config_string(
                "function:c -group",
                bases=[],
            ).dumps(),
        },
    ):
        # Reprocess
        with BurstTaskRunner() as burst_reprocess:
            reprocess_group(default_project.id, event1.group_id)
            reprocess_group(default_project.id, event2.group_id)
            burst_reprocess(max_jobs=100)

    assert event1.group_id is not None
    assert event2.group_id is not None
    assert is_group_finished(event1.group_id)
    assert is_group_finished(event2.group_id)

    # Events should now be in same group because of stack trace rule
    event1 = eventstore.backend.get_event_by_id(default_project.id, event_id1)
    event2 = eventstore.backend.get_event_by_id(default_project.id, event_id2)
    assert event1 is not None
    assert event2 is not None
    assert event1.group is not None
    assert event2.group is not None
    assert event1.group.id != original_issue_id
    assert event1.group.id == event2.group.id

    assert event1.data["grouping_config"] != original_grouping_config


@django_db_all
def test_finish_reprocessing(default_project):
    # Pretend that the old group has more than one activity still connected:
    old_group = Group.objects.create(project=default_project)
    new_group = Group.objects.create(project=default_project)
    new_group2 = Group.objects.create(project=default_project)

    old_group.activity_set.create(
        project=default_project,
        type=ActivityType.REPROCESS.value,
        data={"newGroupId": new_group.id},
    )
    old_group.activity_set.create(project=default_project, type=ActivityType.NOTE.value)

    old_group.activity_set.create(
        project=default_project,
        type=ActivityType.REPROCESS.value,
        data={"newGroupId": new_group2.id},
    )

    finish_reprocessing(old_group.project_id, old_group.id)

    redirects = list(
        GroupRedirect.objects.filter(
            previous_group_id=old_group.id,
        )
    )
    assert len(redirects) == 1
    assert redirects[0].group_id == new_group.id
