from datetime import datetime
from typing import Dict, List

from sentry.models.artifactbundle import ArtifactBundleArchive, SourceFileType


class BundleIndex:
    def __init__(self) -> None:
        self.bundles: Dict[int, datetime] = {}
        self.files_by_url: Dict[str, List[dict]] = {}
        self.files_by_debug_id: Dict[str, List[dict]] = {}

    # TODO: load from JSON
    # TODO: write as JSON

    def merge_bundle_manifest(
        self,
        bundle_id: int,
        bundle_date: datetime,
        manifest: dict,
        index_urls=True,
        index_debugids=True,
    ):
        """
        Merges the Bundle given by its `bundle_id`, `bundle_date` and `manifest` into the Index.
        """

        # The bundle is already part of the index
        if self.bundles.get(bundle_id):
            return

        self.bundles[bundle_id] = bundle_date

        # Index the files of the manifest
        for info in manifest.get("files", {}).values():
            headers = ArtifactBundleArchive.normalize_headers(info.get("headers", {}))

            if index_urls and (url := info.get("url")):
                self._add_sorted_entry(
                    self.files_by_url, url, {"bundle": bundle_id, "headers": headers}
                )

            if index_debugids and (debug_id := headers.get("debug-id")):
                debug_id = self.normalize_debug_id(debug_id)
                file_type = info.get("type", "")
                if debug_id and SourceFileType.from_lowercase_key(file_type):
                    self._add_sorted_entry(
                        self.files_by_debug_id, debug_id, {"bundle": bundle_id, "type": file_type}
                    )

        # Maybe Re-sort the indexes, because why not?
        # self.bundles = dict(sorted(self.bundles.items(), key=lambda i: i[1]))
        # self.files_by_url = dict(sorted(self.files_by_url.items()))
        # self.files_by_debug_id = dict(sorted(self.files_by_debug_id.items()))

    def _add_sorted_entry(self, collection: Dict[str, List[dict]], key: str, entry: dict):
        entries = collection.get(key, [])
        entries.append(entry)
        entries.sort(key=lambda e: self.bundles[e["bundle"]])
        collection[key] = entry

    def remove_bundle_from_index(self, bundle_id: int):
        """
        Removes all the entries with the given `bundle_id` from the Index.
        """
        del self.bundles[bundle_id]
        self.files_by_url = self._remove_entry(self.files_by_url, bundle_id)
        self.files_by_debug_id = self._remove_entry(self.files_by_debug_id, bundle_id)

    def _remove_entry(self, collection: Dict[str, List[dict]], bundle_id: int):
        updated_collection = {}
        for key, entries in collection.items():
            entries = [e for e in entries if e["bundle"] != bundle_id]
            if entries:
                updated_collection[key] = entries

        return updated_collection
