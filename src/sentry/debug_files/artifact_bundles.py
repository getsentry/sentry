from collections import defaultdict
from datetime import datetime
from typing import DefaultDict, Dict, List, Set

import sentry_sdk
from django.conf import settings
from django.db import IntegrityError, router
from django.db.models import Q

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

    To avoid too much load and queries on the database, the provided `artifact_bundles` are first merged/deduplicated
    into an in-memory structure.

    Then, indexing of individual files happens in the following way:
    - If a key already exists with a higher `date_last_modified`, it is ignored
      as that indicates out-of-order calls of this method. We always want the
      most up-to-date bundle to win.
    - Otherwise, the key is created or updated to point to the `artifact_bundle`.

    This function is idempotent and such property makes it suitable for a more flexible implementation on the calling
    side.
    """

    # First: we check if all the bundles to index, are actually not being indexed by someone else. We could also check
    # if the bundles are actually not indexed in the db, but it's too expensive, and it will only save us some work in
    # specific cases.
    bundles_to_index = []

    for artifact_bundle in artifact_bundles:
        # For each bundle we will atomically check if it is not in progress before actually marking it as
        # `being indexed`. In order to do this atomic check, we will issue a single operation with cas semantics, which
        # will apply the insertion only if the specific key doesn't exist.
        if set_artifact_bundle_being_indexed_if_null(
            organization_id=organization_id, artifact_bundle_id=artifact_bundle.id
        ):
            bundles_to_index.append(artifact_bundle)
        else:
            # A different asynchronous job is taking care of this bundle.
            metrics.incr("artifact_bundle_indexing.bundle_already_being_indexed")

    artifact_bundles = bundles_to_index
    if not artifact_bundles:
        return

    # Second: we merge in-memory all the files of the bundles to index, in order to obtain the minimum set of changes
    # that we can apply on the database (e.g., two bundles with identical files will end up with just the newest files
    # actually indexed in the database).
    files_to_index: Dict[str, ArtifactBundle] = {}

    for artifact_bundle in artifact_bundles:
        archive = ArtifactBundleArchive(artifact_bundle.file.getfile(), build_memory_map=False)
        try:
            for info in archive.get_files().values():
                url = info.get("url")
                if url is None:
                    continue

                indexed = files_to_index.get(url)
                # In order to obtain a deterministic total order of bundles, we want to first compare their date and
                # then their id, just to discriminate in case of equal date.
                bundle_ordering = (artifact_bundle.date_last_modified, artifact_bundle.id)
                if not indexed or (indexed.date_last_modified, indexed.id) < bundle_ordering:
                    files_to_index[url] = artifact_bundle
        finally:
            archive.close()

    # Third: we commit the intended changes to the database, carefully merging with the state that already exists
    # in the database. We do so grouping by bundle, using one atomic transaction for the indexing and setting of
    # the indexed state as well.
    urls_by_bundle: DefaultDict[ArtifactBundle, Set[str]] = defaultdict(set)
    for url, bundle in files_to_index.items():
        urls_by_bundle[bundle].add(url)

    # The naming here is a bit confusing, it is the time we touched the index, and is used for partitioning the index
    # table and auto-expiration.
    date_added = datetime.now()

    # Finally: we have to loop over all bundles, since we have to mark all the ones we inspected as `was_indexed`,
    # irrespectively if we have urls to add for that bundle.
    for artifact_bundle in artifact_bundles:
        urls = urls_by_bundle.get(artifact_bundle, set())

        try:
            # We want to start a transaction for each bundle, so that in case of failures we keep consistency at the
            # bundle level, and we also have to retry only the failed bundle in the future and not all the bundles.
            with atomic_transaction(using=router.db_for_write(ArtifactBundle)):
                # Since we use read committed isolation, the value we read here can change after query execution, but
                # we have this check in place for analytics purposes.
                is_bundle_not_indexed = ArtifactBundle.objects.filter(
                    id=artifact_bundle.id,
                    indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
                ).exists()
                # If the bundle was already indexed, we will skip insertion into the database.
                if not is_bundle_not_indexed:
                    metrics.incr("artifact_bundle_indexing.bundle_was_already_indexed")
                    continue

                # Now we index the urls in the bundle.
                _index_urls_in_bundle(artifact_bundle, release, dist, date_added, urls)
        except Exception as e:
            # We want to catch the error and continue execution, since we can try to index the other bundles.
            sentry_sdk.capture_exception(e)

        # After the transaction was successful we could clean the redis cache, but it's fine to keep the value in
        # there and wait for auto-expiration.
        metrics.incr("artifact_bundle_indexing.bundles_indexed")
        metrics.incr("artifact_bundle_indexing.urls_indexed", len(urls))


def _index_urls_in_bundle(
    artifact_bundle: ArtifactBundle, release: str, dist: str, date_added: datetime, urls: Set[str]
):
    for url in urls:
        key = {
            "organization_id": artifact_bundle.organization_id,
            "release_name": release,
            "dist_name": dist,
            "url": url,
        }
        value = {
            "date_last_modified": artifact_bundle.date_last_modified,
            "date_added": date_added,
            "artifact_bundle_id": artifact_bundle.id,
        }
        # Also here we want to perform the comparison by falling back to id in case of equal dates.
        condition = Q(date_last_modified__lt=artifact_bundle.date_last_modified) | Q(
            date_last_modified=artifact_bundle.date_last_modified,
            artifact_bundle_id__lt=artifact_bundle.id,
        )

        # NOTE:
        # Ideally, we would want a single atomic query for this upsert.
        # This would be possible with postgres using:
        # `INSERT INTO ... $key $value ON CONFLICT DO UPDATE SET $value WHERE $condition`.
        # However, writing raw SQL would be too error-prone.
        # The builtin `update_or_create` functionality is also not up for the task,
        # as it does not support an additional update condition,
        # and would do even more queries, so we split this up into two separate queries:
        # - Try to update a matching row.
        # - Otherwise, try to insert it.
        # - Ignore any key conflicts. This happens if the row exists, but does not match the `condition`.
        did_update = ArtifactBundleIndex.objects.filter(
            condition,
            **key,
        ).update(**value)
        # The `did_update` result will be 0 in case:
        # 1. There is no value in the index
        # 2. There is a value but has higher timestamp or bundle id
        # We don't distinguish between them and since we don't, we might end up with duplicates into the
        # database and since we don't have uniqueness constraints (partitioning doesn't support them), we must
        # de-duplicate on the reading side.
        if not did_update:
            try:
                ArtifactBundleIndex.objects.create(
                    **key,
                    **value,
                )
            except IntegrityError:
                pass

    # We have to mark the bundle as indexed now.
    ArtifactBundle.objects.filter(id=artifact_bundle.id).update(
        indexing_state=ArtifactBundleIndexingState.WAS_INDEXED.value
    )
