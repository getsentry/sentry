from typing import TYPE_CHECKING, Any, Dict

import pytest

from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.base import (
    BucketedCount,
    BucketedDurations,
    DurationHistogram,
)
from sentry.processing.realtime_metrics.redis import LPQ_MEMBERS_KEY, RedisRealtimeMetricsStore
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
        "counter_time_window": 0,
        "duration_bucket_size": 10,
        "duration_time_window": 0,
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


def empty_histogram() -> BucketedDurations:
    return BucketedDurations({duration: 0 for duration in range(0, 600, 10)})


def test_default() -> None:
    realtime_metrics.increment_project_event_counter(17, 1234)
    realtime_metrics.increment_project_duration_counter(17, 1234, 55)


@pytest.mark.xfail
def test_invalid_config() -> None:
    invalid_config: Dict[str, Any] = {
        "cluster": "default",
        "counter_bucket_size": 0,
        "counter_time_window": -1,
        "duration_bucket_size": -10,
        "duration_time_window": 0,
    }
    RedisRealtimeMetricsStore(**invalid_config)


# TODO: group tests using classes

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
    counts = store.get_counts_for_project(42, 113)

    assert list(counts) == [BucketedCount(timestamp=110, count=0)]

    store._counter_time_window = 20

    counts = store.get_counts_for_project(42, 113)

    assert list(counts) == [
        BucketedCount(timestamp=90, count=0),
        BucketedCount(timestamp=100, count=0),
        BucketedCount(timestamp=110, count=0),
    ]


def test_get_counts_for_project_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set(
        "symbolicate_event_low_priority:counter:10:42:111",
        0,
    )
    redis_cluster.delete("symbolicate_event_low_priority:counter:10:42:111")

    counts = store.get_counts_for_project(42, 113)

    assert list(counts) == [BucketedCount(timestamp=110, count=0)]

    store._counter_time_window = 20

    counts = store.get_counts_for_project(42, 113)

    assert list(counts) == [
        BucketedCount(timestamp=90, count=0),
        BucketedCount(timestamp=100, count=0),
        BucketedCount(timestamp=110, count=0),
    ]


