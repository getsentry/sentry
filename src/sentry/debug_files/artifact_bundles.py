from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Dict, List, Set, Tuple

import sentry_sdk
from django.conf import settings
from django.db import router
from django.db.models import Count
from django.utils import timezone

from sentry import options
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleIndex,
    ArtifactBundleIndexingState,
    DebugIdArtifactBundle,
    FlatFileIndexState,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.utils import metrics, redis
from sentry.utils.db import atomic_transaction

# The number of Artifact Bundles that we return in case of incomplete indexes.
MAX_BUNDLES_QUERY = 5

# Number of bundles that have to be associated to a release/dist pair before indexing takes place.
# A value of 3 means that the third upload will trigger indexing and backfill.
INDEXING_THRESHOLD = 3

# Number of days that determine whether an artifact bundle is ready for being renewed.
AVAILABLE_FOR_RENEWAL_DAYS = 30

# We want to keep the bundle as being indexed for 600 seconds = 10 minutes. We might need to revise this number and
# optimize it based on the time taken to perform the indexing (on average).
INDEXING_CACHE_TIMEOUT = 600

# ===== Indexing of Artifact Bundles =====


def get_redis_cluster_for_artifact_bundles():
    cluster_key = settings.SENTRY_ARTIFACT_BUNDLES_INDEXING_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)


def get_refresh_key() -> str:
    return "artifact_bundles_in_use"


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
    organization_id: int,
    artifact_bundles: List[Tuple[ArtifactBundle, ArtifactBundleArchive | None]],
) -> None:
    """
    This indexes the contents of `artifact_bundles` into the database, using the given `release` and `dist` pair.

    Synchronization is achieved using a mixture of redis cache with transient state and a binary state in the database.
    """

    for artifact_bundle, archive in artifact_bundles:
        try:
            if not set_artifact_bundle_being_indexed_if_null(
                organization_id=organization_id, artifact_bundle_id=artifact_bundle.id
            ):
                # A different asynchronous job is taking care of this bundle.
                metrics.incr("artifact_bundle_indexing.bundle_already_being_indexed")
                continue

            index_urls_in_bundle(organization_id, artifact_bundle, archive)
        except Exception as e:
            # We want to catch the error and continue execution, since we can try to index the other bundles.
            metrics.incr("artifact_bundle_indexing.index_single_artifact_bundle_error")
            sentry_sdk.capture_exception(e)

            # TODO: Do we want to `remove_artifact_bundle_indexing_state` here so that
            # a different job can retry this? Probably not, as we want to at the very least
            # debounce this in case there is a persistent error?


def backfill_artifact_bundle_db_indexing(organization_id: int, release: str, dist: str):
    artifact_bundles = ArtifactBundle.objects.filter(
        releaseartifactbundle__organization_id=organization_id,
        releaseartifactbundle__release_name=release,
        releaseartifactbundle__dist_name=dist,
        indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
    )
    artifact_bundles = [(ab, None) for ab in artifact_bundles]

    index_artifact_bundles_for_release(organization_id, artifact_bundles)


@sentry_sdk.tracing.trace
def index_urls_in_bundle(
    organization_id: int,
    artifact_bundle: ArtifactBundle,
    existing_archive: ArtifactBundleArchive | None,
):
    # We first open up the bundle and extract all the things we want to index from it.
    archive = existing_archive or ArtifactBundleArchive(
        artifact_bundle.file.getfile(), build_memory_map=False
    )
    urls_to_index = []
    try:
        for info in archive.get_files().values():
            if url := info.get("url"):
                urls_to_index.append(
                    ArtifactBundleIndex(
                        # key/value:
                        artifact_bundle_id=artifact_bundle.id,
                        url=url,
                        # metadata:
                        organization_id=organization_id,
                        date_added=artifact_bundle.date_added,
                        # legacy:
                        # TODO: We fill these in with empty-ish values before they are
                        # dropped for good
                        release_name="",
                        dist_name="",
                        date_last_modified=artifact_bundle.date_last_modified
                        or artifact_bundle.date_added,
                    )
                )
    finally:
        if not existing_archive:
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
        # NOTE: The django ORM by default tries to batch *all* the inserts into a single query,
        # which is not quite that efficient. We want to have a fixed batch size,
        # which will result in a fixed number of unique `INSERT` queries.
        ArtifactBundleIndex.objects.bulk_create(urls_to_index, batch_size=50)

        # Mark the bundle as indexed
        ArtifactBundle.objects.filter(id=artifact_bundle.id).update(
            indexing_state=ArtifactBundleIndexingState.WAS_INDEXED.value
        )

        metrics.incr("artifact_bundle_indexing.bundles_indexed")
        metrics.incr("artifact_bundle_indexing.urls_indexed", len(urls_to_index))


