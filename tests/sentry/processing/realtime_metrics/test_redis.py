from typing import TYPE_CHECKING, Any, Dict

import pytest

from sentry.exceptions import InvalidConfiguration
from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.redis import RedisRealtimeMetricsStore
from sentry.utils import redis

if TYPE_CHECKING:
    from typing import Callable

    def _fixture(func: Callable[..., Any]) -> Callable[..., None]:
        ...

    def _xfail(func: Callable[..., Any]) -> Callable[..., None]:
        ...

    pytest.fixture = _fixture
    pytest.mark.xfail = _xfail


@pytest.fixture
def config() -> Dict[str, Any]:
    return {
        "cluster": "default",
        "counter_bucket_size": 10,
        "counter_time_window": 120,
        "duration_bucket_size": 10,
        "duration_time_window": 120,
        "backoff_timer": 1,
    }


@pytest.fixture
def redis_cluster(config: Dict[str, Any]) -> redis._RedisCluster:
    cluster, options = redis.get_cluster_from_options(
        "TEST_CLUSTER", config, cluster_manager=redis.redis_clusters
    )
    return cluster


@pytest.fixture
def store(config: Dict[str, Any]) -> RedisRealtimeMetricsStore:
    return RedisRealtimeMetricsStore(**config)


def test_default() -> None:
    realtime_metrics.increment_project_event_counter(17, 1234)
    realtime_metrics.increment_project_duration_counter(17, 1234, 55)


def test_invalid_config() -> None:
    invalid_config: Dict[str, Any] = {
        "cluster": "default",
        "counter_bucket_size": 0,
        "counter_time_window": -1,
        "duration_bucket_size": -10,
        "duration_time_window": 0,
        "backoff_timer": -100,
    }
    with pytest.raises(InvalidConfiguration):
        RedisRealtimeMetricsStore(**invalid_config)


#
# increment_project_event_counter()
#


