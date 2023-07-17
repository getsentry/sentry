from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from enum import Enum
from typing import (
    Any,
    Dict,
    List,
    NamedTuple,
    Optional,
    Set,
    Tuple,
    TypedDict,
    TypeVar,
    Union,
    cast,
)

import sentry_sdk
from django.conf import settings
from django.db import router
from django.db.models import Count
from django.utils import timezone

from sentry.models.artifactbundle import (
    INDEXING_THRESHOLD,
    NULL_STRING,
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleFlatFileIndex,
    ArtifactBundleIndex,
    ArtifactBundleIndexingState,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
)
from sentry.models.project import Project
from sentry.utils import json, metrics, redis
from sentry.utils.db import atomic_transaction

# The number of Artifact Bundles that we return in case of incomplete indexes.
MAX_BUNDLES_QUERY = 5

# Number of days that determine whether an artifact bundle is ready for being renewed.
AVAILABLE_FOR_RENEWAL_DAYS = 30

# We want to keep the bundle as being indexed for 600 seconds = 10 minutes. We might need to revise this number and
# optimize it based on the time taken to perform the indexing (on average).
INDEXING_CACHE_TIMEOUT = 600


def get_redis_cluster_for_artifact_bundles():
    cluster_key = settings.SENTRY_ARTIFACT_BUNDLES_INDEXING_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)


# ===== Flat File Indexing of Artifact Bundles =====


class FlatFileIndexingState(Enum):
    SUCCESS = 0
    CONFLICT = 1
    ERROR = 2


class FlatFileIdentifier(NamedTuple):
    project_id: int
    release: str = NULL_STRING
    dist: str = NULL_STRING

    def is_indexing_by_release(self) -> bool:
        # An identifier is indexing by release if release is set.
        return bool(self.release)

    def to_indexing_by_debug_id(self) -> FlatFileIdentifier:
        return FlatFileIdentifier(project_id=self.project_id, release=NULL_STRING, dist=NULL_STRING)


def _generate_flat_file_indexing_cache_key(identifier: FlatFileIdentifier):
    # The {1} is a key which is used to keep all the keys on the same Redis instance, in order to provide consistency
    # guarantees for the atomic check of the state.
    return (
        "{1}:flat_file_indexing:%s"
        % hashlib.sha1(
            b"%s|%s|%s"
            % (
                str(identifier.project_id).encode(),
                str(identifier.release).encode(),
                str(identifier.dist).encode(),
            )
        ).hexdigest()
    )


def set_flat_files_being_indexed_if_null(identifiers: List[FlatFileIdentifier]) -> bool:
    redis_client = get_redis_cluster_for_artifact_bundles()
    cache_keys = [_generate_flat_file_indexing_cache_key(identifier) for identifier in identifiers]

    pipeline = redis_client.pipeline()

    # We want to monitor all the keys, so that in case there are changes, the system will abort the transaction.
    pipeline.watch(*cache_keys)

    # Check if both keys are null.
    all_keys_none = all(pipeline.get(cache_key) is None for cache_key in cache_keys)
    if not all_keys_none:
        return False

    result = True
    try:
        # The transaction is only started if the keys that were previously marked as none, haven't been touched.
        pipeline.multi()

        for cache_key in cache_keys:
            pipeline.set(cache_key, 1, ex=INDEXING_CACHE_TIMEOUT)

        pipeline.execute()
    except Exception:
        result = False
        metrics.incr("artifact_bundle_flat_file_indexing.indexing_conflict")

    # Reset the watched keys.
    pipeline.unwatch()

    return result


