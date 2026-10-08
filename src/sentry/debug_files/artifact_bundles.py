from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import orjson
import sentry_sdk
from django.conf import settings
from django.db import router
from django.db.models import Count, Exists, OuterRef
from django.utils import timezone
from sentry_redis_tools.clients import RedisCluster
from sentry_sdk import traces

from sentry import options
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleIndex,
    ArtifactBundleIndexingState,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.options.rollout import in_random_rollout
from sentry.utils import metrics, redis
from sentry.utils.db import atomic_transaction
from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)

# The number of Artifact Bundles that we return in case of incomplete indexes.
MAX_BUNDLES_QUERY = 5

# Number of bundles that have to be associated to a release/dist pair before indexing takes place.
# A value of 3 means that the third upload will trigger indexing and backfill.
INDEXING_THRESHOLD = 3

# Upper limit for `sourcemaps.artifact-bundles.url-lookup.max-candidate-bundles`. The URL lookup
# reads up to that many active and that many idle bundles and passes their ids to the index
# query, so a mistyped value must not make every lookup expensive.
URL_LOOKUP_MAX_CANDIDATE_BUNDLES_LIMIT = 10_000


# We want to keep the bundle as being indexed for 600 seconds = 10 minutes. We might need to revise this number and
# optimize it based on the time taken to perform the indexing (on average).
INDEXING_CACHE_TIMEOUT = 600

# ===== Indexing of Artifact Bundles =====


def get_redis_cluster_for_artifact_bundles() -> RedisCluster:
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
    return redis_client.set(cache_key, 1, ex=INDEXING_CACHE_TIMEOUT, nx=True) or False


def remove_artifact_bundle_indexing_state(organization_id: int, artifact_bundle_id: int) -> None:
    redis_client = get_redis_cluster_for_artifact_bundles()
    cache_key = _generate_artifact_bundle_indexing_state_cache_key(
        organization_id, artifact_bundle_id
    )
    redis_client.delete(cache_key)


