from typing import Tuple
from unittest.mock import patch

import pytest
from django.db.models import QuerySet
from django.test import override_settings

from sentry.models import ControlOutbox, OutboxScope, SavedSearch
from sentry.silo import SiloMode
from sentry.tasks.deletion.hybrid_cloud import (
    get_watermark,
    schedule_hybrid_cloud_foreign_key_jobs,
    set_watermark,
)
from sentry.testutils.factories import Factories
from sentry.testutils.silo import exempt_from_silo_limits, no_silo_test, region_silo_test
from sentry.types.region import find_regions_for_user


@pytest.fixture(autouse=True)
def batch_size_one():
    with patch("sentry.deletions.base.ModelDeletionTask.DEFAULT_QUERY_LIMIT", new=1), patch(
        "sentry.tasks.deletion.hybrid_cloud.get_batch_size", return_value=1
    ):
        yield


@pytest.fixture
def saved_search_owner_id_field():
    return SavedSearch._meta.get_field("owner_id")


@pytest.mark.django_db(transaction=True)
def test_no_work_is_no_op(task_runner, saved_search_owner_id_field):
    # Transaction id should not change when no processing occurs.  (this would happen if setting the next cursor
    # to the same, previous value.)
    level, tid = get_watermark("tombstone", saved_search_owner_id_field)
    assert level == 0

    with task_runner():
        schedule_hybrid_cloud_foreign_key_jobs()

    assert get_watermark("tombstone", saved_search_owner_id_field) == (0, tid)


@pytest.mark.django_db(transaction=True)
def test_watermark_and_transaction_id(task_runner, saved_search_owner_id_field):
    _, tid1 = get_watermark("tombstone", saved_search_owner_id_field)
    # TODO: Add another test to validate the tid is unique per field

    _, tid2 = get_watermark("row", saved_search_owner_id_field)

    assert tid1
    assert tid2
    assert tid1 != tid2

    set_watermark("tombstone", saved_search_owner_id_field, 5, tid1)
    wm, new_tid1 = get_watermark("tombstone", saved_search_owner_id_field)

    assert new_tid1 != tid1
    assert wm == 5

    assert get_watermark("tombstone", saved_search_owner_id_field) == (wm, new_tid1)


@exempt_from_silo_limits()
def setup_deletable_objects(
    count=1, send_tombstones=True, u_id=None
) -> Tuple[QuerySet, ControlOutbox]:
    if u_id is None:
        u = Factories.create_user()
        u_id = u.id
        u.delete()

    for i in range(count):
        Factories.create_saved_search(f"s-{i}", owner_id=u_id)

    for region_name in find_regions_for_user(u_id):
        shard = ControlOutbox.for_shard(OutboxScope.USER_SCOPE, u_id, region_name)
        if send_tombstones:
            shard.drain_shard()

        return SavedSearch.objects.filter(owner_id=u_id), shard
    assert False, "find_regions_for_user could not determine a region for production."


@region_silo_test(stable=True)
@pytest.mark.django_db(transaction=True)
def test_region_processing(task_runner):
    # Assume we have two groups of objects
    # Both of them have been deleted, but only the first set has their tombstones sent yet.
    results1, shard1 = setup_deletable_objects(10)
    results2, shard2 = setup_deletable_objects(10, send_tombstones=False)

    # Test validation
    assert results1.exists()
    assert results2.exists()

    # Processing now only removes the first set
    with task_runner():
        schedule_hybrid_cloud_foreign_key_jobs()
    assert not results1.exists()
    assert results2.exists()

    # Processing after the tombstones arrives, still converges later.
    with exempt_from_silo_limits():
        shard2.drain_shard()
    with task_runner():
        schedule_hybrid_cloud_foreign_key_jobs()
    assert not results2.exists()

    # Processing for a new record created after its tombstone is processed, still converges.
    results3, shard3 = setup_deletable_objects(10, u_id=shard1.object_identifier)
    assert results3.exists()
    with task_runner():
        schedule_hybrid_cloud_foreign_key_jobs()
    assert not results3.exists()


# No need to run both saas and control tests for this logic, the silo testing is baked in directly.
@no_silo_test(stable=True)
@pytest.mark.django_db(transaction=True)
def test_control_processing(task_runner):
    with override_settings(SILO_MODE=SiloMode.CONTROL):
        results, _ = setup_deletable_objects(10)
        with task_runner():
            schedule_hybrid_cloud_foreign_key_jobs()

        # Do not process
        assert results.exists()
