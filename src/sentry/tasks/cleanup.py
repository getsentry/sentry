"""
sentry.tasks.cleanup
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task


@task(ignore_result=True)
def cleanup(days=30, project=None, **kwargs):
    """
    Deletes a portion of the trailing data in Sentry based on
    their creation dates. For example, if ``days`` is 30, this
    would attempt to clean up all data thats older than 30 days.

    :param project: limit all deletion scopes to messages that are part
                    of the given project
    """
    import datetime

    from django.utils import timezone

    from sentry.models import (Group, Event, MessageCountByMinute,
        MessageFilterValue, FilterKey, FilterValue, ProjectCountByMinute,
        SearchDocument)
    from sentry.utils.query import RangeQuerySetWrapper

    GENERIC_DELETES = (
        (SearchDocument, 'date_changed'),
        (MessageCountByMinute, 'date'),
        (ProjectCountByMinute, 'date'),
        (Event, 'datetime'),
        (Group, 'last_seen'),
        (MessageFilterValue, 'last_seen'),
    )

    log = cleanup.get_logger()

    ts = timezone.now() - datetime.timedelta(days=days)

    # Remove types which can easily be bound to project + date
    for model, date_col in GENERIC_DELETES:
        log.info("Removing %r for days=%s project=%r" % (model, days, project))
        qs = model.objects.filter(**{'%s__lte' % (date_col,): ts})
        if project:
            qs = qs.filter(project=project)
        qs.delete()

    # We'll need this to confirm deletion of FilterKey and Filtervalue objects.
    mqs = MessageFilterValue.objects.all()
    if project:
        mqs = mqs.filter(project=project)

    # FilterKey
    log.info("Removing %r for days=%s project=%r" % (FilterKey, days, project))
    qs = FilterKey.objects.all()
    if project:
        qs = qs.filter(project=project)
    for obj in RangeQuerySetWrapper(qs):
        if not mqs.filter(key=obj.key).exists():
            log.info("Removing unused filter %s=*", obj.key,)
            qs.filter(key=obj.key).delete()
            obj.delete()

    # FilterValue
    log.info("Removing %r for days=%s project=%r" % (FilterValue, days, project))
    qs = FilterValue.objects.all()
    if project:
        qs = qs.filter(project=project)
    for obj in RangeQuerySetWrapper(qs):
        if not mqs.filter(key=obj.key, value=obj.value).exists():
            log.info("Removing unused filter %s=%s", obj.key, obj.value)
            qs.filter(key=obj.key, value=obj.value).delete()
            obj.delete()
