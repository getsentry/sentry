""" Write transactions into redis sets """
import logging
import random
from typing import Any, Iterator, Mapping, Optional
from urllib.parse import urlparse

import sentry_sdk
from django.conf import settings

from sentry import features, options
from sentry.ingest.transaction_clusterer import ClustererNamespace
from sentry.ingest.transaction_clusterer.datasource import (
    HTTP_404_TAG,
    TRANSACTION_SOURCE_SANITIZED,
    TRANSACTION_SOURCE_URL,
)
from sentry.models.project import Project
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
add_to_set = redis.load_script("utils/sadd_capped.lua")
logger = logging.getLogger(__name__)


def _get_redis_key(namespace: ClustererNamespace, project: Project) -> str:
    prefix = namespace.value.data
    return f"{prefix}:o:{project.organization_id}:p:{project.id}"


def _get_projects_key(namespace: ClustererNamespace) -> str:
    """The key for the meta-set of projects"""
    prefix = namespace.value.data
    return f"{prefix}:projects"


def get_redis_client() -> Any:
    # XXX(iker): we may want to revisit the decision of having a single Redis cluster.
    cluster_key = settings.SENTRY_TRANSACTION_NAMES_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)


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


def _record_sample(namespace: ClustererNamespace, project: Project, sample: str) -> None:
    with sentry_sdk.start_span(op="cluster.{namespace.value.name}.record_sample"):
        client = get_redis_client()
        redis_key = _get_redis_key(namespace, project)
        created = add_to_set(client, [redis_key], [sample, MAX_SET_SIZE, SET_TTL])
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
            _with_transaction=False,
        )
        sample_rate = options.get("txnames.bump-lifetime-sample-rate")
        if sample_rate and random.random() <= sample_rate:
            safe_execute(_bump_rule_lifetime, project, event_data, _with_transaction=False)


def _should_store_transaction_name(event_data: Mapping[str, Any]) -> Optional[str]:
    """Returns whether the given event must be stored as input for the
    transaction clusterer."""
    transaction_name = event_data.get("transaction")
    if not transaction_name:
        return None

    tags = event_data.get("tags") or {}
    transaction_info = event_data.get("transaction_info") or {}
    source = transaction_info.get("source")

    # We also feed back transactions into the clustering algorithm
    # that have already been sanitized, so we have a chance to discover
    # more high cardinality segments after partial sanitation.
    # For example, we may have sanitized `/orgs/*/projects/foo`,
    # But the clusterer has yet to discover `/orgs/*/projects/*`.
    #
    # Disadvantage: the load on redis does not decrease over time.
    #
    source_matches = source in (TRANSACTION_SOURCE_URL, TRANSACTION_SOURCE_SANITIZED) or (
        # Relay leaves source None if it expects it to be high cardinality, (otherwise it sets it to "unknown")
        # (see https://github.com/getsentry/relay/blob/2d07bef86415cc0ae8af01d16baecde10cdb23a6/relay-general/src/store/transactions/processor.rs#L369-L373).
        #
        # Our data shows that a majority of these `None` source transactions contain slashes, so treat them as URL transactions:
        source is None
        and "/" in transaction_name
    )

    if not source_matches:
        return None

    if tags and HTTP_404_TAG in tags:
        return None

    return transaction_name


def _bump_rule_lifetime(project: Project, event_data: Mapping[str, Any]) -> None:
    from sentry.ingest.transaction_clusterer import rules as clusterer_rules

    applied_rules = event_data.get("_meta", {}).get("transaction", {}).get("", {}).get("rem", {})
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


def get_span_descriptions(project: Project) -> Iterator[str]:
    """Return all span descriptions stored for the given project."""
    client = get_redis_client()
    redis_key = _get_redis_key(ClustererNamespace.SPANS, project)
    return client.sscan_iter(redis_key)


def record_span_descriptions(
    project: Project, event_data: Mapping[str, Any], **kwargs: Any
) -> None:
    if not features.has("projects:span-metrics-extraction", project):
        return

    spans = event_data.get("spans", [])
    for span in spans:
        description = _get_span_description_to_store(span)
        if not description:
            continue
        safe_execute(_record_sample, ClustererNamespace.SPANS, project, description)


def _get_span_description_to_store(span: Mapping[str, Any]) -> Optional[str]:
    if not span.get("op") in ("resource.css", "resource.script", "resource.img"):
        return None

    if url := span.get("description"):
        try:
            parsed = urlparse(url)
        except ValueError:
            return None
        return f"{parsed.netloc}{parsed.path}"

    return None


def _update_span_description_rule_lifetime(project: Project, event_data: Mapping[str, Any]) -> None:
    from sentry.ingest.transaction_clusterer import rules as clusterer_rules

    spans = event_data.get("_meta", {}).get("spans", {})
    for span in spans.values():
        sentry_tags = span.get("sentry_tags") or {}
        applied_rule = sentry_tags.get("description", {}).get("", {}).get("rem", [[]])[0]
        if not applied_rule:
            continue
        if len(applied_rule) == 2:
            uncleaned_pattern = applied_rule[0]
            # uncleaned_pattern has the following format: `description.scrubbed:<rule>`
            tokens = uncleaned_pattern.split("description:")
            pattern = tokens[1]
            clusterer_rules.bump_last_used(ClustererNamespace.SPANS, project, pattern)
