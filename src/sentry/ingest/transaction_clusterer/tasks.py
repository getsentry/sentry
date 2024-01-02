import logging
from itertools import islice
from typing import Any, Sequence

import sentry_sdk

from sentry import features
from sentry.ingest.transaction_clusterer.base import ReplacementRule
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

from . import ClustererNamespace, rules
from .datasource import redis
from .meta import track_clusterer_run
from .tree import TreeClusterer

logger_transactions = logging.getLogger("sentry.ingest.transaction_clusterer.tasks")

#: Minimum number of children in the URL tree which triggers a merge.
#: See ``TreeClusterer`` for more information.
#: NOTE: We could make this configurable through django settings or even per-project in the future.
#: Minimum number of children in the URL tree which triggers a merge.
#: See TreeClusterer for more information.
#: NOTE: We could make this configurable through django settings or even per-project in the future.
MERGE_THRESHOLD = 200

#: We're only using span clustering for resource spans right now, where we expect path segments to be either
#: very low-cardinality or very high-cardinality, so we can use a more aggressive threshold.
MERGE_THRESHOLD_SPANS = 50

#: Number of projects to process in one celery task
#: The number 100 was chosen at random and might still need tweaking.
PROJECTS_PER_TASK = 100

#: Estimated limit for a clusterer run per project, in seconds.
#: NOTE: using this in a per-project basis may not be enough. Consider using
#: this estimation for project batches instead.
CLUSTERING_TIMEOUT_PER_PROJECT = 0.15


@instrumented_task(
    name="sentry.ingest.transaction_clusterer.tasks.spawn_clusterers",
    queue="transactions.name_clusterer",
    default_retry_delay=5,  # copied from release monitor
    max_retries=5,  # copied from release monitor
)
def spawn_clusterers(**kwargs: Any) -> None:
    """Look for existing transaction name sets in redis and spawn clusterers for each"""
    with sentry_sdk.start_span(op="txcluster_spawn"):
        project_count = 0
        project_iter = redis.get_active_projects(ClustererNamespace.TRANSACTIONS)
        while batch := list(islice(project_iter, PROJECTS_PER_TASK)):
            project_count += len(batch)
            cluster_projects.delay(batch)

        metrics.incr("txcluster.spawned_projects", amount=project_count, sample_rate=1.0)


@instrumented_task(
    name="sentry.ingest.transaction_clusterer.tasks.cluster_projects",
    queue="transactions.name_clusterer",
    default_retry_delay=5,  # copied from release monitor
    max_retries=5,  # copied from release monitor
    soft_time_limit=PROJECTS_PER_TASK * CLUSTERING_TIMEOUT_PER_PROJECT,
    time_limit=PROJECTS_PER_TASK * CLUSTERING_TIMEOUT_PER_PROJECT + 2,  # extra 2s to emit metrics
)
def cluster_projects(projects: Sequence[Project]) -> None:
    pending = set(projects)
    num_clustered = 0
    try:
        for project in projects:
            with sentry_sdk.start_span(op="txcluster_project") as span:
                span.set_data("project_id", project.id)
                tx_names = list(redis.get_transaction_names(project))
                new_rules = []
                if len(tx_names) >= MERGE_THRESHOLD:
                    clusterer = TreeClusterer(merge_threshold=MERGE_THRESHOLD)
                    clusterer.add_input(tx_names)
                    new_rules = clusterer.get_rules()

                track_clusterer_run(ClustererNamespace.TRANSACTIONS, project)

                # The Redis store may have more up-to-date last_seen values,
                # so we must update the stores to bring these values to
                # project options, even if there aren't any new rules.
                num_rules_added = rules.update_rules(
                    ClustererNamespace.TRANSACTIONS, project, new_rules
                )

                # Track a global counter of new rules:
                metrics.incr("txcluster.new_rules_discovered", num_rules_added)

                # Clear transaction names to prevent the set from picking up
                # noise over a long time range.
                redis.clear_samples(ClustererNamespace.TRANSACTIONS, project)
            pending.remove(project)
            num_clustered += 1
    finally:
        metrics.incr(
            "txcluster.cluster_projects",
            amount=num_clustered,
            tags={"clustered": True},
            sample_rate=1.0,
        )
        unclustered = len(projects) - num_clustered
        if unclustered > 0:
            metrics.incr(
                "txcluster.cluster_projects",
                amount=unclustered,
                tags={"clustered": False},
                sample_rate=1.0,
            )
            logger_transactions.error(
                "Transaction clusterer missed projects",
                extra={
                    "projects.total": len(projects),
                    "projects.unclustered.number": unclustered,
                    "projects.unclustered.ids": [p.id for p in pending],
                },
            )


