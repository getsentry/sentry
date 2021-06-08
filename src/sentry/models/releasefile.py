import errno
import logging
import os
import warnings
import zipfile
from tempfile import TemporaryDirectory
from typing import IO, Tuple
from urllib.parse import urlsplit, urlunsplit

from django.core.files.base import File as FileObj
from django.db import models

from sentry import options
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.models import clear_cached_files
from sentry.utils import json, metrics
from sentry.utils.hashlib import sha1_text
from sentry.utils.zip import safe_extract_zip

logger = logging.getLogger(__name__)


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
        cutoff = options.get("releasefile.cache-limit")
        file_size = releasefile.file.size
        if file_size < cutoff:
            metrics.timing("release_file.cache.get.size", file_size, tags={"cutoff": True})
            return releasefile.file.getfile()

        file_id = str(releasefile.file_id)
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


def merge_release_archives(file1: IO, archive2: ReleaseArchive, target: IO) -> bool:
    """Append contents of archive2 to copy of file1

    Skip files that are already present in archive 1.

    :returns: True if zip archive was written to target
    """
    with ReleaseArchive(file1) as archive1:
        manifest = archive1.manifest

        files = manifest.get("files", {})
        files2 = archive2.manifest.get("files", {})

        if any(
            archive1.info(filename).CRC != archive2.info(filename).CRC
            for filename in files.keys() & files2.keys()
        ):
            metrics.incr("release_file.archive.different_content")

        new_files = files2.keys() - files.keys()
        if not new_files:
            # Nothing to merge
            return False

        # Create a copy
        file1.seek(0)
        target.write(file1.read())

    with zipfile.ZipFile(target, mode="a", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for filename in new_files:
            zip_file.writestr(filename, archive2.read(filename))
            files[filename] = files2[filename]

        manifest["files"] = files

        # This creates a duplicate entry for the manifest, which is okay-ish
        # because the Python implementation prefers the latest version when reading
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            zip_file.writestr("manifest.json", json.dumps(manifest))

    return True
