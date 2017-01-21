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

from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.deletion import delete_group

logger = logging.getLogger('sentry.merge')
delete_logger = logging.getLogger('sentry.deletions.async')


@instrumented_task(name='sentry.tasks.merge.merge_group', queue='merge',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def merge_group(from_object_id=None, to_object_id=None, transaction_id=None,
                recursed=False, **kwargs):
    # TODO(mattrobenolt): Write tests for all of this
    from sentry.models import (
        Activity, Group, GroupAssignee, GroupHash, GroupRuleStatus,
        GroupSubscription, GroupTagKey, GroupTagValue, EventMapping, Event,
        UserReport, GroupRedirect, GroupMeta,
    )

    if not (from_object_id and to_object_id):
        logger.error('group.malformed.missing_params', extra={
            'transaction_id': transaction_id,
        })
        return

    try:
        group = Group.objects.get(id=from_object_id)
    except Group.DoesNotExist:
        logger.warn('group.malformed.invalid_id', extra={
            'transaction_id': transaction_id,
            'old_object_id': from_object_id,
        })
        return

    try:
        new_group = Group.objects.get(id=to_object_id)
    except Group.DoesNotExist:
        logger.warn('group.malformed.invalid_id', extra={
            'transaction_id': transaction_id,
            'old_object_id': from_object_id,
        })
        return

    if not recursed:
        logger.info('merge.queued', extra={
            'transaction_id': transaction_id,
            'new_group_id': new_group.id,
            'old_group_id': group.id,
            'new_event_id': getattr(new_group.event_set.order_by('-id').first(), 'id', None),
            'old_event_id': getattr(group.event_set.order_by('-id').first(), 'id', None),
            'new_hash_id': getattr(new_group.grouphash_set.order_by('-id').first(), 'id', None),
            'old_hash_id': getattr(group.grouphash_set.order_by('-id').first(), 'id', None),

        })

    model_list = (
        Activity, GroupAssignee, GroupHash, GroupRuleStatus, GroupSubscription,
        GroupTagValue, GroupTagKey, EventMapping, Event, UserReport,
        GroupRedirect, GroupMeta,
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

    previous_group_id = group.id

    group.delete()
    delete_logger.info('object.delete.executed', extra={
        'object_id': previous_group_id,
        'transaction_id': transaction_id,
        'model': Group.__name__,
    })

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


@instrumented_task(name='sentry.tasks.merge.rehash_group_events', queue='merge',
                   default_retry_delay=60 * 5, max_retries=None)
@retry
def rehash_group_events(group_id, transaction_id=None, **kwargs):
    from sentry.models import Group, GroupHash

    group = Group.objects.get(id=group_id)

    # Clear out existing hashes to preempt new events being added
    # This can cause the new groups to be created before we get to them, but
    # its a tradeoff we're willing to take
    GroupHash.objects.filter(group=group).delete()
    has_more = _rehash_group_events(group)

    if has_more:
        rehash_group_events.delay(
            group_id=group.id,
            transaction_id=transaction_id,
        )
        return

    delete_logger.info('object.delete.bulk_executed', extra={
        'group_id': group.id,
        'transaction_id': transaction_id,
        'model': GroupHash.__name__,
    })

    delete_group.delay(group.id)


def _rehash_group_events(group, limit=100):
    from sentry.event_manager import (
        EventManager, get_hashes_from_fingerprint, generate_culprit,
        md5_from_hash
    )
    from sentry.models import Event, Group

    event_list = list(Event.objects.filter(group_id=group.id)[:limit])
    Event.objects.bind_nodes(event_list, 'data')

    for event in event_list:
        fingerprint = event.data.get('fingerprint', ['{{ default }}'])
        if fingerprint and not isinstance(fingerprint, (list, tuple)):
            fingerprint = [fingerprint]
        elif not fingerprint:
            fingerprint = ['{{ default }}']

        manager = EventManager({})

        group_kwargs = {
            'message': event.message,
            'platform': event.platform,
            'culprit': generate_culprit(event.data),
            'logger': event.get_tag('logger') or group.logger,
            'level': group.level,
            'last_seen': event.datetime,
            'first_seen': event.datetime,
            'data': group.data,
        }

        # XXX(dcramer): doesnt support checksums as they're not stored
        hashes = map(md5_from_hash, get_hashes_from_fingerprint(event, fingerprint))
        for hash in hashes:
            new_group, _, _, _ = manager._save_aggregate(
                event=event,
                hashes=hashes,
                release=None,
                **group_kwargs
            )
            event.update(group_id=new_group.id)
            if event.data.get('tags'):
                Group.objects.add_tags(new_group, event.data['tags'])
    return bool(event_list)


def merge_objects(models, group, new_group, limit=1000,
                  logger=None, transaction_id=None):
    from sentry.models import GroupTagKey, GroupTagValue

    has_more = False
    for model in models:
        all_fields = model._meta.get_all_field_names()
        has_group = 'group' in all_fields
        if has_group:
            queryset = model.objects.filter(group=group)
        else:
            queryset = model.objects.filter(group_id=group.id)
        for obj in queryset[:limit]:
            try:
                with transaction.atomic(using=router.db_for_write(model)):
                    if has_group:
                        model.objects.filter(
                            id=obj.id
                        ).update(group=new_group)
                    else:
                        model.objects.filter(
                            id=obj.id
                        ).update(group_id=new_group.id)
            except IntegrityError:
                delete = True
            else:
                delete = False

            if delete:
                # Before deleting, we want to merge in counts
                try:
                    if model == GroupTagKey:
                        with transaction.atomic(using=router.db_for_write(model)):
                            model.objects.filter(
                                group=new_group,
                                key=obj.key,
                            ).update(
                                values_seen=GroupTagValue.objects.filter(
                                    group=new_group,
                                    key=obj.key,
                                ).count()
                            )
                    elif model == GroupTagValue:
                        with transaction.atomic(using=router.db_for_write(model)):
                            model.objects.filter(
                                group=new_group,
                                key=obj.key,
                                value=obj.value,
                            ).update(times_seen=F('times_seen') + obj.times_seen)
                except DataError:
                    # it's possible to hit an out of range value for counters
                    pass
                obj_id = obj.id
                obj.delete()
                if logger is not None:
                    delete_logger.debug('object.delete.executed', extra={
                        'object_id': obj_id,
                        'transaction_id': transaction_id,
                        'model': model.__name__,
                    })
            has_more = True

        if has_more:
            return True
    return has_more