def index_artifact_bundles_for_release(
    organization_id: int,
    artifact_bundles: list[tuple[ArtifactBundle, ArtifactBundleArchive | None]],
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


def backfill_artifact_bundle_db_indexing(organization_id: int, release: str, dist: str) -> None:
    artifact_bundles = ArtifactBundle.objects.filter(
        releaseartifactbundle__organization_id=organization_id,
        releaseartifactbundle__release_name=release,
        releaseartifactbundle__dist_name=dist,
        indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
    )

    index_artifact_bundles_for_release(organization_id, [(ab, None) for ab in artifact_bundles])


def is_named_after_own_debug_id(url: str, info: dict[str, Any]) -> bool:
    """
    Returns whether a bundle file is stored under a name built from its own debug ID, like
    `~/<debug-id>-<n>.js` or `~/<debug-id>-<n>.js.map`.

    The bundler plugins upload files under such names when they are only meant to be matched
    by debug ID. No frame has these URLs, and Symbolicator sends the debug ID along with the
    URL of every frame that has one, which the lookup resolves before it uses the URL index.
    """
    headers = ArtifactBundleArchive.normalize_headers(info.get("headers", {}))
    debug_id = ArtifactBundleArchive.normalize_debug_id(headers.get("debug-id"))
    if debug_id is None:
        return False
    file_name = url.rsplit("/", 1)[-1].lower()
    return file_name.startswith(f"{debug_id}-")


@traces.trace
def index_urls_in_bundle(
    organization_id: int,
    artifact_bundle: ArtifactBundle,
    existing_archive: ArtifactBundleArchive | None,
):
    skip_debug_id_names = options.get("sourcemaps.artifact-bundles.index-skip-debug-id-names")

    # We first open up the bundle and extract all the things we want to index from it.
    archive = existing_archive or ArtifactBundleArchive(
        artifact_bundle.file.getfile(), build_memory_map=False
    )
    urls_to_index = []
    skipped_urls = 0
    try:
        for info in archive.get_files().values():
            if url := info.get("url"):
                if skip_debug_id_names and is_named_after_own_debug_id(url, info):
                    skipped_urls += 1
                    continue
                urls_to_index.append(
                    ArtifactBundleIndex(
                        # key/value:
                        artifact_bundle_id=artifact_bundle.id,
                        url=url,
                        # metadata:
                        organization_id=organization_id,
                        date_added=artifact_bundle.date_added,
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
        if skipped_urls:
            metrics.incr("artifact_bundle_indexing.urls_skipped", skipped_urls)


# ===== Renewal of Artifact Bundles =====


def maybe_renew_artifact_bundles(used_artifact_bundles: dict[int, datetime]):
    # We take a snapshot in time that MUST be consistent across all updates.
    now = timezone.now()
    # We compute the threshold used to determine whether we want to renew the specific bundle.
    threshold_date = now - timedelta(
        days=options.get("system.debug-files-renewal-age-threshold-days")
    )

    for artifact_bundle_id, date_added in used_artifact_bundles.items():
        # We perform the condition check also before running the query, in order to reduce the amount of queries to the database.
        if date_added > threshold_date:
            continue

        with metrics.timer("artifact_bundle_renewal"):
            renew_artifact_bundle(artifact_bundle_id, threshold_date, now)


@traces.trace
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
        )
    ):
        # We check again for the date_added condition in order to achieve consistency, this is done because
        # the `can_be_renewed` call is using a time which differs from the one of the actual update in the db.
        updated_rows_count = ArtifactBundle.objects.filter(
            id=artifact_bundle_id, date_added__lte=threshold_date
        ).update(date_added=now)
        # We want to make cascading queries only if there were actual changes in the db. Nothing reads `date_added`
        # from the rows linked to the bundle, so with `date-only-on-bundle` they aren't renewed, which spares
        # rewriting every URL index and debug-ID row of the bundle.
        if updated_rows_count > 0 and not options.get(
            "sourcemaps.artifact-bundles.date-only-on-bundle"
        ):
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

    # If the transaction succeeded, and we did actually modify some rows, we want to track the metric.
    if updated_rows_count > 0:
        metrics.incr("artifact_bundle_renewal.were_renewed")


# ===== Querying of Artifact Bundles =====


def _maybe_renew_and_return_bundles(
    bundles: dict[int, tuple[datetime, str]],
) -> list[tuple[int, str]]:
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
) -> list[tuple[int, str]]:
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

    newest_bundles: set[tuple[int, datetime]] | None = None
    if options.get("sourcemaps.artifact-bundles.bounded-indexing-state"):
        # Instead of counting every bundle in the release, only look at the newest ones.
        # If those are all indexed, any bundle missing from the index is older than them,
        # so the newest bundles that we would add below would not include it either.
        newest = get_newest_artifact_bundles_by_release(project, release, dist)
        total_bundles = len(newest)
        indexed_bundles = sum(
            1
            for _id, _date_added, indexing_state in newest
            if indexing_state == ArtifactBundleIndexingState.WAS_INDEXED.value
        )
        newest_bundles = {(bundle_id, date_added) for bundle_id, date_added, _state in newest}
    else:
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
        # tasks here.

    # We keep track of all the discovered artifact bundles, by the various means of lookup.
    # We are intentionally overwriting the `resolved` flag, as we want to rank these from
    # coarse-grained to fine-grained.
    artifact_bundles: dict[int, tuple[datetime, str]] = dict()

    def update_bundles(bundles: set[tuple[int, datetime]], resolved: str):
        for bundle_id, date_added in bundles:
            artifact_bundles[bundle_id] = (date_added, resolved)

    # First, get the N most recently uploaded bundles for the release,
    # but only if the index is only partial:
    if not is_fully_indexed:
        if newest_bundles is not None:
            bundles = newest_bundles
        else:
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
) -> tuple[int, int]:
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
        filter["organization_id"] = org_or_project.organization_id
        filter["releaseartifactbundle__organization_id"] = org_or_project.organization.id
        filter["projectartifactbundle__project_id"] = org_or_project.id
    else:
        filter["organization_id"] = org_or_project.id
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


