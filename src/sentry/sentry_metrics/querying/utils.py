import re

from django.conf import settings
from rediscluster import RedisCluster

from sentry.utils import redis


def get_redis_client_for_metrics_meta() -> RedisCluster:
    """
    Returns the redis client which is used for the Redis cluster that stores metrics metadata.
    """
    cluster_key = settings.SENTRY_METRIC_META_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]


def remove_if_match(pattern, string: str) -> str:
    """
    Removes a pattern from a string.
    """
    # Use the re.sub function to replace the matched characters with an empty string
    return re.sub(pattern, "", string)
