from typing import List

import sentry_sdk
from django.conf import settings
from django.db import router

from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleIndex,
    ArtifactBundleIndexingState,
)
from sentry.utils import metrics, redis
from sentry.utils.db import atomic_transaction

# We want to keep the bundle as being indexed for 600 seconds = 10 minutes. We might need to revise this number and
# optimize it based on the time taken to perform the indexing (on average).
INDEXING_CACHE_TIMEOUT = 600


def get_redis_cluster_for_artifact_bundles():
    cluster_key = settings.SENTRY_ARTIFACT_BUNDLES_INDEXING_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)


def _generate_artifact_bundle_indexing_state_cache_key(
    organization_id: int, artifact_bundle_id: int
) -> str:
    return f"ab::o:{organization_id}:b:{artifact_bundle_id}:bundle_indexing_state"


def set_artifact_bundle_being_indexed_if_null(
    organization_id: int, artifact_bundle_id: int
) -> bool:
    redis_client = get_redis_cluster_for_artifact_bundles()
    cache_key = _generate_artifact_bundle_indexing_state_cache_key(
        organization_id, artifact_bundle_id
    )
    # This function will return true only if the update is applied because there was no value set in memory.
    #
    # For now the state will just contain one, since it's unary but in case we would like to expand it, it will be
    # straightforward by just using a set of integers.
    return redis_client.set(cache_key, 1, ex=INDEXING_CACHE_TIMEOUT, nx=True)


def remove_artifact_bundle_indexing_state(organization_id: int, artifact_bundle_id: int) -> None:
    redis_client = get_redis_cluster_for_artifact_bundles()
    cache_key = _generate_artifact_bundle_indexing_state_cache_key(
        organization_id, artifact_bundle_id
    )
    redis_client.delete(cache_key)


def index_artifact_bundles_for_release(
    organization_id: int, artifact_bundles: List[ArtifactBundle], release: str, dist: str
) -> None:
    """
    This indexes the contents of `artifact_bundles` into the database, using the given `release` and `dist` pair.

    Synchronization is achieved using a mixture of redis cache with transient state and a binary state in the database.
    """

    for artifact_bundle in artifact_bundles:
        try:
            if not set_artifact_bundle_being_indexed_if_null(
                organization_id=organization_id, artifact_bundle_id=artifact_bundle.id
            ):
                # A different asynchronous job is taking care of this bundle.
                metrics.incr("artifact_bundle_indexing.bundle_already_being_indexed")
                continue

            _index_urls_in_bundle(organization_id, artifact_bundle, release, dist)
        except Exception as e:
            # We want to catch the error and continue execution, since we can try to index the other bundles.
            metrics.incr("artifact_bundle_indexing.index_single_artifact_bundle_error")
            sentry_sdk.capture_exception(e)

            # TODO: Do we want to `remove_artifact_bundle_indexing_state` here so that
            # a different job can retry this? Probably not, as we want to at the very least
            # debounce this in case there is a persistent error?


def _index_urls_in_bundle(
    organization_id: int,
    artifact_bundle: ArtifactBundle,
    release: str,
    dist: str,
):
    # We first open up the bundle and extract all the things we want to index from it.
    archive = ArtifactBundleArchive(artifact_bundle.file.getfile(), build_memory_map=False)
    urls_to_index = []
    try:
        for info in archive.get_files().values():
            if url := info.get("url"):
                urls_to_index.append(
                    ArtifactBundleIndex(
                        # key:
                        organization_id=organization_id,
                        release_name=release,
                        dist_name=dist,
                        url=url,
                        # value:
                        artifact_bundle_id=artifact_bundle.id,
                        # metadata:
                        date_last_modified=artifact_bundle.date_last_modified
                        or artifact_bundle.date_added,
                        date_added=artifact_bundle.date_added,
                    )
                )
    finally:
        archive.close()

    # We want to start a transaction for each bundle, so that in case of failures we keep consistency at the
    # bundle level, and we also have to retry only the failed bundle in the future and not all the bundles.
    with atomic_transaction(
        using=(
            router.db_for_write(ArtifactBundle),
            router.db_for_write(ArtifactBundleIndex),
        )
    ):
        # Since we use read committed isolation, the value we read here can change after query execution,
        # but we have this check in place for analytics purposes.
        bundle_was_indexed = ArtifactBundle.objects.filter(
            id=artifact_bundle.id,
            indexing_state=ArtifactBundleIndexingState.WAS_INDEXED.value,
        ).exists()
        # If the bundle was already indexed, we will skip insertion into the database.
        if bundle_was_indexed:
            metrics.incr("artifact_bundle_indexing.bundle_was_already_indexed")
            return

        # Insert the index
        ArtifactBundleIndex.objects.bulk_create(urls_to_index)

        # Mark the bundle as indexed
        ArtifactBundle.objects.filter(id=artifact_bundle.id).update(
            indexing_state=ArtifactBundleIndexingState.WAS_INDEXED.value
        )

        metrics.incr("artifact_bundle_indexing.bundles_indexed")
        metrics.incr("artifact_bundle_indexing.urls_indexed", len(urls_to_index))
