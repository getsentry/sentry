import logging
import time
import uuid
from unittest.mock import patch

import pytest

from sentry.event_manager import EventManager, _save_aggregate
from sentry.eventstore.models import Event
from sentry.grouping.result import CalculatedHashes
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.fixture
def fast_save(default_project, task_runner):
    def inner(last_frame):
        data = {"timestamp": time.time(), "type": "error"}
        evt = Event(
            default_project.id,
            uuid.uuid4().hex,
            data=data,
        )
        group_creation_kwargs = {"level": 10, "culprit": ""}
        hashes = CalculatedHashes(
            hashes=["a" * 32, "b" * 32],
            hierarchical_hashes=["c" * 32, "d" * 32, "e" * 32, last_frame * 32],
            tree_labels=[
                [
                    {
                        "function": "foo",
                        "package": "",
                        "is_sentinel": False,
                        "is_prefix": False,
                        "datapath": "",
                    }
                ],
                [
                    {
                        "function": "bar",
                        "package": "",
                        "is_sentinel": False,
                        "is_prefix": False,
                        "datapath": "",
                    }
                ],
                [
                    {
                        "function": "baz",
                        "package": "",
                        "is_sentinel": False,
                        "is_prefix": False,
                        "datapath": "",
                    }
                ],
                [
                    {
                        "function": "bam",
                        "package": "",
                        "is_sentinel": False,
                        "is_prefix": False,
                        "datapath": "",
                    }
                ],
            ],
        )

        with task_runner():
            with patch(
                "sentry.event_manager.get_hash_values",
                return_value=(hashes, hashes, hashes),
            ):
                with patch(
                    "sentry.event_manager._get_group_creation_kwargs",
                    return_value=group_creation_kwargs,
                ):
                    with patch("sentry.event_manager._materialize_metadata_many"):
                        return _save_aggregate(
                            evt,
                            job={"event_metadata": {}},
                            release=None,
                            received_timestamp=0,
                            metric_tags={},
                        )

    return inner


def get_hash_values_for_group(group_id):
    return {gh.hash for gh in GroupHash.objects.filter(group_id=group_id)}


def associate_group_with_hash(group, hash):
    gh = GroupHash.objects.get_or_create(project=group.project, hash=hash)[0]
    assert gh.group is None or gh.group.id != group.id
    gh.group = group
    gh.save()


def make_event(**kwargs):
    result = {
        "event_id": uuid.uuid1().hex,
        "level": logging.ERROR,
        "logger": "default",
        "tags": [],
    }
    result.update(kwargs)
    return result


@django_db_all
def test_move_all_events(default_project, fast_save):
    group_info = fast_save("f")

    assert group_info.is_new
    assert not group_info.is_regression

    new_group_info = fast_save("f")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group_info.group.id

    associate_group_with_hash(group_info.group, "a" * 32)
    associate_group_with_hash(group_info.group, "b" * 32)

    assert get_hash_values_for_group(group_info.group.id) == {"a" * 32, "b" * 32, "c" * 32}
    assert Group.objects.get(id=new_group_info.group.id).title == "foo"

    # simulate split operation where all events of group are moved into a more specific hash
    GroupHash.objects.filter(group=group_info.group).delete()
    GroupHash.objects.create(project=default_project, hash="f" * 32, group_id=group_info.group.id)

    new_group_info = fast_save("f")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group_info.group.id

    assert {g.hash for g in GroupHash.objects.filter(group=group_info.group)} == {
        # one hierarchical hash associated
        # no flat hashes associated when sorting into split group!
        "f"
        * 32,
    }

    assert Group.objects.get(id=new_group_info.group.id).title == "bam"

    new_group_info = fast_save("g")
    assert new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id != group_info.group.id

    assert get_hash_values_for_group(new_group_info.group.id) == {"c" * 32}
    assert Group.objects.get(id=new_group_info.group.id).title == "foo"


