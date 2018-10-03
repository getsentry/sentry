"""
sentry.tasks.merge
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.db import DataError, IntegrityError, router, transaction
from django.db.models import F

from sentry import eventstream
from sentry.app import tsdb
from sentry.similarity import features
from sentry.tasks.base import instrumented_task

logger = logging.getLogger('sentry.merge')
delete_logger = logging.getLogger('sentry.deletions.async')


EXTRA_MERGE_MODELS = []


@instrumented_task(
    name='sentry.tasks.merge.merge_group',
    queue='merge',
    default_retry_delay=60 * 5,
    max_retries=None
)
def merge_group(
    from_object_id=None, to_object_id=None, transaction_id=None, recursed=False, **kwargs
):
    # TODO(mattrobenolt): Write tests for all of this
    from sentry.models import (
        Activity,
        Group,
        GroupAssignee,
        GroupEnvironment,
        GroupHash,
        GroupRuleStatus,
        GroupSubscription,
        Environment,
        EventMapping,
        Event,
        UserReport,
        GroupRedirect,
        GroupMeta,
    )

    if not (from_object_id and to_object_id):
        logger.error(
            'group.malformed.missing_params', extra={
                'transaction_id': transaction_id,
            }
        )
        return

    try:
        group = Group.objects.get(id=from_object_id)
    except Group.DoesNotExist:
        logger.warn(
            'group.malformed.invalid_id',
            extra={
                'transaction_id': transaction_id,
                'old_object_id': from_object_id,
            }
        )
        return

    try:
        new_group = Group.objects.get(id=to_object_id)
    except Group.DoesNotExist:
        logger.warn(
            'group.malformed.invalid_id',
            extra={
                'transaction_id': transaction_id,
                'old_object_id': from_object_id,
            }
        )
        return

    if not recursed:
        logger.info(
            'merge.queued',
            extra={
                'transaction_id': transaction_id,
                'new_group_id': new_group.id,
                'old_group_id': group.id,
                # TODO(jtcunning): figure out why these are full seq scans and/or alternative solution
                # 'new_event_id': getattr(new_group.event_set.order_by('-id').first(), 'id', None),
                # 'old_event_id': getattr(group.event_set.order_by('-id').first(), 'id', None),
                # 'new_hash_id': getattr(new_group.grouphash_set.order_by('-id').first(), 'id', None),
                # 'old_hash_id': getattr(group.grouphash_set.order_by('-id').first(), 'id', None),
            }
        )

    model_list = tuple(EXTRA_MERGE_MODELS) + (
        Activity, GroupAssignee, GroupEnvironment, GroupHash, GroupRuleStatus,
        GroupSubscription, EventMapping, Event, UserReport, GroupRedirect,
        GroupMeta,
    )

    has_more = merge_objects(
        model_list,
        group,
        new_group,
        logger=logger,
        transaction_id=transaction_id,
    )

    if has_more:
        merge_group.delay(
            from_object_id=from_object_id,
            to_object_id=to_object_id,
            transaction_id=transaction_id,
            recursed=True,
        )
        return

    features.merge(new_group, [group], allow_unsafe=True)

    environment_ids = list(
        Environment.objects.filter(
            projects=group.project
        ).values_list('id', flat=True)
    )

    for model in [tsdb.models.group]:
        tsdb.merge(
            model,
            new_group.id,
            [group.id],
            environment_ids=environment_ids if model in tsdb.models_with_environment_support else None
        )

    for model in [tsdb.models.users_affected_by_group]:
        tsdb.merge_distinct_counts(
            model,
            new_group.id,
            [group.id],
            environment_ids=environment_ids if model in tsdb.models_with_environment_support else None,
        )

    for model in [
        tsdb.models.frequent_releases_by_group, tsdb.models.frequent_environments_by_group
    ]:
        tsdb.merge_frequencies(
            model,
            new_group.id,
            [group.id],
            environment_ids=environment_ids if model in tsdb.models_with_environment_support else None,
        )

    previous_group_id = group.id

    group.delete()
    delete_logger.info(
        'object.delete.executed',
        extra={
            'object_id': previous_group_id,
            'transaction_id': transaction_id,
            'model': Group.__name__,
        }
    )

    try:
        with transaction.atomic():
            GroupRedirect.objects.create(
                group_id=new_group.id,
                previous_group_id=previous_group_id,
            )
    except IntegrityError:
        pass

    new_group.update(
        # TODO(dcramer): ideally these would be SQL clauses
        first_seen=min(group.first_seen, new_group.first_seen),
        last_seen=max(group.last_seen, new_group.last_seen),
    )
    try:
        # it's possible to hit an out of range value for counters
        new_group.update(
            times_seen=F('times_seen') + group.times_seen,
            num_comments=F('num_comments') + group.num_comments,
        )
    except DataError:
        pass

    eventstream.merge(group.project_id, previous_group_id, new_group.id)


def _get_event_environment(event, project, cache):
    from sentry.models import Environment

    environment_name = event.get_tag('environment')

    if environment_name not in cache:
        try:
            environment = Environment.get_for_organization_id(
                project.organization_id, environment_name)
        except Environment.DoesNotExist:
            logger.warn(
                'event.environment.does_not_exist',
                extra={
                    'project_id': project.id,
                    'environment_name': environment_name,
                }
            )
            environment = Environment.get_or_create(project, environment_name)

        cache[environment_name] = environment

    return cache[environment_name]


def merge_objects(models, group, new_group, limit=1000, logger=None, transaction_id=None):
    has_more = False
    for model in models:
        all_fields = model._meta.get_all_field_names()

        # not all models have a 'project' or 'project_id' field, but we make a best effort
        # to filter on one if it is available
        has_project = 'project_id' in all_fields or 'project' in all_fields
        if has_project:
            project_qs = model.objects.filter(project_id=group.project_id)
        else:
            project_qs = model.objects.all()

        has_group = 'group' in all_fields
        if has_group:
            queryset = project_qs.filter(group=group)
        else:
            queryset = project_qs.filter(group_id=group.id)

        for obj in queryset[:limit]:
            try:
                with transaction.atomic(using=router.db_for_write(model)):
                    if has_group:
                        project_qs.filter(id=obj.id).update(group=new_group)
                    else:
                        project_qs.filter(id=obj.id).update(group_id=new_group.id)
            except IntegrityError:
                delete = True
            else:
                delete = False

            if delete:
                # Before deleting, we want to merge in counts
                if hasattr(model, 'merge_counts'):
                    obj.merge_counts(new_group)

                obj_id = obj.id
                obj.delete()

                if logger is not None:
                    delete_logger.debug(
                        'object.delete.executed',
                        extra={
                            'object_id': obj_id,
                            'transaction_id': transaction_id,
                            'model': model.__name__,
                        }
                    )
            has_more = True

        if has_more:
            return True
    return has_more