def index_bundle_in_flat_file(
    artifact_bundle: ArtifactBundle, identifier: FlatFileIdentifier
) -> FlatFileIndexingState:
    with ArtifactBundleArchive(artifact_bundle.file.getfile(), build_memory_map=True) as archive:
        identifiers = [identifier]

        # In case we have an identifier that is indexed by release and the bundle has debug ids, we want to perform
        # indexing on also the debug ids bundle.
        if identifier.is_indexing_by_release() and archive.has_debug_ids():
            identifiers.append(identifier.to_indexing_by_debug_id())

        # Before starting, we have to make sure that no other identifiers are being indexed.
        if not set_flat_files_being_indexed_if_null(identifiers):
            return FlatFileIndexingState.CONFLICT

        # For each identifier we now have to compute the index.
        for identifier in identifiers:
            index = FlatFileIndex.build(FlatFileIndexStore(identifier))
            if index is None:
                return FlatFileIndexingState.ERROR

            # Once the in-memory index is built, we can merge it with the incoming bundle.
            if not index.merge(artifact_bundle, archive):
                return FlatFileIndexingState.ERROR

            # At the end we want to save the newly created index.
            if not index.save():
                return FlatFileIndexingState.ERROR

    return FlatFileIndexingState.SUCCESS


class BundleMeta(TypedDict):
    id: int
    timestamp: datetime


Bundles = List[BundleMeta]
FilesByUrl = Dict[str, List[int]]
FilesByDebugID = Dict[str, List[int]]


class FlatFileIndexStore:
    def __init__(self, identifier: FlatFileIdentifier):
        self.identifier = identifier

    def load(self) -> Optional[Dict[str, Union[Bundles, FilesByUrl, FilesByDebugID]]]:
        try:
            flat_file_index = ArtifactBundleFlatFileIndex.objects.get(
                project_id=self.identifier.project_id,
                release_name=self.identifier.release,
                dist_name=self.identifier.dist,
            ).load_flat_file_index()

            return self._deserialize_json_index(flat_file_index)
        except ArtifactBundleFlatFileIndex.DoesNotExist:
            return None

    @classmethod
    def _deserialize_json_index(
        cls, json_index: Dict[str, Any]
    ) -> Dict[str, Union[Bundles, FilesByUrl, FilesByDebugID]]:
        deserialized_index: Dict[str, Union[Bundles, FilesByUrl, FilesByDebugID]] = {}

        if "bundles" in json_index:
            deserialized_index["bundles"] = cls._deserialize_bundles(json_index["bundles"])

        if "files_by_url" in json_index:
            deserialized_index["files_by_url"] = json_index["files_by_url"]

        if "files_by_debug_id" in json_index:
            deserialized_index["files_by_debug_id"] = json_index["files_by_debug_id"]

        return deserialized_index

    @classmethod
    def _deserialize_bundles(cls, bundles: List[Dict[str, Union[int, str]]]) -> Bundles:
        deserialized_bundles: Bundles = []

        for bundle in bundles:
            bundle_id = bundle["id"]
            bundle_timestamp = bundle["timestamp"]

            deserialized_bundles.append(
                BundleMeta(
                    id=int(bundle_id), timestamp=datetime.fromisoformat(str(bundle_timestamp))
                )
            )

        return deserialized_bundles

    def save(self, flat_file_index: Dict[str, Union[Bundles, FilesByUrl, FilesByDebugID]]):
        serialized_index = self._serialize_json_index(flat_file_index)

        ArtifactBundleFlatFileIndex.create_flat_file_index(
            project_id=self.identifier.project_id,
            release=self.identifier.release,
            dist=self.identifier.dist,
            file_contents=serialized_index,
        )

    @classmethod
    def _serialize_json_index(
        cls, flat_file_index: Dict[str, Union[Bundles, FilesByUrl, FilesByDebugID]]
    ) -> str:
        pre_serialized_index: Dict[str, Any] = {}

        if "bundles" in flat_file_index:
            pre_serialized_index["bundles"] = cls._serialize_bundles(
                cast(Bundles, flat_file_index["bundles"])
            )

        if "files_by_url" in flat_file_index:
            pre_serialized_index["files_by_url"] = flat_file_index["files_by_url"]

        if "files_by_debug_id" in flat_file_index:
            pre_serialized_index["files_by_debug_id"] = flat_file_index["files_by_debug_id"]

        return json.dumps(pre_serialized_index)

    @classmethod
    def _serialize_bundles(cls, bundles: Bundles) -> List[Dict[str, Union[int, str]]]:
        serialized_bundles: List[Dict[str, Union[int, str]]] = []

        for bundle in bundles:
            serialized_bundles.append(
                {"id": bundle["id"], "timestamp": datetime.isoformat(bundle["timestamp"])}
            )

        return serialized_bundles