# ===== Renewal of Artifact Bundles =====


@sentry_sdk.tracing.trace
def maybe_renew_artifact_bundles_from_processing(project_id: int, used_download_ids: List[str]):
    if random.random() >= options.get("symbolicator.sourcemaps-bundle-index-refresh-sample-rate"):
        return

    artifact_bundle_ids = []
    for download_id in used_download_ids:
        # the `download_id` is in a `artifact_bundle/$ID` format
        split = download_id.split("/")
        if len(split) < 2:
            continue
        ty, ty_id, *_rest = split
        if ty != "artifact_bundle":
            continue
        artifact_bundle_ids.append(ty_id)

    redis_client = get_redis_cluster_for_artifact_bundles()

    redis_client.sadd(get_refresh_key(), *artifact_bundle_ids)


@sentry_sdk.tracing.trace
def refresh_artifact_bundles_in_use():
    LOOP_TIMES = 100
    IDS_PER_LOOP = 50

    redis_client = get_redis_cluster_for_artifact_bundles()

    now = timezone.now()
    threshold_date = now - timedelta(days=AVAILABLE_FOR_RENEWAL_DAYS)

    for _ in range(LOOP_TIMES):
        artifact_bundle_ids = redis_client.spop(get_refresh_key(), IDS_PER_LOOP)
        used_artifact_bundles = {
            id: date_added
            for id, date_added in ArtifactBundle.objects.filter(
                id__in=artifact_bundle_ids, date_added__lte=threshold_date
            ).values_list("id", "date_added")
        }

        maybe_renew_artifact_bundles(used_artifact_bundles)

        if len(artifact_bundle_ids) < IDS_PER_LOOP:
            break


def maybe_renew_artifact_bundles(used_artifact_bundles: Dict[int, datetime]):
    # We take a snapshot in time that MUST be consistent across all updates.
    now = timezone.now()
    # We compute the threshold used to determine whether we want to renew the specific bundle.
    threshold_date = now - timedelta(days=AVAILABLE_FOR_RENEWAL_DAYS)

    for artifact_bundle_id, date_added in used_artifact_bundles.items():
        # We perform the condition check also before running the query, in order to reduce the amount of queries to the database.
        if date_added > threshold_date:
            continue

        with metrics.timer("artifact_bundle_renewal"):
            renew_artifact_bundle(artifact_bundle_id, threshold_date, now)