def get_cached_bundles_indexing_state(
    organization: Organization, release_name: str, dist_name: str
) -> tuple[int, int]:
    """
    `get_bundles_indexing_state` for the upload task, cached for
    `sourcemaps.artifact-bundles.indexing-state-cache-ttl` seconds once the release has
    reached `INDEXING_THRESHOLD` bundles.

    Nothing is cached below the threshold, so a stale value never prevents a release from
    being indexed. Above it, every new bundle is indexed whatever the counts say, and a stale
    value can only delay or repeat a backfill of older bundles until the cache expires.
    """
    ttl = options.get("sourcemaps.artifact-bundles.indexing-state-cache-ttl")
    if ttl <= 0:
        return get_bundles_indexing_state(organization, release_name, dist_name)

    redis_client = get_redis_cluster_for_artifact_bundles()
    release_hash = md5_text(release_name, "\x00", dist_name).hexdigest()
    cache_key = f"ab::o:{organization.id}:r:{release_hash}:indexing_state"

    # The cache is an optimization, so any failure falls back to counting.
    try:
        cached = redis_client.get(cache_key)
        if cached is not None:
            total_bundles, indexed_bundles = orjson.loads(cached)
            metrics.incr("artifact_bundle_indexing.indexing_state_cache", tags={"result": "hit"})
            return (total_bundles, indexed_bundles)
    except Exception:
        sentry_sdk.capture_exception()

    metrics.incr("artifact_bundle_indexing.indexing_state_cache", tags={"result": "miss"})
    total_bundles, indexed_bundles = get_bundles_indexing_state(
        organization, release_name, dist_name
    )
    if total_bundles >= INDEXING_THRESHOLD:
        try:
            redis_client.set(cache_key, orjson.dumps([total_bundles, indexed_bundles]), ex=ttl)
        except Exception:
            sentry_sdk.capture_exception()

    return (total_bundles, indexed_bundles)


def get_newest_artifact_bundles_by_release(
    project: Project, release_name: str, dist_name: str
) -> list[tuple[int, datetime, int | None]]:
    """
    Returns `(id, date_added, indexing_state)` of up to `MAX_BUNDLES_QUERY` bundles most
    recently uploaded for the given `release` / `dist`, newest first.

    Bundle ids follow upload order, so ordering by id lets the database walk the
    `(organization_id, release_name, dist_name, artifact_bundle_id)` index backwards and stop
    after `MAX_BUNDLES_QUERY` rows, instead of visiting every bundle in the release like
    `get_bundles_indexing_state` and `get_artifact_bundles_by_release` do.
    """
    bundles = (
        ArtifactBundle.objects.filter(
            organization_id=project.organization_id,
            releaseartifactbundle__organization_id=project.organization_id,
            releaseartifactbundle__release_name=release_name,
            releaseartifactbundle__dist_name=dist_name,
            projectartifactbundle__project_id=project.id,
        )
        .values_list("id", "date_added", "indexing_state")
        .order_by("-id")[:MAX_BUNDLES_QUERY]
    )
    # Duplicate link rows would repeat a bundle, so we only keep its first row.
    return list({bundle[0]: bundle for bundle in bundles}.values())


def get_artifact_bundles_containing_debug_id(
    project: Project, debug_id: str
) -> set[tuple[int, datetime]]:
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