T = TypeVar("T")


class FlatFileIndex:
    def __init__(self, store: FlatFileIndexStore):
        self.store = store

        # By default, a flat file index is empty.
        self._bundles: Bundles = []
        self._files_by_url: FilesByUrl = {}
        self._files_by_debug_id: FilesByDebugID = {}

    @staticmethod
    def build(store: FlatFileIndexStore) -> Optional[FlatFileIndex]:
        index = FlatFileIndex(store)

        try:
            index._build()
            return index
        except Exception as e:
            sentry_sdk.capture_exception(e)
            metrics.incr("artifact_bundle_flat_file_indexing.error_when_building")
            return None

    def _build(self) -> None:
        loaded_index = self.store.load()

        # If we don't find an index, we will silently not mutate the state, since it's initialized as empty.
        if loaded_index is not None:
            self._bundles = cast(Bundles, loaded_index.get("bundles", []))
            self._files_by_url = cast(FilesByUrl, loaded_index.get("files_by_url", {}))
            self._files_by_debug_id = cast(
                FilesByDebugID, loaded_index.get("files_by_debug_id", {})
            )

    def merge(self, artifact_bundle: ArtifactBundle, archive: ArtifactBundleArchive) -> bool:
        try:
            # We want to index by url if the store has an identifier which is being indexed by release.
            self._merge(artifact_bundle, archive, self.store.identifier.is_indexing_by_release())
            return True
        except Exception as e:
            sentry_sdk.capture_exception(e)
            metrics.incr("artifact_bundle_flat_file_indexing.error_when_merging")
            return False

    def _merge(
        self, artifact_bundle: ArtifactBundle, archive: ArtifactBundleArchive, index_urls: bool
    ):
        bundle_index = self._update_bundles(artifact_bundle)

        if index_urls:
            self._iterate_over_urls(bundle_index, archive)
        else:
            self._iterate_over_debug_ids(bundle_index, archive)

    def _update_bundles(self, artifact_bundle: ArtifactBundle) -> int:
        if artifact_bundle.date_last_modified is None:
            raise Exception("Can't index a bundle with no date last modified")

        bundle_meta = BundleMeta(
            id=artifact_bundle.id, timestamp=artifact_bundle.date_last_modified
        )

        bundle_index = self._index_of_bundle(artifact_bundle.id)
        if bundle_index is None:
            self._bundles.append(bundle_meta)
            return len(self._bundles) - 1
        else:
            self._bundles[bundle_index] = bundle_meta
            return bundle_index

    def _iterate_over_debug_ids(self, bundle_index: int, archive: ArtifactBundleArchive):
        for debug_id, _ in archive.get_all_debug_ids():
            self._add_sorted_entry(self._files_by_debug_id, debug_id, bundle_index)

    def _iterate_over_urls(self, bundle_index: int, archive: ArtifactBundleArchive):
        for url in archive.get_all_urls():
            self._add_sorted_entry(self._files_by_url, url, bundle_index)

    def _add_sorted_entry(self, collection: Dict[T, List[int]], key: T, bundle_index: int):
        entries = collection.get(key, [])
        entries.append(bundle_index)
        entries.sort(key=lambda index: self._bundles[index]["timestamp"], reverse=True)
        collection[key] = entries

    def remove(self, artifact_bundle_id: int) -> bool:
        try:
            self._remove(artifact_bundle_id)
            return True
        except Exception as e:
            sentry_sdk.capture_exception(e)
            metrics.incr("artifact_bundle_flat_file_indexing.error_when_removing_bundle")
            return False

    def _remove(self, artifact_bundle_id: int):
        bundle_index = self._index_of_bundle(artifact_bundle_id)
        if bundle_index is not None:
            self._files_by_url = self._update_bundle_references(self._files_by_url, bundle_index)
            self._files_by_debug_id = self._update_bundle_references(
                self._files_by_debug_id, bundle_index
            )
            self._bundles.pop(bundle_index)
        else:
            raise Exception("The bundle you want do delete doesn't exist in the index.")

    def _update_bundle_references(self, collection: Dict[T, List[int]], removed_bundle_index: int):
        updated_collection: Dict[T, List[int]] = {}

        for key, indexes in collection.items():
            updated_indexes = [
                self._compute_updated_index(index, removed_bundle_index)
                for index in indexes
                if index != removed_bundle_index
            ]

            # Only if we have some indexes we want to keep the key.
            if len(updated_indexes) > 0:
                updated_collection[key] = updated_indexes

        return updated_collection

    @staticmethod
    def _compute_updated_index(index: int, removed_bundle_index: int):
        return index if index < removed_bundle_index else index - 1

    def _index_of_bundle(self, artifact_bundle_id) -> Optional[int]:
        for index, bundle in enumerate(self._bundles):
            if bundle["id"] == artifact_bundle_id:
                return index

        return None

    def save(self) -> bool:
        try:
            self._save()
            return True
        except Exception as e:
            sentry_sdk.capture_exception(e)
            metrics.incr("artifact_bundle_flat_file_indexing.error_when_saving")
            return False

    def _save(self):
        result: Dict[str, Any] = {}

        if len(self._bundles) > 0:
            result["bundles"] = self._bundles

        if len(self._files_by_url) > 0:
            result["files_by_url"] = self._files_by_url

        if len(self._files_by_debug_id) > 0:
            result["files_by_debug_id"] = self._files_by_debug_id

        if len(result) > 0:
            self.store.save(result)


