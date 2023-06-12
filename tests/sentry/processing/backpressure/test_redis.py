from sentry.processing.backpressure.redis import RedisMemoryUsageMetrics
from sentry.utils import redis


def test_returns_some_usage() -> None:
    client = redis.redis_clusters.get("default")
    metrics = RedisMemoryUsageMetrics([client])

    usage = metrics.query_usage_percentage()
    assert 0 < usage < 1
