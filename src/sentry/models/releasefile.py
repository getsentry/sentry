import errno
import logging
import os
import zipfile
from contextlib import contextmanager
from hashlib import sha1
from io import BytesIO
from tempfile import TemporaryDirectory
from typing import IO, Optional, Tuple
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


MANIFEST_FILENAME = "release-file-manifest.json"
MANIFEST_TYPE = "release.manifest"


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
        return self.get_regular_file(releasefile.file, releasefile.organization_id)

    def get_regular_file(self, file_: File, organization_id: int) -> FileObj:
        """Get a ``File`` from the release file cache.

        Release bundles are now stored as regular ``File``s (not as ``ReleaseFile``s),
        but the same caching logic applies to them.
        """
        cutoff = options.get("releasefile.cache-limit")
        file_size = file_.size
        if file_size < cutoff:
            metrics.timing("release_file.cache.get.size", file_size, tags={"cutoff": True})
            return file_.getfile()

        file_id = str(file_.id)
        organization_id = str(organization_id)
        file_path = os.path.join(self.cache_path, organization_id, file_id)

        hit = True
        try:
            os.stat(file_path)
        except OSError as e:
            if e.errno != errno.ENOENT:
                raise
            file_.save_to(file_path)
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


class _Manifest:
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


class _ManifestGuard:
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
    def writable_data(self, create: bool):
        """Context manager for editable release manifest"""
        with transaction.atomic():
            if create:
                file_, created = self._get_or_create_file()
            else:
                file_ = self._get_file(lock=True)
                created = False

            if file_ is None:
                manifest = None
            else:
                if created:
                    manifest = _Manifest({}, fresh=True)
                else:
                    data = json.load(file_.getfile())
                    manifest = _Manifest(data)

            yield manifest  # editable reference to manifest

            if manifest is not None and manifest.changed:
                file_.putfile(BytesIO(json.dumps(manifest.data).encode()))

    def _get_or_create_file(self) -> Tuple[File, bool]:
        # Make sure the appropriate rows are locked for update:
        qs = ReleaseFile.objects.select_related("file").select_for_update()

        try:
            return (
                qs.get(
                    organization_id=self._release.organization_id,
                    release=self._release,
                    dist=self._dist,
                    name=MANIFEST_FILENAME,
                ).file,
                False,
            )
        except ReleaseFile.DoesNotExist:
            # This function is called from within a db transaction, so there
            # should be no race condition here
            return (
                qs.create(
                    organization_id=self._release.organization_id,
                    release=self._release,
                    dist=self._dist,
                    name=MANIFEST_FILENAME,
                    file=File.objects.create(
                        name=MANIFEST_FILENAME,
                        type=MANIFEST_TYPE,
                    ),
                ).file,
                True,
            )

    def _get_file(self, lock: bool) -> Optional[File]:
        qs = ReleaseFile.objects.select_related("file")
        if lock:
            qs = qs.select_for_update()
        try:
            release_file = qs.get(
                organization_id=self._release.organization_id,
                release=self._release,
                dist=self._dist,
                name=MANIFEST_FILENAME,
            )
        except ReleaseFile.DoesNotExist:
            return None
        else:
            return release_file.file


class ReleaseManifest:

    """Manager of all uploaded artifact bundles and their common manifest"""

    def __init__(self, release: Release, dist: Optional[Distribution]):
        self._manifest = _ManifestGuard(release, dist)

    def read(self):
        """Get manifest data"""
        return self._manifest.readable_data()

    def update(self, archive: ReleaseArchive, archive_file: File):
        """Add information from release archive to manifest

        Assumes that archive is already open for reading.
        """
        local_manifest = archive.manifest

        files = local_manifest.get("files", {})
        if not files:
            return

        files_out = {}

        for filename, info in files.items():
            info = info.copy()
            url = info.pop("url")
            info["filename"] = filename
            info["archive_id"] = archive_file.id
            info["date_created"] = archive_file.timestamp
            info["sha1"] = self._compute_sha1(archive, filename)
            info["size"] = archive.info(filename).file_size
            files_out[url] = info

        with self._manifest.writable_data(create=True) as manifest:
            manifest.update_files(files_out)

    def delete(self, url: str):
        """Delete a file from the manifest.

        Does *not* delete the file from the zip archive.
        """
        with self._manifest.writable_data(create=False) as manifest:
            if manifest is not None:
                manifest.delete(url)

    def _compute_sha1(self, archive: ReleaseArchive, url: str) -> str:
        data = archive.read(url)
        return sha1(data).hexdigest()
