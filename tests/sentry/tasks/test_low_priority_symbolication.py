import pytest

from sentry.tasks.low_priority_symbolication import calculation_magic
from sentry.utils import redis


@pytest.fixture
def redis_cluster() -> redis._RedisCluster:
    return redis.redis_clusters.get("default")


def test_calculation_magic():
    assert not calculation_magic([])
