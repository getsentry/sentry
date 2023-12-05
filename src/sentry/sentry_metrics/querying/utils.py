import re
from typing import Any

from django.conf import settings

from sentry.utils import redis


def get_redis_client_for_metrics_meta() -> Any:
    """
    Returns the redis client which is used for the Redis cluster that stores metrics metadata.
    """
    cluster_key = settings.SENTRY_METRIC_META_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)


def fnv1a_32(data: bytes) -> int:
    """
    Fowler–Noll–Vo hash function 32 bit implementation.
    """
    fnv_init = 0x811C9DC5
    fnv_prime = 0x01000193
    fnv_size = 2**32

    result_hash = fnv_init
    for byte in data:
        result_hash ^= byte
        result_hash = (result_hash * fnv_prime) % fnv_size

    return result_hash


def remove_if_match(pattern, string: str) -> str:
    """
    Removes a pattern from a string.
    """
    # Use the re.sub function to replace the matched characters with an empty string
    return re.sub(pattern, "", string)
