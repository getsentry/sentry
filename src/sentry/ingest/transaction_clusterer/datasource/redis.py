""" Write transactions into redis sets """
import logging
from typing import Any, Iterator, Mapping

import sentry_sdk
from django.conf import settings

from sentry import features
from sentry.ingest.transaction_clusterer.datasource import (
    HTTP_404_TAG,
    TRANSACTION_SOURCE_SANITIZED,
    TRANSACTION_SOURCE_URL,
)
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
logger = logging.getLogger(__name__)


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
        try:
            yield Project.objects.get_from_cache(id=project_id)
        except Project.DoesNotExist:
            # The project has been deleted.
            # Could theoretically delete the key here, but it has a lifetime
            # of 24h, so probably not worth it.
            logger.debug("Could not find project %s in db", project_id)


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


def clear_transaction_names(project: Project) -> None:
    client = get_redis_client()
    redis_key = _get_redis_key(project)

    client.delete(redis_key)


def record_transaction_name(project: Project, event_data: Mapping[str, Any], **kwargs: Any) -> None:
    transaction_name = event_data.get("transaction")

    if (
        transaction_name
        and features.has("organizations:transaction-name-clusterer", project.organization)
        and _should_store_transaction_name(event_data)
    ):
        safe_execute(_store_transaction_name, project, transaction_name, _with_transaction=False)

        # TODO: For every transaction that had a rule applied to it, we should
        # bump the rule's lifetime here such that it stays alive while it is
        # being used.
        # For that purpose, we need to add the applied rule to the transaction
        # payload so we can check it here.


def _should_store_transaction_name(event_data: Mapping[str, Any]) -> bool:
    """Returns whether the given event must be stored as input for the
    transaction clusterer."""
    tags = event_data.get("tags")
    transaction_info = event_data.get("transaction_info") or {}
    source = transaction_info.get("source")

    # For now, we also feed back transactions into the clustering algorithm
    # that have already been sanitized, so we have a chance to discover
    # more high cardinality segments after partial sanitation.
    # For example, we may have sanitized `/orgs/*/projects/foo`,
    # But the clusterer has yet to discover `/orgs/*/projects/*`.
    #
    # Disadvantage: the load on redis does not decrease over time.
    #
    if source not in (TRANSACTION_SOURCE_URL, TRANSACTION_SOURCE_SANITIZED):
        return False

    if tags and HTTP_404_TAG in tags:
        return False

    return True
