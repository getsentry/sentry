from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Tuple, TypeVar

from sentry.models.artifactbundle import ArtifactBundleArchive, SourceFileType


@dataclass(frozen=True)
class BundleMeta:
    id: int
    timestamp: datetime


T = TypeVar("T")


class BundleIndex:
    def __init__(self) -> None:
        # A list of bundle metadata
        self._bundles: List[BundleMeta] = []
        # Lookup tables by `url` and `debug_id/file_type` to a list of `self.bundles` indices,
        # sorted by the `timestamp` of the bundle.
        self._files_by_url: Dict[str, List[int]] = {}
        self._files_by_debug_id: Dict[Tuple[str, str], List[int]] = {}

    def get_meta_by_url(self, url: str) -> BundleMeta | None:
        entries = self._files_by_url.get(url)
        if not entries:
            return None  # mypy, you are really pedantic about this, hm?
        idx = entries[-1]
        return self._bundles[idx]

    # TODO: load from JSON
    # TODO: write as JSON

    def merge_bundle_manifest(
        self,
        bundle_meta: BundleMeta,
        manifest: dict,
        index_urls=True,
        index_debugids=True,
    ):
        """
        Merges the Bundle with the given `BundleMeta` and `manifest` into the Index.
        """

        # The bundle (matched by id) is already part of the index
        if any(meta.id == bundle_meta.id for meta in self._bundles):
            return

        self._bundles.append(bundle_meta)
        bundle_idx = len(self._bundles) - 1

        # Index the files of the manifest
        for info in manifest.get("files", {}).values():
            if index_urls and (url := info.get("url")):
                self._add_sorted_entry(self._files_by_url, url, bundle_idx)

            headers = ArtifactBundleArchive.normalize_headers(info.get("headers", {}))
            if index_debugids and (debug_id := headers.get("debug-id")):
                debug_id = ArtifactBundleArchive.normalize_debug_id(debug_id)
                file_type = info.get("type", "")

                if debug_id and SourceFileType.from_lowercase_key(file_type):
                    self._add_sorted_entry(
                        self._files_by_debug_id, (debug_id, file_type), bundle_idx
                    )

        # Maybe Re-sort the indexes, because why not?
        # self.files_by_url = dict(sorted(self.files_by_url.items()))
        # self.files_by_debug_id = dict(sorted(self.files_by_debug_id.items()))

    def _add_sorted_entry(self, collection: Dict[T, List[int]], key: T, bundle_idx: int):
        entries = collection.get(key, [])
        entries.append(bundle_idx)
        entries.sort(key=lambda e: self._bundles[e].timestamp)
        collection[key] = entries

    def remove_bundle_from_index(self, bundle_id: int):
        """
        Removes all the entries with the given `bundle_id` from the Index.
        """
        removed_idx = None
        for idx, bundle_meta in enumerate(self._bundles):
            if bundle_meta.id == bundle_id:
                removed_idx = idx
                break

        if removed_idx is None:
            return

        del self._bundles[removed_idx]

        self._files_by_url = self._remove_entry(self._files_by_url, removed_idx)
        self._files_by_debug_id = self._remove_entry(self._files_by_debug_id, removed_idx)

    def _remove_entry(self, collection: Dict[T, List[int]], removed_idx: int):
        updated_collection = {}
        for key, entries in collection.items():
            # We removed `removed_idx` from `self.bundles`, this means we have to
            # patch up all the references: remove the direct reference, and shift
            # all higher indexes by 1 to account for the gap
            entries = [e if e < removed_idx else e - 1 for e in entries if e != removed_idx]
            if entries:
                updated_collection[key] = entries

        return updated_collection
