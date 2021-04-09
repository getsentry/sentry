import time
import uuid

import pytest

from sentry.api.endpoints.group_split import _split_group, _unsplit_group
from sentry.event_manager import _save_aggregate
from sentry.eventstore.models import Event
from sentry.models import Group, GroupHash


@pytest.fixture
def fast_save(default_project):
    def inner(last_frame):
        hierarchical_hashes = ["c" * 32, "d" * 32, "e" * 32, last_frame * 32]
        data = {"timestamp": time.time(), "hierarchical_hashes": hierarchical_hashes}
        evt = Event(
            default_project.id,
            uuid.uuid4().hex,
            data=data,
        )

        group, is_new, is_regression = _save_aggregate(
            evt,
            flat_hashes=["a" * 32, "b" * 32],
            hierarchical_hashes=hierarchical_hashes,
            release=None,
            data=data,
            level=10,
            culprit="",
        )

        group.get_latest_event = lambda: evt

        return group, is_new, is_regression

    return inner


def _group_hashes(group_id):
    return {gh.hash for gh in GroupHash.objects.filter(group_id=group_id)}


def _assoc_hash(group, hash):
    gh = GroupHash.objects.get_or_create(project=group.project, hash=hash)[0]
    assert gh.group is None or gh.group.id != group.id
    gh.group = group
    gh.save()


@pytest.mark.django_db
def test_grouphash_split(default_project, fast_save):
    group, is_new, is_regression = fast_save("f")
    group2, is_new, is_regression = fast_save("g")
    assert group.id == group2.id
    _assoc_hash(group, "a" * 32)
    _assoc_hash(group, "b" * 32)
    assert _group_hashes(group.id) == {"a" * 32, "b" * 32, "c" * 32}

    print("gh update")

    _split_group(group, "c" * 32, ["c" * 32, "d" * 32, "e" * 32, "f" * 32])

    # Assert that a newly inserted event honors the grouphash split and creates its own new group

    group3, is_new, is_regression = fast_save("g")
    assert is_new
    assert group3.id != group2.id
    assert _group_hashes(group3.id) == {"d" * 32}
    assert _group_hashes(group2.id) == {"a" * 32, "b" * 32}

    GroupHash.objects.all().update(group_id=None)

    # Assert that after clearing all flat hashes, they are re-associated correctly.

    group4, is_new, is_regression = fast_save("g")
    assert is_new
    assert group4.id != group3.id
    assert _group_hashes(group4.id) == {"d" * 32}

    # Assert that unsplitting deletes the associated grouphash from group4 and
    # sorts the new event into a new group5 that has the parent grouphash
    # associated.

    _unsplit_group(group4, "d" * 32, ["c" * 32, "d" * 32, "e" * 32, "f" * 32])

    group5, is_new, is_regression = fast_save("g")
    assert is_new
    assert group5.id != group.id
    assert group5.id != group4.id
    assert _group_hashes(group5.id) == {"c" * 32}
    assert _group_hashes(group4.id) == set()


@pytest.mark.django_db
def test_move_all_events(default_project, fast_save):
    group, is_new, is_regression = fast_save("f")

    assert is_new
    assert not is_regression

    new_group, is_new, is_regression = fast_save("f")
    assert not is_new
    assert not is_regression
    assert new_group.id == group.id

    _assoc_hash(group, "a" * 32)
    _assoc_hash(group, "b" * 32)

    assert _group_hashes(group.id) == {"a" * 32, "b" * 32, "c" * 32}

    # simulate split operation where all events of group are moved into a more specific hash
    GroupHash.objects.filter(group=group).delete()
    GroupHash.objects.create(project=default_project, hash="f" * 32, group_id=group.id)

    new_group, is_new, is_regression = fast_save("f")
    assert not is_new
    assert not is_regression
    assert new_group.id == group.id

    assert {g.hash for g in GroupHash.objects.filter(group=group)} == {
        # one hierarchical hash associated
        # no flat hashes associated when sorting into split group!
        "f"
        * 32,
    }

    new_group, is_new, is_regression = fast_save("g")
    assert is_new
    assert not is_regression
    assert new_group.id != group.id

    assert _group_hashes(new_group.id) == {"c" * 32}


@pytest.mark.django_db
def test_partial_move(default_project, fast_save):
    group, is_new, is_regression = fast_save("f")
    assert is_new
    assert not is_regression

    new_group, is_new, is_regression = fast_save("g")
    assert not is_new
    assert not is_regression
    assert new_group.id == group.id

    assert _group_hashes(group.id) == {"c" * 32}
    _assoc_hash(group, "a" * 32)
    _assoc_hash(group, "b" * 32)
    assert _group_hashes(group.id) == {"a" * 32, "b" * 32, "c" * 32}

    # simulate split operation where event "f" of group is moved into a more specific hash
    group2 = Group.objects.create(project=default_project)
    f_hash = GroupHash.objects.create(project=default_project, hash="f" * 32, group_id=group2.id)

    new_group, is_new, is_regression = fast_save("f")
    assert not is_new
    assert not is_regression
    assert new_group.id == group2.id

    assert _group_hashes(new_group.id) == {
        # one hierarchical hash associated
        # no flat hashes associated when sorting into split group!
        "f"
        * 32,
    }

    new_group, is_new, is_regression = fast_save("g")
    assert not is_new
    assert not is_regression
    assert new_group.id == group.id

    assert _group_hashes(new_group.id) == {
        # Since this is the "root group" again (primary hash is c), it's fine
        # to associate flat hashes w it
        "a" * 32,
        "b" * 32,
        # one hierarchical hash associated
        "c" * 32,
    }

    f_hash.delete()

    new_group, is_new, is_regression = fast_save("f")
    assert not is_new
    assert not is_regression
    assert new_group.id == group.id
