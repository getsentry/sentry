from __future__ import annotations

import errno
import logging
import os
import zipfile
from contextlib import contextmanager
from hashlib import sha1
from io import BytesIO
from tempfile import TemporaryDirectory
from typing import IO, ClassVar, Self
from urllib.parse import urlunsplit

import sentry_sdk
from django.core.files.base import File as FileObj
from django.db import models, router

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.models.distribution import Distribution
from sentry.models.files.file import File
from sentry.models.files.utils import clear_cached_files
from sentry.models.release import Release
from sentry.utils import json, metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.hashlib import sha1_text
from sentry.utils.urls import urlsplit_best_effort
from sentry.utils.zip import safe_extract_zip

logger = logging.getLogger(__name__)


ARTIFACT_INDEX_FILENAME = "artifact-index.json"
ARTIFACT_INDEX_TYPE = "release.artifact-index"


class PublicReleaseFileManager(models.Manager["ReleaseFile"]):
    """Manager for all release files that are not internal.

    Internal release files include:
    * Uploaded release archives
    * Artifact index mapping URLs to release archives

    This manager has the overhead of always joining the File table in order
    to filter release files.

    """

    def get_queryset(self):
        return super().get_queryset().select_related("file").filter(file__type="release.file")


@region_silo_model
class ReleaseFile(Model):
    r"""
    A ReleaseFile is an association between a Release and a File.

    The ident of the file should be sha1(name) or
    sha1(name '\x00\x00' dist.name) and must be unique per release.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField()
    # DEPRECATED
    project_id = BoundedBigIntegerField(null=True)
    release_id = BoundedBigIntegerField()
    file = FlexibleForeignKey("sentry.File")
    ident = models.CharField(max_length=40)
    name = models.TextField()
    dist_id = BoundedBigIntegerField(null=True)

    #: For classic file uploads, this field is 1.
    #: For release archives, this field is 0.
    #: For artifact indexes, this field is the number of artifacts contained
    #: in the index.
    artifact_count = BoundedPositiveIntegerField(null=True, default=1)

    __repr__ = sane_repr("release", "ident")

    objects: ClassVar[BaseManager[Self]] = BaseManager()  # The default manager.
    public_objects: ClassVar[PublicReleaseFileManager] = PublicReleaseFileManager()

    cache: ClassVar[ReleaseFileCache]

    class Meta:
        unique_together = (("release_id", "ident"),)
        indexes = (models.Index(fields=("release_id", "name")),)
        app_label = "sentry"
        db_table = "sentry_releasefile"

    def save(self, *args, **kwargs):
        from sentry.models.distribution import Distribution

        if not self.ident and self.name:
            dist = None
            if self.dist_id:
                dist = Distribution.objects.get(pk=self.dist_id).name
            self.ident = type(self).get_ident(self.name, dist)
        return super().save(*args, **kwargs)

    def update(self, *args, **kwargs):
        # If our name is changing, we must also change the ident
        if "name" in kwargs and "ident" not in kwargs:
            dist_name = None
            dist_id = kwargs.get("dist_id") or self.dist_id
            if dist_id:
                dist_name = Distribution.objects.filter(pk=dist_id).values_list("name", flat=True)[
                    0
                ]
            kwargs["ident"] = self.ident = type(self).get_ident(kwargs["name"], dist_name)
        return super().update(*args, **kwargs)

    @classmethod
    def get_ident(cls, name, dist=None):
        if dist is not None:
            return sha1_text(name + "\x00\x00" + dist).hexdigest()
        return sha1_text(name).hexdigest()

    @classmethod
    def normalize(cls, url):
        """Transforms a full absolute url into 2 or 4 generalized options

        * the original url as input
        * (optional) original url without querystring
        * the full url, but stripped of scheme and netloc
        * (optional) full url without scheme and netloc or querystring
        """
        # Always ignore the fragment
        scheme, netloc, path, query = urlsplit_best_effort(url)

        uri_without_fragment = (scheme, netloc, path, query, "")
        uri_relative = ("", "", path, query, "")
        uri_without_query = (scheme, netloc, path, "", "")
        uri_relative_without_query = ("", "", path, "", "")

        urls = [urlunsplit(uri_without_fragment)]
        if query:
            urls.append(urlunsplit(uri_without_query))
        urls.append("~" + urlunsplit(uri_relative))
        if query:
            urls.append("~" + urlunsplit(uri_relative_without_query))
        return urls


class ReleaseFileCache:
    @property
    def cache_path(self):
        return options.get("releasefile.cache-path")

    def getfile(self, releasefile):
        cutoff = options.get("releasefile.cache-limit")
        file_size = releasefile.file.size
        if file_size < cutoff:
            metrics.distribution(
                "release_file.cache.get.size", file_size, tags={"cutoff": True}, unit="byte"
            )
            return releasefile.file.getfile()

        file_id = str(releasefile.file.id)
        organization_id = str(releasefile.organization_id)
        file_path = os.path.join(self.cache_path, organization_id, file_id)

        hit = True
        try:
            os.stat(file_path)
        except OSError as e:
            if e.errno != errno.ENOENT:
                raise
            releasefile.file.save_to(file_path)
            hit = False

        metrics.distribution(
            "release_file.cache.get.size",
            file_size,
            tags={"hit": hit, "cutoff": False},
            unit="byte",
        )
        return FileObj(open(file_path, "rb"))

    def clear_old_entries(self):
        clear_cached_files(self.cache_path)


ReleaseFile.cache = ReleaseFileCache()


class ReleaseArchive:
    """Read-only view of uploaded ZIP-archive of release files"""

    def __init__(self, fileobj: IO):
        self._fileobj = fileobj
        self._zip_file = zipfile.ZipFile(self._fileobj)
        self.manifest = self._read_manifest()
        self.artifact_count = len(self.manifest.get("files", {}))
        files = self.manifest.get("files", {})
        self._entries_by_url = {entry["url"]: (path, entry) for path, entry in files.items()}

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

    def get_file_by_url(self, url: str) -> tuple[IO[bytes], dict]:
        """Return file-like object and headers.

        The caller is responsible for closing the returned stream.

        May raise ``KeyError``
        """
        filename, entry = self._entries_by_url[url]
        return self._zip_file.open(filename), entry.get("headers", {})

    def extract(self) -> TemporaryDirectory:
        """Extract contents to a temporary directory.

        The caller is responsible for cleanup of the temporary files.
        """
        temp_dir = TemporaryDirectory()
        safe_extract_zip(self._fileobj, temp_dir.name)

        return temp_dir


class _ArtifactIndexData:
    """Holds data of artifact index and keeps track of changes"""

    def __init__(self, data: dict, fresh=False):
        self._data = data
        self.changed = fresh

    @property
    def data(self):
        """Meant to be read-only"""
        return self._data

    @property
    def num_files(self):
        return len(self._data.get("files", {}))

    def get(self, filename: str):
        return self._data.get("files", {}).get(filename, None)

    def update_files(self, files: dict):
        if files:
            self._data.setdefault("files", {}).update(files)
            self.changed = True

    def delete(self, filename: str) -> bool:
        result = self._data.get("files", {}).pop(filename, None)
        deleted = result is not None
        if deleted:
            self.changed = True

        return deleted


class _ArtifactIndexGuard:
    """Ensures atomic write operations to the artifact index"""

    def __init__(self, release: Release, dist: Distribution | None, **filter_args):
        self._release = release
        self._dist = dist
        self._ident = ReleaseFile.get_ident(ARTIFACT_INDEX_FILENAME, dist and dist.name)
        self._filter_args = filter_args  # Extra constraints on artifact index release file

    def readable_data(self, use_cache: bool) -> dict | None:
        """Simple read, no synchronization necessary"""
        try:
            releasefile = self._releasefile_qs()[0]
        except IndexError:
            return None
        else:
            if use_cache:
                fp = ReleaseFile.cache.getfile(releasefile)
            else:
                fp = releasefile.file.getfile()
            with fp:
                return json.load(fp)

    @contextmanager
    def writable_data(self, create: bool, initial_artifact_count=None):
        """Context manager for editable artifact index"""
        with atomic_transaction(
            using=(
                router.db_for_write(ReleaseFile),
                router.db_for_write(File),
            )
        ):
            created = False
            if create:
                releasefile, created = self._get_or_create_releasefile(initial_artifact_count)
            else:
                # Lock the row for editing:
                # NOTE: Do not select_related('file') here, because we do not
                # want to lock the File table
                qs = self._releasefile_qs().select_for_update()
                try:
                    releasefile = qs[0]
                except IndexError:
                    releasefile = None

            if releasefile is None:
                index_data = None
            else:
                if created:
                    index_data = _ArtifactIndexData({}, fresh=True)
                else:
                    source_file = releasefile.file
                    if source_file.type != ARTIFACT_INDEX_TYPE:
                        raise RuntimeError("Unexpected file type for artifact index")
                    raw_data = json.load(source_file.getfile())
                    index_data = _ArtifactIndexData(raw_data)

            yield index_data  # editable reference to index

            if index_data is not None and index_data.changed:
                if created:
                    target_file = releasefile.file
                else:
                    target_file = File.objects.create(
                        name=ARTIFACT_INDEX_FILENAME, type=ARTIFACT_INDEX_TYPE
                    )

                target_file.putfile(BytesIO(json.dumps(index_data.data).encode()))

                artifact_count = index_data.num_files
                if not created:
                    # Update and clean existing
                    old_file = releasefile.file
                    releasefile.update(file=target_file, artifact_count=artifact_count)
                    old_file.delete()

    def _get_or_create_releasefile(self, initial_artifact_count):
        """Make sure that the release file exists"""
        return ReleaseFile.objects.select_for_update().get_or_create(
            **self._key_fields(),
            defaults={
                "artifact_count": initial_artifact_count,
                "file": lambda: File.objects.create(
                    name=ARTIFACT_INDEX_FILENAME,
                    type=ARTIFACT_INDEX_TYPE,
                ),
            },
        )

    def _releasefile_qs(self):
        """QuerySet for selecting artifact index"""
        return ReleaseFile.objects.filter(**self._key_fields(), **self._filter_args)

    def _key_fields(self):
        """Columns needed to identify the artifact index in the db"""
        return dict(
            organization_id=self._release.organization_id,
            release_id=self._release.id,
            dist_id=self._dist.id if self._dist else self._dist,
            name=ARTIFACT_INDEX_FILENAME,
            ident=self._ident,
        )


@sentry_sdk.tracing.trace
def read_artifact_index(
    release: Release, dist: Distribution | None, use_cache: bool = False, **filter_args
) -> dict | None:
    """Get index data"""
    guard = _ArtifactIndexGuard(release, dist, **filter_args)
    return guard.readable_data(use_cache)


def _compute_sha1(archive: ReleaseArchive, url: str) -> str:
    data = archive.read(url)
    return sha1(data).hexdigest()


@sentry_sdk.tracing.trace
def update_artifact_index(
    release: Release,
    dist: Distribution | None,
    archive_file: File,
    temp_file: IO | None = None,
):
    """Add information from release archive to artifact index

    :returns: The created ReleaseFile instance
    """
    releasefile = ReleaseFile.objects.create(
        name=archive_file.name,
        release_id=release.id,
        organization_id=release.organization_id,
        dist_id=dist.id if dist is not None else dist,
        file=archive_file,
        artifact_count=0,  # Artifacts will be counted with artifact index
    )

    files_out = {}
    with ReleaseArchive(temp_file or archive_file.getfile()) as archive:
        manifest = archive.manifest

        files = manifest.get("files", {})
        if not files:
            return

        for filename, info in files.items():
            info = info.copy()
            url = info.pop("url")
            info["filename"] = filename
            info["archive_ident"] = releasefile.ident
            info["date_created"] = archive_file.timestamp
            info["sha1"] = _compute_sha1(archive, filename)
            info["size"] = archive.info(filename).file_size
            files_out[url] = info

    guard = _ArtifactIndexGuard(release, dist)
    with guard.writable_data(create=True, initial_artifact_count=len(files_out)) as index_data:
        index_data.update_files(files_out)

    return releasefile


@sentry_sdk.tracing.trace
def delete_from_artifact_index(release: Release, dist: Distribution | None, url: str) -> bool:
    """Delete the file with the given url from the manifest.

    Does *not* delete the file from the zip archive.

    :returns: True if deleted
    """
    guard = _ArtifactIndexGuard(release, dist)
    with guard.writable_data(create=False) as index_data:
        if index_data is not None:
            return index_data.delete(url)

    return False
