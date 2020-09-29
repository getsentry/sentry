from __future__ import absolute_import

import os
import six
import mmap
import tempfile
import time

from hashlib import sha1
from uuid import uuid4
from threading import Semaphore
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager

from django.conf import settings
from django.core.files.base import File as FileObj
from django.core.files.base import ContentFile
from django.core.files.storage import get_storage_class
from django.db import models, transaction, IntegrityError
from django.utils import timezone

from sentry.app import locks
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, JSONField, Model
from sentry.tasks.files import delete_file as delete_file_task, delete_unreferenced_blobs
from sentry.utils import metrics
from sentry.utils.retries import TimedRetryPolicy

ONE_DAY = 60 * 60 * 24
ONE_DAY_AND_A_HALF = int(ONE_DAY * 1.5)

UPLOAD_RETRY_TIME = getattr(settings, "SENTRY_UPLOAD_RETRY_TIME", 60)  # 1min

DEFAULT_BLOB_SIZE = 1024 * 1024  # one mb
CHUNK_STATE_HEADER = "__state"
MULTI_BLOB_UPLOAD_CONCURRENCY = 8
MAX_FILE_SIZE = 2 ** 31  # 2GB is the maximum offset supported by fileblob


class nooplogger(object):
    debug = staticmethod(lambda *a, **kw: None)
    info = staticmethod(lambda *a, **kw: None)
    warning = staticmethod(lambda *a, **kw: None)
    error = staticmethod(lambda *a, **kw: None)
    critical = staticmethod(lambda *a, **kw: None)
    log = staticmethod(lambda *a, **kw: None)
    exception = staticmethod(lambda *a, **kw: None)


def _get_size_and_checksum(fileobj, logger=nooplogger):
    logger.debug("_get_size_and_checksum.start")
    size = 0
    checksum = sha1()
    while True:
        chunk = fileobj.read(65536)
        if not chunk:
            break
        size += len(chunk)
        checksum.update(chunk)

    logger.debug("_get_size_and_checksum.end")
    return size, checksum.hexdigest()


@contextmanager
def _locked_blob(checksum, logger=nooplogger):
    logger.debug("_locked_blob.start", extra={"checksum": checksum})
    lock = locks.get(u"fileblob:upload:{}".format(checksum), duration=UPLOAD_RETRY_TIME)
    with TimedRetryPolicy(UPLOAD_RETRY_TIME, metric_instance="lock.fileblob.upload")(lock.acquire):
        logger.debug("_locked_blob.acquired", extra={"checksum": checksum})
        # test for presence
        try:
            existing = FileBlob.objects.get(checksum=checksum)
        except FileBlob.DoesNotExist:
            existing = None
        yield existing
    logger.debug("_locked_blob.end", extra={"checksum": checksum})


class AssembleChecksumMismatch(Exception):
    pass


def get_storage():
    from sentry import options

    backend = options.get("filestore.backend")
    options = options.get("filestore.options")

    try:
        backend = settings.SENTRY_FILESTORE_ALIASES[backend]
    except KeyError:
        pass

    storage = get_storage_class(backend)
    return storage(**options)


