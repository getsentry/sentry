"""Write transactions into redis sets"""

import logging
from collections.abc import Callable, Iterator, Mapping, Sequence
from typing import Any

import orjson
import sentry_sdk
from django.conf import settings
from rediscluster import RedisCluster
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.ingest.transaction_clusterer.datasource import (
    HTTP_404_TAG,
    TRANSACTION_SOURCE_SANITIZED,
    TRANSACTION_SOURCE_URL,
)
from sentry.models.project import Project
from sentry.options.rollout import in_random_rollout
from sentry.spans.consumers.process_segments.types import CompatibleSpan, attribute_value
from sentry.utils import redis
from sentry.utils.safe import safe_execute

#: Maximum number of transaction names per project that we want
#: to store in redis.
MAX_SET_SIZE = 4000

#: Retention of a set.
#: Remove the set if it has not received any updates for 24 hours.
SET_TTL = 24 * 60 * 60


# TODO(iker): accept multiple values to add to the set. Right now, multiple
# calls for each individual value are required, producing too many Redis calls.
add_to_set = redis.load_redis_script("utils/sadd_capped.lua")
logger = logging.getLogger(__name__)


def _get_redis_key(namespace: ClustererNamespace, project: Project) -> str:
    prefix = namespace.value.data
    return f"{prefix}:o:{project.organization_id}:p:{project.id}"


def _get_projects_key(namespace: ClustererNamespace) -> str:
    """The key for the meta-set of projects"""
    prefix = namespace.value.data
    return f"{prefix}:projects"


def get_redis_client() -> RedisCluster:
    cluster_key = settings.SENTRY_TRANSACTION_NAMES_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]


def _get_all_keys(namespace: ClustererNamespace) -> Iterator[str]:
    client = get_redis_client()
    return client.sscan_iter(_get_projects_key(namespace))


def get_active_projects(namespace: ClustererNamespace) -> Iterator[Project]:
    """Scan redis for projects and fetch their db models"""
    for key in _get_all_keys(namespace):
        project_id = int(key)
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


def get_active_project_ids(namespace: ClustererNamespace) -> Iterator[int]:
    """
    Scan redis for projects and fetch their ids.

    Unlike get_active_projects(), this will include ids for projects
    that have been deleted since clustering was scheduled.
    """
    for key in _get_all_keys(namespace):
        yield int(key)


def _record_sample(namespace: ClustererNamespace, project: Project, sample: str) -> None:
    with sentry_sdk.start_span(op=f"cluster.{namespace.value.name}.record_sample"):
        client = get_redis_client()
        redis_key = _get_redis_key(namespace, project)
        created = add_to_set([redis_key], [sample, MAX_SET_SIZE, SET_TTL], client)
        if created:
            projects_key = _get_projects_key(namespace)
            client.sadd(projects_key, project.id)
            client.expire(projects_key, SET_TTL)


def get_transaction_names(project: Project) -> Iterator[str]:
    """Return all transaction names stored for the given project"""
    client = get_redis_client()
    redis_key = _get_redis_key(ClustererNamespace.TRANSACTIONS, project)

    return client.sscan_iter(redis_key)


def clear_samples(namespace: ClustererNamespace, project: Project) -> None:
    client = get_redis_client()

    projects_key = _get_projects_key(namespace)
    client.srem(projects_key, project.id)

    redis_key = _get_redis_key(namespace, project)
    client.unlink(redis_key)


def record_transaction_name(project: Project, event_data: Mapping[str, Any], **kwargs: Any) -> None:
    if transaction_name := _should_store_transaction_name(event_data):
        safe_execute(
            _record_sample,
            ClustererNamespace.TRANSACTIONS,
            project,
            transaction_name,
        )
        if in_random_rollout("txnames.bump-lifetime-sample-rate"):
            safe_execute(_bump_rule_lifetime, project, event_data)


def record_segment_name(project: Project, segment_span: CompatibleSpan) -> None:
    if segment_name := _should_store_segment_name(segment_span):
        safe_execute(
            _record_sample,
            ClustererNamespace.TRANSACTIONS,
            project,
            segment_name,
        )
        if in_random_rollout("txnames.bump-lifetime-sample-rate"):
            safe_execute(
                _bump_rule_lifetime_for_segment,
                project,
                segment_span,
            )


def _should_store_transaction_name(event_data: Mapping[str, Any]) -> str | None:
    transaction_name = event_data.get("transaction")
    transaction_info = event_data.get("transaction_info") or {}
    source = transaction_info.get("source")

    def is_404() -> bool:
        tags = event_data.get("tags") or []
        return HTTP_404_TAG in tags

    return _should_store_segment_name_inner(transaction_name, source, is_404)


def _should_store_segment_name(segment_span: CompatibleSpan) -> str | None:
    segment_name = attribute_value(
        segment_span, ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME
    ) or segment_span.get("name")
    source = attribute_value(segment_span, ATTRIBUTE_NAMES.SENTRY_SPAN_SOURCE)

    def is_404() -> bool:
        status_code = attribute_value(segment_span, ATTRIBUTE_NAMES.HTTP_RESPONSE_STATUS_CODE)
        return status_code == 404

    return _should_store_segment_name_inner(segment_name, source, is_404)


def _should_store_segment_name_inner(
    name: str | None, source: str | None, is_404: Callable[[], bool]
) -> str | None:
    if not name:
        return None
    source_matches = source in (TRANSACTION_SOURCE_URL, TRANSACTION_SOURCE_SANITIZED) or (
        # Relay leaves source None if it expects it to be high cardinality, (otherwise it sets it to "unknown")
        # (see https://github.com/getsentry/relay/blob/2d07bef86415cc0ae8af01d16baecde10cdb23a6/relay-general/src/store/transactions/processor.rs#L369-L373).
        #
        # Our data shows that a majority of these `None` source transactions contain slashes, so treat them as URL transactions:
        source is None
        and "/" in name
    )
    if not source_matches:
        return None
    if is_404():
        return None
    return name


def _bump_rule_lifetime(project: Project, event_data: Mapping[str, Any]) -> None:
    applied_rules = event_data.get("_meta", {}).get("transaction", {}).get("", {}).get("rem", [])
    _bump_rule_lifetime_inner(project, applied_rules)


def _bump_rule_lifetime_for_segment(project: Project, segment_span: CompatibleSpan) -> None:
    meta_str: str | None = attribute_value(
        segment_span, f"sentry._meta.fields.attributes.{ATTRIBUTE_NAMES.SENTRY_SEGMENT_NAME}"
    )
    if meta_str:
        meta = orjson.loads(meta_str)
        applied_rules = meta.get("meta", {}).get("", {}).get("rem", [])
        _bump_rule_lifetime_inner(project, applied_rules)


def _bump_rule_lifetime_inner(project: Project, applied_rules: Sequence):
    from sentry.ingest.transaction_clusterer import rules as clusterer_rules

    if not applied_rules:
        return

    for applied_rule in applied_rules:
        # There are two types of rules:
        # Transaction clustering rules  -- ["<pattern>", "<action>"]
        # Other rules                   -- ["<reason>", "<action>", <from>, <to>]
        # We are only looking at the transaction clustering rules, so checking
        # for the length of the array should be enough.
        if len(applied_rule) == 2:
            pattern = applied_rule[0]
            # Only one clustering rule is applied per project
            clusterer_rules.bump_last_used(ClustererNamespace.TRANSACTIONS, project, pattern)
            return
