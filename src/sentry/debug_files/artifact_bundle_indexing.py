import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, NamedTuple, Optional, Tuple, TypeVar

import sentry_sdk
from django.db import router
from django.utils import timezone

from sentry.debug_files.artifact_bundles import get_redis_cluster_for_artifact_bundles
from sentry.locks import locks
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
from sentry.utils.locking.lock import Lock
from sentry.utils.retries import TimedRetryPolicy

logger = logging.getLogger(__name__)

# The TTL of the cache containing information about a specific flat file index. The TTL is set to 1 hour, since
# we know that the cache will be invalidated in case of flat file index updates, thus it is mostly to keep the
# size of the caches under control in case of no uploads from the user end.
FLAT_FILE_IDENTIFIER_CACHE_TTL = 3600


@dataclass(frozen=True)
class BundleMeta:
    id: int
    timestamp: datetime


@dataclass(frozen=True)
class FlatFileMeta:
    id: int
    date: datetime

    @staticmethod
    def from_str(bundle_meta: str) -> "FlatFileMeta":
        parsed = bundle_meta.split("/")
        if len(parsed) != 3:
            raise Exception(f"Can't build FlatFileMeta from str {bundle_meta}")

        return FlatFileMeta(id=int(parsed[1]), date=datetime.fromtimestamp(int(parsed[2]) / 1000))

    @staticmethod
    def build_none():
        return FlatFileMeta(id=-1, date=datetime.min)

    def to_string(self) -> str:
        if self.date != datetime.min:
            timestamp = int(self.date.timestamp() * 1000)
        else:
            timestamp = 0

        return f"bundle_index/{self.id}/{timestamp}"

    def is_none(self):
        return self.id == -1 and self.date == datetime.min


@sentry_sdk.tracing.trace
def mark_bundle_for_flat_file_indexing(
    artifact_bundle: ArtifactBundle,
    project_ids: List[int],
    release: Optional[str],
    dist: Optional[str],
):
    identifiers = []

    for project_id in project_ids:
        if release:
            identifiers.append(
                FlatFileIdentifier(project_id, release=release, dist=dist or NULL_STRING)
            )

        identifiers.append(FlatFileIdentifier.for_debug_id(project_id))

    # Create / Update the indexing state in the database
    for identifier in identifiers:
        # It turns out our DB integrity, and usage of `get_or_create` is not safe
        # in the sense that it can end up with duplicates in the database, yay!
        # So just wrap all of this in a lock so we are definitely not creating
        # duplicated index entries concurrently.
        lock = identifier.get_lock()
        with TimedRetryPolicy(60)(lock.acquire), atomic_transaction(
            using=(
                router.db_for_write(ArtifactBundleFlatFileIndex),
                router.db_for_write(FlatFileIndexState),
            )
        ):
            # This used to be `get_or_create`, but that is completely broken
            # when you end up with duplicates, so now we gotta clean that mess up:
            flat_file_indexes = list(
                ArtifactBundleFlatFileIndex.objects.filter(
                    project_id=identifier.project_id,
                    release_name=identifier.release,
                    dist_name=identifier.dist,
                )
            )
            if len(flat_file_indexes) > 0:
                flat_file_index = flat_file_indexes.pop(0)
                # remove duplicates from the DB:
                if len(flat_file_indexes) > 0:
                    ids = [index.id for index in flat_file_indexes]
                    ArtifactBundleFlatFileIndex.objects.filter(id__in=ids).delete()
            else:
                flat_file_index = ArtifactBundleFlatFileIndex.objects.create(
                    project_id=identifier.project_id,
                    release_name=identifier.release,
                    dist_name=identifier.dist,
                )

            # Lol, turns out that `update_or_create` will also do a `get` under the hood,
            # which is equally broken if you end up with duplicates.
            rows_updated = FlatFileIndexState.objects.filter(
                flat_file_index=flat_file_index,
                artifact_bundle=artifact_bundle,
            ).update(
                indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
                date_added=timezone.now(),
            )
            if rows_updated == 0:
                FlatFileIndexState.objects.create(
                    flat_file_index=flat_file_index,
                    artifact_bundle=artifact_bundle,
                    indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
                )

    return identifiers


