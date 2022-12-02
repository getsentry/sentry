""" Write transactions into redis sets """
from typing import Any, Iterable

import sentry_sdk
from django.conf import settings

from sentry import features
from sentry.eventstore.models import Event
from sentry.ingest.transaction_clusterer.datasource import TRANSACTION_SOURCE
from sentry.models import Project
from sentry.utils import redis
from sentry.utils.safe import safe_execute

#: Maximum number of transaction names per project that we want
#: to store in redis.
MAX_SET_SIZE = 1000

#: Retention of a set.
#: Remove the set if it has not received any updates for 24 hours.
SET_TTL = 24 * 60 * 60

REDIS_KEY_PREFIX = "txnames:"

add_to_set = redis.load_script("utils/sadd_capped.lua")


def _get_redis_key(project: Project) -> str:
    return f"{REDIS_KEY_PREFIX}{project.organization_id}:{project.id}"


def _get_redis_client() -> Any:
    cluster_key = getattr(settings, "SENTRY_TRANSACTION_NAMES_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)


def _get_all_keys() -> Iterable[str]:
    client = _get_redis_client()
    return client.scan_iter(match=f"{REDIS_KEY_PREFIX}*")


def get_active_projects() -> Iterable[Project]:
    """Scan redis for projects and fetch their db models"""
    for key in _get_all_keys():
        project_id = int(key.split(":")[-1])
        yield Project.objects.get_from_cache(id=project_id)


def _store_transaction_name(project: Project, transaction_name: str) -> None:
    with sentry_sdk.start_span(op="txcluster.store_transaction_name"):
        client = _get_redis_client()
        redis_key = _get_redis_key(project)
        add_to_set(client, [redis_key], [transaction_name, MAX_SET_SIZE, SET_TTL])


def get_transaction_names(project: Project) -> Iterable[str]:
    """Return all transaction names stored for the given project"""
    client = _get_redis_client()
    redis_key = _get_redis_key(project)

    return client.sscan_iter(redis_key)  # type: ignore


def record_transaction_name(project: Project, event: Event, **kwargs: Any) -> None:
    source = (event.data.get("transaction_info") or {}).get("source")
    if (
        source == TRANSACTION_SOURCE
        and event.transaction
        and features.has("organizations:transaction-name-clusterer", project.organization)
    ):
        safe_execute(_store_transaction_name, project, event.transaction, _with_transaction=False)
