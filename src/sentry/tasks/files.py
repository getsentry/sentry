from datetime import timedelta

from django.apps import apps
from django.db import DatabaseError, IntegrityError, router
from django.utils import timezone

from sentry.locks import locks
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.deletion.scheduled import MAX_RETRIES
from sentry.utils.db import atomic_transaction


@instrumented_task(
    name="sentry.tasks.files.delete_file",
    queue="files.delete",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    autoretry_for=(DatabaseError, IntegrityError),
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def delete_file_region(path, checksum, **kwargs):
    from sentry.models.files import FileBlob

    delete_file(FileBlob, path, checksum, **kwargs)


@instrumented_task(
    name="sentry.tasks.files.delete_file_control",
    queue="files.delete.control",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    autoretry_for=(DatabaseError, IntegrityError),
    acks_late=True,
    silo_mode=SiloMode.CONTROL,
)
def delete_file_control(path, checksum, **kwargs):
    from sentry.models.files import ControlFileBlob

    delete_file(ControlFileBlob, path, checksum, **kwargs)


def delete_file(file_blob_model, path, checksum, **kwargs):
    from sentry.models.files.utils import get_storage, lock_blob

    lock = lock_blob(checksum, "fileblob_upload")
    with lock:
        # check that the fileblob with *this* path exists, as its possible
        # that a concurrent re-upload added the same chunk once again, with a
        # different path that time
        if not file_blob_model.objects.filter(checksum=checksum, path=path).exists():
            get_storage().delete(path)


@instrumented_task(
    name="sentry.tasks.files.delete_unreferenced_blobs",
    queue="files.delete",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    silo_mode=SiloMode.REGION,
)
@retry
def delete_unreferenced_blobs_region(blob_ids):
    from sentry.models.files.fileblob import FileBlob
    from sentry.models.files.fileblobindex import FileBlobIndex

    delete_unreferenced_blobs(FileBlob, FileBlobIndex, blob_ids)


@instrumented_task(
    name="sentry.tasks.files.delete_unreferenced_blobs_control",
    queue="files.delete.control",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    silo_mode=SiloMode.CONTROL,
)
@retry
def delete_unreferenced_blobs_control(blob_ids):
    from sentry.models.files.control_fileblob import ControlFileBlob
    from sentry.models.files.control_fileblobindex import ControlFileBlobIndex

    delete_unreferenced_blobs(ControlFileBlob, ControlFileBlobIndex, blob_ids)


def delete_unreferenced_blobs(blob_model, blob_index_model, blob_ids):

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


# TODO(hybrid-cloud): Remove this once backfills are done?
@instrumented_task(
    name="sentry.tasks.files.copy_to_control",
    queue="files.copy",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    autoretry_for=(DatabaseError, IntegrityError),
    acks_late=True,
)
def copy_file_to_control_and_update_model(
    app_name: str,
    model_name: str,
    model_id: int,
    file_id: int,
    **kwargs,
):
    from sentry.models.files import ControlFile, File

    if SiloMode.get_current_mode() != SiloMode.MONOLITH:
        # We can only run this task in monolith mode.
        return

    lock = f"copy-file-lock-{model_name}:{model_id}"

    with locks.get(lock, duration=60, name="copy-file-lock").acquire():
        # Short circuit duplicate copy calls
        model_class = apps.get_model(app_name, model_name)
        instance = model_class.objects.get(id=model_id)
        if instance.control_file_id:
            return

        file_model = File.objects.get(id=file_id)
        file_handle = file_model.getfile()

        control_file = ControlFile.objects.create(
            name=file_model.name,
            type=file_model.type,
            headers=file_model.headers,
            timestamp=file_model.timestamp,
            size=file_model.size,
            checksum=file_model.checksum,
        )
        control_file.putfile(file_handle)

        instance.control_file_id = control_file.id
        instance.file_id = None
        instance.save()
