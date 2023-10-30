from __future__ import annotations

import hashlib
import logging
import random
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, NamedTuple, Optional, Tuple, TypeVar

import sentry_sdk
from django.db import DatabaseError, router
from django.utils import timezone

from sentry.debug_files.artifact_bundles import get_redis_cluster_for_artifact_bundles
from sentry.models.artifactbundle import (
    NULL_STRING,
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleFlatFileIndex,
    ArtifactBundleIndexingState,
    FlatFileIndexState,
)
from sentry.utils import json, metrics
from sentry.utils.db import atomic_transaction

logger = logging.getLogger(__name__)

# The number of indexes to update with one execution of `backfill_artifact_index_updates`.
BACKFILL_BATCH_SIZE = 20

# The TTL of the cache containing information about a specific flat file index. The TTL is set to 1 hour, since
# we know that the cache will be invalidated in case of flat file index updates, thus it is mostly to keep the
# size of the caches under control in case of no uploads from the user end.
FLAT_FILE_IDENTIFIER_CACHE_TTL = 3600


@dataclass(frozen=True)
class BundleMeta:
    id: int
    timestamp: datetime

    @staticmethod
    def from_artifact_bundle(artifact_bundle: ArtifactBundle) -> BundleMeta:
        return BundleMeta(
            id=artifact_bundle.id,
            # We give priority to the date last modified for total ordering.
            timestamp=(artifact_bundle.date_last_modified or artifact_bundle.date_uploaded),
        )


@dataclass(frozen=True)
class BundleManifest:
    meta: BundleMeta
    urls: List[str]
    debug_ids: List[str]

    @staticmethod
    def from_artifact_bundle(
        artifact_bundle: ArtifactBundle, archive: ArtifactBundleArchive
    ) -> BundleManifest:
        meta = BundleMeta.from_artifact_bundle(artifact_bundle)
        urls = archive.get_all_urls()
        debug_ids = list({debug_id for debug_id, _ty in archive.get_all_debug_ids()})

        return BundleManifest(meta=meta, urls=urls, debug_ids=debug_ids)


@dataclass(frozen=True)
class FlatFileMeta:
    id: int
    date: datetime

    @staticmethod
    def from_str(bundle_meta: str) -> FlatFileMeta:
        parsed = bundle_meta.split("/")
        if len(parsed) != 3:
            raise Exception(f"Can't build FlatFileMeta from str {bundle_meta}")

        return FlatFileMeta(id=int(parsed[1]), date=datetime.fromtimestamp(int(parsed[2]) / 1000))

    @staticmethod
    def build_none():
        return FlatFileMeta(id=-1, date=datetime.utcfromtimestamp(0))

    def to_string(self) -> str:
        return f"bundle_index/{self.id}/{int(self.date.timestamp() * 1000)}"

    def is_none(self):
        return self.id == -1 and self.date == datetime.utcfromtimestamp(0)


class FlatFileIdentifier(NamedTuple):
    project_id: int
    release: str
    dist: str

    @staticmethod
    def from_index(idx: ArtifactBundleFlatFileIndex) -> FlatFileIdentifier:
        return FlatFileIdentifier(
            project_id=idx.project_id, release=idx.release_name, dist=idx.dist_name
        )

    @staticmethod
    def for_debug_id(project_id: int) -> FlatFileIdentifier:
        return FlatFileIdentifier(project_id, release=NULL_STRING, dist=NULL_STRING)

    def is_indexing_by_release(self) -> bool:
        # An identifier is indexing by release if release is set.
        return bool(self.release)

    def _hashed(self) -> str:
        key = f"{self.project_id}|{self.release}|{self.dist}"
        return hashlib.sha1(key.encode()).hexdigest()

    def _flat_file_meta_cache_key(self) -> str:
        return f"flat_file_index:{self._hashed()}"

    def set_flat_file_meta_in_cache(self, flat_file_meta: FlatFileMeta):
        cache_key = self._flat_file_meta_cache_key()
        redis_client = get_redis_cluster_for_artifact_bundles()

        redis_client.set(cache_key, flat_file_meta.to_string(), ex=FLAT_FILE_IDENTIFIER_CACHE_TTL)

    def get_flat_file_meta_from_cache(self) -> Optional[FlatFileMeta]:
        cache_key = self._flat_file_meta_cache_key()
        redis_client = get_redis_cluster_for_artifact_bundles()

        flat_file_meta = redis_client.get(cache_key)
        if flat_file_meta is None:
            return None

        try:
            return FlatFileMeta.from_str(flat_file_meta)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return None

    def get_flat_file_meta_from_db(self) -> Optional[FlatFileMeta]:
        result = ArtifactBundleFlatFileIndex.objects.filter(
            project_id=self.project_id, release_name=self.release, dist_name=self.dist
        ).first()
        if result is None:
            return None

        return FlatFileMeta(id=result.id, date=result.date_added)

    def get_flat_file_meta(self) -> Optional[FlatFileMeta]:
        meta_type = "release" if self.is_indexing_by_release() else "debug_id"

        meta = self.get_flat_file_meta_from_cache()
        if meta is None:
            metrics.incr(
                "artifact_bundle_flat_file_indexing.flat_file_meta.cache_miss",
                tags={"meta_type": meta_type},
            )

            meta = self.get_flat_file_meta_from_db()
            if meta is None:
                metrics.incr(
                    "artifact_bundle_flat_file_indexing.flat_file_meta.db_miss",
                    tags={"meta_type": meta_type},
                )
                meta = FlatFileMeta.build_none()
            else:
                metrics.incr(
                    "artifact_bundle_flat_file_indexing.flat_file_meta.db_hit",
                    tags={"meta_type": meta_type},
                )

            # We want to cache in both cases, either a value is found or a value was not found.
            self.set_flat_file_meta_in_cache(meta)
        else:
            metrics.incr(
                "artifact_bundle_flat_file_indexing.flat_file_meta.cache_hit",
                tags={"meta_type": meta_type},
            )

        # In case the meta that we found was none, we want to return None.
        if meta.is_none():
            return None

        return meta


