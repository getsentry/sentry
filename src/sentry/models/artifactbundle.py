from __future__ import annotations

import zipfile
from enum import Enum
from io import BytesIO
from typing import IO, Callable, Dict, List, Mapping, Optional, Set, Tuple

from django.db import models, router
from django.db.models.signals import post_delete
from django.utils import timezone
from symbolic.debuginfo import normalize_debug_id
from symbolic.exceptions import SymbolicError

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)
from sentry.utils import json
from sentry.utils.db import atomic_transaction
from sentry.utils.hashlib import sha1_text

# Sentinel values used to represent a null state in the database. This is done since the `NULL` type in the db is
# always different from `NULL`.
NULL_UUID = "00000000-00000000-00000000-00000000"
NULL_STRING = ""
# Number of bundles that have to be associated to a release/dist pair before indexing takes place.
INDEXING_THRESHOLD = 1


class SourceFileType(Enum):
    SOURCE = 1
    MINIFIED_SOURCE = 2
    SOURCE_MAP = 3
    INDEXED_RAM_BUNDLE = 4

    @classmethod
    def choices(cls) -> List[Tuple[int, str]]:
        return [(key.value, key.name) for key in cls]

    @classmethod
    def from_lowercase_key(cls, lowercase_key: Optional[str]) -> Optional[SourceFileType]:
        if lowercase_key is None:
            return None

        for key in cls:
            if key.name.lower() == lowercase_key:
                return SourceFileType(key.value)

        return None


class ArtifactBundleIndexingState(Enum):
    NOT_INDEXED = 0
    WAS_INDEXED = 1

    @classmethod
    def choices(cls) -> List[Tuple[int, str]]:
        return [(key.value, key.name) for key in cls]


