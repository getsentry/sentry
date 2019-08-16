from __future__ import absolute_import

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
