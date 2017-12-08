"""
sentry.tagstore.tasks
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from uuid import uuid4

from sentry.exceptions import DeleteAborted
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.deletion import MAX_RETRIES


# initialized below
delete_tag_key = None


def setup_tasks(tagkey_model):
    global delete_tag_key

    @instrumented_task(
        name='sentry.tagstore.tasks.delete_tag_key',
        queue='cleanup',
        default_retry_delay=60 * 5,
        max_retries=MAX_RETRIES
    )
    @retry(exclude=(DeleteAborted, ))
    def delete_tag_key_task(object_id, transaction_id=None, **kwargs):
        from sentry import deletions

        task = deletions.get(
            model=tagkey_model,
            query={
                'id': object_id,
            },
            transaction_id=transaction_id or uuid4().hex,
        )
        has_more = task.chunk()
        if has_more:
            delete_tag_key.apply_async(
                kwargs={'object_id': object_id,
                        'transaction_id': transaction_id},
                countdown=15,
            )

    delete_tag_key = delete_tag_key_task
