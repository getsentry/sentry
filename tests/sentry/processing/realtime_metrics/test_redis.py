from datetime import datetime
from typing import Any, Dict

import pytest
from redis import StrictRedis

from sentry.exceptions import InvalidConfiguration
from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.redis import RedisRealtimeMetricsStore
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import redis


@pytest.fixture
def config() -> Dict[str, Any]:
    return {
        "cluster": "default",
        "budget_bucket_size": 10,
        "budget_time_window": 120,
        "backoff_timer": 1,
    }


@pytest.fixture
def redis_cluster(config: Dict[str, Any]) -> StrictRedis:
    cluster, options = redis.get_cluster_from_options(
        "TEST_CLUSTER", config, cluster_manager=redis.redis_clusters
    )
    return cluster


@pytest.fixture
def store(config: Dict[str, Any]) -> RedisRealtimeMetricsStore:
    return RedisRealtimeMetricsStore(**config)


def test_default() -> None:
    with freeze_time(datetime.fromtimestamp(1234)):
        realtime_metrics.record_project_duration(17, 1.0)


def test_invalid_config() -> None:
    invalid_config: Dict[str, Any] = {
        "cluster": "default",
        "budget_bucket_size": 0,
        "budget_time_window": -1,
        "backoff_timer": -100,
    }
    with pytest.raises(InvalidConfiguration):
        RedisRealtimeMetricsStore(**invalid_config)


#
# record_project_duration()
#


def test_record_project_duration_same_bucket(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    with freeze_time(datetime.fromtimestamp(1147)) as frozen_datetime:
        store.record_project_duration(17, 1.0)
        frozen_datetime.shift(2)
        store.record_project_duration(17, 1.0)

    assert redis_cluster.get("symbolicate_event_low_priority:budget:10:17:1140") == "2000"


def test_record_project_duration_different_buckets(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    with freeze_time(datetime.fromtimestamp(1147)) as frozen_datetime:
        store.record_project_duration(17, 1.0)
        frozen_datetime.shift(5)
        store.record_project_duration(17, 1.0)

    assert redis_cluster.get("symbolicate_event_low_priority:budget:10:17:1140") == "1000"
    assert redis_cluster.get("symbolicate_event_low_priority:budget:10:17:1150") == "1000"


#
# get_lpq_projects()
#


def test_get_lpq_projects_unset(store: RedisRealtimeMetricsStore) -> None:
    in_lpq = store.get_lpq_projects()
    assert in_lpq == set()


def test_get_lpq_projects_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    in_lpq = store.get_lpq_projects()
    assert in_lpq == set()


def test_get_lpq_projects_filled(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    in_lpq = store.get_lpq_projects()
    assert in_lpq == {1}


#
# add_project_to_lpq()
#


def test_add_project_to_lpq_unset(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    added = store.add_project_to_lpq(1)
    assert added
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    added = store.add_project_to_lpq(1)
    assert added
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_dupe(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    added = store.add_project_to_lpq(1)
    assert not added
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_filled(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    added = store.add_project_to_lpq(1)
    assert added
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1", "11"}


def test_add_project_to_lpq_backing_off_adding(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.set(f"{store._backoff_key_prefix()}:1", 1)

    added = store.add_project_to_lpq(1)
    assert not added


def test_add_project_to_lpq_backing_off_readding(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
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
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    removed = store.remove_projects_from_lpq({1})
    assert removed == 0

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_empty(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    removed = store.remove_projects_from_lpq({1})
    assert removed == 0
    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_only_member(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    removed = store.remove_projects_from_lpq({1})
    assert removed == 1

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_nonmember(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    removed = store.remove_projects_from_lpq({1})
    assert removed == 0

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"11"}


def test_remove_projects_from_lpq_subset(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    removed = store.remove_projects_from_lpq({1})
    assert removed == 1

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"11"}


def test_remove_projects_from_lpq_all_members(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    removed = store.remove_projects_from_lpq({1, 11})
    assert removed == 2

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_no_members(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    removed = store.remove_projects_from_lpq(set())
    assert removed == 0

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"1"}


def test_remove_projects_from_lpq_backing_off_removing(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}
    assert redis_cluster.get(f"{store._backoff_key_prefix()}:1") == "1"

    removed = store.remove_projects_from_lpq({1})
    assert not removed


def test_remove_projects_from_lpq_backing_off_reremoving(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
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


def test_projects_empty(store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis) -> None:
    redis_cluster.set(
        "symbolicate_event_low_priority:budget:10:42:111",
        0,
    )
    redis_cluster.delete("symbolicate_event_low_priority:budget:10:42:111")

    candidates = store.projects()
    assert list(candidates) == []


def test_projects_different_bucket(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:budget:5:42:111", 0)

    candidates = store.projects()
    assert list(candidates) == []


def test_projects_negative_timestamp(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:budget:10:42:-111", 0)

    candidates = store.projects()
    assert list(candidates) == [42]


def test_projects_one_budget(store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis) -> None:
    redis_cluster.set("symbolicate_event_low_priority:budget:10:42:111", 0)

    candidates = store.projects()
    assert list(candidates) == [42]


def test_projects_mixed_buckets(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:budget:10:42:111", 0)
    redis_cluster.set("symbolicate_event_low_priority:budget:5:53:111", 0)

    candidates = store.projects()
    assert list(candidates) == [42]


#
# get_used_budget_for_project()
#


def test_get_used_budget_for_project_unset(store: RedisRealtimeMetricsStore) -> None:
    budget = store.get_used_budget_for_project(project_id=42)

    assert budget == 0


def test_get_used_budget_for_project_missing_project(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:budget:10:53:111", 0)

    with freeze_time(datetime.fromtimestamp(113)):
        budget = store.get_used_budget_for_project(project_id=42)

    assert budget == 0


def test_get_used_budget_for_project_different_bucket_sizes(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    redis_cluster.set("symbolicate_event_low_priority:budget:10:42:110", 1000 * 120)
    redis_cluster.set("symbolicate_event_low_priority:budget:5:42:110", 2000)

    with freeze_time(datetime.fromtimestamp(113)):
        budget = store.get_used_budget_for_project(project_id=42)

    assert round(budget) == 1


def test_get_used_budget_for_projects_with_gap(
    store: RedisRealtimeMetricsStore, redis_cluster: StrictRedis
) -> None:
    store._budget_time_window = 40
    redis_cluster.set("symbolicate_event_low_priority:budget:10:42:110", 3000 * 40)
    redis_cluster.set("symbolicate_event_low_priority:budget:10:42:150", 17000 * 40)

    with freeze_time(datetime.fromtimestamp(151)):
        budget = store.get_used_budget_for_project(project_id=42)

    assert round(budget) == 20
