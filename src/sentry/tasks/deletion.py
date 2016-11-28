"""
sentry.tasks.deletion
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.db.models import get_model

from sentry.constants import ObjectStatus
from sentry.exceptions import DeleteAborted
from sentry.signals import pending_delete
from sentry.tasks.base import instrumented_task, retry
from sentry.utils.query import bulk_delete_objects

logger = logging.getLogger('sentry.deletions.async')


@instrumented_task(name='sentry.tasks.deletion.delete_organization', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry(exclude=(DeleteAborted,))
def delete_organization(object_id, transaction_id=None, continuous=True, **kwargs):
    from sentry.models import (
        Organization, OrganizationMember, OrganizationStatus, Team, TeamStatus,
        Commit, CommitAuthor, CommitFileChange, Repository
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
        team.update(status=TeamStatus.DELETION_IN_PROGRESS)
        delete_team(team.id, transaction_id=transaction_id, continuous=False)
        if continuous:
            delete_organization.apply_async(
                kwargs={'object_id': object_id, 'transaction_id': transaction_id},
                countdown=15,
            )
        return

    model_list = (
        OrganizationMember, CommitFileChange, Commit, CommitAuthor, Repository,
    )

    has_more = delete_objects(
        model_list,
        transaction_id=transaction_id,
        relation={'organization_id': o.id},
        logger=logger,
    )
    if has_more:
        if continuous:
            delete_organization.apply_async(
                kwargs={'object_id': object_id, 'transaction_id': transaction_id},
                countdown=15,
            )
        return
    o_id = o.id
    o.delete()
    logger.info('object.delete.executed', extra={
        'object_id': o_id,
        'transaction_id': transaction_id,
        'model': Organization.__name__,
    })


@instrumented_task(name='sentry.tasks.deletion.delete_team', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry(exclude=(DeleteAborted,))
def delete_team(object_id, transaction_id=None, continuous=True, **kwargs):
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
        project.update(status=ProjectStatus.DELETION_IN_PROGRESS)
        delete_project(project.id, transaction_id=transaction_id, continuous=False)
        if continuous:
            delete_team.apply_async(
                kwargs={'object_id': object_id, 'transaction_id': transaction_id},
                countdown=15,
            )
        return

    t_id = t.id
    t.delete()
    logger.info('object.delete.executed', extra={
        'object_id': t_id,
        'transaction_id': transaction_id,
        'model': Team.__name__,
    })


@instrumented_task(name='sentry.tasks.deletion.delete_project', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry(exclude=(DeleteAborted,))
def delete_project(object_id, transaction_id=None, continuous=True, **kwargs):
    from sentry.models import (
        Activity, EventMapping, EventUser, Group, GroupAssignee, GroupBookmark,
        GroupEmailThread, GroupHash, GroupMeta, GroupRelease, GroupResolution,
        GroupRuleStatus, GroupSeen, GroupSubscription, GroupSnooze, GroupTagKey,
        GroupTagValue, Project, ProjectBookmark, ProjectKey, ProjectStatus,
        Release, ReleaseFile, SavedSearchUserDefault, SavedSearch, TagKey,
        TagValue, UserReport, ReleaseEnvironment, Environment, ReleaseCommit
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
    project_keys = list(ProjectKey.objects.filter(project_id=object_id).values_list('id', flat=True))
    ProjectKey.objects.filter(project_id=object_id).delete()
    for key_id in project_keys:
        logger.info('object.delete.executed', extra={
            'object_id': key_id,
            'transaction_id': transaction_id,
            'model': ProjectKey.__name__,
        })

    model_list = (
        Activity, EventMapping, EventUser, GroupAssignee, GroupBookmark,
        GroupEmailThread, GroupHash, GroupRelease, GroupRuleStatus, GroupSeen,
        GroupSubscription, GroupTagKey, GroupTagValue, ProjectBookmark,
        ProjectKey, TagKey, TagValue, SavedSearchUserDefault, SavedSearch,
        UserReport, ReleaseEnvironment, Environment, ReleaseCommit
    )
    for model in model_list:
        has_more = bulk_delete_objects(model, project_id=p.id, transaction_id=transaction_id, logger=logger)
        if has_more:
            if continuous:
                delete_project.apply_async(
                    kwargs={'object_id': object_id, 'transaction_id': transaction_id},
                    countdown=15,
                )
            return

    # TODO(dcramer): no project relation so we cant easily bulk
    # delete today
    has_more = delete_objects([GroupMeta, GroupResolution, GroupSnooze],
                              relation={'group__project': p},
                              transaction_id=transaction_id,
                              logger=logger)
    if has_more:
        if continuous:
            delete_project.apply_async(
                kwargs={'object_id': object_id, 'transaction_id': transaction_id},
                countdown=15,
            )
        return

    has_more = delete_events(relation={'project_id': p.id}, transaction_id=transaction_id, logger=logger)
    if has_more:
        if continuous:
            delete_project.apply_async(
                kwargs={'object_id': object_id, 'transaction_id': transaction_id},
            )
        return

    # Release needs to handle deletes after Group is cleaned up as the foreign
    # key is protected
    model_list = (Group, ReleaseFile, Release)
    for model in model_list:
        has_more = bulk_delete_objects(model, project_id=p.id, transaction_id=transaction_id, logger=logger)
        if has_more:
            if continuous:
                delete_project.apply_async(
                    kwargs={'object_id': object_id, 'transaction_id': transaction_id},
                    countdown=15,
                )
            return

    p_id = p.id
    p.delete()
    logger.info('object.delete.queued', extra={
        'object_id': p_id,
        'transaction_id': transaction_id,
        'model': Project.__name__,
    })


@instrumented_task(name='sentry.tasks.deletion.delete_group', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry(exclude=(DeleteAborted,))
def delete_group(object_id, transaction_id=None, continuous=True, **kwargs):
    from sentry.models import (
        EventMapping, Group, GroupAssignee, GroupBookmark, GroupHash, GroupMeta,
        GroupRelease, GroupResolution, GroupRuleStatus, GroupSnooze,
        GroupSubscription, GroupStatus, GroupTagKey, GroupTagValue,
        GroupEmailThread, GroupRedirect, UserReport
    )

    try:
        group = Group.objects.get(id=object_id)
    except Group.DoesNotExist:
        return

    if group.status != GroupStatus.DELETION_IN_PROGRESS:
        group.update(status=GroupStatus.DELETION_IN_PROGRESS)

    bulk_model_list = (
        # prioritize GroupHash
        GroupHash, GroupAssignee, GroupBookmark, GroupMeta, GroupRelease,
        GroupResolution, GroupRuleStatus, GroupSnooze, GroupTagValue,
        GroupTagKey, EventMapping, GroupEmailThread, UserReport, GroupRedirect,
        GroupSubscription,
    )
    for model in bulk_model_list:
        has_more = bulk_delete_objects(model, group_id=object_id, logger=logger)
        if has_more:
            if continuous:
                delete_group.apply_async(
                    kwargs={'object_id': object_id, 'transaction_id': transaction_id},
                    countdown=15,
                )
            return

    has_more = delete_events(relation={'group_id': object_id}, logger=logger)
    if has_more:
        if continuous:
            delete_group.apply_async(
                kwargs={'object_id': object_id, 'transaction_id': transaction_id},
            )
        return
    g_id = group.id
    group.delete()
    logger.info('object.delete.queued', extra={
        'object_id': g_id,
        'transaction_id': transaction_id,
        'model': Group.__name__,
    })


@instrumented_task(name='sentry.tasks.deletion.delete_tag_key', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry(exclude=(DeleteAborted,))
def delete_tag_key(object_id, transaction_id=None, continuous=True, **kwargs):
    from sentry.models import (
        EventTag, GroupTagKey, GroupTagValue, TagKey, TagKeyStatus, TagValue
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
                delete_tag_key.apply_async(
                    kwargs={'object_id': object_id, 'transaction_id': transaction_id},
                    countdown=15,
                )
            return

    has_more = bulk_delete_objects(EventTag, project_id=tagkey.project_id,
                                   key_id=tagkey.id, logger=logger)
    if has_more:
        if continuous:
            delete_tag_key.apply_async(
                kwargs={'object_id': object_id, 'transaction_id': transaction_id},
                countdown=15,
            )
        return

    tagkey_id = tagkey.id
    tagkey.delete()
    logger.info('object.delete.executed', extra={
        'object_id': tagkey_id,
        'transaction_id': transaction_id,
        'model': TagKey.__name__,
    })


@instrumented_task(name='sentry.tasks.deletion.generic_delete', queue='cleanup',
                   default_retry_delay=60 * 5, max_retries=None)
@retry(exclude=(DeleteAborted,))
def generic_delete(app_label, model_name, object_id, transaction_id=None,
                   continuous=True, actor_id=None, **kwargs):
    from sentry.models import User

    model = get_model(app_label, model_name)

    try:
        instance = model.objects.get(id=object_id)
    except model.DoesNotExist:
        return

    if instance.status == ObjectStatus.VISIBLE:
        raise DeleteAborted

    if instance.status == ObjectStatus.PENDING_DELETION:
        if actor_id:
            actor = User.objects.get(id=actor_id)
        else:
            actor = None
        instance.update(status=ObjectStatus.DELETION_IN_PROGRESS)
        pending_delete.send(sender=model, instance=instance, actor=actor)

    # TODO(dcramer): it'd be nice if we could collect relations here and
    # cascade efficiently
    instance_id = instance.id
    instance.delete()
    logger.info('object.delete.executed', extra={
        'object_id': instance_id,
        'transaction_id': transaction_id,
        'model': model.__name__,
    })


def delete_events(relation, transaction_id=None, limit=10000, chunk_limit=100, logger=None):
    from sentry.app import nodestore
    from sentry.models import Event, EventTag

    while limit > 0:
        result_set = list(Event.objects.filter(**relation)[:chunk_limit])
        if not bool(result_set):
            return False

        # delete objects from nodestore first
        node_ids = set(r.data.id for r in result_set if r.data.id)
        if node_ids:
            nodestore.delete_multi(node_ids)

        event_ids = [r.id for r in result_set]

        # bulk delete by id
        EventTag.objects.filter(event_id__in=event_ids).delete()
        if logger is not None:
            # The only reason this is a different log statement is that logging every
            # single event that gets deleted in the relation will destroy disks.
            logger.info('object.delete.bulk_executed', extra=dict(
                relation.items() + [
                    ('transaction_id', transaction_id),
                    ('model', 'EventTag'),
                ],
            ))

        # bulk delete by id
        Event.objects.filter(id__in=event_ids).delete()
        if logger is not None:
            # The only reason this is a different log statement is that logging every
            # single event that gets deleted in the relation will destroy disks.
            logger.info('object.delete.bulk_executed', extra=dict(
                relation.items() + [
                    ('transaction_id', transaction_id),
                    ('model', 'Event'),
                ],
            ))

        limit -= chunk_limit

    return True


def delete_objects(models, relation, transaction_id=None, limit=100, logger=None):
    # This handles cascades properly
    has_more = False
    for model in models:
        for obj in model.objects.filter(**relation)[:limit]:
            obj_id = obj.id
            model_name = type(obj).__name__
            obj.delete()
            if logger is not None:
                logger.info('object.delete.executed', extra={
                    'object_id': obj_id,
                    'transaction_id': transaction_id,
                    'model': model_name,
                })
            has_more = True

        if has_more:
            return True
    return has_more
