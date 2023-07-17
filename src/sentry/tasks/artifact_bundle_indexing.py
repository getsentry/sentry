from sentry.debug_files.artifact_bundles import (
    FlatFileIdentifier,
    FlatFileIndexingState,
    index_bundle_in_flat_file,
)
from sentry.models import ArtifactBundle
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

RETRIAL_DELAY_IN_SECONDS = 10


@instrumented_task(
    name="sentry.tasks.artifact_bundle_indexing.index_artifact_bundle", queue="assemble"
)
def index_artifact_bundle(
    artifact_bundle_id: int, project_id: int, release: str, dist: str, *args, **kwargs
):
    try:
        artifact_bundle = ArtifactBundle.objects.get(id=artifact_bundle_id)
    except ArtifactBundle.DoesNotExist:
        artifact_bundle = None

    if artifact_bundle is None:
        # TODO: decide how to handle error cases (we might want to mark this specific entry has errored and have a job
        #  to perform indexing again).
        metrics.incr("tasks.artifact_bundle_indexing.artifact_bundle_id_not_found")
        return

    with metrics.timer("tasks.artifact_bundle_indexing.index_artifact_bundle"):
        indexing_result = index_bundle_in_flat_file(
            artifact_bundle, FlatFileIdentifier(project_id=project_id, release=release, dist=dist)
        )

    if indexing_result == FlatFileIndexingState.CONFLICT:
        # In case of conflict, we want to retry the same function in a few seconds.
        index_artifact_bundle.apply_async(
            (artifact_bundle.id, project_id, release, dist), countdown=RETRIAL_DELAY_IN_SECONDS
        )
        metrics.incr("tasks.artifact_bundle_indexing.retry_indexing")
    elif indexing_result == FlatFileIndexingState.ERROR:
        # TODO: decide how to handle error cases (we might want to mark this specific entry has errored and have a job
        #  to perform indexing again).
        pass