@django_db_all
def test_partial_move(default_project, fast_save):
    group_info = fast_save("f")
    assert group_info.is_new
    assert not group_info.is_regression

    new_group_info = fast_save("g")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group_info.group.id

    assert get_hash_values_for_group(group_info.group.id) == {"c" * 32}

    # simulate split operation where event "f" of group is moved into a more specific hash
    group2 = Group.objects.create(project=default_project)
    f_hash = GroupHash.objects.create(project=default_project, hash="f" * 32, group_id=group2.id)

    new_group_info = fast_save("f")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group2.id

    assert get_hash_values_for_group(new_group_info.group.id) == {
        # one hierarchical hash associated
        # no flat hashes associated when sorting into split group!
        "f"
        * 32,
    }

    new_group_info = fast_save("g")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group_info.group.id

    assert get_hash_values_for_group(new_group_info.group.id) == {
        "c" * 32,
    }

    f_hash.delete()

    new_group_info = fast_save("f")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group_info.group.id


class EventManagerGroupingTest(TestCase):
    def test_applies_secondary_grouping_hierarchical(self):
        project = self.project
        project.update_option("sentry:grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", 0)

        timestamp = time.time() - 300

        def save_event(ts_offset):
            ts = timestamp + ts_offset
            manager = EventManager(
                make_event(
                    message="foo 123",
                    event_id=hex(2**127 + int(ts))[-32:],
                    timestamp=ts,
                    exception={
                        "values": [
                            {
                                "type": "Hello",
                                "stacktrace": {
                                    "frames": [
                                        {
                                            "function": "not_in_app_function",
                                        },
                                        {
                                            "function": "in_app_function",
                                        },
                                    ]
                                },
                            }
                        ]
                    },
                )
            )
            manager.normalize()
            with self.tasks():
                return manager.save(project.id)

        event = save_event(0)

        project.update_option("sentry:grouping_config", "mobile:2021-02-12")
        project.update_option("sentry:secondary_grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_expiry", time.time() + (24 * 90 * 3600))

        # Switching to newstyle grouping changes hashes as 123 will be removed
        event2 = save_event(2)

        # make sure that events did get into same group because of fallback grouping, not because of hashes which come from primary grouping only
        assert not set(event.get_hashes().hashes) & set(event2.get_hashes().hashes)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group_id)

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime

        # After expiry, new events are still assigned to the same group:
        project.update_option("sentry:secondary_grouping_expiry", 0)
        event3 = save_event(4)
        assert event3.group_id == event2.group_id

    def test_applies_downgrade_hierarchical(self):
        project = self.project
        project.update_option("sentry:grouping_config", "mobile:2021-02-12")
        project.update_option("sentry:secondary_grouping_expiry", 0)

        timestamp = time.time() - 300

        def save_event(ts_offset):
            ts = timestamp + ts_offset
            manager = EventManager(
                make_event(
                    message="foo 123",
                    event_id=hex(2**127 + int(ts))[-32:],
                    timestamp=ts,
                    exception={
                        "values": [
                            {
                                "type": "Hello",
                                "stacktrace": {
                                    "frames": [
                                        {
                                            "function": "not_in_app_function",
                                        },
                                        {
                                            "function": "in_app_function",
                                        },
                                    ]
                                },
                            }
                        ]
                    },
                )
            )
            manager.normalize()
            with self.tasks():
                return manager.save(project.id)

        event = save_event(0)

        project.update_option("sentry:grouping_config", "legacy:2019-03-12")
        project.update_option("sentry:secondary_grouping_config", "mobile:2021-02-12")
        project.update_option("sentry:secondary_grouping_expiry", time.time() + (24 * 90 * 3600))

        # Switching to newstyle grouping changes hashes as 123 will be removed
        event2 = save_event(2)

        # make sure that events did get into same group because of fallback grouping, not because of hashes which come from primary grouping only
        assert not set(event.get_hashes().hashes) & set(event2.get_hashes().hashes)
        assert event.group_id == event2.group_id

        group = Group.objects.get(id=event.group_id)

        group_hashes = GroupHash.objects.filter(
            project=self.project, hash__in=event.get_hashes().hashes
        )
        assert group_hashes
        for hash in group_hashes:
            assert hash.group_id == event.group_id

        assert group.times_seen == 2
        assert group.last_seen == event2.datetime

        # After expiry, new events are still assigned to the same group:
        project.update_option("sentry:secondary_grouping_expiry", 0)
        event3 = save_event(4)
        assert event3.group_id == event2.group_id
