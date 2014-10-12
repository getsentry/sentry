"""
sentry.tasks.merge
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.db.models import F

from sentry.tasks.base import instrumented_task, retry


@instrumented_task(name='sentry.tasks.merge.merge_group', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def merge_group(from_object_id, to_object_id, **kwargs):
    from sentry.models import (
        Group, GroupHash, GroupRuleStatus, GroupTagKey, GroupTagValue,
        EventMapping, Event
    )

    logger = merge_group.get_logger()

    try:
        group = Group.objects.get(id=from_object_id)
    except Group.DoesNotExist:
        logger.warn('merge_group called with invalid from_object_id: %s', from_object_id)
        return

    try:
        new_group = Group.objects.get(id=to_object_id)
    except Group.DoesNotExist:
        logger.warn('merge_group called with invalid to_object_id: %s', to_object_id)
        return

    model_list = (
        GroupHash, GroupRuleStatus, GroupTagValue, GroupTagKey, EventMapping, Event
    )

    has_more = merge_objects(model_list, group, new_group, logger=logger)

    if has_more:
        merge_group.delay(
            from_object_id=from_object_id,
            to_object_id=to_object_id,
        )
        return

    new_group.update(
        times_seen=F('times_seen') + group.times_seen,
    )

    group.delete()


def merge_objects(models, group, new_group, limit=1000,
                  logger=None):

    has_more = False
    for model in models:
        if logger is not None:
            logger.info('Merging %r objects where %r into %r', model, group,
                        new_group)
        for obj in model.objects.filter(group=group)[:limit]:
            obj.group = new_group

            sid = transaction.savepoint()
            try:
                obj.save()
            except IntegrityError:
                transaction.savepoint_rollback(sid)
                obj.delete()
            else:
                transaction.savepoint_commit(sid)
            has_more = True

        if has_more:
            return True
    return has_more