@region_silo_only_model
class ArtifactBundle(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    # We use 00000000-00000000-00000000-00000000 in place of NULL because the uniqueness constraint doesn't play well
    # with nullable fields, since NULL != NULL.
    bundle_id = models.UUIDField(default=NULL_UUID, db_index=True)
    file = FlexibleForeignKey("sentry.File")
    artifact_count = BoundedPositiveIntegerField()
    indexing_state = models.IntegerField(
        default=None, null=True, choices=ArtifactBundleIndexingState.choices()
    )
    # This field represents the date in which the bundle was renewed, since we have a renewal mechanism in place. The
    # name is the same across entities connected to this bundle named *ArtifactBundle.
    date_added = models.DateTimeField(default=timezone.now, db_index=True)
    # This field represents the date of upload of this bundle, and it's not mutated afterward.
    date_uploaded = models.DateTimeField(default=timezone.now)
    # This field represents the date in which this bundle was last modified, where modification means that an
    # association has been added or any of its fields have been modified.
    date_last_modified = models.DateTimeField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_artifactbundle"

    @classmethod
    def get_release_associations(
        cls, organization_id: int, artifact_bundle: ArtifactBundle
    ) -> List[Mapping[str, str | None]]:
        release_artifact_bundles = ReleaseArtifactBundle.objects.filter(
            organization_id=organization_id, artifact_bundle=artifact_bundle
        )

        return [
            {
                "release": release_artifact_bundle.release_name,
                "dist": release_artifact_bundle.dist_name or None,
            }
            for release_artifact_bundle in release_artifact_bundles
        ]

    @classmethod
    def get_ident(cls, url, dist=None):
        if dist is not None:
            return sha1_text(url + "\x00\x00" + dist).hexdigest()
        return sha1_text(url).hexdigest()


def delete_file_for_artifact_bundle(instance, **kwargs):
    instance.file.delete()


post_delete.connect(delete_file_for_artifact_bundle, sender=ArtifactBundle)


@region_silo_only_model
class ArtifactBundleFlatFileIndex(Model):
    __include_in_export__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    release_name = models.CharField(max_length=250)
    dist_name = models.CharField(max_length=64, default=NULL_STRING)
    # This association is nullable since we need it for a correct durable implementation of the `FlatFileIndexState`.
    flat_file_index = FlexibleForeignKey("sentry.File", null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_artifactbundleflatfileindex"

        index_together = (("project_id", "release_name", "dist_name"),)

    def update_flat_file_index(self, file_contents: str):
        from sentry.models import File

        with atomic_transaction(
            using=(router.db_for_write(File), router.db_for_write(ArtifactBundleFlatFileIndex))
        ):
            current_file = self.flat_file_index

            updated_file = self._create_flat_file_index_object(file_contents)

            # We have to update the new index file and also the date added, which is required for expiration.
            self.update(flat_file_index=updated_file, date_added=timezone.now())

            if current_file is not None:
                # It's important to also delete the old file, otherwise we will end up with orphan files in the
                # database.
                current_file.delete()

    def load_flat_file_index(self) -> Optional[str]:
        if self.flat_file_index is None:
            return None

        return self.flat_file_index.getfile().read().decode()

    @classmethod
    def _create_flat_file_index_object(cls, file_contents: str):
        from sentry.models import File

        file = File.objects.create(
            name="artifact_bundle_flat_file_index",
            type="flat_file_index",
        )
        file.putfile(BytesIO(file_contents.encode()))

        return file


@region_silo_only_model
class FlatFileIndexState(Model):
    __include_in_export__ = False

    flat_file_index = FlexibleForeignKey("sentry.ArtifactBundleFlatFileIndex")
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")
    indexing_state = models.IntegerField(choices=ArtifactBundleIndexingState.choices())
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_flatfileindexstate"

    @staticmethod
    def compare_state_and_set(
        flat_file_index_id: int,
        artifact_bundle_id: int,
        indexing_state: ArtifactBundleIndexingState,
        new_indexing_state: ArtifactBundleIndexingState,
    ) -> bool:
        updated_rows = FlatFileIndexState.objects.filter(
            flat_file_index_id=flat_file_index_id,
            artifact_bundle_id=artifact_bundle_id,
            indexing_state=indexing_state.value,
        ).update(indexing_state=new_indexing_state.value, date_added=timezone.now())

        # If we had one row being updated, it means that the cas operation succeeded.
        return updated_rows == 1


@region_silo_only_model
class ArtifactBundleIndex(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")
    url = models.TextField()
    date_added = models.DateTimeField(default=timezone.now)

    # TODO: legacy fields:
    # These will eventually be removed in a migration, as they can be joined
    # via the `{Release,}ArtifactBundle` tables.
    release_name = models.CharField(max_length=250)
    dist_name = models.CharField(max_length=64, default=NULL_STRING)
    date_last_modified = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_artifactbundleindex"

        index_together = (("url", "artifact_bundle"),)


@region_silo_only_model
class ReleaseArtifactBundle(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    release_name = models.CharField(max_length=250)
    # We use "" in place of NULL because the uniqueness constraint doesn't play well with nullable fields, since
    # NULL != NULL.
    dist_name = models.CharField(max_length=64, default=NULL_STRING)
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_releaseartifactbundle"

        # We add the organization_id to this index since there are many occurrences of the same release/dist
        # pair, and we would like to reduce the result set by scoping to the org.
        index_together = (("organization_id", "release_name", "dist_name", "artifact_bundle"),)


@region_silo_only_model
class DebugIdArtifactBundle(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    debug_id = models.UUIDField()
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")
    source_file_type = models.IntegerField(choices=SourceFileType.choices())
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_debugidartifactbundle"

        index_together = (("debug_id", "artifact_bundle"),)


@region_silo_only_model
class ProjectArtifactBundle(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    project_id = BoundedBigIntegerField()
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectartifactbundle"

        index_together = (("project_id", "artifact_bundle"),)


class ArtifactBundleArchive:
    """Read-only view of uploaded ZIP artifact bundle."""

    def __init__(self, fileobj: IO, build_memory_map: bool = True):
        self._fileobj = fileobj
        self._zip_file = zipfile.ZipFile(self._fileobj)
        self._entries_by_debug_id = {}
        self._entries_by_url = {}

        self.manifest = self._read_manifest()
        self.artifact_count = len(self.manifest.get("files", {}))

        if build_memory_map:
            self._build_memory_maps()

    def __enter__(self):
        return self

    def __exit__(self, exc, value, tb):
        self.close()

    def close(self):
        self._zip_file.close()
        self._fileobj.close()

    def info(self, filename: str) -> zipfile.ZipInfo:
        return self._zip_file.getinfo(filename)

    def read(self, filename: str) -> bytes:
        return self._zip_file.read(filename)

    def _read_manifest(self) -> dict:
        manifest_bytes = self.read("manifest.json")
        return json.loads(manifest_bytes.decode("utf-8"))

    @staticmethod
    def normalize_headers(headers: dict) -> dict:
        return {k.lower(): v for k, v in headers.items()}

    @staticmethod
    def normalize_debug_id(debug_id: Optional[str]) -> Optional[str]:
        if debug_id is None:
            return None

        try:
            return normalize_debug_id(debug_id)
        except SymbolicError:
            return None

    def _build_memory_maps(self):
        files = self.manifest.get("files", {})
        for file_path, info in files.items():
            # Building the map for debug_id lookup.
            headers = self.normalize_headers(info.get("headers", {}))
            if (debug_id := headers.get("debug-id")) is not None:
                debug_id = self.normalize_debug_id(debug_id)
                file_type = info.get("type")
                if (
                    debug_id is not None
                    and file_type is not None
                    and (source_file_type := SourceFileType.from_lowercase_key(file_type))
                    is not None
                ):
                    self._entries_by_debug_id[(debug_id, source_file_type)] = (
                        file_path,
                        info.get("url"),
                        info,
                    )

            # Building the map for url lookup.
            self._entries_by_url[info.get("url")] = (file_path, info)

    def get_all_urls(self):
        return self._entries_by_url.keys()

    def get_all_debug_ids(self):
        return self._entries_by_debug_id.keys()

    def has_debug_ids(self):
        return len(self._entries_by_debug_id) > 0

    def extract_debug_ids_from_manifest(
        self,
    ) -> Set[Tuple[SourceFileType, str]]:
        # We use a set, since we might have the same debug_id and file_type.
        debug_ids_with_types = set()

        files = self.manifest.get("files", {})
        for info in files.values():
            headers = self.normalize_headers(info.get("headers", {}))
            if (debug_id := headers.get("debug-id")) is not None:
                debug_id = self.normalize_debug_id(debug_id)
                file_type = info.get("type")
                if (
                    debug_id is not None
                    and file_type is not None
                    and (source_file_type := SourceFileType.from_lowercase_key(file_type))
                    is not None
                ):
                    debug_ids_with_types.add((source_file_type, debug_id))

        return debug_ids_with_types

    def extract_bundle_id(self) -> Optional[str]:
        bundle_id = self.manifest.get("debug_id")

        if bundle_id is not None:
            bundle_id = self.normalize_debug_id(bundle_id)

        return bundle_id

    def get_files(self) -> Dict[str, dict]:
        return self.manifest.get("files", {})

    def get_file_by_url(self, url: str) -> Tuple[IO, dict]:
        file_path, info = self._entries_by_url[url]
        return self._zip_file.open(file_path), info.get("headers", {})

    def get_file_by_debug_id(
        self, debug_id: str, source_file_type: SourceFileType
    ) -> Tuple[IO[bytes], dict]:
        file_path, _, info = self._entries_by_debug_id[debug_id, source_file_type]
        return self._zip_file.open(file_path), info.get("headers", {})

    def get_file(self, file_path: str) -> Tuple[IO, dict]:
        files = self.manifest.get("files", {})
        file_info = files.get(file_path, {})
        return self._zip_file.open(file_path), file_info.get("headers", {})

    def get_files_by(self, block: Callable[[str, dict], bool]) -> Dict[str, dict]:
        files = self.manifest.get("files", {})
        results = {}

        for file_path, info in files.items():
            if block(file_path, info):
                results[file_path] = info

        return results

    def get_files_by_url_or_debug_id(self, query: Optional[str]) -> Dict[str, dict]:
        def filter_function(_: str, info: dict) -> bool:
            if query is None:
                return True

            normalized_query = query.lower()

            if normalized_query in info.get("url", "").lower():
                return True

            headers = self.normalize_headers(info.get("headers", {}))
            debug_id = self.normalize_debug_id(headers.get("debug-id", None))
            if debug_id is not None:
                debug_id = debug_id.lower()

                if normalized_query in debug_id:
                    return True

                # We also want to try and normalize the query so that we can match for example:
                # 2b69e5bd2e984c578ce1b58da19110ae with 2b69e5bd-2e98-4c57-8ce1-b58da19110ae.
                normalized_query = self.normalize_debug_id(normalized_query)
                if normalized_query is not None and normalized_query in debug_id:
                    return True

            return False

        return self.get_files_by(filter_function)

    def get_file_info(self, file_path: Optional[str]) -> Optional[zipfile.ZipInfo]:
        try:
            return self._zip_file.getinfo(file_path)
        except KeyError:
            return None

    def get_file_url_by_debug_id(
        self, debug_id: str, source_file_type: SourceFileType
    ) -> Optional[str]:
        entry = self._entries_by_debug_id.get((debug_id, source_file_type))
        if entry is not None:
            return entry[1]

        return None

    def get_file_url_by_file_path(self, file_path):
        files = self.manifest.get("files", {})
        file_info = files.get(file_path, {})

        return file_info.get("url")