def get_url_lookup_candidates(
    project: Project, release_name: str, dist_name: str
) -> list[int] | None:
    """
    Returns the ids of the bundles whose files the URL lookup should scan, or `None` to scan
    every bundle in the release.

    The URL lookup checks every `ArtifactBundleIndex` row of the bundles it scans, whether
    the file is found or not, and some releases have millions of them. When
    `sourcemaps.artifact-bundles.url-lookup.max-index-rows` is set, that budget is spent on
    the active bundles first, those uploaded or renewed (`date_added`) within the renewal
    threshold plus a margin, newest first, and then on the remaining bundles, newest first.
    A release with fewer indexed files than the budget, and fewer active and fewer idle
    bundles than `sourcemaps.artifact-bundles.url-lookup.max-candidate-bundles`, is still
    scanned completely.

    A bundle that is in use is renewed when a lookup returns it, so it stays active. Lookups
    of bundles beyond the budget can no longer find them by URL.
    """
    max_index_rows = options.get("sourcemaps.artifact-bundles.url-lookup.max-index-rows")
    if max_index_rows <= 0:
        return None

    max_candidate_bundles = min(
        max(options.get("sourcemaps.artifact-bundles.url-lookup.max-candidate-bundles"), 1),
        URL_LOOKUP_MAX_CANDIDATE_BUNDLES_LIMIT,
    )
    active_days = options.get("system.debug-files-renewal-age-threshold-days") + options.get(
        "sourcemaps.artifact-bundles.url-lookup.active-margin-days"
    )
    active_since = timezone.now() - timedelta(days=active_days)

    release_bundles = ArtifactBundle.objects.filter(
        organization_id=project.organization_id,
        releaseartifactbundle__organization_id=project.organization_id,
        releaseartifactbundle__release_name=release_name,
        releaseartifactbundle__dist_name=dist_name,
        projectartifactbundle__project_id=project.id,
    )

    # Using a dict to keep the order and drop bundles repeated by duplicate link rows.
    candidates: dict[int, None] = {}
    index_rows = 0
    # Which limit cut the lookup short, if any: "budget" or "candidates".
    truncated_by: str | None = None
    for bundles in (
        release_bundles.filter(date_added__gte=active_since),
        release_bundles.filter(date_added__lt=active_since),
    ):
        # One more row than we scan tells whether this group has more bundles.
        rows = list(
            bundles.values_list("id", "artifact_count").order_by("-id")[: max_candidate_bundles + 1]
        )
        for bundle_id, artifact_count in rows[:max_candidate_bundles]:
            if bundle_id in candidates:
                continue
            # We always scan at least one bundle, even if it alone exceeds the budget.
            if candidates and index_rows + artifact_count > max_index_rows:
                truncated_by = "budget"
                break
            candidates[bundle_id] = None
            index_rows += artifact_count
        if truncated_by is None and len(rows) > max_candidate_bundles:
            # This group has more bundles than we looked at, and those come before any bundle
            # of the next group.
            truncated_by = "candidates"
        if truncated_by is not None:
            break

    metrics.distribution("artifact_bundle_url_lookup.index_rows", index_rows)
    metrics.incr(
        "artifact_bundle_url_lookup.candidates",
        tags={"truncated": truncated_by or "false"},
    )
    # Files in bundles beyond the limits are no longer found by URL. The metric can't say for
    # which releases, so we log a sample of the truncated lookups.
    if truncated_by is not None and in_random_rollout(
        "sourcemaps.artifact-bundles.url-lookup.truncated-log-sample-rate"
    ):
        logger.info(
            "artifact_bundle_url_lookup.truncated",
            extra={
                "organization_id": project.organization_id,
                "project_id": project.id,
                "release": release_name,
                "dist": dist_name,
                "truncated_by": truncated_by,
                "max_index_rows": max_index_rows,
                "max_candidate_bundles": max_candidate_bundles,
                "index_rows": index_rows,
                "candidates": len(candidates),
            },
        )
    return list(candidates)


def get_artifact_bundles_containing_url(
    project: Project, release_name: str, dist_name: str, url: str
) -> set[tuple[int, datetime]]:
    """
    Returns the most recently uploaded bundles containing a file matching the `release`, `dist` and `url`.
    """
    contains_url = Exists(
        ArtifactBundleIndex.objects.filter(
            artifact_bundle_id=OuterRef("pk"),
            organization_id=project.organization.id,
            url__icontains=url,
        )
    )

    candidates = get_url_lookup_candidates(project, release_name, dist_name)
    if candidates is not None:
        # The candidates already belong to the project, release and dist.
        bundles = ArtifactBundle.objects.filter(contains_url, id__in=candidates)
    else:
        bundles = ArtifactBundle.objects.filter(
            contains_url,
            Exists(
                ProjectArtifactBundle.objects.filter(
                    artifact_bundle_id=OuterRef("pk"),
                    project_id=project.id,
                )
            ),
            Exists(
                ReleaseArtifactBundle.objects.filter(
                    artifact_bundle_id=OuterRef("pk"),
                    organization_id=project.organization.id,
                    release_name=release_name,
                    dist_name=dist_name,
                )
            ),
        )

    return set(
        bundles.values_list("id", "date_added").order_by("-date_last_modified", "-id")[
            :MAX_BUNDLES_QUERY
        ]
    )


def get_artifact_bundles_by_release(
    project: Project,
    release_name: str,
    dist_name: str,
) -> set[tuple[int, datetime]]:
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