@sentry_sdk.tracing.trace
def renew_artifact_bundle(artifact_bundle_id: int, threshold_date: datetime, now: datetime):
    metrics.incr("artifact_bundle_renewal.need_renewal")
    # We want to use a transaction, in order to keep the `date_added` consistent across multiple tables.
    with atomic_transaction(
        using=(
            router.db_for_write(ArtifactBundle),
            router.db_for_write(ProjectArtifactBundle),
            router.db_for_write(ReleaseArtifactBundle),
            router.db_for_write(DebugIdArtifactBundle),
            router.db_for_write(ArtifactBundleIndex),
            router.db_for_write(FlatFileIndexState),
        )
    ):
        # We check again for the date_added condition in order to achieve consistency, this is done because
        # the `can_be_renewed` call is using a time which differs from the one of the actual update in the db.
        updated_rows_count = ArtifactBundle.objects.filter(
            id=artifact_bundle_id, date_added__lte=threshold_date
        ).update(date_added=now)
        # We want to make cascading queries only if there were actual changes in the db.
        if updated_rows_count > 0:
            ProjectArtifactBundle.objects.filter(
                artifact_bundle_id=artifact_bundle_id, date_added__lte=threshold_date
            ).update(date_added=now)
            ReleaseArtifactBundle.objects.filter(
                artifact_bundle_id=artifact_bundle_id, date_added__lte=threshold_date
            ).update(date_added=now)
            DebugIdArtifactBundle.objects.filter(
                artifact_bundle_id=artifact_bundle_id, date_added__lte=threshold_date
            ).update(date_added=now)
            ArtifactBundleIndex.objects.filter(
                artifact_bundle_id=artifact_bundle_id, date_added__lte=threshold_date
            ).update(date_added=now)
            FlatFileIndexState.objects.filter(
                artifact_bundle_id=artifact_bundle_id, date_added__lte=threshold_date
            ).update(date_added=now)

    # If the transaction succeeded, and we did actually modify some rows, we want to track the metric.
    if updated_rows_count > 0:
        metrics.incr("artifact_bundle_renewal.were_renewed")


# ===== Querying of Artifact Bundles =====


def _maybe_renew_and_return_bundles(
    bundles: Dict[int, Tuple[datetime, str]]
) -> List[Tuple[int, str]]:
    maybe_renew_artifact_bundles(
        {id: date_added for id, (date_added, _resolved) in bundles.items()}
    )

    return [(id, resolved) for id, (_date_added, resolved) in bundles.items()]


def query_artifact_bundles_containing_file(
    project: Project,
    release: str,
    dist: str,
    url: str,
    debug_id: str | None,
) -> List[Tuple[int, str]]:
    """
    This looks up the artifact bundles that satisfy the query consisting of
    `release`, `dist`, `url` and `debug_id`.

    This function should ideally return a single bundle containing the file matching
    the query. However it can also return more than a single bundle in case no
    complete index is available, in which case the N most recent bundles will be
    returned under the assumption that one of those may contain the file.

    Along the bundles `id`, it also returns the most-precise method the bundles
    was resolved with.
    """

    if debug_id:
        bundles = get_artifact_bundles_containing_debug_id(project, debug_id)
        if bundles:
            return _maybe_renew_and_return_bundles(
                {id: (date_added, "debug-id") for id, date_added in bundles}
            )

    total_bundles, indexed_bundles = get_bundles_indexing_state(project, release, dist)

    if not total_bundles:
        return []

    # If all the bundles for this release are fully indexed, we will only query
    # the url index.
    # Otherwise, if we are below the threshold, or only partially indexed, we
    # want to return the N most recent bundles associated with the release,
    # under the assumption that one of those should ideally contain the file we
    # are looking for.
    is_fully_indexed = total_bundles >= INDEXING_THRESHOLD and indexed_bundles == total_bundles

    if total_bundles >= INDEXING_THRESHOLD and indexed_bundles < total_bundles:
        metrics.incr("artifact_bundle_indexing.query_partial_index")
        # TODO: spawn an async task to backfill non-indexed bundles
        # lets do this in a different PR though :-)
        # ^ we would want to use a Redis SET to not spawn a ton of duplicated
        # celery tasks here.

    # We keep track of all the discovered artifact bundles, by the various means of lookup.
    # We are intentionally overwriting the `resolved` flag, as we want to rank these from
    # coarse-grained to fine-grained.
    artifact_bundles: Dict[int, Tuple[datetime, str]] = dict()

    def update_bundles(bundles: Set[Tuple[int, datetime]], resolved: str):
        for bundle_id, date_added in bundles:
            artifact_bundles[bundle_id] = (date_added, resolved)

    # First, get the N most recently uploaded bundles for the release,
    # but only if the index is only partial:
    if not is_fully_indexed:
        bundles = get_artifact_bundles_by_release(project, release, dist)
        update_bundles(bundles, "release")

    # Then, we are matching by `url`:
    if url:
        bundles = get_artifact_bundles_containing_url(project, release, dist, url)
        update_bundles(bundles, "index")

    return _maybe_renew_and_return_bundles(artifact_bundles)


