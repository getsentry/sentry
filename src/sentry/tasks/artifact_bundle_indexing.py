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
def index_artifact_bundle(artifact_bundle: ArtifactBundle, identifier: FlatFileIdentifier):
    with metrics.timer("tasks.artifact_bundle_indexing.index_artifact_bundle"):
        indexing_result = index_bundle_in_flat_file(artifact_bundle, identifier)

    if indexing_result == FlatFileIndexingState.CONFLICT:
        # In case of conflict, we want to retry the same function in a few seconds.
        index_artifact_bundle.apply_async(
            (artifact_bundle, identifier), countdown=RETRIAL_DELAY_IN_SECONDS
        )
        metrics.incr("tasks.artifact_bundle_indexing.retry_indexing")
    elif indexing_result == FlatFileIndexingState.ERROR:
        # TODO: decide how to handle error cases (we might want to mark this specific entry has errored and have a job
        #  to perform indexing again).
        pass
