from collections import defaultdict
from datetime import datetime
from typing import DefaultDict, Dict, List, Set

import sentry_sdk
from django.db import IntegrityError, router
from django.db.models import Q

from sentry.cache import default_cache
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleIndex,
    ArtifactBundleIndexingState,
)
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction

# We want to keep the bundle as being indexed for 600 seconds = 10 minutes. We might need to revise this number and
# optimize it based on the time taken to perform the indexing (on average).
INDEXING_CACHE_TIMEOUT = 600


def _generate_artifact_bundle_indexing_cache_key(
    organization_id: int, artifact_bundle_id: int
) -> str:
    return f"ab::o:{organization_id}:b:{artifact_bundle_id}:bundle_indexing_state"


def set_artifact_bundle_being_indexed_if_null(
    organization_id: int, artifact_bundle_id: int
) -> None:
    cache_key = _generate_artifact_bundle_indexing_cache_key(organization_id, artifact_bundle_id)
    default_cache.set(cache_key, 1, INDEXING_CACHE_TIMEOUT)


def is_artifact_bundle_being_indexed(organization_id: int, artifact_bundle_id: int) -> bool:
    cache_key = _generate_artifact_bundle_indexing_cache_key(organization_id, artifact_bundle_id)
    return default_cache.exists(cache_key)


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
    """

    # First: we check if all the bundles to index, are actually not being indexed by someone else. We could also check
    # if the bundles are actually not indexed in the db, but it's too expensive, and it will only save us some work in
    # specific cases.
    bundles_to_index = []

    for artifact_bundle in artifact_bundles:
        # For each bundle we want to check if it is being processed by another job, if not we will mark it as being
        # indexed. Since indexing is idempotent, we don't mind concurrency issues that might arise when the state is
        # modified concurrently.
        if not is_artifact_bundle_being_indexed(
            organization_id=organization_id, artifact_bundle_id=artifact_bundle.id
        ):
            set_artifact_bundle_being_indexed_if_null(
                organization_id=organization_id, artifact_bundle_id=artifact_bundle.id
            )
            bundles_to_index.append(artifact_bundle)
        else:
            # A different asynchronous job is taking care of this bundle.
            metrics.incr("artifact_bundle_indexing.conflict")

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
        except Exception as e:
            # We want to capture any errors happening during archive indexing.
            sentry_sdk.capture_exception(e)
        finally:
            archive.close()

    # Finally: we commit the intended changes to the database, carefully merging with the state that already exists
    # in the database. We do so grouping by bundle, using one atomic transaction for the indexing and setting of
    # the indexed state as well.
    urls_by_bundle: DefaultDict[ArtifactBundle, Set[str]] = defaultdict(set)
    for url, bundle in files_to_index.items():
        urls_by_bundle[bundle].add(url)

    # The naming here is a bit confusing, it is the time we touched the index, and is used for partitioning the index
    # table and auto-expiration.
    date_added = datetime.now()

    # We have to loop over all bundles, since we have to mark all the ones we inspected as `was_indexed`, irrespectively
    # if we have urls to add for that bundle.
    for artifact_bundle in artifact_bundles:
        try:
            urls = urls_by_bundle.get(artifact_bundle, set())
            # We want to start a transaction for each bundle, so that in case of failures we keep consistency at the
            # bundle level, and we also have to retry only the failed bundle in the future and not all the bundles.
            with atomic_transaction(
                using=(
                    router.db_for_write(ArtifactBundleIndex),
                    router.db_for_write(ArtifactBundle),
                )
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
                    if not did_update:
                        try:
                            ArtifactBundleIndex.objects.create(
                                **key,
                                **value,
                            )
                        except IntegrityError:
                            pass

                ArtifactBundle.objects.filter(id=artifact_bundle.id).update(
                    indexing_state=ArtifactBundleIndexingState.WAS_INDEXED.value
                )

            # After the transaction was successful we could clean the redis cache, but it's fine to keep the value in
            # there and wait for auto-expiration.
            metrics.incr("artifact_bundle_indexing.bundles_indexed")
            metrics.incr("artifact_bundle_indexing.urls_indexed", len(urls))
        except Exception as e:
            sentry_sdk.capture_exception(e)
