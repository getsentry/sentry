"""
sentry.tasks.deletion
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from celery.utils.log import get_task_logger

from sentry.exceptions import DeleteAborted
from sentry.signals import pending_delete
from sentry.tasks.base import instrumented_task, retry
from sentry.utils.query import bulk_delete_objects

logger = get_task_logger(__name__)


@instrumented_task(name='sentry.tasks.deletion.delete_organization', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry(exclude=(DeleteAborted,))
def delete_organization(object_id, continuous=True, **kwargs):
    from sentry.models import (
        Organization, OrganizationMember, OrganizationStatus, Team, TeamStatus
    )

    try:
        o = Organization.objects.get(id=object_id)
    except Organization.DoesNotExist:
        return

    if o.status == OrganizationStatus.VISIBLE:
        raise DeleteAborted('Aborting organization deletion as status is invalid')

    if o.status != OrganizationStatus.DELETION_IN_PROGRESS:
        o.update(status=OrganizationStatus.DELETION_IN_PROGRESS)
        pending_delete.send(sender=Organization, instance=o)

    for team in Team.objects.filter(organization=o).order_by('id')[:1]:
        logger.info('Removing Team id=%s where organization=%s', team.id, o.id)
        team.update(status=TeamStatus.DELETION_IN_PROGRESS)
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
@retry(exclude=(DeleteAborted,))
def delete_team(object_id, continuous=True, **kwargs):
    from sentry.models import Team, TeamStatus, Project, ProjectStatus

    try:
        t = Team.objects.get(id=object_id)
    except Team.DoesNotExist:
        return

    if t.status == TeamStatus.VISIBLE:
        raise DeleteAborted('Aborting team deletion as status is invalid')

    if t.status != TeamStatus.DELETION_IN_PROGRESS:
        pending_delete.send(sender=Team, instance=t)
        t.update(status=TeamStatus.DELETION_IN_PROGRESS)

    # Delete 1 project at a time since this is expensive by itself
    for project in Project.objects.filter(team=t).order_by('id')[:1]:
        logger.info('Removing Project id=%s where team=%s', project.id, t.id)
        project.update(status=ProjectStatus.DELETION_IN_PROGRESS)
        delete_project(project.id, continuous=False)
        if continuous:
            delete_team.delay(object_id=object_id, countdown=15)
        return

    t.delete()


@instrumented_task(name='sentry.tasks.deletion.delete_project', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry(exclude=(DeleteAborted,))
def delete_project(object_id, continuous=True, **kwargs):
    from sentry.models import (
        Activity, EventMapping, Group, GroupAssignee, GroupBookmark,
        GroupEmailThread, GroupHash, GroupMeta, GroupResolution,
        GroupRuleStatus, GroupSeen, GroupTagKey, GroupTagValue, Project,
        ProjectBookmark, ProjectKey, ProjectStatus, Release, ReleaseFile,
        SavedSearchUserDefault, SavedSearch, TagKey, TagValue, UserReport
    )

    try:
        p = Project.objects.get(id=object_id)
    except Project.DoesNotExist:
        return

    if p.status == ProjectStatus.VISIBLE:
        raise DeleteAborted('Aborting project deletion as status is invalid')

    if p.status != ProjectStatus.DELETION_IN_PROGRESS:
        pending_delete.send(sender=Project, instance=p)
        p.update(status=ProjectStatus.DELETION_IN_PROGRESS)

    # Immediately revoke keys
    ProjectKey.objects.filter(project_id=object_id).delete()

    model_list = (
        Activity, EventMapping, GroupAssignee, GroupBookmark, GroupEmailThread,
        GroupHash, GroupSeen, GroupRuleStatus, GroupTagKey, GroupTagValue,
        ProjectBookmark, ProjectKey, TagKey, TagValue, SavedSearchUserDefault,
        SavedSearch, UserReport
    )
    for model in model_list:
        has_more = bulk_delete_objects(model, project_id=p.id, logger=logger)
        if has_more:
            if continuous:
                delete_project.delay(object_id=object_id, countdown=15)
            return

    # TODO(dcramer): no project relation so we cant easily bulk
    # delete today
    has_more = delete_objects([GroupMeta, GroupResolution],
                              relation={'group__project': p},
                              logger=logger)
    if has_more:
        if continuous:
            delete_project.delay(object_id=object_id, countdown=15)
        return

    has_more = delete_events(relation={'project_id': p.id}, logger=logger)
    if has_more:
        if continuous:
            delete_project.delay(object_id=object_id, countdown=15)
        return

    # Release needs to handle deletes after Group is cleaned up as the foreign
    # key is protected
    model_list = (Group, ReleaseFile, Release)
    for model in model_list:
        has_more = bulk_delete_objects(model, project_id=p.id, logger=logger)
        if has_more:
            if continuous:
                delete_project.delay(object_id=object_id, countdown=15)
            return

    p.delete()


@instrumented_task(name='sentry.tasks.deletion.delete_group', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry(exclude=(DeleteAborted,))
def delete_group(object_id, continuous=True, **kwargs):
    from sentry.models import (
        EventMapping, Group, GroupAssignee, GroupBookmark, GroupHash, GroupMeta,
        GroupResolution, GroupRuleStatus, GroupStatus, GroupTagKey,
        GroupTagValue, GroupEmailThread, UserReport, GroupRedirect,
    )

    try:
        group = Group.objects.get(id=object_id)
    except Group.DoesNotExist:
        return

    if group.status != GroupStatus.DELETION_IN_PROGRESS:
        group.update(status=GroupStatus.DELETION_IN_PROGRESS)

    bulk_model_list = (
        # prioritize GroupHash
        GroupHash, GroupAssignee, GroupBookmark, GroupMeta, GroupResolution,
        GroupRuleStatus, GroupTagValue, GroupTagKey, EventMapping,
        GroupEmailThread, UserReport, GroupRedirect,
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
@retry(exclude=(DeleteAborted,))
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
    from sentry.models import Event, EventTag

    has_more = False
    if logger is not None:
        logger.info('Removing %r objects where %r', Event, relation)

    result_set = list(Event.objects.filter(**relation)[:limit])
    has_more = bool(result_set)
    if has_more:
        # delete objects from nodestore first
        node_ids = set(r.data.id for r in result_set)
        nodestore.delete_multi(node_ids)

        event_ids = [r.id for r in result_set]

        # bulk delete by id
        EventTag.objects.filter(event_id__in=event_ids).delete()
        Event.objects.filter(id__in=event_ids).delete()
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
