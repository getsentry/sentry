from sentry.processing.backpressure.redis import iter_cluster_memory_usage
from sentry.utils import redis


def test_returns_some_usage() -> None:
    cluster = redis.redis_clusters.get("default")

    usage = [usage for usage in iter_cluster_memory_usage(cluster)]
    assert len(usage) > 0
    used, available = usage[0]
    assert used > 0
    assert available > 0
    assert used < available
