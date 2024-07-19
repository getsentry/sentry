from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest
from django.db import IntegrityError

from sentry import options
from sentry.models.counter import Counter
from sentry.models.group import Group
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.pytest.mocking import capture_results


@django_db_all
@pytest.mark.parametrize("upsert_sample_rate", [0, 1])
def test_increment(default_project, upsert_sample_rate):
    options.set("store.projectcounter-modern-upsert-sample-rate", upsert_sample_rate)

    assert Counter.increment(default_project, 42) == 42
    assert Counter.increment(default_project, 1) == 43


@contextmanager
def patch_group_creation(monkeypatch):
    group_creation_results: list[Group | Exception] = []
    group_creation_spy = MagicMock(
        side_effect=capture_results(Group.objects.create, group_creation_results)
    )
    monkeypatch.setattr("sentry.event_manager.Group.objects.create", group_creation_spy)

    yield (group_creation_spy, group_creation_results)


def create_existing_group(project, monkeypatch, message):
    with patch_group_creation(monkeypatch) as patches:
        group_creation_spy, group_creation_results = patches

        event = save_new_event({"message": message}, project)
        group = Group.objects.get(id=event.group_id)

        assert (
            group.times_seen == 1
        ), "Error: No new group was created. This is probably because the given message matched that of an existing group."

        assert group_creation_spy.call_count == 1
        assert group_creation_results[0] == group

        # This equality ensures the next new group's `short_id` won't conflict with group's `short_id`.
        counter = Counter.objects.get(project_id=project.id)
        assert group.short_id == counter.value

        return group


@django_db_all
def test_group_creation_simple(default_project, monkeypatch):
    group = create_existing_group(default_project, monkeypatch, "Dogs are great!")

    # See `create_existing_group` for more assertions
    assert group


@django_db_all
@pytest.mark.parametrize(
    "discrepancy",
    [1, 2, 3],
    ids=[" discrepancy = 1 ", " discrepancy = 2 ", " discrepancy = 3 "],
)
def test_group_creation_with_stuck_project_counter(default_project, monkeypatch, discrepancy):
    project = default_project

    # Create enough groups that a discripancy larger than 1 will still land us on an existing group
    messages = [
        "Maisey is a silly dog",
        "Charlie is a goofy dog",
        "Bodhi is an adventurous dog",
        "Cory is a loyal dog",
    ]
    existing_groups = [create_existing_group(project, monkeypatch, message) for message in messages]

    with patch_group_creation(monkeypatch) as patches:
        group_creation_spy, group_creation_results = patches

        # Set the counter value such that it will try to create the next group with the same `short_id` as the
        # existing group
        counter = Counter.objects.get(project_id=project.id)
        counter.value = counter.value - discrepancy
        counter.save()

        # Change the message so the event will create a new group... or at least try to
        new_message = "Dogs are great!"
        assert new_message not in messages
        potentially_stuck_event = save_new_event({"message": new_message}, project)

        # Because of the incorrect counter value, we had to try twice to create the group.
        assert group_creation_spy.call_count == 2

        first_attempt_result, second_attempt_result = group_creation_results

        # The counter was indeed stuck...
        assert isinstance(first_attempt_result, IntegrityError)
        raised_error_message = first_attempt_result.args[0]
        possible_error_messages = [
            f"Key (project_id, short_id)=({project.id}, {existing_group.short_id}) already exists."
            for existing_group in existing_groups
        ]
        assert any(
            [
                possible_message in raised_error_message
                for possible_message in possible_error_messages
            ]
        )

        # ... but we did manage to create a new group after fixing it
        assert isinstance(second_attempt_result, Group)
        new_group = second_attempt_result
        assert potentially_stuck_event.group_id == new_group.id
        assert new_group.id not in [group.id for group in existing_groups]

        # And voila, now the counter's fixed and ready for the next new group
        counter = Counter.objects.get(project_id=project.id)
        assert counter.value == new_group.short_id

        # These will be helpful for the next set of assertions
        messages.append(new_message)
        existing_groups.append(new_group)

    # Just to prove that it now works, here we go (new spies just for convenience)
    with patch_group_creation(monkeypatch) as patches:
        group_creation_spy, group_creation_results = patches

        new_new_message = "Dogs are still great!"
        assert new_new_message not in messages
        hopefully_normal_event = save_new_event({"message": new_new_message}, project)

        # We didn't have to go through the stuck-counter-fixing process
        assert group_creation_spy.call_count == 1

        # We successfully created a new group
        assert isinstance(group_creation_results[0], Group)
        new_new_group = group_creation_results[0]
        assert hopefully_normal_event.group_id == new_new_group.id
        assert new_new_group.id not in [group.id for group in existing_groups]

        # And as before, the counter has been adjusted to be ready for the next new group
        counter = Counter.objects.get(project_id=project.id)
        assert counter.value == new_new_group.short_id
