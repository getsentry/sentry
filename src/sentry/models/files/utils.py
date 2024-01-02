from __future__ import annotations

import os
import time
from contextlib import contextmanager
from datetime import timedelta
from hashlib import sha1

from django.conf import settings
from django.core.files.storage import get_storage_class
from django.utils import timezone

from sentry import options
from sentry.locks import locks
from sentry.utils import redis
from sentry.utils.retries import TimedRetryPolicy

ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)
HALF_DAY = timedelta(hours=12)

UPLOAD_RETRY_TIME = getattr(settings, "SENTRY_UPLOAD_RETRY_TIME", 60)  # 1min

DEFAULT_BLOB_SIZE = 1024 * 1024  # one mb
CHUNK_STATE_HEADER = "__state"

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

    logger.debug("get_size_and_checksum.end")
    return size, checksum.hexdigest()


@contextmanager
def lock_blob(checksum: str, name: str, metric_instance: str | None = None):
    if not options.get("fileblob.upload.use_lock"):
        yield
        return

    lock = locks.get(f"fileblob:upload:{checksum}", duration=UPLOAD_RETRY_TIME, name=name)
    with TimedRetryPolicy(UPLOAD_RETRY_TIME, metric_instance=metric_instance)(lock.acquire):
        yield


def _get_redis_for_blobs():
    cluster_key = settings.SENTRY_DEBUG_FILES_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)


def _redis_key_for_blob(file_blob_model, checksum):
    return f"fileblob:{file_blob_model.__name__}:{checksum}"


def _get_cached_blob_id(file_blob_model, checksum):
    if not options.get("fileblob.upload.use_blobid_cache"):
        return None
    redis = _get_redis_for_blobs()
    if id := redis.get(_redis_key_for_blob(file_blob_model, checksum)):
        return int(id)
    return None


def cache_blob_id(file_blob_model, checksum, id):
    if not options.get("fileblob.upload.use_blobid_cache"):
        return
    redis = _get_redis_for_blobs()
    redis.set(_redis_key_for_blob(file_blob_model, checksum), str(id), ex=HALF_DAY.seconds)


@contextmanager
def locked_blob(file_blob_model, size, checksum, logger=nooplogger):
    if cached_id := _get_cached_blob_id(file_blob_model, checksum):
        yield file_blob_model(id=cached_id, size=size, checksum=checksum)
        return

    logger.debug("locked_blob.start", extra={"checksum": checksum})
    lock = lock_blob(checksum, "fileblob_upload_model", metric_instance="lock.fileblob.upload")
    with lock:
        logger.debug("locked_blob.acquired", extra={"checksum": checksum})
        # test for presence
        try:
            existing = file_blob_model.objects.get(checksum=checksum)
            cache_blob_id(file_blob_model, checksum, existing.id)

            now = timezone.now()
            threshold = now - HALF_DAY
            if existing.timestamp <= threshold:
                existing.update(timestamp=now)
        except file_blob_model.DoesNotExist:
            existing = None
        yield existing
    logger.debug("locked_blob.end", extra={"checksum": checksum})


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

    storage = get_storage_class(backend)
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

    storage = get_storage_class(backend)
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
