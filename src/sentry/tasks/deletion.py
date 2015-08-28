"""
sentry.tasks.deletion
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import


from celery.utils.log import get_task_logger

from sentry.utils.query import bulk_delete_objects
from sentry.tasks.base import instrumented_task, retry

logger = get_task_logger(__name__)


@instrumented_task(name='sentry.tasks.deletion.delete_organization', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def delete_organization(object_id, continuous=True, **kwargs):
    from sentry.models import (
        Organization, OrganizationMember, OrganizationStatus, Team
    )

    try:
        o = Organization.objects.get(id=object_id)
    except Team.DoesNotExist:
        return

    if o.status != OrganizationStatus.DELETION_IN_PROGRESS:
        o.update(status=OrganizationStatus.DELETION_IN_PROGRESS)

    for team in Team.objects.filter(organization=o).order_by('id')[:1]:
        logger.info('Removing Team id=%s where organization=%s', team.id, o.id)
        delete_team(team.id, continuous=False)
        if continuous:
            delete_organization.delay(object_id=object_id, countdown=15)
        return

    model_list = (OrganizationMember,)

    has_more = delete_objects(model_list, relation={'organization': o}, logger=logger)
    if has_more:
        if continuous:
            delete_organization.delay(object_id=object_id, countdown=15)
        return
    o.delete()


@instrumented_task(name='sentry.tasks.deletion.delete_team', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def delete_team(object_id, continuous=True, **kwargs):
    from sentry.models import (
        Team, TeamStatus, Project, AccessGroup,
    )

    try:
        t = Team.objects.get(id=object_id)
    except Team.DoesNotExist:
        return

    if t.status != TeamStatus.DELETION_IN_PROGRESS:
        t.update(status=TeamStatus.DELETION_IN_PROGRESS)

    # Delete 1 project at a time since this is expensive by itself
    for project in Project.objects.filter(team=t).order_by('id')[:1]:
        logger.info('Removing Project id=%s where team=%s', project.id, t.id)
        delete_project(project.id, continuous=False)
        if continuous:
            delete_team.delay(object_id=object_id, countdown=15)
        return

    model_list = (AccessGroup,)

    has_more = delete_objects(model_list, relation={'team': t}, logger=logger)
    if has_more:
        if continuous:
            delete_team.delay(object_id=object_id, countdown=15)
        return
    t.delete()


@instrumented_task(name='sentry.tasks.deletion.delete_project', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def delete_project(object_id, continuous=True, **kwargs):
    from sentry.models import (
        Project, ProjectKey, ProjectStatus, TagKey, TagValue, GroupTagKey,
        GroupTagValue, Activity, EventMapping, Group, GroupRuleStatus,
        GroupHash, GroupSeen,
    )

    try:
        p = Project.objects.get(id=object_id)
    except Project.DoesNotExist:
        return

    if p.status != ProjectStatus.DELETION_IN_PROGRESS:
        p.update(status=ProjectStatus.DELETION_IN_PROGRESS)

    # XXX: remove keys first to prevent additional data from flowing in
    model_list = (
        ProjectKey, TagKey, TagValue, GroupTagKey, GroupTagValue, EventMapping,
        Activity, GroupRuleStatus, GroupHash, GroupSeen,
    )
    for model in model_list:
        has_more = bulk_delete_objects(model, project_id=p.id, logger=logger)
        if has_more:
            if continuous:
                delete_project.delay(object_id=object_id, countdown=15)
            return

    has_more = delete_events(relation={'project_id': p.id}, logger=logger)
    if has_more:
        if continuous:
            delete_project.delay(object_id=object_id, countdown=15)
        return

    model_list = (Group,)
    for model in model_list:
        has_more = bulk_delete_objects(model, project_id=p.id, logger=logger)
        if has_more:
            if continuous:
                delete_project.delay(object_id=object_id, countdown=15)
            return
    p.delete()


@instrumented_task(name='sentry.tasks.deletion.delete_group', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def delete_group(object_id, continuous=True, **kwargs):
    from sentry.models import (
        EventMapping, Group, GroupHash, GroupRuleStatus, GroupStatus,
        GroupTagKey, GroupTagValue
    )

    try:
        group = Group.objects.get(id=object_id)
    except Group.DoesNotExist:
        return

    if group.status != GroupStatus.DELETION_IN_PROGRESS:
        group.update(status=GroupStatus.DELETION_IN_PROGRESS)

    bulk_model_list = (
        GroupHash, GroupRuleStatus, GroupTagValue, GroupTagKey, EventMapping
    )
    for model in bulk_model_list:
        has_more = bulk_delete_objects(model, group_id=object_id, logger=logger)
        if has_more:
            if continuous:
                delete_group.delay(object_id=object_id, countdown=15)
            return

    has_more = delete_events(relation={'group_id': object_id}, logger=logger)
    if has_more:
        if continuous:
            delete_group.delay(object_id=object_id, countdown=15)
        return
    group.delete()


@instrumented_task(name='sentry.tasks.deletion.delete_tag_key', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def delete_tag_key(object_id, continuous=True, **kwargs):
    from sentry.models import (
        GroupTagKey, GroupTagValue, TagKey, TagKeyStatus, TagValue
    )

    try:
        tagkey = TagKey.objects.get(id=object_id)
    except TagKey.DoesNotExist:
        return

    if tagkey.status != TagKeyStatus.DELETION_IN_PROGRESS:
        tagkey.update(status=TagKeyStatus.DELETION_IN_PROGRESS)

    bulk_model_list = (
        GroupTagValue, GroupTagKey, TagValue
    )
    for model in bulk_model_list:
        has_more = bulk_delete_objects(model, project_id=tagkey.project_id,
                                       key=tagkey.key, logger=logger)
        if has_more:
            if continuous:
                delete_tag_key.delay(object_id=object_id, countdown=15)
            return
    tagkey.delete()


def delete_events(relation, limit=100, logger=None):
    from sentry.app import nodestore
    from sentry.models import Event

    has_more = False
    if logger is not None:
        logger.info('Removing %r objects where %r', Event, relation)

    result_set = list(Event.objects.filter(**relation)[:limit])
    has_more = bool(result_set)
    if has_more:
        # delete objects from nodestore first
        node_ids = set(r.data.id for r in result_set)
        nodestore.delete_multi(node_ids)

        # bulk delete by id
        Event.objects.filter(id__in=[r.id for r in result_set]).delete()
    return has_more


def delete_objects(models, relation, limit=100, logger=None):
    # This handles cascades properly
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
