import uuid
import time
import pytest

from sentry.event_manager import _save_aggregate
from sentry.eventstore.models import Event
from sentry.models import GroupHash, Group


@pytest.fixture
def fast_save(default_project):
    def inner(last_frame):
        data = {"timestamp": time.time()}
        evt = Event(
            default_project.id,
            uuid.uuid4().hex,
            data=data,
        )

        return _save_aggregate(
            evt,
            flat_hashes=["a" * 32, "b" * 32],
            hierarchical_hashes=["c" * 32, "d" * 32, "e" * 32, last_frame * 32],
            release=None,
            data=data,
            level=10,
            culprit="",
        )

    return inner


@pytest.mark.django_db
def test_move_all_events(default_project, fast_save):
    group, is_new, is_regression = fast_save("f")

    assert is_new
    assert not is_regression

    new_group, is_new, is_regression = fast_save("f")
    assert not is_new
    assert not is_regression
    assert new_group.id == group.id

    assert {g.hash for g in GroupHash.objects.filter(group=group)} == {"a" * 32, "b" * 32, "c" * 32}

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

    assert {g.hash for g in GroupHash.objects.filter(group=new_group)} == {
        # Since this is the "root group" again (primary hash is c), it's fine
        # to associate flat hashes w it
        "a" * 32,
        "b" * 32,
        # one hierarchical hash associated
        "c" * 32,
    }


@pytest.mark.django_db
def test_partial_move(default_project, fast_save):
    group, is_new, is_regression = fast_save("f")
    assert is_new
    assert not is_regression

    new_group, is_new, is_regression = fast_save("g")
    assert not is_new
    assert not is_regression
    assert new_group.id == group.id

    assert {g.hash for g in GroupHash.objects.filter(group=group)} == {"a" * 32, "b" * 32, "c" * 32}

    # simulate split operation where event "f" of group is moved into a more specific hash
    group2 = Group.objects.create(project=default_project)
    f_hash = GroupHash.objects.create(project=default_project, hash="f" * 32, group_id=group2.id)

    new_group, is_new, is_regression = fast_save("f")
    assert not is_new
    assert not is_regression
    assert new_group.id == group2.id

    assert {g.hash for g in GroupHash.objects.filter(group=new_group)} == {
        # one hierarchical hash associated
        # no flat hashes associated when sorting into split group!
        "f"
        * 32,
    }

    new_group, is_new, is_regression = fast_save("g")
    assert not is_new
    assert not is_regression
    assert new_group.id == group.id

    assert {g.hash for g in GroupHash.objects.filter(group=new_group)} == {
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
