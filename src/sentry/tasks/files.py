from __future__ import absolute_import

from django.db import IntegrityError, transaction
from sentry.tasks.base import instrumented_task
from sentry.tasks.deletion import MAX_RETRIES


@instrumented_task(
    name="sentry.tasks.files.delete_file",
    queue="files.delete",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
)
def delete_file(path, checksum, **kwargs):
    from sentry.models.file import get_storage, FileBlob
    from sentry.app import locks
    from sentry.utils.retries import TimedRetryPolicy

    lock = locks.get(u"fileblob:upload:{}".format(checksum), duration=60 * 10)
    with TimedRetryPolicy(60)(lock.acquire):
        if not FileBlob.objects.filter(checksum=checksum).exists():
            get_storage().delete(path)


@instrumented_task(
    name="sentry.tasks.files.delete_unreferenced_blobs",
    queue="files.delete",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
)
def delete_unreferenced_blobs(blob_ids):
    from sentry.models import FileBlobIndex, FileBlob

    for blob_id in blob_ids:
        if FileBlobIndex.objects.filter(blob_id=blob_id).exists():
            continue
        try:
            blob = FileBlob.objects.get(id=blob_id)
        except FileBlob.DoesNotExist:
            pass
        else:
            try:
                with transaction.atomic():
                    # Need to delete the record to ensure django hooks run.
                    blob.delete()
            except IntegrityError:
                # Do nothing if the blob was deleted in another task, or
                # if had another reference added concurrently.
                pass
