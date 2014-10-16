"""
sentry.tasks.cleanup
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from nydus.utils import ThreadPool

from sentry.tasks.base import instrumented_task


def delete_object(item):
    item.delete()


@instrumented_task(name='sentry.tasks.cleanup.cleanup', queue='cleanup')
def cleanup(days=30, project=None, chunk_size=1000, concurrency=1, **kwargs):
    """
    Deletes a portion of the trailing data in Sentry based on
    their creation dates. For example, if ``days`` is 30, this
    would attempt to clean up all data that's older than 30 days.

    :param project: limit all deletion scopes to messages that are part
                    of the given project
    """
    import datetime

    from django.utils import timezone

    from sentry import app
    # TODO: TagKey and GroupTagKey need cleaned up
    from sentry.models import (
        Group, GroupRuleStatus, Event, EventMapping,
        GroupTagValue, TagValue, Alert,
        Activity, LostPasswordHash)
    from sentry.search.django.models import SearchDocument

    GENERIC_DELETES = (
        (SearchDocument, 'date_changed'),
        (GroupRuleStatus, 'date_added'),
        (GroupTagValue, 'last_seen'),
        (Event, 'datetime'),
        (Activity, 'datetime'),
        (TagValue, 'last_seen'),
        (Alert, 'datetime'),
        (EventMapping, 'date_added'),
        # Group should probably be last
        (Group, 'last_seen'),
    )

    log = cleanup.get_logger()

    ts = timezone.now() - datetime.timedelta(days=days)

    log.info("Removing expired values for LostPasswordHash")
    LostPasswordHash.objects.filter(
        date_added__lte=timezone.now() - datetime.timedelta(hours=48)
    ).delete()

    # TODO: we should move this into individual backends
    log.info("Removing old Node values")
    try:
        app.nodestore.cleanup(ts)
    except NotImplementedError:
        log.warning("Node backend does not support cleanup operation")

    # Remove types which can easily be bound to project + date
    for model, date_col in GENERIC_DELETES:
        log.info("Removing %s for days=%s project=%s", model.__name__, days, project or '*')
        qs = model.objects.filter(**{'%s__lte' % (date_col,): ts})
        if project:
            qs = qs.filter(project=project)
        # XXX: we step through because the deletion collector will pull all relations into memory

        count = 0
        while qs.exists():
            log.info("Removing %s chunk %d", model.__name__, count)
            if concurrency > 1:
                worker_pool = ThreadPool(workers=concurrency)
                for obj in qs[:chunk_size].iterator():
                    worker_pool.add(obj.id, delete_object, [obj])
                    count += 1
                worker_pool.join()
                del worker_pool
            else:
                for obj in qs[:chunk_size].iterator():
                    delete_object(obj)

    # EventMapping is fairly expensive and is special cased as it's likely you
    # won't need a reference to an event for nearly as long
    if days > 7:
        log.info("Removing expired values for EventMapping")
        EventMapping.objects.filter(
            date_added__lte=timezone.now() - datetime.timedelta(days=7)
        ).delete()