def test_get_counts_for_project_no_matching_keys(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:53:111", 0)

    counts = store.get_counts_for_project(42, 113)

    assert list(counts) == [BucketedCount(timestamp=110, count=0)]


def test_get_counts_for_project_negative_key(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:-110", 0)

    counts = store.get_counts_for_project(42, -103)

    assert list(counts) == [
        BucketedCount(timestamp=-110, count=0),
    ]


def test_get_counts_for_project_negative_count(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:110", -10)

    counts = store.get_counts_for_project(42, 113)

    assert list(counts) == [
        BucketedCount(timestamp=110, count=-10),
    ]


def test_get_counts_for_project_multiple_projects(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:110", 0)
    redis_cluster.set("symbolicate_event_low_priority:counter:10:53:110", 0)

    counts = store.get_counts_for_project(42, 113)

    assert list(counts) == [
        BucketedCount(timestamp=110, count=0),
    ]


def test_get_counts_for_project_multi_metric(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:110", 0)
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:110:0", 0, 123)

    counts = store.get_counts_for_project(42, 113)

    assert list(counts) == [
        BucketedCount(timestamp=110, count=0),
    ]


def test_get_counts_for_project_different_buckets(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:110", 0)
    redis_cluster.set("symbolicate_event_low_priority:counter:5:42:110", 0)

    counts = store.get_counts_for_project(42, 113)

    assert list(counts) == [
        BucketedCount(timestamp=110, count=0),
    ]


def test_get_counts_for_projects_with_gap(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store._counter_time_window = 40
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:110", 3)
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:150", 17)

    counts = store.get_counts_for_project(42, 154)

    assert list(counts) == [
        BucketedCount(timestamp=110, count=3),
        BucketedCount(timestamp=120, count=0),
        BucketedCount(timestamp=130, count=0),
        BucketedCount(timestamp=140, count=0),
        BucketedCount(timestamp=150, count=17),
    ]


#
# get_durations_for_project()
#


def test_get_durations_for_project_unset(store: RedisRealtimeMetricsStore) -> None:
    durations = store.get_durations_for_project(42, 113)

    assert list(durations) == [
        DurationHistogram(timestamp=110, histogram=BucketedDurations(empty_histogram()))
    ]

    store._duration_time_window = 20

    durations = store.get_durations_for_project(42, 113)

    assert list(durations) == [
        DurationHistogram(timestamp=90, histogram=BucketedDurations(empty_histogram())),
        DurationHistogram(timestamp=100, histogram=BucketedDurations(empty_histogram())),
        DurationHistogram(timestamp=110, histogram=BucketedDurations(empty_histogram())),
    ]


def test_get_durations_for_project_empty(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.hset(
        "symbolicate_event_low_priority:duration:10:42:111",
        0,
        123,
    )
    redis_cluster.delete("symbolicate_event_low_priority:duration:10:42:111")

    durations = store.get_durations_for_project(42, 113)

    assert list(durations) == [
        DurationHistogram(timestamp=110, histogram=BucketedDurations(empty_histogram()))
    ]

    store._duration_time_window = 20

    durations = store.get_durations_for_project(42, 113)

    assert list(durations) == [
        DurationHistogram(timestamp=90, histogram=BucketedDurations(empty_histogram())),
        DurationHistogram(timestamp=100, histogram=BucketedDurations(empty_histogram())),
        DurationHistogram(timestamp=110, histogram=BucketedDurations(empty_histogram())),
    ]


def test_get_durations_for_project_no_matching_keys(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:53:111", 0, 123)

    durations = store.get_durations_for_project(42, 113)

    assert list(durations) == [
        DurationHistogram(timestamp=110, histogram=BucketedDurations(empty_histogram()))
    ]


def test_get_durations_for_project_negative_timestamp(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:-110", 0, 123)

    histogram = empty_histogram()
    histogram[0] = 123

    durations = store.get_durations_for_project(42, -103)

    assert list(durations) == [
        DurationHistogram(timestamp=-110, histogram=BucketedDurations(histogram))
    ]


def test_get_durations_for_project_negative_duration(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:110", -20, 123)

    histogram = empty_histogram()
    histogram[-20] = 123

    durations = store.get_durations_for_project(42, 113)

    assert list(durations) == [
        DurationHistogram(timestamp=110, histogram=BucketedDurations(histogram))
    ]


def test_get_durations_for_project_negative_count(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:110", 0, -123)

    histogram = empty_histogram()
    histogram[0] = -123

    durations = store.get_durations_for_project(42, 113)

    assert list(durations) == [
        DurationHistogram(timestamp=110, histogram=BucketedDurations(histogram))
    ]


def test_get_durations_for_project_multi_key_multi_durations(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:110", 0, 123)
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:110", 10, 456)
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:53:110", 0, 123)

    histogram = empty_histogram()
    histogram[0] = 123
    histogram[10] = 456

    durations = store.get_durations_for_project(42, 113)

    assert list(durations) == [
        DurationHistogram(timestamp=110, histogram=BucketedDurations(histogram)),
    ]


def test_get_durations_for_project_multi_metric(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:110", 0)
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:220", 0, 123)

    histogram = empty_histogram()
    histogram[0] = 123

    durations = store.get_durations_for_project(42, 225)

    assert list(durations) == [
        DurationHistogram(timestamp=220, histogram=BucketedDurations(histogram))
    ]


def test_get_durations_for_project_different_buckets(
    store: RedisRealtimeMetricsStore,
    redis_cluster: redis._RedisCluster,
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:110", 0, 123)
    redis_cluster.hset("symbolicate_event_low_priority:duration:5:42:110", 20, 456)

    histogram = empty_histogram()
    histogram[0] = 123

    durations = store.get_durations_for_project(42, 113)

    assert list(durations) == [
        DurationHistogram(timestamp=110, histogram=BucketedDurations(histogram))
    ]


def test_get_durations_for_projects_with_gap(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store._duration_time_window = 40
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:110", 20, 3)
    redis_cluster.hset("symbolicate_event_low_priority:duration:10:42:150", 30, 17)

    hist1 = empty_histogram()
    hist1[20] = 3

    hist2 = empty_histogram()
    hist2[30] = 17

    durations = store.get_durations_for_project(42, 154)

    assert list(durations) == [
        DurationHistogram(timestamp=110, histogram=hist1),
        DurationHistogram(timestamp=120, histogram=empty_histogram()),
        DurationHistogram(timestamp=130, histogram=empty_histogram()),
        DurationHistogram(timestamp=140, histogram=empty_histogram()),
        DurationHistogram(timestamp=150, histogram=hist2),
    ]


#
# was_recently_moved()
#


def test_was_recently_moved_noop(store: RedisRealtimeMetricsStore) -> None:
    store.remove_projects_from_lpq({42})
    assert store.was_recently_moved(42)


def test_was_recently_moved_added(store: RedisRealtimeMetricsStore) -> None:
    store.add_project_to_lpq(42)
    assert store.was_recently_moved(42)


def test_was_recently_moved_removed(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd(LPQ_MEMBERS_KEY, 42)
    store.remove_projects_from_lpq({42})
    assert store.was_recently_moved(42)


#
# recently_moved_projects()
#


def test_recently_moved_projects_noop(store: RedisRealtimeMetricsStore) -> None:
    store.remove_projects_from_lpq({42})
    assert store.recently_moved_projects() == {42}


def test_recently_moved_projects_added(store: RedisRealtimeMetricsStore) -> None:
    store.add_project_to_lpq(42)
    assert store.recently_moved_projects() == {42}


def test_recently_moved_projects_removed(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd(LPQ_MEMBERS_KEY, 42)
    store.remove_projects_from_lpq({42})
    assert store.recently_moved_projects() == {42}
