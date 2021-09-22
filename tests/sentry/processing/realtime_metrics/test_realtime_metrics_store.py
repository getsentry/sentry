import datetime
import time
from typing import TYPE_CHECKING, Any, Dict

import pytest

from sentry.processing.realtime_metrics.redis import RedisRealtimeMetricsStore  # type: ignore
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
def config() -> Dict[str, Any]:
    return {
        "cluster": "default",
        "counter_bucket_size": 10,
        "counter_ttl": datetime.timedelta(milliseconds=400),
        "prefix": "test_store",
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


def test_increment_project_event_counter(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    counter = redis_cluster.get("test_store:17:1140")
    assert counter == "1"
    time.sleep(0.5)
    counter = redis_cluster.get("test_store:17:1140")
    assert counter is None


def test_increment_project_event_counter_twice(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    time.sleep(0.2)
    store.increment_project_event_counter(17, 1149)
    counter = redis_cluster.get("test_store:17:1140")
    assert counter == "2"
    time.sleep(0.3)
    # it should have expired by now
    counter = redis_cluster.get("test_store:17:1140")
    assert counter is None


def test_increment_project_event_counter_multiple(
    store: RedisRealtimeMetricsStore, redis_cluster: redis._RedisCluster
) -> None:
    store.increment_project_event_counter(17, 1147)
    store.increment_project_event_counter(17, 1152)

    assert redis_cluster.get("test_store:17:1140") == "1"
    assert redis_cluster.get("test_store:17:1150") == "1"
