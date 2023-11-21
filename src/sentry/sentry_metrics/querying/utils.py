from typing import Any

from django.conf import settings

from sentry.utils import redis


def get_redis_client_for_ingest() -> Any:
    cluster_key = settings.SENTRY_DYNAMIC_SAMPLING_RULES_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)
