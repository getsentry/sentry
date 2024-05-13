from datetime import datetime

from sentry.eventstore.reprocessing.redis import RedisReprocessingStore
from sentry.testutils.helpers.redis import use_redis_cluster


@use_redis_cluster()
def test_mark_event_reprocessed():
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
