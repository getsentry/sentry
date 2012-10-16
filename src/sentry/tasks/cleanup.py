"""
sentry.tasks.cleanup
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task


@task(ignore_result=True)
def cleanup(days=30, logger=None, site=None, server=None, level=None,
            project=None, resolved=None, **kwargs):
    """
    Deletes a portion of the trailing data in Sentry based on
    their creation dates. For example, if ``days`` is 30, this
    would attempt to clean up all data thats older than 30 days.

    :param logger: limit all deletion scopes to messages from the
                   specified logger.
    :param site: limit the message deletion scope to the specified
                 site.
    :param server: limit the message deletion scope to the specified
                   server.
    :param level: limit all deletion scopes to messages that are greater
                  than or equal to level.
    :param project: limit all deletion scopes to messages that are part
                    of the given project
    :param resolved: limit all deletion scopes to messages that are resolved.
    """
    import datetime

    from django.utils import timezone
    from sentry.models import Group, Event, MessageCountByMinute, \
      MessageFilterValue, FilterKey, FilterValue, SearchDocument, ProjectCountByMinute
    from sentry.utils.query import RangeQuerySetWrapper, SkinnyQuerySet

    def cleanup_groups(iterable):
        for obj in iterable:
            print ">>> Removing all matching <SearchDocument: group=%s>" % (obj.pk)
            SearchDocument.objects.filter(group=obj).delete()
            print ">>> Removing <%s: id=%s>" % (obj.__class__.__name__, obj.pk)
            obj.delete()

    # TODO: we should collect which messages above were deleted
    # and potentially just send out post_delete signals where
    # GroupedMessage can update itself accordingly
    ts = timezone.now() - datetime.timedelta(days=days)

    # Message
    qs = SkinnyQuerySet(Event).filter(datetime__lte=ts)
    if logger:
        qs = qs.filter(logger=logger)
    if site:
        qs = qs.filter(site=site)
    if server:
        qs = qs.filter(server_name=server)
    if level:
        qs = qs.filter(level__gte=level)
    if project:
        qs = qs.filter(project=project)
    if resolved is True:
        qs = qs.filter(group__status=1)
    elif resolved is False:
        qs = qs.filter(group__status=0)

    groups_to_check = set()
    if resolved is None:
        for obj in RangeQuerySetWrapper(qs):
            print ">>> Removing <%s: id=%s>" % (obj.__class__.__name__, obj.pk)
            obj.delete()
            groups_to_check.add(obj.group_id)

    if not (server or site):
        # MessageCountByMinute
        qs = SkinnyQuerySet(MessageCountByMinute).filter(date__lte=ts)
        if logger:
            qs = qs.filter(group__logger=logger)
        if level:
            qs = qs.filter(group__level__gte=level)
        if project:
            qs = qs.filter(project=project)
        if resolved is True:
            qs = qs.filter(group__status=1)
        elif resolved is False:
            qs = qs.filter(group__status=0)

        for obj in RangeQuerySetWrapper(qs):
            print ">>> Removing <%s: id=%s>" % (obj.__class__.__name__, obj.pk)
            obj.delete()

        # Group
        qs = SkinnyQuerySet(Group).filter(last_seen__lte=ts)
        if logger:
            qs = qs.filter(logger=logger)
        if level:
            qs = qs.filter(level__gte=level)
        if project:
            qs = qs.filter(project=project)
        if resolved is True:
            qs = qs.filter(status=1)
        elif resolved is False:
            qs = qs.filter(status=0)

        cleanup_groups(RangeQuerySetWrapper(qs))

    # Project counts
    # TODO: these dont handle filters
    qs = SkinnyQuerySet(ProjectCountByMinute).filter(date__lte=ts)
    if project:
        qs = qs.filter(project=project)

    for obj in RangeQuerySetWrapper(qs):
        print ">>> Removing <%s: id=%s>" % (obj.__class__.__name__, obj.pk)
        obj.delete()

    # Filters
    qs = FilterKey.objects.all()
    if project:
        qs = qs.filter(project=project)

    mqs = MessageFilterValue.objects.all()
    if project:
        mqs = mqs.filter(project=project)

    print "checking filters"
    for obj in RangeQuerySetWrapper(qs):
        if not mqs.filter(key=obj.key).exists():
            print ">>> Removing filters for unused filter %s=*" % (obj.key,)
            qs.filter(key=obj.key).delete()
            obj.delete()

    qs = FilterValue.objects.all()
    if project:
        qs = qs.filter(project=project)

    for obj in RangeQuerySetWrapper(qs):
        if not mqs.filter(key=obj.key, value=obj.value).exists():
            print ">>> Removing filters for unused filter %s=%s" % (obj.key, obj.value)
            qs.filter(key=obj.key).delete()
            obj.delete()

    # attempt to cleanup any groups that may now be empty
    groups_to_delete = []
    for group_id in groups_to_check:
        if not Event.objects.filter(group=group_id).exists():
            groups_to_delete.append(group_id)

    if groups_to_delete:
        cleanup_groups(SkinnyQuerySet(Group).filter(pk__in=groups_to_delete))