DELETION_KEY_PREFIX = "flat_file_index_deletions"


def get_all_deletions_key() -> str:
    return DELETION_KEY_PREFIX


def get_deletion_key(flat_file_id: int) -> str:
    return f"{DELETION_KEY_PREFIX}:{flat_file_id}"


@sentry_sdk.tracing.trace
def mark_bundle_for_flat_file_indexing(
    artifact_bundle: ArtifactBundle,
    has_debug_ids: bool,
    project_ids: List[int],
    release: Optional[str],
    dist: Optional[str],
) -> List[FlatFileIdentifier]:
    identifiers = []

    for project_id in project_ids:
        if release:
            identifiers.append(
                FlatFileIdentifier(project_id, release=release, dist=dist or NULL_STRING)
            )

        if has_debug_ids:
            identifiers.append(FlatFileIdentifier.for_debug_id(project_id))

    # Create / Update the indexing state in the database
    for identifier in identifiers:
        with atomic_transaction(
            using=(
                router.db_for_write(ArtifactBundleFlatFileIndex),
                router.db_for_write(FlatFileIndexState),
            )
        ):
            flat_file_index, _created = ArtifactBundleFlatFileIndex.objects.get_or_create(
                project_id=identifier.project_id,
                release_name=identifier.release,
                dist_name=identifier.dist,
            )
            FlatFileIndexState.objects.update_or_create(
                flat_file_index=flat_file_index,
                artifact_bundle=artifact_bundle,
                defaults={
                    "indexing_state": ArtifactBundleIndexingState.NOT_INDEXED.value,
                    "date_added": timezone.now(),
                },
            )

    return identifiers


@sentry_sdk.tracing.trace
def remove_artifact_bundle_from_indexes(artifact_bundle: ArtifactBundle):
    redis_client = get_redis_cluster_for_artifact_bundles()

    flat_file_indexes = ArtifactBundleFlatFileIndex.objects.filter(
        flatfileindexstate__artifact_bundle=artifact_bundle
    )
    for idx in flat_file_indexes:
        identifier = FlatFileIdentifier.from_index(idx)

        was_removed = update_artifact_bundle_index(
            identifier, bundles_to_remove=[artifact_bundle.id]
        )
        if not was_removed:
            metrics.incr("artifact_bundle_flat_file_indexing.removal.would_block")
            redis_client.sadd(get_deletion_key(idx.id), artifact_bundle.id)
            redis_client.sadd(get_all_deletions_key(), idx.id)


