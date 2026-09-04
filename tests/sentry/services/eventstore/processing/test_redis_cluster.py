from datetime import datetime

from sentry.services.eventstore.reprocessing.redis import RedisReprocessingStore
from sentry.testutils.helpers.redis import use_redis_cluster


@use_redis_cluster()
def test_mark_event_reprocessed() -> None:
    group_id = 5
    store = RedisReprocessingStore()
    date_created = datetime.now()
    store.start_reprocessing(
        group_id=group_id, date_created=date_created, sync_count=10, event_count=20
    )
    pending, _ = store.get_pending(group_id=group_id)
    assert pending == "10"
    result = store.mark_event_reprocessed(group_id=group_id, num_events=0)
    assert result is False
    progress = store.get_progress(group_id=group_id)
    assert progress is not None
    assert progress.get("syncCount") == 10
    assert progress.get("totalEvents") == 20


@use_redis_cluster()
def test_try_claim_page() -> None:
    store = RedisReprocessingStore()
    project_id = 1
    group_id = 2
    new_group_id = 3
    state = {"timestamp": "2026-08-04T06:10:59+00:00", "event_id": "42"}

    # First claim is ok, and reclaiming from same claimant is a NOOP.
    assert store.try_claim_page(project_id, group_id, new_group_id, state, claimant="A")
    assert store.try_claim_page(project_id, group_id, new_group_id, state, claimant="A")

    # Claiming from another claimant should not work.
    assert not store.try_claim_page(project_id, group_id, new_group_id, state, claimant="B")

    # Different reprocessing run but same state should be unaffected.
    assert store.try_claim_page(project_id, 4, 5, state, claimant="B")
