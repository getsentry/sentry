import datetime
import time
from typing import TYPE_CHECKING

import pytest

from sentry.processing.realtime_metrics import base  # type: ignore
from sentry.utils import redis

if TYPE_CHECKING:
    from typing import Callable, TypeVar

    # Declare fixture decorator to swallow the function, this isn't the actual type returned
    # but the type is unusable as a function which is what matters.
    F = TypeVar("F", bound=Callable[..., None])

    def _fixture(func: F) -> F:
        ...

    pytest.fixture = _fixture


@pytest.fixture
def redis_cluster() -> redis._RedisCluster:
    return redis.redis_clusters.get("default")


@pytest.fixture
def store(redis_cluster: redis._RedisCluster) -> base.RealtimeMetricsStore:
    return base.RealtimeMetricsStore(
        redis_cluster, counter_bucket_size=10, counter_ttl=datetime.timedelta(milliseconds=400)
    )


def test_increment_project_event_counter(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    counter = redis_cluster.get("symbolicate_event_low_priority:17:1140")
    assert counter == "1"
    time.sleep(0.5)
    counter = redis_cluster.get("symbolicate_event_low_priority:17:1140")
    assert counter is None


def test_increment_project_event_counter_twice(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    time.sleep(0.2)
    store.increment_project_event_counter(17, 1149)
    counter = redis_cluster.get("symbolicate_event_low_priority:17:1140")
    assert counter == "2"
    time.sleep(0.3)
    # it should have expired by now
    counter = redis_cluster.get("symbolicate_event_low_priority:17:1140")
    assert counter is None


def test_increment_project_event_counter_multiple(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    store.increment_project_event_counter(17, 1152)

    assert redis_cluster.get("symbolicate_event_low_priority:17:1140") == "1"
    assert redis_cluster.get("symbolicate_event_low_priority:17:1150") == "1"


def test_get_lpq_projects_unset(store: base.RealtimeMetricsStore) -> None:
    in_lpq = store.get_lpq_projects()
    assert in_lpq == set()


def test_get_lpq_projects_empty(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    in_lpq = store.get_lpq_projects()
    assert in_lpq == set()


def test_get_lpq_projects_filled(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    in_lpq = store.get_lpq_projects()
    assert in_lpq == {1}


def test_add_project_to_lpq_unset(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    assert store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_empty(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    assert store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_dupe(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    assert store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1"}


def test_add_project_to_lpq_filled(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    assert store.add_project_to_lpq(1)
    in_lpq = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert in_lpq == {"1", "11"}


def test_remove_projects_from_lpq_unset(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    removed = store.remove_projects_from_lpq({1})
    assert removed == set()

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_empty(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.srem("store.symbolicate-event-lpq-selected", 1)

    removed = store.remove_projects_from_lpq({1})
    assert removed == set()

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_only_member(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    removed = store.remove_projects_from_lpq({1})
    assert removed == {1}

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_nonmember(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    removed = store.remove_projects_from_lpq({1})
    assert removed == set()

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"11"}


def test_remove_projects_from_lpq_subset(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    removed = store.remove_projects_from_lpq({1})
    assert removed == {1}

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"11"}


def test_remove_projects_from_lpq_all_members(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 11)

    removed = store.remove_projects_from_lpq({1, 11})
    assert removed == {1, 11}

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == set()


def test_remove_projects_from_lpq_no_members(
    store: base.RealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    redis_cluster.sadd("store.symbolicate-event-lpq-selected", 1)

    removed = store.remove_projects_from_lpq({})
    assert removed == set()

    remaining = redis_cluster.smembers("store.symbolicate-event-lpq-selected")
    assert remaining == {"1"}