@sentry_sdk.tracing.trace
def backfill_artifact_index_updates() -> bool:
    redis_client = get_redis_cluster_for_artifact_bundles()

    indexes_needing_update = list(
        ArtifactBundleFlatFileIndex.objects.filter(
            flatfileindexstate__indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
        ).distinct()[:BACKFILL_BATCH_SIZE]
    )

    # To avoid multiple backfill tasks from running into lock contention,
    # we will randomize the order in which we update the indexes
    random.shuffle(indexes_needing_update)

    index_not_fully_updated = False

    # First, we are processing all the indexes that need bundles *added* to them,
    # we also process *removals* at the same time.
    for index in indexes_needing_update:
        identifier = FlatFileIdentifier.from_index(index)

        artifact_bundles = ArtifactBundle.objects.filter(
            flatfileindexstate__flat_file_index=index,
            flatfileindexstate__indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
        ).select_related("file")[:BACKFILL_BATCH_SIZE]

        if len(artifact_bundles) >= BACKFILL_BATCH_SIZE:
            index_not_fully_updated = True

        bundles_to_add = []
        try:
            for artifact_bundle in artifact_bundles:
                with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
                    bundles_to_add.append(
                        BundleManifest.from_artifact_bundle(artifact_bundle, archive)
                    )
        except Exception as e:
            metrics.incr("artifact_bundle_flat_file_indexing.error_when_backfilling")
            sentry_sdk.capture_exception(e)
            continue

        deletion_key = get_deletion_key(index.id)
        redis_client.srem(get_all_deletions_key(), index.id)
        bundles_to_remove = [int(bundle_id) for bundle_id in redis_client.smembers(deletion_key)]

        if bundles_to_add or bundles_to_remove:
            try:
                update_artifact_bundle_index(
                    identifier,
                    blocking=True,
                    bundles_to_add=bundles_to_add,
                    bundles_to_remove=bundles_to_remove,
                )
                if bundles_to_remove:
                    redis_client.srem(deletion_key, *bundles_to_remove)
            except Exception as e:
                metrics.incr("artifact_bundle_flat_file_indexing.error_when_backfilling")
                sentry_sdk.capture_exception(e)

                if bundles_to_remove:
                    # If this failed, it means we didn't remove bundles scheduled for
                    # removal. we want to re-schedule that to do that work later.
                    redis_client.sadd(get_all_deletions_key(), index.id)

    # Then, we process any pending removals marked in redis.
    # NOTE on the usage of redis sets:
    # We could use a redis `SCAN` to find all the sets of scheduled deletions,
    # however that scales with the *total* number of keys in the redis server.
    # Therefore, we rather use a second redis set for the indexes that have deletions scheduled.
    # Races when adding to these sets should not cause a problem, as the *writer*
    # side first adds to the per-index set, and then adds the index to the set of indexes
    # needing deletions.
    # However, there is indeed a slight consistency problem here in case we hit an
    # error after removing the index from the set.
    # In that case we would indeed forget that this index has pending removals,
    # until another deletion request re-adds it to the set of indexes.
    # If this is indeed a problem, we can try to indeed use `scan_iter` to find all
    # the indexes that were missed, like so:
    # deletion_keys = redis_client.scan_iter(
    #     match=DELETION_KEY_PREFIX + ":*",
    # )
    # for deletion_key in deletion_keys:
    #     _prefix, idx_id = deletion_key.split(":")

    deletion_keys = redis_client.srandmember(get_all_deletions_key(), BACKFILL_BATCH_SIZE)
    for idx_id in deletion_keys:
        index = ArtifactBundleFlatFileIndex.objects.get(id=idx_id)
        identifier = FlatFileIdentifier.from_index(index)

        redis_client.srem(get_all_deletions_key(), idx_id)
        deletion_key = get_deletion_key(idx_id)
        bundles_to_remove = [int(bundle_id) for bundle_id in redis_client.smembers(deletion_key)]
        if bundles_to_remove:
            try:
                update_artifact_bundle_index(
                    identifier, blocking=True, bundles_to_remove=bundles_to_remove
                )

                redis_client.srem(deletion_key, *bundles_to_remove)
            except Exception as e:
                metrics.incr("artifact_bundle_flat_file_indexing.error_when_backfilling")
                sentry_sdk.capture_exception(e)

    return (
        len(indexes_needing_update) >= BACKFILL_BATCH_SIZE
        or len(deletion_keys) >= BACKFILL_BATCH_SIZE
        or index_not_fully_updated
    )


