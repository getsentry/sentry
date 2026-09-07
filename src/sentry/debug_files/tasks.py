from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import attachments_tasks


@instrumented_task(
    name="sentry.debug_files.tasks.backfill_artifact_bundle_db_indexing",
    namespace=attachments_tasks,
)
def backfill_artifact_bundle_db_indexing(organization_id: int, release: str, dist: str) -> None:
    from .artifact_bundles import backfill_artifact_bundle_db_indexing as do_backfill

    do_backfill(organization_id, release, dist)
