""" Write transactions into redis sets """
from typing import Any, Iterator, Mapping

import sentry_sdk
from django.conf import settings

from sentry import features
from sentry.ingest.transaction_clusterer.datasource import TRANSACTION_SOURCE_URL
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
    return f"{REDIS_KEY_PREFIX}o:{project.organization_id}:p:{project.id}"


def get_redis_client() -> Any:
    cluster_key = getattr(settings, "SENTRY_TRANSACTION_NAMES_REDIS_CLUSTER", "default")
    return redis.redis_clusters.get(cluster_key)


def _get_all_keys() -> Iterator[str]:
    client = get_redis_client()
    return client.scan_iter(match=f"{REDIS_KEY_PREFIX}*")  # type: ignore


def get_active_projects() -> Iterator[Project]:
    """Scan redis for projects and fetch their db models"""
    for key in _get_all_keys():
        project_id = int(key.split(":")[-1])
        # NOTE: Would be nice to do a `select_related` on project.organization
        # because we need it for the feature flag, but I don't know how to do
        # it with `get_from_cache`.
        yield Project.objects.get_from_cache(id=project_id)


def _store_transaction_name(project: Project, transaction_name: str) -> None:
    with sentry_sdk.start_span(op="txcluster.store_transaction_name"):
        client = get_redis_client()
        redis_key = _get_redis_key(project)
        add_to_set(client, [redis_key], [transaction_name, MAX_SET_SIZE, SET_TTL])


def get_transaction_names(project: Project) -> Iterator[str]:
    """Return all transaction names stored for the given project"""
    client = get_redis_client()
    redis_key = _get_redis_key(project)

    return client.sscan_iter(redis_key)  # type: ignore


def record_transaction_name(project: Project, event_data: Mapping[str, Any], **kwargs: Any) -> None:
    transaction_info = event_data.get("transaction_info") or {}

    transaction_name = event_data.get("transaction")
    source = transaction_info.get("source")
    if transaction_name and features.has(
        "organizations:transaction-name-clusterer", project.organization
    ):
        if source == TRANSACTION_SOURCE_URL:
            safe_execute(
                _store_transaction_name, project, transaction_name, _with_transaction=False
            )
        # TODO: For every transaction that had a rule applied to it, we should
        # bump the rule's lifetime here such that it stays alive while it is
        # being used.
        # For that purpose, we need to add the applied rule to the transaction
        # payload so we can check it here.