@sentry_sdk.tracing.trace
def update_artifact_bundle_index(
    identifier: FlatFileIdentifier,
    blocking: bool = False,
    bundles_to_add: List[BundleManifest] | None = None,
    bundles_to_remove: List[int] | None = None,
) -> bool:
    """
    This will update the index identified via `identifier`.
    Multiple manifests given in `bundles_to_add` and `bundles_to_remove` will be merged
    into the index as one batched operation.

    If this function fails for any reason, it can be, and *has to be* retried at a later point,
    as not doing so will leave inconsistent indexes around.
    """
    with atomic_transaction(
        using=(
            router.db_for_write(ArtifactBundleFlatFileIndex),
            router.db_for_write(FlatFileIndexState),
        )
    ):
        # The `nowait=True` will opportunistically lock the row/index without blocking,
        # and throw an error otherwise which we will pass down and handle in the caller.
        try:
            flat_file_index = (
                ArtifactBundleFlatFileIndex.objects.filter(
                    project_id=identifier.project_id,
                    release_name=identifier.release,
                    dist_name=identifier.dist,
                )
                .select_for_update(nowait=not blocking)
                .first()
            )
        except DatabaseError:
            return False

        index = FlatFileIndex()
        # Load the index from the file if it exists
        if existing_index := flat_file_index.load_flat_file_index():
            index.from_json(existing_index)

        for bundle in bundles_to_add or []:
            # Before merging new data into the index, we will clear any existing
            # data from the index related to this bundle.
            # This is related to an edge-case in which the same `bundle_id` could be
            # re-used but with different file contents.
            index.remove(bundle.meta.id)

            # We merge the index based on the identifier type.
            if identifier.is_indexing_by_release():
                index.merge_urls(bundle.meta, bundle.urls)
            else:
                index.merge_debug_ids(bundle.meta, bundle.debug_ids)

        for bundle_id in bundles_to_remove or []:
            index.remove(bundle_id)

        bundles_removed = index.enforce_size_limits()
        if bundles_removed > 0:
            metrics.incr(
                "artifact_bundle_flat_file_indexing.bundles_removed",
                amount=bundles_removed,
                tags={"reason": "size_limits"},
            )

        # Store the updated index file
        new_json_index = index.to_json()
        flat_file_index.update_flat_file_index(new_json_index)

        # And then mark the bundles as indexed
        for bundle in bundles_to_add or []:
            was_updated = FlatFileIndexState.mark_as_indexed(
                flat_file_index_id=flat_file_index.id, artifact_bundle_id=bundle.meta.id
            )
            if not was_updated:
                metrics.incr("artifact_bundle_flat_file_indexing.duplicated_indexing")
                logger.error(
                    "`ArtifactBundle` %r was already indexed into %r", bundle.meta, identifier
                )

        # We update the cache which is holding the FlatFileMeta for this specific identifier. This is done
        # so that any upcoming event will load the new meta from the db and store it in cache.
        identifier.set_flat_file_meta_in_cache(
            FlatFileMeta(id=flat_file_index.id, date=flat_file_index.date_added)
        )
        return True


# We have seen customers with up to 5_000 bundles per *release*.
MAX_BUNDLES_PER_INDEX = 7_500
# Older `sentry-cli` used to generate fully random DebugIds, and uploads can end up
# having over 400_000 unique ids that do not have mutual sharing among them.
MAX_DEBUGIDS_PER_INDEX = 75_000
# We have seen (legitimate) uploads with over 25_000 unique files.
MAX_URLS_PER_INDEX = 75_000
# Some highly joint bundles will have thousands of bundles matching a file
MAX_BUNDLES_PER_ENTRY = 20


Bundles = List[BundleMeta]
FilesByUrl = Dict[str, List[int]]
FilesByDebugID = Dict[str, List[int]]


T = TypeVar("T")


