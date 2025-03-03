from __future__ import annotations

from abc import abstractmethod
from concurrent.futures import ThreadPoolExecutor
from threading import Semaphore
from typing import TYPE_CHECKING, Any, Generic, Self, TypeVar
from uuid import uuid4

import sentry_sdk
from django.db import IntegrityError, models, router, transaction
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.celery import SentryTask
from sentry.db.models import BoundedPositiveIntegerField, Model
from sentry.models.files.abstractfileblobowner import AbstractFileBlobOwner
from sentry.models.files.utils import (
    get_and_optionally_update_blob,
    get_size_and_checksum,
    get_storage,
    nooplogger,
)
from sentry.utils import metrics

MULTI_BLOB_UPLOAD_CONCURRENCY = 8

BlobOwnerType = TypeVar("BlobOwnerType", bound=AbstractFileBlobOwner)


if TYPE_CHECKING:
    # Django doesn't permit models to have parent classes that are Generic
    # this kludge lets satisfy both mypy and django
    class _Parent(Generic[BlobOwnerType]):
        pass

else:

    class _Parent:
        def __class_getitem__(cls, _):
            return cls


class AbstractFileBlob(Model, _Parent[BlobOwnerType]):
    __relocation_scope__ = RelocationScope.Excluded

    path = models.TextField(null=True)
    size = BoundedPositiveIntegerField(null=True)
    checksum = models.CharField(max_length=40, unique=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        abstract = True

    @abstractmethod
    def _create_blob_owner(self, organization_id: int) -> BlobOwnerType: ...

    @abstractmethod
    def _delete_file_task(self) -> SentryTask: ...

    @classmethod
    @abstractmethod
    def _storage_config(cls) -> dict[str, Any] | None:
        raise NotImplementedError(cls)

    @classmethod
    @sentry_sdk.tracing.trace
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
        blobs_to_save = []
        semaphore = Semaphore(value=MULTI_BLOB_UPLOAD_CONCURRENCY)

        def _upload_and_pend_chunk(fileobj, size, checksum):
            logger.debug(
                "FileBlob.from_files._upload_and_pend_chunk.start",
                extra={"checksum": checksum, "size": size},
            )
            blob = cls(size=size, checksum=checksum)
            blob.path = cls.generate_unique_path()
            storage = get_storage(cls._storage_config())
            storage.save(blob.path, fileobj)
            blobs_to_save.append(blob)
            metrics.distribution(
                "filestore.blob-size", size, tags={"function": "from_files"}, unit="byte"
            )
            logger.debug(
                "FileBlob.from_files._upload_and_pend_chunk.end",
                extra={"checksum": checksum, "path": blob.path},
            )

        def _save_blob(blob: Self):
            logger.debug("FileBlob.from_files._save_blob.start", extra={"path": blob.path})
            try:
                blob.save()
            except IntegrityError:
                # this means that there was a race inserting a blob
                # with this checksum. we will fetch the other blob that was
                # saved, and delete our backing storage to not leave orphaned
                # chunks behind.
                # we also won't have to worry about concurrent deletes, as deletions
                # are only happening for blobs older than 24h.
                metrics.incr("filestore.upload_race", sample_rate=1.0)
                saved_path = blob.path
                blob = cls.objects.get(checksum=blob.checksum)
                storage = get_storage(cls._storage_config())
                storage.delete(saved_path)

            blob._ensure_blob_owned(organization)
            logger.debug("FileBlob.from_files._save_blob.end", extra={"path": blob.path})

        def _flush_blobs():
            while True:
                try:
                    blob = blobs_to_save.pop()
                except IndexError:
                    break

                _save_blob(blob)
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
                    size, checksum = get_size_and_checksum(fileobj)
                    if reference_checksum is not None and checksum != reference_checksum:
                        raise OSError("Checksum mismatch")
                    if checksum in checksums_seen:
                        continue
                    checksums_seen.add(checksum)

                    # Check if we need to upload the blob.  If we get a result back
                    # here it means the blob already exists.
                    existing = get_and_optionally_update_blob(cls, checksum)
                    if existing is not None:
                        existing._ensure_blob_owned(organization)
                        continue

                    # Otherwise we leave the blob locked and submit the task.
                    # We use the semaphore to ensure we never schedule too
                    # many.  The upload will be done with a certain amount
                    # of concurrency controlled by the semaphore and the
                    # `_flush_blobs` call will take all those uploaded
                    # blobs and associate them with the database.
                    semaphore.acquire()
                    exe.submit(_upload_and_pend_chunk(fileobj, size, checksum))
                    logger.debug("FileBlob.from_files.end", extra={"checksum": reference_checksum})

            _flush_blobs()
        finally:
            logger.debug("FileBlob.from_files.end")

    @classmethod
    @sentry_sdk.tracing.trace
    def from_file_with_organization(cls, fileobj, organization=None, logger=nooplogger) -> Self:
        """
        Retrieve a single FileBlob instances for the given file and binds it to an organization via the FileBlobOwner.
        """
        blob = cls.from_file(fileobj, logger=logger)
        blob._ensure_blob_owned(organization)

        return blob

    @classmethod
    @sentry_sdk.tracing.trace
    def from_file(cls, fileobj, logger=nooplogger) -> Self:
        """
        Retrieve a single FileBlob instances for the given file.
        """
        logger.debug("FileBlob.from_file.start")

        size, checksum = get_size_and_checksum(fileobj)

        existing = get_and_optionally_update_blob(cls, checksum)
        if existing is not None:
            return existing

        blob = cls(size=size, checksum=checksum)
        blob.path = cls.generate_unique_path()
        storage = get_storage(cls._storage_config())
        storage.save(blob.path, fileobj)
        try:
            blob.save()
        except IntegrityError:
            # see `_save_blob` above
            metrics.incr("filestore.upload_race", sample_rate=1.0)
            saved_path = blob.path
            blob = cls.objects.get(checksum=checksum)
            storage.delete(saved_path)

        metrics.distribution("filestore.blob-size", size, unit="byte")
        logger.debug("FileBlob.from_file.end")
        return blob

    @classmethod
    def generate_unique_path(cls):
        # We intentionally do not use checksums as path names to avoid concurrency issues
        # when we attempt concurrent uploads for any reason.
        uuid_hex = uuid4().hex
        pieces = [uuid_hex[:2], uuid_hex[2:6], uuid_hex[6:]]
        return "/".join(pieces)

    @sentry_sdk.tracing.trace
    def delete(self, *args, **kwargs):
        if self.path:
            # Defer this by 1 minute just to make sure
            # we avoid any transaction isolation where the
            # FileBlob row might still be visible by the
            # task before transaction is committed.
            self._delete_file_task().apply_async(
                kwargs={"path": self.path, "checksum": self.checksum}, countdown=60
            )
        super().delete(*args, **kwargs)

    def getfile(self):
        """
        Return a file-like object for this File's content.

        >>> with blob.getfile() as src, open('/tmp/localfile', 'wb') as dst:
        >>>     for chunk in src.chunks():
        >>>         dst.write(chunk)
        """
        assert self.path

        storage = get_storage(self._storage_config())
        return storage.open(self.path)

    def _ensure_blob_owned(self, organization):
        """
        Ensures that the FileBlob is owned by the given organization.
        """
        if organization is None:
            return

        try:
            with transaction.atomic(using=router.db_for_write(self.__class__)):
                self._create_blob_owner(organization_id=organization.id)
        except IntegrityError:
            pass
