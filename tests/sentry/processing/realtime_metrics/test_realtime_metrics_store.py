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


def test_increment_project_event_counter(store: base.RealtimeMetricsStore) -> None:
    store.increment_project_event_counter(17, 1147)
    counter = store.get("symbolicate_event_low_priority:17:1140")
    assert counter == "1"
    time.sleep(0.5)
    counter = store.get("symbolicate_event_low_priority:17:1140")
    assert counter is None


def test_increment_project_event_counter_twice(store: base.RealtimeMetricsStore) -> None:
    store.increment_project_event_counter(17, 1147)
    time.sleep(0.2)
    store.increment_project_event_counter(17, 1149)
    counter = store.get("symbolicate_event_low_priority:17:1140")
    assert counter == "2"
    time.sleep(0.3)
    # it should have expired by now
    counter = store.get("symbolicate_event_low_priority:17:1140")
    assert counter is None


def test_increment_project_event_counter_multiple(store: base.RealtimeMetricsStore) -> None:
    store.increment_project_event_counter(17, 1147)
    store.increment_project_event_counter(17, 1152)

    assert store.get("symbolicate_event_low_priority:17:1140") == "1"
    assert store.get("symbolicate_event_low_priority:17:1150") == "1"
