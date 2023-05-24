from concurrent.futures import ThreadPoolExecutor
from threading import Semaphore
from uuid import uuid4

from django.db import IntegrityError, models, router
from django.utils import timezone

from sentry.db.models import BoundedPositiveIntegerField, Model
from sentry.locks import locks
from sentry.models.files.utils import (
    UPLOAD_RETRY_TIME,
    _get_size_and_checksum,
    get_storage,
    locked_blob,
    nooplogger,
)
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.retries import TimedRetryPolicy

MULTI_BLOB_UPLOAD_CONCURRENCY = 8


class AbstractFileBlob(Model):
    __include_in_export__ = False

    path = models.TextField(null=True)
    size = BoundedPositiveIntegerField(null=True)
    checksum = models.CharField(max_length=40, unique=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        abstract = True

    FILE_BLOB_OWNER_MODEL = None
    DELETE_FILE_TASK = None

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
                with atomic_transaction(using=router.db_for_write(cls.FILE_BLOB_OWNER_MODEL)):
                    cls.FILE_BLOB_OWNER_MODEL.objects.create(
                        organization_id=organization.id, blob=blob
                    )
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
                        raise OSError("Checksum mismatch")
                    if checksum in checksums_seen:
                        continue
                    checksums_seen.add(checksum)

                    # Check if we need to lock the blob.  If we get a result back
                    # here it means the blob already exists.
                    lock = locked_blob(cls, checksum, logger=logger)
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
        with locked_blob(cls, checksum, logger=logger) as existing:
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
        return "/".join(pieces)

    def delete(self, *args, **kwargs):
        if self.path:
            self.deletefile(commit=False)
        lock = locks.get(
            f"fileblob:upload:{self.checksum}",
            duration=UPLOAD_RETRY_TIME,
            name="fileblob_upload_delete",
        )
        with TimedRetryPolicy(UPLOAD_RETRY_TIME, metric_instance="lock.fileblob.delete")(
            lock.acquire
        ):
            super().delete(*args, **kwargs)

    def deletefile(self, commit=False):
        assert self.path

        # Defer this by 1 minute just to make sure
        # we avoid any transaction isolation where the
        # FileBlob row might still be visible by the
        # task before transaction is committed.
        self.DELETE_FILE_TASK.apply_async(
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
