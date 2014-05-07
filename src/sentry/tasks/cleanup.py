"""
sentry.tasks.cleanup
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.tasks.base import instrumented_task


@instrumented_task(name='sentry.tasks.cleanup.cleanup', queue='cleanup')
def cleanup(days=30, project=None, chunk_size=1000, **kwargs):
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
        Group, Event, EventMapping,
        GroupTagValue, TagValue, Alert,
        Activity, LostPasswordHash)
    from sentry.search.django.models import SearchDocument

    GENERIC_DELETES = (
        (SearchDocument, 'date_changed'),
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

    log.info("Removing expired values for %r", LostPasswordHash)
    LostPasswordHash.objects.filter(
        date_added__lte=timezone.now() - datetime.timedelta(days=1)
    ).delete()

    # TODO: we should move this into individual backends
    log.info("Removing old Node values")
    try:
        app.nodestore.cleanup(ts)
    except NotImplementedError:
        log.warning("Node backend does not support cleanup operation")

    # Remove types which can easily be bound to project + date
    for model, date_col in GENERIC_DELETES:
        log.info("Removing %r for days=%s project=%r", model, days, project or '*')
        qs = model.objects.filter(**{'%s__lte' % (date_col,): ts})
        if project:
            qs = qs.filter(project=project)
        # XXX: we step through because the deletion collector will pull all relations into memory
        while qs.exists():
            for obj in list(qs[:chunk_size]):
                log.info("Removing %r", obj)
                obj.delete()

    # EventMapping is fairly expensive and is special cased as it's likely you
    # won't need a reference to an event for nearly as long
    if days > 7:
        log.info("Removing expired values for %r", EventMapping)
        EventMapping.objects.filter(
            date_added__lte=timezone.now() - datetime.timedelta(days=7)
        ).delete()
