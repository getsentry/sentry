import datetime
import time
from typing import TYPE_CHECKING, Any, Dict

import pytest

from sentry.processing import realtime_metrics  # type: ignore
from sentry.processing.realtime_metrics.redis import RedisRealtimeMetricsStore  # type: ignore
from sentry.processing.realtime_metrics.base import BucketedCount, BucketedDurations, DurationHistogram  # type: ignore
from sentry.utils import redis

if TYPE_CHECKING:
    from typing import Callable

    def _fixture(func: Callable[..., Any]) -> Callable[..., None]:
        ...

    pytest.fixture = _fixture


@pytest.fixture
def config() -> Dict[str, Any]:
    return {
        "cluster": "default",
        "counter_bucket_size": 10,
        "counter_ttl": datetime.timedelta(milliseconds=400),
        "histogram_bucket_size": 10,
        "histogram_ttl": datetime.timedelta(milliseconds=400),
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


# TODO: group tests using classes

#
# increment_project_event_counter()
#


def test_increment_project_event_counter_simple(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    assert redis_cluster.get("symbolicate_event_low_priority:counter:10:17:1140") == "1"
    time.sleep(0.5)
    assert redis_cluster.get("symbolicate_event_low_priority:counter:10:17:1140") is None


def test_increment_project_event_counter_same_bucket(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    time.sleep(0.2)
    store.increment_project_event_counter(17, 1149)
    assert redis_cluster.get("symbolicate_event_low_priority:counter:10:17:1140") == "2"
    time.sleep(0.3)
    # the second insert should have refreshed the ttl
    assert redis_cluster.get("symbolicate_event_low_priority:counter:10:17:1140") == "2"
    time.sleep(0.2)
    # it should have expired by now
    assert redis_cluster.get("symbolicate_event_low_priority:counter:10:17:1140") is None


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


def test_increment_project_duration_counter_simple(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_duration_counter(17, 1147, 15)
    assert redis_cluster.hget("symbolicate_event_low_priority:histogram:10:17:1140", "10") == "1"
    time.sleep(0.5)
    assert redis_cluster.get("symbolicate_event_low_priority:histogram:10:17:1140") is None


def test_increment_project_duration_counter_same_bucket(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_duration_counter(17, 1147, 15)
    time.sleep(0.2)
    store.increment_project_duration_counter(17, 1149, 19)
    assert redis_cluster.hget("symbolicate_event_low_priority:histogram:10:17:1140", "10") == "2"
    time.sleep(0.3)
    # the second insert should have refreshed the ttl
    assert redis_cluster.hget("symbolicate_event_low_priority:histogram:10:17:1140", "10") == "2"
    time.sleep(0.2)
    # it should have expired by now
    assert redis_cluster.get("symbolicate_event_low_priority:histogram:10:17:1140") is None


def test_increment_project_duration_counter_different_buckets(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_duration_counter(17, 1147, 23)
    store.increment_project_duration_counter(17, 1152, 42)

    assert redis_cluster.hget("symbolicate_event_low_priority:histogram:10:17:1140", "20") == "1"
    assert redis_cluster.hget("symbolicate_event_low_priority:histogram:10:17:1150", "40") == "1"


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


def test_get_lpq_projects_hit(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    in_lpq = store.get_lpq_projects()
    assert in_lpq == {1}


def test_get_lpq_projects_no_hit(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 2)
    in_lpq = store.get_lpq_projects()
    assert in_lpq == set()


#
# add_project_to_lpq()
#


def test_add_project_to_lpq_unset(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_dupe(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_filled(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1", "11"}


#
# remove_projects_from_lpq()
#


def test_remove_projects_from_lpq_unset(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.remove_projects_from_lpq({1})

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    store.remove_projects_from_lpq({1})
    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_only_member(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    store.remove_projects_from_lpq({1})

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_nonmember(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    store.remove_projects_from_lpq({1})

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"11"}


def test_remove_projects_from_lpq_subset(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    store.remove_projects_from_lpq({1})

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"11"}


def test_remove_projects_from_lpq_all_members(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    store.remove_projects_from_lpq({1, 11})

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_no_members(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    store.remove_projects_from_lpq({})

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"1"}


#
# remove_project_from_lpq()
# This literally invokes remove_projects_from_lpq so bare bones tests should be enough


def test_remove_project_from_lpq_unset(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.remove_project_from_lpq(1)

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_project_from_lpq_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    store.remove_project_from_lpq(1)
    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_project_from_lpq_only_member(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    store.remove_project_from_lpq(1)

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_project_from_lpq_nonmember(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    store.remove_projects_from_lpq(1)

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"11"}


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
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:111:0", 0, 123)

    candidates = store.projects()
    assert list(candidates) == [42]


def test_projects_multiple_metric_types(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:111", 0)
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:53:111:20", 20, 456)

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
    counts = store.get_counts_for_project(42)
    assert list(counts) == []


def test_get_counts_for_project_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set(
        "symbolicate_event_low_priority:counter:10:42:111",
        0,
    )
    redis_cluster.delete("symbolicate_event_low_priority:counter:10:42:111")

    counts = store.get_counts_for_project(42)
    assert list(counts) == []


def test_get_counts_for_project_no_matching_keys(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:53:111", 0)

    counts = store.get_counts_for_project(42)
    assert list(counts) == []


def test_get_counts_for_project_negative_key(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:-111", 0)

    counts = store.get_counts_for_project(42)
    assert list(counts) == [
        BucketedCount(timestamp=-111, count=0),
    ]


def test_get_counts_for_project_negative_count(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:111", -10)

    counts = store.get_counts_for_project(42)
    assert list(counts) == [
        BucketedCount(timestamp=111, count=-10),
    ]


def test_get_counts_for_project_multiple_projects(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:111", 0)
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:222", 0)
    redis_cluster.set("symbolicate_event_low_priority:counter:10:53:111", 0)

    counts = store.get_counts_for_project(42)
    assert list(counts) == [
        BucketedCount(timestamp=111, count=0),
        BucketedCount(timestamp=222, count=0),
    ]


def test_get_counts_for_project_multi_metric(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:111", 0)
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:222:0", 0, 123)

    counts = store.get_counts_for_project(42)
    assert list(counts) == [
        BucketedCount(timestamp=111, count=0),
    ]


def test_get_counts_for_project_different_buckets(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:111", 0)
    redis_cluster.set("symbolicate_event_low_priority:counter:5:42:111", 0)

    counts = store.get_counts_for_project(42)
    assert list(counts) == [
        BucketedCount(timestamp=111, count=0),
    ]


#
# get_durations_for_project()
#


def test_get_durations_for_project_unset(store: RedisRealtimeMetricsStore) -> None:
    counts = store.get_durations_for_project(42)
    assert list(counts) == []


def test_get_durations_for_project_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.hset(
        "symbolicate_event_low_priority:histogram:10:42:111",
        0,
        123,
    )
    redis_cluster.delete("symbolicate_event_low_priority:histogram:10:42:111")

    counts = store.get_durations_for_project(42)
    assert list(counts) == []


def test_get_durations_for_project_no_matching_keys(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:53:111", 0, 123)

    counts = store.get_durations_for_project(42)
    assert list(counts) == []


def test_get_durations_for_project_negative_timestamp(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:-111", 0, 123)

    counts = store.get_durations_for_project(42)
    assert list(counts) == [
        DurationHistogram(timestamp=-111, histogram=BucketedDurations({0: 123}))
    ]


def test_get_durations_for_project_negative_duration(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:111", -20, 123)

    counts = store.get_durations_for_project(42)
    assert list(counts) == [
        DurationHistogram(timestamp=111, histogram=BucketedDurations({-20: 123}))
    ]


def test_get_durations_for_project_negative_count(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:111", 0, -123)

    counts = store.get_durations_for_project(42)
    assert list(counts) == [
        DurationHistogram(timestamp=111, histogram=BucketedDurations({0: -123}))
    ]


def test_get_durations_for_project_multi_key_multi_durations(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:111", 0, 123)
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:111", 10, 456)
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:222", 20, 123)
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:53:111", 0, 123)

    counts = store.get_durations_for_project(42)
    assert list(counts) == [
        DurationHistogram(timestamp=111, histogram=BucketedDurations({0: 123, 10: 456})),
        DurationHistogram(timestamp=222, histogram=BucketedDurations({20: 123})),
    ]


def test_get_durations_for_project_multi_metric(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:counter:10:42:111", 0)
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:222", 0, 123)

    counts = store.get_durations_for_project(42)
    assert list(counts) == [DurationHistogram(timestamp=222, histogram=BucketedDurations({0: 123}))]


def test_get_durations_for_project_different_buckets(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.hset("symbolicate_event_low_priority:histogram:10:42:111", 0, 123)
    redis_cluster.hset("symbolicate_event_low_priority:histogram:5:42:111", 20, 456)

    counts = store.get_durations_for_project(42)
    assert list(counts) == [DurationHistogram(timestamp=111, histogram=BucketedDurations({0: 123}))]
