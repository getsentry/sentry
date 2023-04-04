from itertools import islice
from typing import Any, Sequence

import sentry_sdk
from django.conf import settings

from sentry import features
from sentry.models import Project
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

from . import rules
from .datasource import redis
from .tree import TreeClusterer

#: Minimum number of children in the URL tree which triggers a merge.
#: See ``TreeClusterer`` for more information.
#: NOTE: We could make this configurable through django settings or even per-project in the future.
#: Minimum number of children in the URL tree which triggers a merge.
#: See TreeClusterer for more information.
#: NOTE: We could make this configurable through django settings or even per-project in the future.
MERGE_THRESHOLD = 200

#: Number of projects to process in one celery task
#: The number 100 was chosen at random and might still need tweaking.
PROJECTS_PER_TASK = 100


@instrumented_task(
    name="sentry.ingest.transaction_clusterer.tasks.spawn_clusterers",
    queue="transactions.name_clusterer",
    default_retry_delay=5,  # copied from release monitor
    max_retries=5,  # copied from release monitor
)  # type: ignore
def spawn_clusterers(**kwargs: Any) -> None:
    """Look for existing transaction name sets in redis and spawn clusterers for each"""
    if not settings.SENTRY_TRANSACTION_CLUSTERER_RUN:
        return
    with sentry_sdk.start_span(op="txcluster_spawn"):
        project_count = 0
        project_iter = redis.get_active_projects()
        while batch := list(islice(project_iter, PROJECTS_PER_TASK)):
            project_count += len(batch)
            cluster_projects.delay(batch)

        metrics.incr("txcluster.spawned_projects", amount=project_count, sample_rate=1.0)


@instrumented_task(
    name="sentry.ingest.transaction_clusterer.tasks.cluster_projects",
    queue="transactions.name_clusterer",
    default_retry_delay=5,  # copied from release monitor
    max_retries=5,  # copied from release monitor
)  # type: ignore
def cluster_projects(projects: Sequence[Project]) -> None:
    for project in projects:
        # NOTE: The probability that the feature flag is True is high, because
        # we know at this point that a redis set exists for the project.
        # It's still worth checking the feature flag though, because we don't
        # want to keep clustering projects for which the feature flag has been
        # turned off.
        if features.has("organizations:transaction-name-clusterer", project.organization):
            with sentry_sdk.start_span(op="txcluster_project") as span:
                span.set_data("project_id", project.id)
                tx_names = list(redis.get_transaction_names(project))
                new_rules = []
                if len(tx_names) >= redis.MAX_SET_SIZE:
                    clusterer = TreeClusterer(merge_threshold=MERGE_THRESHOLD)
                    clusterer.add_input(tx_names)
                    new_rules = clusterer.get_rules()

                # The Redis store may have more up-to-date last_seen values,
                # so we must update the stores to bring these values to
                # project options, even if there aren't any new rules.
                rules.update_rules(project, new_rules)

                # Clear transaction names to prevent the set from picking up
                # noise over a long time range.
                redis.clear_transaction_names(project)
