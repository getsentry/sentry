import zipfile
from enum import Enum
from typing import IO, Dict, List, Optional, Tuple
from uuid import UUID

from django.db import models
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


class SourceFileType(Enum):
    SOURCE = 1
    MINIFIED_SOURCE = 2
    SOURCE_MAP = 3
    INDEXED_RAM_BUNDLE = 4

    @classmethod
    def choices(cls) -> List[Tuple[int, str]]:
        return [(key.value, key.name) for key in cls]

    @classmethod
    def from_lowercase_key(cls, lowercase_key: str) -> Optional["SourceFileType"]:
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
    bundle_id = models.UUIDField(default="00000000-00000000-00000000-00000000")
    file = FlexibleForeignKey("sentry.File")
    artifact_count = BoundedPositiveIntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_artifactbundle"

        unique_together = (("organization_id", "bundle_id"),)

    @classmethod
    def get_artifact_counts(cls, artifact_bundle_ids: List[int]) -> Dict[int, Tuple[UUID, int]]:
        artifact_bundles = ArtifactBundle.objects.filter(id__in=artifact_bundle_ids)
        bundles_with_counts = {}
        for artifact_bundle in artifact_bundles:
            bundles_with_counts[artifact_bundle.id] = (
                artifact_bundle.bundle_id,
                artifact_bundle.artifact_count,
            )

        return bundles_with_counts


@region_silo_only_model
class ReleaseArtifactBundle(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    release_name = models.CharField(max_length=250)
    # We use "" in place of NULL because the uniqueness constraint doesn't play well with nullable fields, since
    # NULL != NULL.
    dist_name = models.CharField(max_length=64, default="")
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
    date_last_accessed = models.DateTimeField(default=timezone.now)

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

    def __init__(self, fileobj: IO):
        self._fileobj = fileobj
        self._zip_file = zipfile.ZipFile(self._fileobj)
        self.manifest = self._read_manifest()
        self._build_entries_by_debug_id_map()

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
    def _normalize_headers(headers: dict) -> dict:
        return {k.lower(): v for k, v in headers.items()}

    @staticmethod
    def _normalize_debug_id(debug_id: Optional[str]) -> Optional[str]:
        try:
            return normalize_debug_id(debug_id)
        except SymbolicError:
            return None

    def _build_entries_by_debug_id_map(self):
        self._entries_by_debug_id = {}

        # TODO(iambriccardo): generalize the manifest reading methods across assemble and processor.
        files = self.manifest.get("files", {})
        for file_path, info in files.items():
            headers = self._normalize_headers(info.get("headers", {}))
            if (debug_id := headers.get("debug-id", None)) is not None:
                debug_id = self._normalize_debug_id(debug_id)
                file_type = info.get("type", None)
                if (
                    debug_id is not None
                    and file_type is not None
                    and (source_file_type := SourceFileType.from_lowercase_key(file_type))
                    is not None
                ):
                    self._entries_by_debug_id[(debug_id, source_file_type)] = (file_path, info)

    def get_file_by_debug_id(
        self, debug_id: str, source_file_type: SourceFileType
    ) -> Tuple[IO, dict]:
        file_path, info = self._entries_by_debug_id[debug_id, source_file_type]
        return self._zip_file.open(file_path), info.get("headers", {})
