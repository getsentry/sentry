"""
sentry.tasks.deletion
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from celery.task import task


@task(name='sentry.tasks.deletion.delete_project', queue='cleanup')
def delete_project(object_id, **kwargs):
    from sentry.models import (
        Project, TagKey, TagValue, GroupTagKey, GroupTag, GroupCountByMinute,
        ProjectCountByMinute, Activity, EventMapping, Event, Group
    )

    try:
        p = Project.objects.get(id=object_id)
    except Project.DoesNotExist:
        return

    logger = delete_project.get_logger()

    # This handles cascades properly
    # TODO: this doesn't clean up the index
    for model in (
            TagKey, TagValue, GroupTagKey, GroupTag, GroupCountByMinute,
            ProjectCountByMinute, Activity, EventMapping, Event, Group):
        logger.info('Removing %r objects where project=%s', model, p.id)
        has_results = False
        for obj in model.objects.filter(project=p)[:1000]:
            obj.delete()
            has_results = True

        if has_results:
            delete_project.delay(object_id=object_id)
    p.delete()


@task(name='sentry.tasks.deletion.delete_group', queue='cleanup')
def delete_group(object_id, **kwargs):
    from sentry.models import Group

    try:
        g = Group.objects.get(id=object_id)
    except Group.DoesNotExist:
        return

    g.delete()
