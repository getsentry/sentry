"""
sentry.tasks.cleanup
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task


@task(name='sentry.tasks.cleanup.cleanup', queue='cleanup')
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

    # TODO: TagKey and GroupTagKey need cleaned up
    from sentry.models import (
        Group, Event, GroupCountByMinute, EventMapping,
        GroupTag, TagValue, ProjectCountByMinute, Alert,
        SearchDocument, Activity, LostPasswordHash)

    GENERIC_DELETES = (
        (SearchDocument, 'date_changed'),
        (GroupCountByMinute, 'date'),
        (ProjectCountByMinute, 'date'),
        (GroupTag, 'last_seen'),
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

    log.info("Removing expired values for %r", LostPasswordHash)
    LostPasswordHash.objects.filter(
        date_added__lte=timezone.now() - datetime.timedelta(days=1)
    ).delete()
