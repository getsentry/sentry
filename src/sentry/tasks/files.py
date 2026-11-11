from __future__ import annotations

from collections.abc import Sequence
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db import DatabaseError, IntegrityError, router
from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import deletion_control_tasks, deletion_tasks
from sentry.utils.db import atomic_transaction

if TYPE_CHECKING:
    from sentry.models.files.control_fileblob import ControlFileBlob
    from sentry.models.files.control_fileblobindex import ControlFileBlobIndex
    from sentry.models.files.fileblob import FileBlob
    from sentry.models.files.fileblobindex import FileBlobIndex

MAX_RETRIES = 5


@instrumented_task(
    name="sentry.tasks.files.delete_file",
    namespace=deletion_tasks,
    retry=Retry(
        times=MAX_RETRIES,
        delay=60 * 5,
        on=(DatabaseError, IntegrityError),
    ),
    silo_mode=SiloMode.CELL,
)
def delete_file_region(path: str | None, checksum: str, **kwargs: object) -> None:
    from sentry.models.files import FileBlob

    delete_file(FileBlob, path, checksum, **kwargs)


@instrumented_task(
    name="sentry.tasks.files.delete_file_control",
    namespace=deletion_control_tasks,
    retry=Retry(
        times=MAX_RETRIES,
        on=(DatabaseError, IntegrityError),
        delay=60 * 5,
    ),
    silo_mode=SiloMode.CONTROL,
)
def delete_file_control(path: str | None, checksum: str, **kwargs: object) -> None:
    from sentry.models.files import ControlFileBlob

    delete_file(ControlFileBlob, path, checksum, **kwargs)


def delete_file(
    file_blob_model: type[FileBlob] | type[ControlFileBlob],
    path: str | None,
    checksum: str,
    **kwargs: object,
) -> None:
    from sentry.models.files.utils import get_storage

    if path is None:
        return

    # check that the fileblob with *this* path exists, as its possible
    # that a concurrent re-upload added the same chunk once again, with a
    # different path that time
    if not file_blob_model.objects.filter(checksum=checksum, path=path).exists():
        get_storage().delete(path)


@instrumented_task(
    name="sentry.tasks.files.delete_unreferenced_blobs",
    namespace=deletion_tasks,
    retry=Retry(
        times=MAX_RETRIES,
        delay=60 * 5,
        on=(Exception,),
    ),
    silo_mode=SiloMode.CELL,
)
def delete_unreferenced_blobs_region(blob_ids: Sequence[int]) -> None:
    from sentry.models.files.fileblob import FileBlob
    from sentry.models.files.fileblobindex import FileBlobIndex

    delete_unreferenced_blobs(FileBlob, FileBlobIndex, blob_ids)


@instrumented_task(
    name="sentry.tasks.files.delete_unreferenced_blobs_control",
    namespace=deletion_control_tasks,
    retry=Retry(
        times=MAX_RETRIES,
        delay=60 * 5,
        on=(Exception,),
    ),
    silo_mode=SiloMode.CONTROL,
)
def delete_unreferenced_blobs_control(blob_ids: Sequence[int]) -> None:
    from sentry.models.files.control_fileblob import ControlFileBlob
    from sentry.models.files.control_fileblobindex import ControlFileBlobIndex

    delete_unreferenced_blobs(ControlFileBlob, ControlFileBlobIndex, blob_ids)


def delete_unreferenced_blobs(
    blob_model: type[FileBlob] | type[ControlFileBlob],
    blob_index_model: type[FileBlobIndex] | type[ControlFileBlobIndex],
    blob_ids: Sequence[int],
) -> None:
    for blob_id in blob_ids:
        # If a blob is referenced, we do not want to delete it
        if blob_index_model.objects.filter(blob_id=blob_id).exists():
            continue
        try:
            # We also want to skip new blobs which are just in the process of
            # being uploaded. See `cleanup.py::cleanup_unused_files` as well.
            cutoff = timezone.now() - timedelta(days=1)
            blob = blob_model.objects.get(id=blob_id, timestamp__lte=cutoff)
        except blob_model.DoesNotExist:
            pass
        else:
            try:
                with atomic_transaction(using=router.db_for_write(blob_model)):
                    # Need to delete the record to ensure django hooks run.
                    blob.delete()
            except IntegrityError:
                # Do nothing if the blob was deleted in another task, or
                # if had another reference added concurrently.
                pass
