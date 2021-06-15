import errno
import logging
import os
import zipfile
from contextlib import contextmanager
from hashlib import sha1
from io import BytesIO
from tempfile import TemporaryDirectory
from typing import IO, ContextManager, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

from django.core.files.base import File as FileObj
from django.db import models, transaction

from sentry import options
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.models import clear_cached_files
from sentry.models.distribution import Distribution
from sentry.models.file import File
from sentry.models.release import Release
from sentry.utils import json, metrics
from sentry.utils.hashlib import sha1_text
from sentry.utils.zip import safe_extract_zip

logger = logging.getLogger(__name__)


ARTIFACT_INDEX_FILENAME = "artifact-index.json"
ARTIFACT_INDEX_TYPE = "release.artifact-index"


class PublicReleaseFileManager(models.Manager):
    """Manager for all release files that are not internal.

    Internal release files include:
    * Uploaded release archives
    * Artifact index mapping URLs to release archives

    This manager has the overhead of always joining the File table in order
    to filter release files.

    """

    def get_queryset(self):
        return super().get_queryset().select_related("file").filter(file__type="release.file")


class ReleaseFile(Model):
    r"""
    A ReleaseFile is an association between a Release and a File.

    The ident of the file should be sha1(name) or
    sha1(name '\x00\x00' dist.name) and must be unique per release.
    """
    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    # DEPRECATED
    project_id = BoundedPositiveIntegerField(null=True)
    release = FlexibleForeignKey("sentry.Release")
    file = FlexibleForeignKey("sentry.File")
    ident = models.CharField(max_length=40)
    name = models.TextField()
    dist = FlexibleForeignKey("sentry.Distribution", null=True)

    __repr__ = sane_repr("release", "ident")

    objects = models.Manager()  # The default manager.
    public_objects = PublicReleaseFileManager()

    class Meta:
        unique_together = (("release", "ident"),)
        index_together = (("release", "name"),)
        app_label = "sentry"
        db_table = "sentry_releasefile"

    def save(self, *args, **kwargs):
        if not self.ident and self.name:
            dist = self.dist_id and self.dist.name or None
            self.ident = type(self).get_ident(self.name, dist)
        return super().save(*args, **kwargs)

    def update(self, *args, **kwargs):
        # If our name is changing, we must also change the ident
        if "name" in kwargs and "ident" not in kwargs:
            dist = kwargs.get("dist") or self.dist
            kwargs["ident"] = self.ident = type(self).get_ident(
                kwargs["name"], dist and dist.name or dist
            )
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
        scheme, netloc, path, query, _ = urlsplit(url)

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
            metrics.timing("release_file.cache.get.size", file_size, tags={"cutoff": True})
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

        metrics.timing("release_file.cache.get.size", file_size, tags={"hit": hit, "cutoff": False})
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
        files = self.manifest.get("files", {})

        self._entries_by_url = {entry["url"]: (path, entry) for path, entry in files.items()}

    def __enter__(self):
        return self

    def __exit__(self, exc, value, tb):
        self._zip_file.close()
        self._fileobj.close()

    def info(self, filename: str) -> zipfile.ZipInfo:
        return self._zip_file.getinfo(filename)

    def read(self, filename: str) -> bytes:
        return self._zip_file.read(filename)

    def _read_manifest(self) -> dict:
        manifest_bytes = self.read("manifest.json")
        return json.loads(manifest_bytes.decode("utf-8"))

    def get_file_by_url(self, url: str) -> Tuple[IO, dict]:
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
        safe_extract_zip(self._fileobj, temp_dir.name, strip_toplevel=False)

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

    def get(self, filename: str):
        return self._data.get("files", {}).get(filename, None)

    def update_files(self, files: dict):
        if files:
            self._data.setdefault("files", {}).update(files)
            self.changed = True

    def delete(self, filename: str):
        self._data.get("files", {}).pop(filename, None)
        self.changed = True


