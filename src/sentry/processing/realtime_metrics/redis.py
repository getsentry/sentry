from typing import Dict

from sentry.processing.realtime_metrics import base  # type: ignore
from sentry.utils import redis


def RedisRealtimeMetricsStore(**options: Dict[str, str]) -> base.RealtimeMetricsStore:
    cluster_name = options.pop("cluster_name")
    cluster = redis.redis_clusters.get(cluster_name)
    return base.RealtimeMetricsStore(cluster, **options)
