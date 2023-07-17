from __future__ import annotations

import hashlib
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, NamedTuple, Optional, Tuple, TypedDict, TypeVar, Union

import sentry_sdk

from sentry.debug_files.artifact_bundles import get_redis_cluster_for_artifact_bundles
from sentry.models.artifactbundle import (
    NULL_STRING,
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleFlatFileIndex,
)
from sentry.utils import json, metrics

# We want to keep the bundle as being indexed for 600 seconds = 10 minutes. We might need to revise this number and
# optimize it based on the time taken to perform the indexing (on average).
FLAT_FILE_INDEXING_CACHE_TIMEOUT = 600


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
            pipeline.set(cache_key, 1, ex=FLAT_FILE_INDEXING_CACHE_TIMEOUT)

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
    with ArtifactBundleArchive(
        artifact_bundle.file.getfile(), build_memory_map=True
    ) as bundle_archive:
        identifiers = [identifier]

        # In case we have an identifier that is indexed by release and the bundle has debug ids, we want to perform
        # indexing on also the debug ids bundle.
        if identifier.is_indexing_by_release() and bundle_archive.has_debug_ids():
            identifiers.append(identifier.to_indexing_by_debug_id())

        # Before starting, we have to make sure that no other identifiers are being indexed.
        if not set_flat_files_being_indexed_if_null(identifiers):
            return FlatFileIndexingState.CONFLICT

        # For each identifier we now have to compute the index.
        for identifier in identifiers:
            try:
                store = FlatFileIndexStore(identifier)
                index = FlatFileIndex()

                existing_json_index = store.load()
                if existing_json_index is not None:
                    # We build the index from the json stored in memory.
                    index.from_json(existing_json_index)

                bundle_meta = BundleMeta(
                    id=artifact_bundle.id,
                    # We give priority to the date last modified for total ordering.
                    timestamp=(artifact_bundle.date_last_modified or artifact_bundle.date_uploaded),
                )
                # We merge the index based on the identifier type.
                if identifier.is_indexing_by_release():
                    index.merge_urls(bundle_meta, bundle_archive)
                else:
                    index.merge_debug_ids(bundle_meta, bundle_archive)

                # We convert the index to a json representation.
                new_json_index = index.to_json()
                # We store the new index as json.
                store.save(json_index=new_json_index)
            except Exception as e:
                sentry_sdk.capture_exception(e)
                metrics.incr("artifact_bundle_flat_file_indexing.error_when_indexing")
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

    def load(self) -> Optional[str]:
        try:
            return ArtifactBundleFlatFileIndex.objects.get(
                project_id=self.identifier.project_id,
                release_name=self.identifier.release,
                dist_name=self.identifier.dist,
            ).load_flat_file_index()
        except ArtifactBundleFlatFileIndex.DoesNotExist:
            return None

    def save(self, json_index: str):
        ArtifactBundleFlatFileIndex.create_flat_file_index(
            project_id=self.identifier.project_id,
            release=self.identifier.release,
            dist=self.identifier.dist,
            file_contents=json_index,
        )


T = TypeVar("T")


class FlatFileIndex:
    def __init__(self):
        # By default, a flat file index is empty.
        self._bundles: Bundles = []
        self._files_by_url: FilesByUrl = {}
        self._files_by_debug_id: FilesByDebugID = {}

    def from_json(self, json_index: str) -> None:
        flat_file_index = json.loads(json_index)
        self._deserialize_json_index(flat_file_index)

    def _deserialize_json_index(self, flat_file_index: Dict[str, Any]) -> None:
        if "bundles" in flat_file_index:
            self._bundles = self._deserialize_bundles(flat_file_index["bundles"])

        if "files_by_url" in flat_file_index:
            self._files_by_url = flat_file_index["files_by_url"]

        if "files_by_debug_id" in flat_file_index:
            self._files_by_debug_id = flat_file_index["files_by_debug_id"]

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

    def to_json(self) -> str:
        pre_serialized_index: Dict[str, Any] = {
            "bundles": self._serialize_bundles(),
            "files_by_url": self._files_by_url,
            "files_by_debug_id": self._files_by_debug_id,
        }

        return json.dumps(pre_serialized_index)

    def _serialize_bundles(self) -> List[Dict[str, Union[int, str]]]:
        serialized_bundles: List[Dict[str, Union[int, str]]] = []

        for bundle in self._bundles:
            serialized_bundles.append(
                {"id": bundle["id"], "timestamp": datetime.isoformat(bundle["timestamp"])}
            )

        return serialized_bundles

    def merge_urls(self, bundle_meta: BundleMeta, bundle_archive: ArtifactBundleArchive):
        bundle_index = self._update_bundles(bundle_meta)
        if bundle_index is None:
            return

        self._iterate_over_urls(bundle_index, bundle_archive)

    def merge_debug_ids(self, bundle_meta: BundleMeta, bundle_archive: ArtifactBundleArchive):
        bundle_index = self._update_bundles(bundle_meta)
        if bundle_index is None:
            return

        self._iterate_over_debug_ids(bundle_index, bundle_archive)

    def _update_bundles(self, bundle_meta: BundleMeta) -> Optional[int]:
        index_and_bundle_meta = self._index_and_bundle_meta_for_id(bundle_meta["id"])
        if index_and_bundle_meta is None:
            self._bundles.append(bundle_meta)
            return len(self._bundles) - 1

        found_bundle_index, found_bundle_meta = index_and_bundle_meta
        # In case the new bundle is exactly the same, we will not update, since it's unnecessary.
        if found_bundle_meta == bundle_meta:
            return None
        else:
            # TODO: we can for sure optimize the case in which we update the date of a bundle that already exists by
            #  just sorting the list again or doing a smarter shift in the list.
            self._bundles[found_bundle_index] = bundle_meta
            return found_bundle_index

    def _iterate_over_debug_ids(self, bundle_index: int, bundle_archive: ArtifactBundleArchive):
        for debug_id, _ in bundle_archive.get_all_debug_ids():
            self._add_sorted_entry(self._files_by_debug_id, debug_id, bundle_index)

    def _iterate_over_urls(self, bundle_index: int, bundle_archive: ArtifactBundleArchive):
        for url in bundle_archive.get_all_urls():
            self._add_sorted_entry(self._files_by_url, url, bundle_index)

    def _add_sorted_entry(self, collection: Dict[T, List[int]], key: T, bundle_index: int):
        entries = collection.get(key, [])
        entries.append(bundle_index)
        # We need to remove duplicates, and we can do this by naively converting a list to a set and then again to a
        # list.
        entries = list(set(entries))
        # Symbolicator will consider the newest element the last element of the list.
        entries.sort(key=lambda index: self._bundles[index]["timestamp"])
        collection[key] = entries

    def remove(self, artifact_bundle_id: int):
        index_and_bundle_meta = self._index_and_bundle_meta_for_id(artifact_bundle_id)
        if index_and_bundle_meta is None:
            raise Exception("The bundle you want do delete doesn't exist in the index.")

        found_bundle_index, _ = index_and_bundle_meta
        self._files_by_url = self._update_bundle_references(self._files_by_url, found_bundle_index)
        self._files_by_debug_id = self._update_bundle_references(
            self._files_by_debug_id, found_bundle_index
        )
        self._bundles.pop(found_bundle_index)

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

    def _index_and_bundle_meta_for_id(self, artifact_bundle_id) -> Optional[Tuple[int, BundleMeta]]:
        for index, bundle in enumerate(self._bundles):
            if bundle["id"] == artifact_bundle_id:
                return index, bundle

        return None
