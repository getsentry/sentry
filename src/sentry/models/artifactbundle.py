import zipfile
from enum import Enum
from typing import IO, Callable, Dict, List, Optional, Tuple

from django.db import models
from django.db.models.signals import post_delete
from django.utils import timezone
from symbolic import SymbolicError, normalize_debug_id

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
)
from sentry.utils import json
from sentry.utils.hashlib import sha1_text

NULL_UUID = "00000000-00000000-00000000-00000000"
NULL_STRING = ""


class SourceFileType(Enum):
    SOURCE = 1
    MINIFIED_SOURCE = 2
    SOURCE_MAP = 3
    INDEXED_RAM_BUNDLE = 4

    @classmethod
    def choices(cls) -> List[Tuple[int, str]]:
        return [(key.value, key.name) for key in cls]

    @classmethod
    def from_lowercase_key(cls, lowercase_key: Optional[str]) -> Optional["SourceFileType"]:
        if lowercase_key is None:
            return None

        for key in cls:
            if key.name.lower() == lowercase_key:
                return SourceFileType(key.value)

        return None


@region_silo_only_model
class ArtifactBundle(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    # We use 00000000-00000000-00000000-00000000 in place of NULL because the uniqueness constraint doesn't play well
    # with nullable fields, since NULL != NULL.
    bundle_id = models.UUIDField(default=NULL_UUID)
    file = FlexibleForeignKey("sentry.File")
    artifact_count = BoundedPositiveIntegerField()
    date_added = models.DateTimeField(default=timezone.now, db_index=True)
    # This field represents the date of the upload that we show in the UI.
    date_uploaded = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_artifactbundle"

    @classmethod
    def get_release_dist_pair(
        cls, organization_id: int, artifact_bundle: "ArtifactBundle"
    ) -> Tuple[Optional[str], Optional[str]]:
        try:
            release_artifact_bundle = ReleaseArtifactBundle.objects.filter(
                organization_id=organization_id, artifact_bundle=artifact_bundle
            )[0]

            return release_artifact_bundle.release_name, release_artifact_bundle.dist_name
        except IndexError:
            return None, None

    @classmethod
    def get_ident(cls, url, dist=None):
        if dist is not None:
            return sha1_text(url + "\x00\x00" + dist).hexdigest()
        return sha1_text(url).hexdigest()


def delete_file_for_artifact_bundle(instance, **kwargs):
    instance.file.delete()


post_delete.connect(delete_file_for_artifact_bundle, sender=ArtifactBundle)


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

        unique_together = (("organization_id", "release_name", "dist_name", "artifact_bundle"),)


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

        # We can have the same debug_id pointing to different artifact_bundle(s) because the user might upload
        # the same artifacts twice, or they might have certain build files that don't change across builds.
        unique_together = (("debug_id", "artifact_bundle", "source_file_type"),)


@region_silo_only_model
class ProjectArtifactBundle(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    project_id = BoundedBigIntegerField(db_index=True)
    artifact_bundle = FlexibleForeignKey("sentry.ArtifactBundle")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectartifactbundle"

        unique_together = (("project_id", "artifact_bundle"),)


class ArtifactBundleArchive:
    """Read-only view of uploaded ZIP artifact bundle."""

    def __init__(self, fileobj: IO, build_memory_map: bool = True):
        self._fileobj = fileobj
        self._zip_file = zipfile.ZipFile(self._fileobj)
        self.manifest = self._read_manifest()
        if build_memory_map:
            self._build_memory_maps()

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
        self._entries_by_debug_id = {}
        self._entries_by_url = {}

        # TODO(iambriccardo): generalize the manifest reading methods across assemble and processor.
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

    def get_file_by_url(self, url: str) -> Tuple[IO, dict]:
        file_path, info = self._entries_by_url[url]
        return self._zip_file.open(file_path), info.get("headers", {})

    def get_file_by_debug_id(
        self, debug_id: str, source_file_type: SourceFileType
    ) -> Tuple[IO, dict]:
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
