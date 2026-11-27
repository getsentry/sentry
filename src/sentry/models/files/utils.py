from __future__ import annotations

import os
import time
from collections.abc import Iterable
from datetime import timedelta
from hashlib import sha1
from typing import IO, TYPE_CHECKING, Any, TypeVar

from django.conf import settings
from django.core.files.storage import Storage
from django.utils import timezone

from sentry.utils.imports import import_string

if TYPE_CHECKING:
    from sentry.models.files.abstractfileblob import AbstractFileBlob

FileModelT = TypeVar("FileModelT", bound="AbstractFileBlob[Any]")

ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)
HALF_DAY = timedelta(hours=12)

DEFAULT_BLOB_SIZE = 1024 * 1024  # one mb
MAX_FILE_SIZE = 2**32  # 4GB is the maximum size/offset supported by `File/Blob/Index`


class nooplogger:
    debug = staticmethod(lambda *a, **kw: None)
    info = staticmethod(lambda *a, **kw: None)
    warning = staticmethod(lambda *a, **kw: None)
    error = staticmethod(lambda *a, **kw: None)
    critical = staticmethod(lambda *a, **kw: None)
    log = staticmethod(lambda *a, **kw: None)
    exception = staticmethod(lambda *a, **kw: None)


def get_size_and_checksum(fileobj: IO[bytes]) -> tuple[int, str]:
    size = 0
    checksum = sha1()
    while True:
        chunk = fileobj.read(65536)
        if not chunk:
            break
        size += len(chunk)
        checksum.update(chunk)
    fileobj.seek(0)

    return size, checksum.hexdigest()


def get_and_optionally_update_blob(
    file_blob_model: type[FileModelT], checksum: str
) -> FileModelT | None:
    """
    Returns the `FileBlob` (actually generic `file_blob_model`) identified by its `checksum`.
    This will also bump its `timestamp` in a debounced fashion,
    in order to prevent it from being cleaned up.
    """
    return get_and_optionally_update_blobs(file_blob_model, [checksum]).get(checksum)


def get_and_optionally_update_blobs(
    file_blob_model: type[FileModelT], checksums: Iterable[str]
) -> dict[str, FileModelT]:
    """
    Bulk version of `get_and_optionally_update_blob`, returning the existing blobs
    by checksum.
    """
    blobs = file_blob_model.objects.in_bulk(checksums, field_name="checksum")

    now = timezone.now()
    stale_ids = {blob.id for blob in blobs.values() if blob.timestamp <= now - HALF_DAY}
    if not stale_ids:
        return blobs

    # Cleanup may have removed a stale blob since the lookup. It won't be
    # updated, so treat it as missing.
    refreshed_ids = {
        blob_id
        for (blob_id,) in file_blob_model.objects.filter(id__in=stale_ids).update_with_returning(
            ["id"], timestamp=now
        )
    }
    removed_ids = stale_ids - refreshed_ids
    return {checksum: blob for checksum, blob in blobs.items() if blob.id not in removed_ids}


class AssembleChecksumMismatch(Exception):
    pass


def get_storage(
    config: dict[str, Any] | None = None,
) -> Storage:
    if config is not None:
        backend = config["backend"]
        options = config["options"]
    else:
        backend = settings.SENTRY_FILE_STORAGE_BACKEND
        options = settings.SENTRY_FILE_STORAGE_CONFIG

    try:
        backend = settings.SENTRY_FILESTORE_ALIASES[backend]
    except KeyError:
        pass

    storage = import_string(backend)
    return storage(**options)


def get_relocation_storage(config: dict[str, Any] | None = None) -> Storage:
    backend = settings.SENTRY_RELOCATION_FILE_STORAGE_BACKEND
    relocation = settings.SENTRY_RELOCATION_FILE_STORAGE_CONFIG

    try:
        backend = settings.SENTRY_FILESTORE_ALIASES[backend]
    except KeyError:
        pass

    storage = import_string(backend)
    return storage(**relocation)


def get_profiles_storage(config: dict[str, Any] | None = None) -> Storage:
    backend = settings.SENTRY_PROFILES_FILE_STORAGE_BACKEND
    profiles = settings.SENTRY_PROFILES_FILE_STORAGE_CONFIG

    try:
        backend = settings.SENTRY_FILESTORE_ALIASES[backend]
    except KeyError:
        pass

    storage = import_string(backend)
    return storage(**profiles)


def clear_cached_files(cache_path: str) -> None:
    try:
        cache_folders = os.listdir(cache_path)
    except OSError:
        return

    cutoff = int(time.time()) - ONE_DAY_AND_A_HALF

    for cache_folder in cache_folders:
        cache_folder = os.path.join(cache_path, cache_folder)
        try:
            items = os.listdir(cache_folder)
        except OSError:
            continue
        for cached_file in items:
            cached_file = os.path.join(cache_folder, cached_file)
            try:
                mtime = os.path.getmtime(cached_file)
            except OSError:
                continue
            if mtime < cutoff:
                try:
                    os.remove(cached_file)
                except OSError:
                    pass
