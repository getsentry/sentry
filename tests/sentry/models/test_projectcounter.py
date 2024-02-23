from contextlib import contextmanager
from unittest.mock import MagicMock

import pytest

from sentry import options
from sentry.models.counter import Counter
from sentry.models.group import Group
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.pytest.mocking import capture_results
from sentry.testutils.silo import region_silo_test


@django_db_all
@pytest.mark.parametrize("upsert_sample_rate", [0, 1])
@region_silo_test
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
