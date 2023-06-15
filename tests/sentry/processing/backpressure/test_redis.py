from sentry.processing.backpressure.memory import iter_cluster_memory_usage
from sentry.utils import redis


def test_returns_some_usage() -> None:
    cluster = redis.redis_clusters.get("default")

    usage = [usage for usage in iter_cluster_memory_usage(cluster)]
    assert len(usage) > 0
    memory = usage[0]
    assert memory.used > 0
    assert memory.available > 0
    assert 0.0 < memory.percentage < 1.0