class FlatFileIdentifier(NamedTuple):
    project_id: int
    release: str
    dist: str

    @staticmethod
    def for_debug_id(project_id: int) -> "FlatFileIdentifier":
        return FlatFileIdentifier(project_id, release=NULL_STRING, dist=NULL_STRING)

    def is_indexing_by_release(self) -> bool:
        # An identifier is indexing by release if release is set.
        return bool(self.release)

    def _hashed(self):
        key = f"{self.project_id}|{self.release}|{self.dist}"
        return hashlib.sha1(key.encode()).hexdigest()

    def _flat_file_meta_cache_key(self):
        return f"flat_file_index:{self._hashed()}"

    def delete_flat_file_meta_from_cache(self):
        cache_key = self._flat_file_meta_cache_key()
        redis_client = get_redis_cluster_for_artifact_bundles()

        redis_client.delete(cache_key)

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
        if result is None or result.flat_file_index is None:
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

    def _locking_key(self):
        return f"bundle_index:write:{self._hashed()}"

    def get_lock(self) -> Lock:
        locking_key = self._locking_key()

        return locks.get(locking_key, duration=60 * 10, name="bundle_index")


@sentry_sdk.tracing.trace
def update_artifact_bundle_index(
    bundle_meta: "BundleMeta", bundle_archive: ArtifactBundleArchive, identifier: FlatFileIdentifier
):
    """
    This will merge the `ArtifactBundle` given via `bundle_meta` and `bundle_archive`
    into the index identified via `identifier`.

    If this function fails for any reason, it can be, and *has to be* retried at a later point.
    """
    # TODO: maybe query `FlatFileIndexState` to avoid double-indexing?

    lock = identifier.get_lock()
    with TimedRetryPolicy(60)(lock.acquire):
        flat_file_index = (
            ArtifactBundleFlatFileIndex.objects.select_related("flat_file_index")
            .filter(
                project_id=identifier.project_id,
                release_name=identifier.release,
                dist_name=identifier.dist,
            )
            .first()
        )

        index = FlatFileIndex()
        # Load the index from the file if it exists
        if existing_index := flat_file_index.load_flat_file_index():
            index.from_json(existing_index)

        # Before merging new data into the index, we will clear any existing
        # data from the index related to this bundle.
        # This is related to an edge-case in which the same `bundle_id` could be
        # re-used but with different file contents.
        index.remove(bundle_meta.id)

        # We merge the index based on the identifier type.
        if identifier.is_indexing_by_release():
            index.merge_urls(bundle_meta, bundle_archive)
        else:
            index.merge_debug_ids(bundle_meta, bundle_archive)

        # Store the updated index file
        new_json_index = index.to_json()
        flat_file_index.update_flat_file_index(new_json_index)

        # And then mark the bundle as indexed
        was_updated = FlatFileIndexState.compare_state_and_set(
            flat_file_index.id,
            bundle_meta.id,
            ArtifactBundleIndexingState.NOT_INDEXED,
            ArtifactBundleIndexingState.WAS_INDEXED,
        )
        if not was_updated:
            metrics.incr("artifact_bundle_flat_file_indexing.duplicated_indexing")
            logger.error("`ArtifactBundle` %r was already indexed into %r", bundle_meta, identifier)

        # We invalidate the cache which is holding the FlatFileMeta for this specific identifier. This is done
        # so that any upcoming event will load the new meta from the db and store it in cache.
        identifier.delete_flat_file_meta_from_cache()


Bundles = List[BundleMeta]
FilesByUrl = Dict[str, List[int]]
FilesByDebugID = Dict[str, List[int]]


T = TypeVar("T")


class FlatFileIndex:
    def __init__(self):
        # By default, a flat file index is empty.
        self._bundles: Bundles = []
        self._files_by_url: FilesByUrl = {}
        self._files_by_debug_id: FilesByDebugID = {}

    def from_json(self, json_str: str) -> None:
        json_idx = json.loads(json_str)

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
            "bundles": bundles,
            "files_by_url": self._files_by_url,
            "files_by_debug_id": self._files_by_debug_id,
        }

        return json.dumps(json_idx)

    def merge_urls(self, bundle_meta: BundleMeta, bundle_archive: ArtifactBundleArchive):
        bundle_index = self._add_or_update_bundle(bundle_meta)
        if bundle_index is None:
            return

        for url in bundle_archive.get_all_urls():
            self._add_sorted_entry(self._files_by_url, url, bundle_index)

    def merge_debug_ids(self, bundle_meta: BundleMeta, bundle_archive: ArtifactBundleArchive):
        bundle_index = self._add_or_update_bundle(bundle_meta)
        if bundle_index is None:
            return

        for debug_id, _ in bundle_archive.get_all_debug_ids():
            self._add_sorted_entry(self._files_by_debug_id, debug_id, bundle_index)

    def _add_or_update_bundle(self, bundle_meta: BundleMeta) -> Optional[int]:
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
        entries.append(bundle_index)
        # Remove duplicates by doing a roundtrip through `set`.
        entries = list(set(entries))
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
                for index in indexes
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
