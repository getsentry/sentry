import time
import uuid

import pytest

from sentry.event_manager import _save_aggregate
from sentry.eventstore.models import CalculatedHashes, Event
from sentry.models import Group, GroupHash


@pytest.fixture
def fast_save(default_project, task_runner):
    def inner(last_frame):
        data = {"timestamp": time.time(), "type": "error"}
        evt = Event(
            default_project.id,
            uuid.uuid4().hex,
            data=data,
        )

        with task_runner():
            return _save_aggregate(
                evt,
                hashes=CalculatedHashes(
                    hashes=["a" * 32, "b" * 32],
                    hierarchical_hashes=["c" * 32, "d" * 32, "e" * 32, last_frame * 32],
                    tree_labels=[
                        [{"function": "foo"}],
                        [{"function": "bar"}],
                        [{"function": "baz"}],
                        [{"function": "bam"}],
                    ],
                ),
                release=None,
                metadata={},
                received_timestamp=None,
                level=10,
                culprit="",
            )

    return inner


def _group_hashes(group_id):
    return {gh.hash for gh in GroupHash.objects.filter(group_id=group_id)}


def _assoc_hash(group, hash):
    gh = GroupHash.objects.get_or_create(project=group.project, hash=hash)[0]
    assert gh.group is None or gh.group.id != group.id
    gh.group = group
    gh.save()


@pytest.mark.django_db
def test_move_all_events(default_project, fast_save):
    group_info = fast_save("f")

    assert group_info.is_new
    assert not group_info.is_regression

    new_group_info = fast_save("f")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group_info.group.id

    _assoc_hash(group_info.group, "a" * 32)
    _assoc_hash(group_info.group, "b" * 32)

    assert _group_hashes(group_info.group.id) == {"a" * 32, "b" * 32, "c" * 32}
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

    assert _group_hashes(new_group_info.group.id) == {"c" * 32}
    assert Group.objects.get(id=new_group_info.group.id).title == "foo"


@pytest.mark.django_db
def test_partial_move(default_project, fast_save):
    group_info = fast_save("f")
    assert group_info.is_new
    assert not group_info.is_regression

    new_group_info = fast_save("g")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group_info.group.id

    assert _group_hashes(group_info.group.id) == {"c" * 32}

    # simulate split operation where event "f" of group is moved into a more specific hash
    group2 = Group.objects.create(project=default_project)
    f_hash = GroupHash.objects.create(project=default_project, hash="f" * 32, group_id=group2.id)

    new_group_info = fast_save("f")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group2.id

    assert _group_hashes(new_group_info.group.id) == {
        # one hierarchical hash associated
        # no flat hashes associated when sorting into split group!
        "f"
        * 32,
    }

    new_group_info = fast_save("g")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group_info.group.id

    assert _group_hashes(new_group_info.group.id) == {
        "c" * 32,
    }

    f_hash.delete()

    new_group_info = fast_save("f")
    assert not new_group_info.is_new
    assert not new_group_info.is_regression
    assert new_group_info.group.id == group_info.group.id
