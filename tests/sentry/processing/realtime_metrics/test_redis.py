import datetime
import time
from typing import TYPE_CHECKING, Any, Dict

import pytest

from sentry.processing import realtime_metrics  # type: ignore
from sentry.processing.realtime_metrics.redis import RedisRealtimeMetricsStore  # type: ignore
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
