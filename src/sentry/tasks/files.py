import random

from django.apps import apps
from django.conf import settings
from django.db import DatabaseError, IntegrityError, router

from sentry.locks import locks
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
)
def delete_file_region(path, checksum, **kwargs):
    from sentry.models.files import FileBlob

    delete_file(FileBlob, path, checksum, **kwargs)


@instrumented_task(
    name="sentry.tasks.files.delete_file_control",
    queue="files.delete",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
    autoretry_for=(DatabaseError, IntegrityError),
    acks_late=True,
)
def delete_file_control(path, checksum, **kwargs):
    from sentry.models.files import ControlFileBlob

    delete_file(ControlFileBlob, path, checksum, **kwargs)


def delete_file(file_blob_model, path, checksum, **kwargs):
    from sentry.locks import locks
    from sentry.models.files import get_storage
    from sentry.utils.retries import TimedRetryPolicy

    lock = locks.get(f"fileblob:upload:{checksum}", duration=60 * 10, name="fileblob_upload")
    with TimedRetryPolicy(60)(lock.acquire):
        if not file_blob_model.objects.filter(checksum=checksum).exists():
            get_storage().delete(path)


@instrumented_task(
    name="sentry.tasks.files.delete_unreferenced_blobs",
    queue="files.delete",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
)
@retry
def delete_unreferenced_blobs_region(blob_ids):
    from sentry.models import FileBlob, FileBlobIndex

    delete_unreferenced_blobs(FileBlob, FileBlobIndex, blob_ids)


@instrumented_task(
    name="sentry.tasks.files.delete_unreferenced_blobs_control",
    queue="files.delete",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
)
@retry
def delete_unreferenced_blobs_control(blob_ids):
    from sentry.models import ControlFileBlob, ControlFileBlobIndex

    delete_unreferenced_blobs(ControlFileBlob, ControlFileBlobIndex, blob_ids)


def delete_unreferenced_blobs(blob_model, blob_index_model, blob_ids):

    for blob_id in blob_ids:
        if blob_index_model.objects.filter(blob_id=blob_id).exists():
            continue
        try:
            blob = blob_model.objects.get(id=blob_id)
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
    from sentry.models.files import ControlFile, ControlFileBlob, File

    if ControlFileBlob._storage_config() is None:
        return

    if random.uniform(0, 1) > settings.SENTRY_FILE_COPY_ROLLOUT_RATE:
        return

    lock = f"copy-file-lock-{model_name}:{model_id}"

    with locks.get(lock, duration=60, name="copy-file-lock").acquire():
        # Short circuit duplicate copy calls
        model = apps.get_app_config(app_name).get_model(model_name).objects.get(id=model_id)
        if model.control_file_id:
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

        model.control_file_id = control_file.id
        model.save()
