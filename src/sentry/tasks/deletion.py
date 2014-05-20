"""
sentry.tasks.deletion
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from celery.task import current
from functools import wraps

from sentry.tasks.base import instrumented_task


def retry(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as exc:
            current.retry(exc=exc)
    return wrapped


@instrumented_task(name='sentry.tasks.deletion.delete_team', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def delete_team(object_id, **kwargs):
    from sentry.models import (
        Team, TeamStatus, Project, AccessGroup, PendingTeamMember, TeamMember,
    )

    try:
        t = Team.objects.get(id=object_id)
    except Team.DoesNotExist:
        return

    if t.status != TeamStatus.DELETION_IN_PROGRESS:
        t.update(status=TeamStatus.DELETION_IN_PROGRESS)

    logger = delete_team.get_logger()

    # Delete 1 project at a time since this is expensive by itself
    for project in Project.objects.filter(team=t).order_by('id')[:1]:
        logger.info('Removing Project id=%s where team=%s', project.id, t.id)
        delete_project(project.id)
        delete_team.delay(object_id=object_id)
        return

    model_list = (
        AccessGroup, PendingTeamMember, TeamMember,
    )

    has_more = delete_objects(model_list, relation={'team': t}, logger=logger)
    if has_more:
        delete_team.delay(object_id=object_id)
        return
    t.delete()


@instrumented_task(name='sentry.tasks.deletion.delete_project', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def delete_project(object_id, **kwargs):
    from sentry.constants import STATUS_HIDDEN
    from sentry.models import (
        Project, ProjectKey, TagKey, TagValue, GroupTagKey, GroupTagValue,
        Activity, EventMapping, Event, Group
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
        Activity, EventMapping, Event, Group
    )

    has_more = delete_objects(model_list, relation={'project': p}, logger=logger)
    if has_more:
        delete_project.delay(object_id=object_id)
        return
    p.delete()


@instrumented_task(name='sentry.tasks.deletion.delete_group', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def delete_group(object_id, **kwargs):
    from sentry.models import (
        Group, GroupTagKey, GroupTagValue, EventMapping, Event
    )

    try:
        group = Group.objects.get(id=object_id)
    except Group.DoesNotExist:
        return

    logger = delete_group.get_logger()

    model_list = (
        GroupTagValue, GroupTagKey, EventMapping, Event
    )

    has_more = delete_objects(model_list, relation={'group': group}, logger=logger)
    if has_more:
        delete_group.delay(object_id=object_id)
        return
    group.delete()


def delete_objects(models, relation, limit=1000, logger=None):
    # This handles cascades properly
    # TODO: this doesn't clean up the index
    has_more = False
    for model in models:
        if logger is not None:
            logger.info('Removing %r objects where %r', model, relation)
        for obj in model.objects.filter(**relation)[:limit]:
            obj.delete()
            has_more = True

        if has_more:
            return True
    return has_more