class _ArtifactIndexGuard:
    """Ensures atomic write operations to the artifact index"""

    def __init__(self, release: Release, dist: Optional[Distribution]):
        self._release = release
        self._dist = dist

    def readable_data(self) -> Optional[dict]:
        """Simple read, no synchronization necessary"""
        file_ = self._get_file(lock=False)
        if file_ is not None:
            with file_.getfile() as fp:
                return json.load(fp)

    @contextmanager
    def writable_data(self, create: bool) -> ContextManager[_ArtifactIndexData]:
        """Context manager for editable artifact index"""
        with transaction.atomic():
            if create:
                file_, created = self._get_or_create_file()
            else:
                file_ = self._get_file(lock=True)
                created = False

            if file_ is None:
                index_data = None
            else:
                if created:
                    index_data = _ArtifactIndexData({}, fresh=True)
                else:
                    raw_data = json.load(file_.getfile())
                    index_data = _ArtifactIndexData(raw_data)

            yield index_data  # editable reference to index

            if index_data is not None and index_data.changed:
                file_.putfile(BytesIO(json.dumps(index_data.data).encode()))

    def _get_or_create_file(self) -> Tuple[File, bool]:
        """Insert the artifact index release file if it does not exist.

        We lock the selected row for the current transaction, s.t. any
        "read & write" operation to the manifest is atomic.

        :returns:
            - file - The File instance associated with the release file.
              If created, this file does not have any content, so consider it
              write-only.
            - created - True if the release file was newly inserted.

        """
        qs = ReleaseFile.objects.select_related("file")

        # Once the queryset is evaluated,
        # this will lock the artifact index until the end of the current transaction
        qs = qs.select_for_update()

        releasefile, created = qs.get_or_create(
            organization_id=self._release.organization_id,
            release=self._release,
            dist=self._dist,
            name=ARTIFACT_INDEX_FILENAME,
            file__type=ARTIFACT_INDEX_TYPE,  # Make sure we don't get a user-uploaded file
            defaults={
                "file": lambda: File.objects.create(
                    name=ARTIFACT_INDEX_FILENAME,
                    type=ARTIFACT_INDEX_TYPE,
                )
            },
        )

        return releasefile.file, created

    def _get_file(self, lock: bool) -> Optional[File]:
        qs = ReleaseFile.objects.select_related("file")
        if lock:
            qs = qs.select_for_update()
        try:
            release_file = qs.get(
                organization_id=self._release.organization_id,
                release=self._release,
                dist=self._dist,
                name=ARTIFACT_INDEX_FILENAME,
                file__type=ARTIFACT_INDEX_TYPE,
            )
        except ReleaseFile.DoesNotExist:
            return None
        else:
            return release_file.file


def read_artifact_index(release: Release, dist: Optional[Distribution]) -> Optional[dict]:
    """Get index data"""
    guard = _ArtifactIndexGuard(release, dist)
    return guard.readable_data()


def _compute_sha1(archive: ReleaseArchive, url: str) -> str:
    data = archive.read(url)
    return sha1(data).hexdigest()


def update_artifact_index(release: Release, dist: Optional[Distribution], archive_file: File):
    """Add information from release archive to artifact index

    :returns: The created ReleaseFile instance
    """
    releasefile = ReleaseFile.objects.create(
        name=archive_file.name,
        release=release,
        organization_id=release.organization_id,
        dist=dist,
        file=archive_file,
    )

    files_out = {}
    with ReleaseArchive(archive_file.getfile()) as archive:
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
    with guard.writable_data(create=True) as index_data:
        index_data.update_files(files_out)

    return releasefile


def delete_from_artifact_index(release: Release, dist: Optional[Distribution], url: str):
    """Delete the file with the given url from the manifest.

    Does *not* delete the file from the zip archive.
    """
    guard = _ArtifactIndexGuard(release, dist)
    with guard.writable_data(create=False) as index_data:
        if index_data is not None:
            index_data.delete(url)