def test_increment_project_event_counter_same_bucket(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    store.increment_project_event_counter(17, 1149)

    assert redis_cluster.get("symbolicate_event_low_priority:counter:10:17:1140") == "2"


def test_increment_project_event_counter_different_buckets(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    store.increment_project_event_counter(17, 1152)

    assert redis_cluster.get("symbolicate_event_low_priority:counter:10:17:1140") == "1"
    assert redis_cluster.get("symbolicate_event_low_priority:counter:10:17:1150") == "1"


#
# increment_project_duration_counter()
#


def test_increment_project_duration_counter_same_bucket(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_duration_counter(17, 1147, 15)
    store.increment_project_duration_counter(17, 1149, 19)

    assert redis_cluster.hget("symbolicate_event_low_priority:duration:10:17:1140", "10") == "2"


def test_increment_project_duration_counter_different_buckets(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_duration_counter(17, 1147, 23)
    store.increment_project_duration_counter(17, 1152, 42)

    assert redis_cluster.hget("symbolicate_event_low_priority:duration:10:17:1140", "20") == "1"
    assert redis_cluster.hget("symbolicate_event_low_priority:duration:10:17:1150", "40") == "1"


#
# get_lpq_projects()
#


def test_get_lpq_projects_unset(store: RedisRealtimeMetricsStore) -> None:
    in_lpq = store.get_lpq_projects()
    assert in_lpq == set()


def test_get_lpq_projects_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    in_lpq = store.get_lpq_projects()
    assert in_lpq == set()


def test_get_lpq_projects_filled(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    in_lpq = store.get_lpq_projects()
    assert in_lpq == {1}


#
# add_project_to_lpq()
#


def test_add_project_to_lpq_unset(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    added = store.add_project_to_lpq(1)
    assert added
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    added = store.add_project_to_lpq(1)
    assert added
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_dupe(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    added = store.add_project_to_lpq(1)
    assert not added
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_filled(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    added = store.add_project_to_lpq(1)
    assert added
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1", "11"}


def test_add_project_to_lpq_backing_off_adding(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set(f"{store._backoff_key_prefix()}:1", 1)

    added = store.add_project_to_lpq(1)
    assert not added


def test_add_project_to_lpq_backing_off_readding(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}
    assert redis_cluster.get(f"{store._backoff_key_prefix()}:1") == "1"

    added = store.add_project_to_lpq(1)
    assert not added


#
# remove_projects_from_lpq()
#


def test_remove_projects_from_lpq_unset(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    removed = store.remove_projects_from_lpq({1})
    assert removed == 0

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    removed = store.remove_projects_from_lpq({1})
    assert removed == 0
    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_only_member(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    removed = store.remove_projects_from_lpq({1})
    assert removed == 1

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_nonmember(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    removed = store.remove_projects_from_lpq({1})
    assert removed == 0

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"11"}


def test_remove_projects_from_lpq_subset(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    removed = store.remove_projects_from_lpq({1})
    assert removed == 1

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"11"}


def test_remove_projects_from_lpq_all_members(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    removed = store.remove_projects_from_lpq({1, 11})
    assert removed == 2

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_no_members(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    removed = store.remove_projects_from_lpq(set())
    assert removed == 0

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"1"}


def test_remove_projects_from_lpq_backing_off_removing(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}
    assert redis_cluster.get(f"{store._backoff_key_prefix()}:1") == "1"

    removed = store.remove_projects_from_lpq({1})
    assert not removed


def test_remove_projects_from_lpq_backing_off_reremoving(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set(f"{store._backoff_key_prefix()}:1", 1)

    removed = store.remove_projects_from_lpq({1})
    assert not removed


#
# projects()
#


def test_projects_unset(store: RedisRealtimeMetricsStore) -> None:
    candidates = store.projects()
    assert list(candidates) == []


def test_projects_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set(
        "symbolicate_event_low_priority:counter:10:42:111",
        0,
    )
    redis_cluster.delete("symbolicate_event_low_priority:counter:10:42:111")

    candidates = store.projects()
    assert list(candidates) == []


def test_projects_different_bucket(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:5:42:111", 0)

    candidates = store.projects()
    assert list(candidates) == []


def test_projects_negative_timestamp(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:-111", 0)

    candidates = store.projects()
    assert list(candidates) == [42]


def test_projects_one_count(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:111", 0)

    candidates = store.projects()
    assert list(candidates) == [42]


def test_projects_one_histogram(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:111:0", 0, 123)

    candidates = store.projects()
    assert list(candidates) == [42]


def test_projects_multiple_metric_types(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:111", 0)
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:53:111:20", 20, 456)

    candidates = store.projects()
    assert list(candidates) == [42, 53]


def test_projects_mixed_buckets(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:111", 0)
    redis_cluster.set("symbolicate_event_low_priority:counter:5:53:111", 0)

    candidates = store.projects()
    assert list(candidates) == [42]


#
# get_counts_for_project()
#


def test_get_counts_for_project_unset(store: RedisRealtimeMetricsStore) -> None:
    buckets = store.get_counts_for_project(project_id=42, timestamp=113)

    # It is impossible to specify the last possible time in the current bucket, so we always
    # still fall back to 13 buckets to cover the time window.
    assert len(buckets.counts) == 13

    assert buckets.total_count() == 0


def test_get_counts_for_project_missing_project(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:53:111", 0)

    buckets = store.get_counts_for_project(project_id=42, timestamp=113)

    assert buckets.total_count() == 0


def test_get_counts_for_project_different_bucket_sizes(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:110", 1)
    redis_cluster.set("symbolicate_event_low_priority:counter:5:42:110", 2)

    buckets = store.get_counts_for_project(project_id=42, timestamp=113)

    assert buckets.total_count() == 1


def test_get_counts_for_projects_with_gap(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store._counter_time_window = 40
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:110", 3)
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:150", 17)

    buckets = store.get_counts_for_project(project_id=42, timestamp=154)

    assert buckets.total_count() == 20

    assert buckets.counts[-1] == 17
    assert buckets.counts[-2] == 0
    assert buckets.counts[-3] == 0
    assert buckets.counts[-4] == 0
    assert buckets.counts[-5] == 3


#
# get_durations_for_project()
#


def test_get_durations_for_project_unset(store: RedisRealtimeMetricsStore) -> None:
    durations = store.get_durations_for_project(project_id=42, timestamp=113)

    assert len(durations.histograms) == 13

    for hist in durations.histograms:
        assert hist.total_count() == 0


def test_get_durations_for_project_missing_project(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:53:111", 0, 123)

    durations = store.get_durations_for_project(project_id=42, timestamp=113)

    for hist in durations.histograms:
        assert hist.total_count() == 0


def test_get_durations_for_project_different_bucket_sizes(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:110", 0, 123)
    redis_cluster.hset("symbolicate_event_low_priority:duration:5:42:110", 20, 456)

    durations = store.get_durations_for_project(42, 113)

    total = sum(h.total_count() for h in durations.histograms)

    assert total == 123


def test_get_durations_for_projects_with_gap(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store._duration_time_window = 40
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:110", 20, 3)
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:150", 30, 17)

    durations = store.get_durations_for_project(42, 154)

    assert durations.histograms[-1].total_count() == 17
    assert durations.histograms[-2].total_count() == 0
    assert durations.histograms[-3].total_count() == 0
    assert durations.histograms[-4].total_count() == 0
    assert durations.histograms[-5].total_count() == 3
