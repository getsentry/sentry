""" Write transactions into redis sets """
from typing import Any, Set

from django.conf import settings

from sentry import features
from sentry.eventstore.models import Event
from sentry.ingest.transaction_clusterer.datasource import TRANSACTION_SOURCE
from sentry.models import Project
from sentry.signals import transaction_processed
from sentry.utils import redis
from sentry.utils.safe import safe_execute

__all__ = ["store_transaction_name", "get_transaction_names"]


#: Maximum number of transaction names per project that we want
#: to store in redis.
MAX_SET_SIZE = 1000


add_to_set = redis.load_script("utils/sadd_capped.lua")


def get_redis_key(project: Project) -> str:
    return f"txnames:{project.organization_id}:{project.id}"


def get_redis_client() -> Any:
    cluster_key = getattr(settings, "SENTRY_TRANSACTION_NAMES_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)


def store_transaction_name(project: Project, transaction_name: str) -> None:
    client = get_redis_client()
    redis_key = get_redis_key(project)
    add_to_set(client, [redis_key], [transaction_name, MAX_SET_SIZE])


def get_transaction_names(project: Project) -> Set[str]:
    client = get_redis_client()
    redis_key = get_redis_key(project)

    # TODO: Not sure if this works for large sets in production
    return client.smembers(redis_key)


def record_transaction_name(project: Project, event: Event, **kwargs):
    source = (event.data.get("transaction_info") or {}).get("source")
    if (
        source == TRANSACTION_SOURCE
        and event.transaction
        and features.has("organizations:transaction-name-clusterer", project.organization)
    ):
        safe_execute(store_transaction_name, project, event.transaction)


transaction_processed.connect(record_transaction_name, weak=False)