# ===== Indexing of Artifact Bundles =====


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


def maybe_renew_artifact_bundles(used_artifact_bundles: Dict[int, datetime]):
    # We take a snapshot in time that MUST be consistent across all updates.
    now = timezone.now()
    # We compute the threshold used to determine whether we want to renew the specific bundle.
    threshold_date = now - timedelta(days=AVAILABLE_FOR_RENEWAL_DAYS)

    for (artifact_bundle_id, date_added) in used_artifact_bundles.items():
        # We perform the condition check also before running the query, in order to reduce the amount of queries to
        # the database.
        if date_added > threshold_date:
            continue

        with metrics.timer("artifact_bundle_renewal"):
            renew_artifact_bundle(artifact_bundle_id, threshold_date, now)


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
    is_fully_indexed = total_bundles > INDEXING_THRESHOLD and indexed_bundles == total_bundles

    if total_bundles > INDEXING_THRESHOLD and indexed_bundles < total_bundles:
        metrics.incr("artifact_bundle_indexing.query_partial_index")
        # TODO: spawn an async task to backfill non-indexed bundles
        # lets do this in a different PR though :-)

    # We keep track of all the discovered artifact bundles, by the various means of lookup.
    # We are intentionally overwriting the `resolved` flag, as we want to rank these from
    # coarse-grained to fine-grained.
    artifact_bundles: Dict[int, Tuple[datetime, str]] = dict()

    def update_bundles(bundles: Set[Tuple[int, datetime]], resolved: str):
        for (bundle_id, date_added) in bundles:
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


def get_bundles_indexing_state(project: Project, release_name: str, dist_name: str):
    """
    Returns the number of total bundles, and the number of fully indexed bundles
    associated with the given `release` / `dist`.
    """
    total_bundles = 0
    indexed_bundles = 0

    for state, count in (
        ArtifactBundle.objects.filter(
            releaseartifactbundle__organization_id=project.organization.id,
            releaseartifactbundle__release_name=release_name,
            releaseartifactbundle__dist_name=dist_name,
            projectartifactbundle__project_id=project.id,
        )
        .values_list("indexing_state")
        .annotate(count=Count("*"))
    ):
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
