"""
sentry.tasks.deletion
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.tasks.base import instrumented_task


@instrumented_task(name='sentry.tasks.deletion.delete_project', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
def delete_project(object_id, **kwargs):
    from sentry.constants import STATUS_HIDDEN
    from sentry.models import (
        Project, ProjectKey, TagKey, TagValue, GroupTagKey, GroupTagValue,
        GroupCountByMinute, ProjectCountByMinute, Activity, EventMapping,
        Event, Group
    )

    try:
        p = Project.objects.get(id=object_id)
    except Project.DoesNotExist:
        return

    if p.status != STATUS_HIDDEN:
        p.update(status=STATUS_HIDDEN)

    logger = delete_project.get_logger()

    model_list = (
        ProjectKey, TagKey, TagValue, GroupTagKey, GroupTagValue,
        GroupCountByMinute, ProjectCountByMinute, Activity, EventMapping,
        Event, Group
    )

    try:
        for model in model_list:
            logger.info('Removing %r objects where project=%s', model, p.id)
            has_results = False
            for obj in model.objects.filter(project=p)[:1000]:
                obj.delete()
                has_results = True

            if has_results:
                delete_project.delay(object_id=object_id)
                return

        p.delete()
    except Exception as exc:
        delete_project.retry(exc=exc)


@instrumented_task(name='sentry.tasks.deletion.delete_group', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
def delete_group(object_id, **kwargs):
    from sentry.models import (
        Group, GroupTagKey, GroupTagValue, GroupCountByMinute, EventMapping, Event
    )

    try:
        group = Group.objects.get(id=object_id)
    except Group.DoesNotExist:
        return

    logger = delete_group.get_logger()

    model_list = (
        GroupTagValue, GroupTagKey, GroupCountByMinute, EventMapping, Event
    )

    try:
        for model in model_list:
            logger.info('Removing %r objects where group=%s', model, group.id)
            has_results = True
            while has_results:
                has_results = False
                for obj in model.objects.filter(group=group)[:1000]:
                    obj.delete()
                    has_results = True

            if has_results:
                delete_group.delay(object_id=object_id)
                return

        group.delete()
    except Exception as exc:
        delete_group.retry(exc=exc)
