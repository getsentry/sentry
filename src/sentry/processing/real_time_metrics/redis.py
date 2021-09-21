from typing import Dict

from sentry.processing.real_time_metrics import base  # type: ignore
from sentry.utils import redis


def RedisRealTimeMetricsStore(**options: Dict[str, str]) -> base.RealTimeMetricsStore:
    cluster_name = options.pop("cluster_name")
    cluster = redis.redis_clusters.get(cluster_name)
    return base.RealTimeMetricsStore(cluster, **options)