@instrumented_task(
    name="sentry.ingest.span_clusterer.tasks.spawn_span_cluster_projects",
    queue="transactions.name_clusterer",  # XXX(iker): we should use a different queue
    default_retry_delay=5,  # copied from transaction name clusterer
    max_retries=5,  # copied from transaction name clusterer
)
def spawn_clusterers_span_descs(**kwargs: Any) -> None:
    """Look for existing span description sets in redis and spawn clusterers for each"""
    with sentry_sdk.start_span(op="span_descs-cluster_spawn"):
        project_count = 0
        project_iter = redis.get_active_projects(ClustererNamespace.SPANS)
        project_iter = (
            p for p in project_iter if features.has("projects:span-metrics-extraction", p)
        )
        while batch := list(islice(project_iter, PROJECTS_PER_TASK)):
            project_count += len(batch)
            cluster_projects_span_descs.delay(batch)

        metrics.incr("span_descs-spawned_projects", amount=project_count, sample_rate=1.0)


@instrumented_task(
    name="sentry.ingest.span_clusterer.tasks.cluster_projects_span_descs",
    queue="transactions.name_clusterer",  # XXX(iker): we should use a different queue
    default_retry_delay=5,  # copied from transaction name clusterer
    max_retries=5,  # copied from transaction name clusterer
    soft_time_limit=PROJECTS_PER_TASK * CLUSTERING_TIMEOUT_PER_PROJECT,
    time_limit=PROJECTS_PER_TASK * CLUSTERING_TIMEOUT_PER_PROJECT + 2,  # extra 2s to emit metrics
)
def cluster_projects_span_descs(projects: Sequence[Project]) -> None:
    num_clustered = 0
    try:
        for project in projects:
            with sentry_sdk.start_span(op="span_descs-cluster") as span:
                span.set_data("project_id", project.id)
                descriptions = list(redis.get_span_descriptions(project))
                new_rules = []
                if len(descriptions) >= MERGE_THRESHOLD_SPANS:
                    clusterer = TreeClusterer(merge_threshold=MERGE_THRESHOLD_SPANS)
                    clusterer.add_input(descriptions)
                    new_rules = clusterer.get_rules()
                    # Span description rules must match a prefix in the string
                    # (HTTP verb, domain...), but we only feed the URL path to
                    # the clusterer to avoid scrubbing other tokens. The prefix
                    # `**` in the glob ensures we match the prefix but we don't
                    # scrub it.
                    new_rules = [ReplacementRule(r) for r in new_rules]

                track_clusterer_run(ClustererNamespace.SPANS, project)

                # The Redis store may have more up-to-date last_seen values,
                # so we must update the stores to bring these values to
                # project options, even if there aren't any new rules.
                num_rules_added = rules.update_rules(ClustererNamespace.SPANS, project, new_rules)

                # Track a global counter of new rules:
                metrics.incr("span_descs.new_rules_discovered", num_rules_added, sample_rate=1.0)

                # Clear transaction names to prevent the set from picking up
                # noise over a long time range.
                redis.clear_samples(ClustererNamespace.SPANS, project)
            num_clustered += 1
    finally:
        unclustered = len(projects) - num_clustered
        if unclustered > 0:
            metrics.incr(
                "span_descs.cluster_projects.unclustered", amount=unclustered, sample_rate=1.0
            )
