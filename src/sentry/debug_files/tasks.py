from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.debug_files.tasks.backfill_artifact_index_updates",
    queue="assemble",
)
def backfill_artifact_index_updates():
    from .artifact_bundle_indexing import backfill_artifact_index_updates as do_backfill

    # If we hit our batch size, immediately schedule the task again to continue backfilling.
    # Otherwise, only relying on a timer would mean we would accumulate a backlog over time.
    hit_batch_size = do_backfill()
    if hit_batch_size:
        backfill_artifact_index_updates.delay()


@instrumented_task(
    name="sentry.debug_files.tasks.refresh_artifact_bundles_in_use",
    queue="assemble",
)
def refresh_artifact_bundles_in_use():
    from .artifact_bundles import refresh_artifact_bundles_in_use as do_refresh

    do_refresh()


@instrumented_task(
    name="sentry.debug_files.tasks.backfill_artifact_bundle_db_indexing",
    queue="assemble",
)
def backfill_artifact_bundle_db_indexing(organization_id: int, release: str, dist: str):
    from .artifact_bundles import backfill_artifact_bundle_db_indexing as do_backfill

    do_backfill(organization_id, release, dist)
