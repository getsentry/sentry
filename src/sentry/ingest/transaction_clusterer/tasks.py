from sentry import features
from sentry.tasks.base import instrumented_task

from . import rules
from .datasource import redis
from .tree import TreeClusterer

MERGE_THRESHOLD = 100


@instrumented_task(
    name="sentry.ingest.transaction_clusterer.tasks.run_clusterer",
    queue="txcluster",
    soft_timeout=60 * 60,
    # TODO: set appropriate soft_timeout
)
def run_clusterer(**kwargs):
    # TODO: Avoid scanning redis when no organization has the feature flag enabled
    for project in redis.get_active_projects():
        if features.has("organizations:transaction-name-clusterer", project.organization):
            clusterer = TreeClusterer(merge_threshold=MERGE_THRESHOLD)
            clusterer.add_input(redis.get_transaction_names(project))
            new_rules = clusterer.get_rules()
            rules.update(project, new_rules)
