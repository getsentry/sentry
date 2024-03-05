from __future__ import annotations

import os
import time
from datetime import timedelta
from hashlib import sha1
from typing import Any

from django.conf import settings
from django.utils import timezone

from sentry.utils.imports import import_string

ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)
HALF_DAY = timedelta(hours=12)

DEFAULT_BLOB_SIZE = 1024 * 1024  # one mb
MAX_FILE_SIZE = 2**31  # 2GB is the maximum offset supported by fileblob


class nooplogger:
    debug = staticmethod(lambda *a, **kw: None)
    info = staticmethod(lambda *a, **kw: None)
    warning = staticmethod(lambda *a, **kw: None)
    error = staticmethod(lambda *a, **kw: None)
    critical = staticmethod(lambda *a, **kw: None)
    log = staticmethod(lambda *a, **kw: None)
    exception = staticmethod(lambda *a, **kw: None)


def get_size_and_checksum(fileobj, logger=nooplogger):
    logger.debug("get_size_and_checksum.start")
    size = 0
    checksum = sha1()
    while True:
        chunk = fileobj.read(65536)
        if not chunk:
            break
        size += len(chunk)
        checksum.update(chunk)
    fileobj.seek(0)

    logger.debug("get_size_and_checksum.end")
    return size, checksum.hexdigest()


def get_and_optionally_update_blob(file_blob_model: Any, checksum: str):
    """
    Returns the `FileBlob` (actually generic `file_blob_model`) identified by its `checksum`.
    This will also bump its `timestamp` in a debounced fashion,
    in order to prevent it from being cleaned up.
    """
    try:
        existing = file_blob_model.objects.get(checksum=checksum)

        now = timezone.now()
        threshold = now - HALF_DAY
        if existing.timestamp <= threshold:
            existing.update(timestamp=now)
    except file_blob_model.DoesNotExist:
        existing = None

    return existing


class AssembleChecksumMismatch(Exception):
    pass


def get_storage(config=None):
    if config is not None:
        backend = config["backend"]
        options = config["options"]
    else:
        from sentry import options as options_store

        backend = options_store.get("filestore.backend")
        options = options_store.get("filestore.options")

    try:
        backend = settings.SENTRY_FILESTORE_ALIASES[backend]
    except KeyError:
        pass

    storage = import_string(backend)
    return storage(**options)


def get_relocation_storage(config=None):
    if config is not None:
        backend = config["backend"]
        relocation = config["relocation"]
    else:
        from sentry import options as options_store

        backend = options_store.get("filestore.backend")
        relocation = options_store.get("filestore.relocation")

    try:
        backend = settings.SENTRY_FILESTORE_ALIASES[backend]
    except KeyError:
        pass

    storage = import_string(backend)
    return storage(**relocation)


def clear_cached_files(cache_path):
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
