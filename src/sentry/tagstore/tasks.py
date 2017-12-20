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


@instrumented_task(
    name='sentry.tagstore.tasks.delete_tag_key',
    queue='cleanup',
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES
)
@retry(exclude=(DeleteAborted, ))
def delete_tag_key(object_id, model=None, transaction_id=None, **kwargs):
    from sentry import deletions

    # TODO(brett): remove this (and make model a normal arg) after deploy
    if model is None:
        # if the model wasn't sent we can assume it's from legacy code
        from sentry.tagstore.legacy.models import TagKey as model

    task = deletions.get(
        model=model,
        query={
            'id': object_id,
        },
        transaction_id=transaction_id or uuid4().hex,
    )
    has_more = task.chunk()
    if has_more:
        delete_tag_key.apply_async(
            kwargs={'object_id': object_id,
                    'model': model,
                    'transaction_id': transaction_id},
            countdown=15,
        )
