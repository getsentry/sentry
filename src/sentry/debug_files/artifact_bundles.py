from collections import defaultdict
from datetime import datetime
from typing import DefaultDict, Mapping, Sequence, Set

from django.db import IntegrityError, router
from django.db.models import Q

from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleIndex,
    ArtifactBundleIndexingState,
)
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction


def index_artifact_bundles_for_release(
    artifact_bundles: Sequence[ArtifactBundle], release: str = "", dist: str = ""
):
    """
    This indexes the contents of `artifact_bundles` into the database, using
    the given `release` and `dist` pair.

    Synchronization is achieved using the 4-state `indexing_state`.
    It is flipped from `needs_indexing` to `is_being_indexed` to avoid conflicts in
    case two different jobs are calling this method at the same time with the
    same `artifact_bundle`.
    Once indexing is done, the state is set to `was_indexed`.

    To avoid too much load and queries on the database, the provided
    `artifact_bundles` are first merged/deduplicated into an in-memory structure.

    Then, indexing of individual files happens in the following way:
    - If a key already exists with a higher `date_last_modified`, it is ignored
      as that indicates out-of-order calls of this method. We always want the
      most up-to-date bundle to win.
    - Otherwise, the key is created or updated to point to the `artifact_bundle`.
    """

    # First: Mark the bundles as `is_being_indexed` using a compare-and-swap like update,
    # which atomically guarantees that only bundles in that state will be indexed.
    started_artifact_bundles = []
    for artifact_bundle in artifact_bundles:
        is_being_indexed = ArtifactBundle.objects.filter(
            id=artifact_bundle.id, indexing_state=ArtifactBundleIndexingState.NEEDS_INDEXING
        ).update(indexing_state=ArtifactBundleIndexingState.IS_BEING_INDEXED)
        if is_being_indexed:
            started_artifact_bundles.append(artifact_bundle)
        else:
            # a different job is already taking care of this bundle
            metrics.incr("artifact_bundle_indexing.conflict")
    artifact_bundles = started_artifact_bundles

    if not artifact_bundles:
        return

    # Then: Merge the bundles into an in-memory index
    files_to_index: Mapping[str, ArtifactBundle] = {}

    for artifact_bundle in artifact_bundles:
        archive = ArtifactBundleArchive(artifact_bundle.file.getfile(), build_memory_map=False)
        try:
            for info in archive.manifest.get("files", {}).values():
                url = info.get("url")
                if not url:
                    continue

                indexed = files_to_index.get(url)
                bundle_ordering = (artifact_bundle.date_last_modified, artifact_bundle.id)
                if not indexed or (indexed.date_last_modified, indexed.id) < bundle_ordering:
                    files_to_index[url] = artifact_bundle

        finally:
            archive.close()

    # And finally, commit the intended changes to the database, carefully merging
    # with the state that already exists in the database.
    # We do so grouped by artifact bundle, using one atomic transaction for
    # the indexing and setting of the indexed state as well.
    urls_by_bundle: DefaultDict[ArtifactBundle, Set[str]] = defaultdict(set)
    for url, bundle in files_to_index.items():
        urls_by_bundle[bundle].add(url)

    # The naming here is a bit confusing, it is the time we touched the index,
    # and is used for partitioning the index table and auto-expiration.
    date_added = datetime.now()

    for artifact_bundle, urls in urls_by_bundle.items():
        with atomic_transaction(
            using=(router.db_for_write(ArtifactBundleIndex), router.db_for_write(ArtifactBundle))
        ):
            for url in urls:
                key = {
                    "organization_id": artifact_bundle.organization_id,
                    "release": release,
                    "dist": dist,
                    "url": url,
                }
                value = {
                    "date_last_modified": artifact_bundle.date_last_modified,
                    "date_added": date_added,
                    "artifact_bundle_id": artifact_bundle.id,
                }
                condition = Q(date_last_modified__lt=artifact_bundle.date_last_modified) | Q(
                    date_last_modified=artifact_bundle.date_last_modified,
                    artifact_bundle_id__lt=artifact_bundle.id,
                )

                # NOTE:
                # Ideally, we would want a single atomic query for this upsert.
                # This would be possible with postgres using:
                # `INSERT INTO ... $key $value ON CONFLICT DO UPDATE SET $value WHERE $condition`.
                # However, writing raw SQL would be too error prone.
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

            ArtifactBundle.filter(id=artifact_bundle.id).update(
                indexing_state=ArtifactBundleIndexingState.WAS_INDEXED
            )

        metrics.incr("artifact_bundle_indexing.bundles_indexed")
        metrics.incr("artifact_bundle_indexing.urls_indexed", len(urls))
