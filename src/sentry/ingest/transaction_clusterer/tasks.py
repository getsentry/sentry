from typing import Any

import sentry_sdk
from django.conf import settings

from sentry import features
from sentry.tasks.base import instrumented_task

from . import rules
from .datasource import redis
from .tree import TreeClusterer

#: Minimum number of children in the URL tree which triggers a merge.
#: See ``TreeClusterer`` for more information.
#: NOTE: We could make this configurable through django settings or even per-project in the future.
#: Minimum number of children in the URL tree which triggers a merge.
#: See TreeClusterer for more information.
#: NOTE: We could make this configurable through django settings or even per-project in the future.
MERGE_THRESHOLD = 100


@instrumented_task(
    name="sentry.ingest.transaction_clusterer.tasks.run_clusterer",
    queue="transactions.name_clusterer",
    soft_timeout=60 * 60,
    # TODO: set appropriate soft_timeout
)  # type: ignore
def run_clusterer(**kwargs: Any) -> None:
    if not settings.SENTRY_TRANSACTION_CLUSTERER_RUN:
        return
    with sentry_sdk.start_span(op="txcluster_run"):
        for project in redis.get_active_projects():
            if features.has("organizations:transaction-name-clusterer", project.organization):
                with sentry_sdk.start_span(op="txcluster_project") as span:
                    span.set_data("project_id", project.id)
                    clusterer = TreeClusterer(merge_threshold=MERGE_THRESHOLD)
                    clusterer.add_input(redis.get_transaction_names(project))
                    new_rules = clusterer.get_rules()
                    rules.update_rules(project, new_rules)