# NOTE on queries and index usage:
# All the queries below return the `date_added` so we can do proper renewal and expiration.
# Also, all the queries are sorted by `date_last_modified`, so we get the most
# recently uploaded bundle.
#
# For all the queries below, we make sure that we are joining the
# `ProjectArtifactBundle` table primarily for access control reasons.
# While the project implies the `organization_id`, we put the `organization_id`
# into some of the queries explicitly, primarily to optimize index usage.
# The goal here is that this index can further restrict the search space.
# For example, we assume that the `ReleaseArtifactBundle` has bad cardinality on
# `release_name`, as a ton of projects might have a `"1.0.0"` release.
# Restricting that to a single org may cut down the number of rows considered
# significantly. We might even use the `organization_id` for that purpose on
# multiple tables in a single query.


def get_bundles_indexing_state(
    org_or_project: Project | Organization, release_name: str, dist_name: str
) -> Tuple[int, int]:
    """
    Returns the number of total bundles, and the number of fully indexed bundles
    associated with the given `release` / `dist`.
    """
    total_bundles = 0
    indexed_bundles = 0

    filter: dict = {
        "releaseartifactbundle__release_name": release_name,
        "releaseartifactbundle__dist_name": dist_name,
    }
    if isinstance(org_or_project, Project):
        filter["releaseartifactbundle__organization_id"] = org_or_project.organization.id
        filter["projectartifactbundle__project_id"] = org_or_project.id
    else:
        filter["releaseartifactbundle__organization_id"] = org_or_project.id

    query = (
        ArtifactBundle.objects.filter(**filter)
        .values_list("indexing_state")
        .annotate(count=Count("*"))
    )
    for state, count in query:
        if state == ArtifactBundleIndexingState.WAS_INDEXED.value:
            indexed_bundles = count
        total_bundles += count

    return (total_bundles, indexed_bundles)


def get_artifact_bundles_containing_debug_id(
    project: Project, debug_id: str
) -> Set[Tuple[int, datetime]]:
    """
    Returns the most recently uploaded artifact bundle containing the given `debug_id`.
    """
    return set(
        ArtifactBundle.objects.filter(
            organization_id=project.organization.id,
            projectartifactbundle__project_id=project.id,
            debugidartifactbundle__debug_id=debug_id,
        )
        .values_list("id", "date_added")
        .order_by("-date_last_modified", "-id")[:1]
    )


def get_artifact_bundles_containing_url(
    project: Project, release_name: str, dist_name: str, url: str
) -> Set[Tuple[int, datetime]]:
    """
    Returns the most recently uploaded bundle containing a file matching the `release`, `dist` and `url`.
    """
    return set(
        ArtifactBundle.objects.filter(
            releaseartifactbundle__organization_id=project.organization.id,
            releaseartifactbundle__release_name=release_name,
            releaseartifactbundle__dist_name=dist_name,
            projectartifactbundle__project_id=project.id,
            artifactbundleindex__organization_id=project.organization.id,
            artifactbundleindex__url__icontains=url,
        )
        .values_list("id", "date_added")
        .order_by("-date_last_modified", "-id")
        .distinct("date_last_modified", "id")[:MAX_BUNDLES_QUERY]
    )


def get_artifact_bundles_by_release(
    project: Project,
    release_name: str,
    dist_name: str,
) -> Set[Tuple[int, datetime]]:
    """
    Returns up to N most recently uploaded bundles for the given `release` and `dist`.
    """
    return set(
        ArtifactBundle.objects.filter(
            releaseartifactbundle__organization_id=project.organization.id,
            releaseartifactbundle__release_name=release_name,
            releaseartifactbundle__dist_name=dist_name,
            projectartifactbundle__project_id=project.id,
        )
        .values_list("id", "date_added")
        .order_by("-date_last_modified", "-id")[:MAX_BUNDLES_QUERY]
    )