class FlatFileIndex:
    def __init__(self):
        # By default, a flat file index is empty.
        self._is_complete: bool = True
        self._bundles: Bundles = []
        self._files_by_url: FilesByUrl = {}
        self._files_by_debug_id: FilesByDebugID = {}

    def from_json(self, raw_json: str | bytes) -> None:
        json_idx = json.loads(raw_json, use_rapid_json=True)

        self._is_complete = json_idx.get("is_complete", True)
        bundles = json_idx.get("bundles", [])
        self._bundles = [
            BundleMeta(
                int(bundle["bundle_id"].split("/")[1]),
                datetime.fromisoformat(bundle["timestamp"]),
            )
            for bundle in bundles
        ]
        self._files_by_url = json_idx.get("files_by_url", {})
        self._files_by_debug_id = json_idx.get("files_by_debug_id", {})

    def to_json(self) -> str:
        bundles = [
            {
                # NOTE: Symbolicator is using the `bundle_id` as the `?download=...`
                # parameter it passes to the artifact-lookup API to download the
                # linked bundle from, so this has to match whatever download_id
                # the artifact-lookup API accepts.
                "bundle_id": f"artifact_bundle/{bundle.id}",
                "timestamp": datetime.isoformat(bundle.timestamp),
            }
            for bundle in self._bundles
        ]
        json_idx: Dict[str, Any] = {
            "is_complete": self._is_complete,
            "bundles": bundles,
            "files_by_url": self._files_by_url,
            "files_by_debug_id": self._files_by_debug_id,
        }

        return json.dumps(json_idx)

    def enforce_size_limits(self) -> int:
        """
        This enforced reasonable limits on the data we put into the `FlatFileIndex` by removing
        the oldest bundle from the index until the limits are met.
        """
        bundles_by_timestamp = [bundle for bundle in self._bundles]
        bundles_by_timestamp.sort(reverse=True, key=lambda bundle: (bundle.timestamp, bundle.id))
        bundles_removed = 0

        while (
            len(self._bundles) > MAX_BUNDLES_PER_INDEX
            or len(self._files_by_debug_id) > MAX_DEBUGIDS_PER_INDEX
            or len(self._files_by_url) > MAX_URLS_PER_INDEX
        ):
            bundle_to_remove = bundles_by_timestamp.pop()
            self.remove(bundle_to_remove.id)
            self._is_complete = False
            bundles_removed += 1

        return bundles_removed

    def merge_urls(self, bundle_meta: BundleMeta, urls: List[str]):
        bundle_index = self._add_or_update_bundle(bundle_meta)
        if bundle_index is None:
            return

        for url in urls:
            self._add_sorted_entry(self._files_by_url, url, bundle_index)

    def merge_debug_ids(self, bundle_meta: BundleMeta, debug_ids: List[str]):
        bundle_index = self._add_or_update_bundle(bundle_meta)
        if bundle_index is None:
            return

        for debug_id in debug_ids:
            self._add_sorted_entry(self._files_by_debug_id, debug_id, bundle_index)

    def _add_or_update_bundle(self, bundle_meta: BundleMeta) -> Optional[int]:
        if len(self._bundles) > MAX_BUNDLES_PER_ENTRY:
            self._is_complete = False

        index_and_bundle_meta = self._index_and_bundle_meta_for_id(bundle_meta.id)
        if index_and_bundle_meta is None:
            self._bundles.append(bundle_meta)
            return len(self._bundles) - 1

        found_bundle_index, found_bundle_meta = index_and_bundle_meta
        # In case the new bundle is exactly the same, we will not update, since it's unnecessary.
        if found_bundle_meta == bundle_meta:
            return None
        else:
            # TODO: it might be possible to optimize updating and re-sorting
            # an existing bundle
            self._bundles[found_bundle_index] = bundle_meta
            return found_bundle_index

    def _add_sorted_entry(self, collection: Dict[T, List[int]], key: T, bundle_index: int):
        entries = collection.get(key, [])
        # Remove duplicates by doing a roundtrip through `set`.
        entries_set = set(entries[-MAX_BUNDLES_PER_ENTRY:])
        entries_set.add(bundle_index)
        entries = list(entries_set)
        # Symbolicator will consider the newest element the last element of the list.
        entries.sort(key=lambda index: (self._bundles[index].timestamp, self._bundles[index].id))
        collection[key] = entries

    def remove(self, artifact_bundle_id: int) -> bool:
        index_and_bundle_meta = self._index_and_bundle_meta_for_id(artifact_bundle_id)
        if index_and_bundle_meta is None:
            return False

        found_bundle_index, _ = index_and_bundle_meta
        self._files_by_url = self._update_bundle_references(self._files_by_url, found_bundle_index)
        self._files_by_debug_id = self._update_bundle_references(
            self._files_by_debug_id, found_bundle_index
        )
        self._bundles.pop(found_bundle_index)

        return True

    @staticmethod
    def _update_bundle_references(collection: Dict[T, List[int]], removed_bundle_index: int):
        updated_collection: Dict[T, List[int]] = {}

        for key, indexes in collection.items():
            updated_indexes = [
                index if index < removed_bundle_index else index - 1
                for index in indexes[-MAX_BUNDLES_PER_ENTRY:]
                if index != removed_bundle_index
            ]

            # Only if we have some indexes we want to keep the key.
            if len(updated_indexes) > 0:
                updated_collection[key] = updated_indexes

        return updated_collection

    def _index_and_bundle_meta_for_id(
        self, artifact_bundle_id: int
    ) -> Optional[Tuple[int, BundleMeta]]:
        for index, bundle in enumerate(self._bundles):
            if bundle.id == artifact_bundle_id:
                return index, bundle

        return None