class FileBlob(Model):
    __core__ = False

    path = models.TextField(null=True)
    size = BoundedPositiveIntegerField(null=True)
    checksum = models.CharField(max_length=40, unique=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_fileblob"

    @classmethod
    def from_files(cls, files, organization=None, logger=nooplogger):
        """A faster version of `from_file` for multiple files at the time.
        If an organization is provided it will also create `FileBlobOwner`
        entries.  Files can be a list of files or tuples of file and checksum.
        If both are provided then a checksum check is performed.

        If the checksums mismatch an `IOError` is raised.
        """
        logger.debug("FileBlob.from_files.start")

        files_with_checksums = []
        for fileobj in files:
            if isinstance(fileobj, tuple):
                files_with_checksums.append(fileobj)
            else:
                files_with_checksums.append((fileobj, None))

        checksums_seen = set()
        blobs_created = []
        blobs_to_save = []
        locks = set()
        semaphore = Semaphore(value=MULTI_BLOB_UPLOAD_CONCURRENCY)

        def _upload_and_pend_chunk(fileobj, size, checksum, lock):
            logger.debug(
                "FileBlob.from_files._upload_and_pend_chunk.start",
                extra={"checksum": checksum, "size": size},
            )
            blob = cls(size=size, checksum=checksum)
            blob.path = cls.generate_unique_path()
            storage = get_storage()
            storage.save(blob.path, fileobj)
            blobs_to_save.append((blob, lock))
            metrics.timing("filestore.blob-size", size, tags={"function": "from_files"})
            logger.debug(
                "FileBlob.from_files._upload_and_pend_chunk.end",
                extra={"checksum": checksum, "path": blob.path},
            )

        def _ensure_blob_owned(blob):
            if organization is None:
                return
            try:
                with transaction.atomic():
                    FileBlobOwner.objects.create(organization=organization, blob=blob)
            except IntegrityError:
                pass

        def _save_blob(blob):
            logger.debug("FileBlob.from_files._save_blob.start", extra={"path": blob.path})
            blob.save()
            _ensure_blob_owned(blob)
            logger.debug("FileBlob.from_files._save_blob.end", extra={"path": blob.path})

        def _flush_blobs():
            while True:
                try:
                    blob, lock = blobs_to_save.pop()
                except IndexError:
                    break

                _save_blob(blob)
                lock.__exit__(None, None, None)
                locks.discard(lock)
                semaphore.release()

        try:
            with ThreadPoolExecutor(max_workers=MULTI_BLOB_UPLOAD_CONCURRENCY) as exe:
                for fileobj, reference_checksum in files_with_checksums:
                    logger.debug(
                        "FileBlob.from_files.executor_start", extra={"checksum": reference_checksum}
                    )
                    _flush_blobs()

                    # Before we go and do something with the files we calculate
                    # the checksums and compare it against the reference.  This
                    # also deduplicates duplicates uploaded in the same request.
                    # This is necessary because we acquire multiple locks in one
                    # go which would let us deadlock otherwise.
                    size, checksum = _get_size_and_checksum(fileobj)
                    if reference_checksum is not None and checksum != reference_checksum:
                        raise IOError("Checksum mismatch")
                    if checksum in checksums_seen:
                        continue
                    checksums_seen.add(checksum)

                    # Check if we need to lock the blob.  If we get a result back
                    # here it means the blob already exists.
                    lock = _locked_blob(checksum, logger=logger)
                    existing = lock.__enter__()
                    if existing is not None:
                        lock.__exit__(None, None, None)
                        blobs_created.append(existing)
                        _ensure_blob_owned(existing)
                        continue

                    # Remember the lock to force unlock all at the end if we
                    # encounter any difficulties.
                    locks.add(lock)

                    # Otherwise we leave the blob locked and submit the task.
                    # We use the semaphore to ensure we never schedule too
                    # many.  The upload will be done with a certain amount
                    # of concurrency controlled by the semaphore and the
                    # `_flush_blobs` call will take all those uploaded
                    # blobs and associate them with the database.
                    semaphore.acquire()
                    exe.submit(_upload_and_pend_chunk(fileobj, size, checksum, lock))
                    logger.debug("FileBlob.from_files.end", extra={"checksum": reference_checksum})

            _flush_blobs()
        finally:
            for lock in locks:
                try:
                    lock.__exit__(None, None, None)
                except Exception:
                    pass
            logger.debug("FileBlob.from_files.end")

    @classmethod
    def from_file(cls, fileobj, logger=nooplogger):
        """
        Retrieve a single FileBlob instances for the given file.
        """
        logger.debug("FileBlob.from_file.start")

        size, checksum = _get_size_and_checksum(fileobj)

        # TODO(dcramer): the database here is safe, but if this lock expires
        # and duplicate files are uploaded then we need to prune one
        with _locked_blob(checksum, logger=logger) as existing:
            if existing is not None:
                return existing

            blob = cls(size=size, checksum=checksum)
            blob.path = cls.generate_unique_path()
            storage = get_storage()
            storage.save(blob.path, fileobj)
            blob.save()

        metrics.timing("filestore.blob-size", size)
        logger.debug("FileBlob.from_file.end")
        return blob

    @classmethod
    def generate_unique_path(cls):
        # We intentionally do not use checksums as path names to avoid concurrency issues
        # when we attempt concurrent uploads for any reason.
        uuid_hex = uuid4().hex
        pieces = [uuid_hex[:2], uuid_hex[2:6], uuid_hex[6:]]
        return u"/".join(pieces)

    def delete(self, *args, **kwargs):
        lock = locks.get(u"fileblob:upload:{}".format(self.checksum), duration=UPLOAD_RETRY_TIME)
        with TimedRetryPolicy(UPLOAD_RETRY_TIME, metric_instance="lock.fileblob.delete")(
            lock.acquire
        ):
            super(FileBlob, self).delete(*args, **kwargs)
        if self.path:
            self.deletefile(commit=False)

    def deletefile(self, commit=False):
        assert self.path

        # Defer this by 1 minute just to make sure
        # we avoid any transaction isolation where the
        # FileBlob row might still be visible by the
        # task before transaction is committed.
        delete_file_task.apply_async(
            kwargs={"path": self.path, "checksum": self.checksum}, countdown=60
        )

        self.path = None

        if commit:
            self.save()

    def getfile(self):
        """
        Return a file-like object for this File's content.

        >>> with blob.getfile() as src, open('/tmp/localfile', 'wb') as dst:
        >>>     for chunk in src.chunks():
        >>>         dst.write(chunk)
        """
        assert self.path

        storage = get_storage()
        return storage.open(self.path)


class File(Model):
    __core__ = False

    name = models.TextField()
    type = models.CharField(max_length=64)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    headers = JSONField()
    blobs = models.ManyToManyField("sentry.FileBlob", through="sentry.FileBlobIndex")
    size = BoundedPositiveIntegerField(null=True)
    checksum = models.CharField(max_length=40, null=True, db_index=True)

    # <Legacy fields>
    # Remove in 8.1
    blob = FlexibleForeignKey("sentry.FileBlob", null=True, related_name="legacy_blob")
    path = models.TextField(null=True)

    # </Legacy fields>

    class Meta:
        app_label = "sentry"
        db_table = "sentry_file"

    def _get_chunked_blob(self, mode=None, prefetch=False, prefetch_to=None, delete=True):
        return ChunkedFileBlobIndexWrapper(
            FileBlobIndex.objects.filter(file=self).select_related("blob").order_by("offset"),
            mode=mode,
            prefetch=prefetch,
            prefetch_to=prefetch_to,
            delete=delete,
        )

    def getfile(self, mode=None, prefetch=False):
        """Returns a file object.  By default the file is fetched on
        demand but if prefetch is enabled the file is fully prefetched
        into a tempfile before reading can happen.
        """
        impl = self._get_chunked_blob(mode, prefetch)
        return FileObj(impl, self.name)

    def save_to(self, path):
        """Fetches the file and emplaces it at a certain location.  The
        write is done atomically to a tempfile first and then moved over.
        If the directory does not exist it is created.
        """
        path = os.path.abspath(path)
        base = os.path.dirname(path)
        try:
            os.makedirs(base)
        except OSError:
            pass

        f = None
        try:
            f = self._get_chunked_blob(
                prefetch=True, prefetch_to=base, delete=False
            ).detach_tempfile()
            os.rename(f.name, path)
            f.close()
            f = None
        finally:
            if f is not None:
                f.close()
                try:
                    os.remove(f.name)
                except Exception:
                    pass

    def putfile(self, fileobj, blob_size=DEFAULT_BLOB_SIZE, commit=True, logger=nooplogger):
        """
        Save a fileobj into a number of chunks.

        Returns a list of `FileBlobIndex` items.

        >>> indexes = file.putfile(fileobj)
        """
        results = []
        offset = 0
        checksum = sha1(b"")

        while True:
            contents = fileobj.read(blob_size)
            if not contents:
                break
            checksum.update(contents)

            blob_fileobj = ContentFile(contents)
            blob = FileBlob.from_file(blob_fileobj, logger=logger)

            results.append(FileBlobIndex.objects.create(file=self, blob=blob, offset=offset))
            offset += blob.size
        self.size = offset
        self.checksum = checksum.hexdigest()
        metrics.timing("filestore.file-size", offset)
        if commit:
            self.save()
        return results

    def assemble_from_file_blob_ids(self, file_blob_ids, checksum, commit=True):
        """
        This creates a file, from file blobs and returns a temp file with the
        contents.
        """
        tf = tempfile.NamedTemporaryFile()
        with transaction.atomic():
            file_blobs = FileBlob.objects.filter(id__in=file_blob_ids).all()

            # Ensure blobs are in the order and duplication as provided
            blobs_by_id = {blob.id: blob for blob in file_blobs}
            file_blobs = [blobs_by_id[blob_id] for blob_id in file_blob_ids]

            new_checksum = sha1(b"")
            offset = 0
            for blob in file_blobs:
                FileBlobIndex.objects.create(file=self, blob=blob, offset=offset)
                for chunk in blob.getfile().chunks():
                    new_checksum.update(chunk)
                    tf.write(chunk)
                offset += blob.size

            self.size = offset
            self.checksum = new_checksum.hexdigest()

            if checksum != self.checksum:
                raise AssembleChecksumMismatch("Checksum mismatch")

        metrics.timing("filestore.file-size", offset)
        if commit:
            self.save()
        tf.flush()
        tf.seek(0)
        return tf

    def delete(self, *args, **kwargs):
        blob_ids = [blob.id for blob in self.blobs.all()]
        super(File, self).delete(*args, **kwargs)

        # Wait to delete blobs. This helps prevent
        # races around frequently used blobs in debug images and release files.
        transaction.on_commit(
            lambda: delete_unreferenced_blobs.apply_async(
                kwargs={"blob_ids": blob_ids}, countdown=60 * 5
            )
        )


class FileBlobIndex(Model):
    __core__ = False

    file = FlexibleForeignKey("sentry.File")
    blob = FlexibleForeignKey("sentry.FileBlob", on_delete=models.PROTECT)
    offset = BoundedPositiveIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_fileblobindex"
        unique_together = (("file", "blob", "offset"),)


class ChunkedFileBlobIndexWrapper(object):
    def __init__(self, indexes, mode=None, prefetch=False, prefetch_to=None, delete=True):
        # eager load from database incase its a queryset
        self._indexes = list(indexes)
        self._curfile = None
        self._curidx = None
        if prefetch:
            self.prefetched = True
            self._prefetch(prefetch_to, delete)
        else:
            self.prefetched = False
        self.mode = mode
        self.open()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, tb):
        self.close()

    def detach_tempfile(self):
        if not self.prefetched:
            raise TypeError("Can only detech tempfiles in prefetch mode")
        rv = self._curfile
        self._curfile = None
        self.close()
        rv.seek(0)
        return rv

    def _nextidx(self):
        assert not self.prefetched, "this makes no sense"
        old_file = self._curfile
        try:
            try:
                self._curidx = six.next(self._idxiter)
                self._curfile = self._curidx.blob.getfile()
            except StopIteration:
                self._curidx = None
                self._curfile = None
        finally:
            if old_file is not None:
                old_file.close()

    @property
    def size(self):
        return sum(i.blob.size for i in self._indexes)

    def open(self):
        self.closed = False
        self.seek(0)

    def _prefetch(self, prefetch_to=None, delete=True):
        size = self.size
        f = tempfile.NamedTemporaryFile(prefix="._prefetch-", dir=prefetch_to, delete=delete)
        if size == 0:
            self._curfile = f
            return

        # Zero out the file
        f.seek(size - 1)
        f.write(b"\x00")
        f.flush()

        mem = mmap.mmap(f.fileno(), size)

        def fetch_file(offset, getfile):
            with getfile() as sf:
                while True:
                    chunk = sf.read(65535)
                    if not chunk:
                        break
                    mem[offset : offset + len(chunk)] = chunk
                    offset += len(chunk)

        with ThreadPoolExecutor(max_workers=4) as exe:
            for idx in self._indexes:
                exe.submit(fetch_file, idx.offset, idx.blob.getfile)

        mem.flush()
        self._curfile = f

    def close(self):
        if self._curfile:
            self._curfile.close()
        self._curfile = None
        self._curidx = None
        self.closed = True

    def seek(self, pos):
        if self.closed:
            raise ValueError("I/O operation on closed file")

        if self.prefetched:
            return self._curfile.seek(pos)

        if pos < 0:
            raise IOError("Invalid argument")
        if pos == 0 and not self._indexes:
            # Empty file, there's no seeking to be done.
            return

        for n, idx in enumerate(self._indexes[::-1]):
            if idx.offset <= pos:
                if idx != self._curidx:
                    self._idxiter = iter(self._indexes[-(n + 1) :])
                    self._nextidx()
                break
        else:
            raise ValueError("Cannot seek to pos")
        self._curfile.seek(pos - self._curidx.offset)

    def tell(self):
        if self.closed:
            raise ValueError("I/O operation on closed file")
        if self.prefetched:
            return self._curfile.tell()
        if self._curfile is None:
            return self.size
        return self._curidx.offset + self._curfile.tell()

    def read(self, n=-1):
        if self.closed:
            raise ValueError("I/O operation on closed file")

        if self.prefetched:
            return self._curfile.read(n)

        result = bytearray()

        # Read to the end of the file
        if n < 0:
            while self._curfile is not None:
                blob_result = self._curfile.read(32768)
                if not blob_result:
                    self._nextidx()
                else:
                    result.extend(blob_result)

        # Read until a certain number of bytes are read
        else:
            while n > 0 and self._curfile is not None:
                blob_result = self._curfile.read(min(n, 32768))
                if not blob_result:
                    self._nextidx()
                else:
                    n -= len(blob_result)
                    result.extend(blob_result)

        return bytes(result)


class FileBlobOwner(Model):
    __core__ = False

    blob = FlexibleForeignKey("sentry.FileBlob")
    organization = FlexibleForeignKey("sentry.Organization")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_fileblobowner"
        unique_together = (("blob", "organization"),)


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
