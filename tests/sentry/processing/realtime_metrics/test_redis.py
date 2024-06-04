from datetime import datetime
from typing import Any

import pytest
from redis import StrictRedis

from sentry.exceptions import InvalidConfiguration
from sentry.processing import realtime_metrics
from sentry.processing.realtime_metrics.redis import RedisRealtimeMetricsStore
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import redis


@pytest.fixture
def config() -> dict[str, Any]:
    return {
        "cluster": "default",
        "budget_bucket_size": 10,
        "budget_time_window": 120,
        "backoff_timer": 1,
    }


@pytest.fixture
def redis_cluster(config: dict[str, Any]) -> StrictRedis:
    return redis.redis_clusters.get("default")


@pytest.fixture
def store(config: dict[str, Any]) -> RedisRealtimeMetricsStore:
    return RedisRealtimeMetricsStore(**config)


def test_default() -> None:
    with freeze_time(datetime.fromtimestamp(1234)):
        realtime_metrics.record_project_duration(17, 1.0)


def test_invalid_config() -> None:
    invalid_config: dict[str, Any] = {
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
