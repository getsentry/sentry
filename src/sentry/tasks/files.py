from __future__ import absolute_import

from sentry.tasks.base import instrumented_task
from sentry.tasks.deletion import MAX_RETRIES


@instrumented_task(
    name='sentry.tasks.files.delete_file',
    queue='files.delete',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
def delete_file(path, **kwargs):
    from sentry.models.file import get_storage
    get_storage().delete(path)
