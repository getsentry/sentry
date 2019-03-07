"""
sentry.tagstore.legacy.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import collections
import six

from collections import defaultdict
from datetime import timedelta
from django.db import connections, router, IntegrityError, transaction
from django.db.models import Q, Sum
from django.utils import timezone
from operator import or_
from six.moves import reduce

from sentry import buffer
from sentry.tagstore import TagKeyStatus
from sentry.tagstore.base import TagStorage, TOP_VALUES_DEFAULT_LIMIT
from sentry.utils import db

from . import models
from sentry.tagstore.types import TagKey, TagValue, GroupTagKey, GroupTagValue
from sentry.tasks.post_process import index_event_tags


transformers = {
    models.TagKey: lambda instance: TagKey(
        key=instance.key,
        values_seen=instance.values_seen,
        status=instance.status,
    ),
    models.TagValue: lambda instance: TagValue(
        key=instance.key,
        value=instance.value,
        times_seen=instance.times_seen,
        first_seen=instance.first_seen,
        last_seen=instance.last_seen,
    ),
    models.GroupTagKey: lambda instance: GroupTagKey(
        group_id=instance.group_id,
        key=instance.key,
        values_seen=instance.values_seen,
    ),
    models.GroupTagValue: lambda instance: GroupTagValue(
        group_id=instance.group_id,
        key=instance.key,
        value=instance.value,
        times_seen=instance.times_seen,
        first_seen=instance.first_seen,
        last_seen=instance.last_seen,
    ),
}


class LegacyTagStorage(TagStorage):
    """\
    The legacy tagstore backend ignores the ``environment_id`` (because it doesn't store this information
    in its models) and stores ``times_seen`` and ``values_seen`` in Postgres.
    """

    def setup(self):
        self.setup_deletions()

        self.setup_cleanup()

        self.setup_merge(
            grouptagkey_model=models.GroupTagKey,
            grouptagvalue_model=models.GroupTagValue,
        )

        self.setup_receivers()

    def setup_cleanup(self):
        from sentry.runner.commands import cleanup

        cleanup.EXTRA_BULK_QUERY_DELETES += [
            (models.GroupTagValue, 'last_seen', None),
            (models.TagValue, 'last_seen', None),
            (models.EventTag, 'date_added', 'date_added', 50000),
        ]

    def setup_deletions(self):
        from sentry.deletions import default_manager as deletion_manager
        from sentry.deletions.defaults import BulkModelDeletionTask, ModelDeletionTask
        from sentry.deletions.base import ModelRelation
        from sentry.models import Event, Group, Project

        deletion_manager.add_bulk_dependencies(Event, [
            lambda instance_list: ModelRelation(models.EventTag,
                                                {'event_id__in': [i.id for i in instance_list]},
                                                ModelDeletionTask),
        ])

        deletion_manager.register(models.TagValue, BulkModelDeletionTask)
        deletion_manager.register(models.GroupTagKey, BulkModelDeletionTask)
        deletion_manager.register(models.GroupTagValue, BulkModelDeletionTask)
        deletion_manager.register(models.EventTag, BulkModelDeletionTask)

        deletion_manager.add_dependencies(Group, [
            lambda instance: ModelRelation(
                models.EventTag,
                query={
                    'group_id': instance.id,
                }),
            lambda instance: ModelRelation(
                models.GroupTagKey,
                query={
                    'group_id': instance.id,
                }),
            lambda instance: ModelRelation(
                models.GroupTagValue,
                query={
                    'group_id': instance.id,
                }),
        ])

        deletion_manager.add_dependencies(Project, [
            lambda instance: ModelRelation(models.TagKey,
                                           query={'project_id': instance.id}),
            lambda instance: ModelRelation(models.TagValue,
                                           query={'project_id': instance.id}),
            lambda instance: ModelRelation(models.GroupTagKey,
                                           query={'project_id': instance.id}),
            lambda instance: ModelRelation(models.GroupTagValue,
                                           query={'project_id': instance.id}),
        ])

        class TagKeyDeletionTask(ModelDeletionTask):
            def get_child_relations(self, instance):
                # in bulk
                model_list = (models.GroupTagValue, models.GroupTagKey, models.TagValue)
                relations = [
                    ModelRelation(m, {
                        'project_id': instance.project_id,
                        'key': instance.key,
                    }) for m in model_list
                ]
                return relations

            def mark_deletion_in_progress(self, instance_list):
                for instance in instance_list:
                    if instance.status != TagKeyStatus.DELETION_IN_PROGRESS:
                        instance.update(status=TagKeyStatus.DELETION_IN_PROGRESS)

        deletion_manager.register(models.TagKey, TagKeyDeletionTask)

    def setup_receivers(self):
        from sentry.signals import buffer_incr_complete

        # Legacy tag write flow:
        #
        # event_manager calls index_event_tags:
        #   for tag in event:
        #       get_or_create_tag_key
        #       get_or_create_tag_value
        #   create_event_tags
        #
        # event_manager calls Group.objects.add_tags:
        #   for tag in event:
        #       incr_tag_value_times_seen:
        #           (async) buffer.incr(TagValue):
        #                create_or_update(TagValue)
        #                buffer_incr_complete.send_robust(TagValue):
        #                   record_project_tag_count(TagValue)
        #                   if created(TagValue):
        #                       incr_tag_key_values_seen:
        #                           (async) buffer.incr(TagKey):
        #                               create_or_update(TagKey)
        #       incr_group_tag_value_times_seen:
        #           (async) buffer.incr(GroupTagValue):
        #                create_or_update(GroupTagValue)
        #                buffer_incr_complete.send_robust(GroupTagValue)
        #                   record_project_tag_count(GroupTagValue)
        #                   if created(GroupTagValue):
        #                       incr_group_tag_key_values_seen:
        #                           (async) buffer.incr(GroupTagKey):
        #                               create_or_update(GroupTagKey)

        @buffer_incr_complete.connect(sender=models.TagValue, weak=False)
        def record_project_tag_count(filters, created, **kwargs):
            if not created:
                return

            project_id = filters['project_id']
            key = filters['key']

            buffer.incr(models.TagKey,
                        columns={
                            'values_seen': 1,
                        },
                        filters={
                            'project_id': project_id,
                            'key': key,
                        })

        @buffer_incr_complete.connect(sender=models.GroupTagValue, weak=False)
        def record_group_tag_count(filters, created, extra, **kwargs):
            if not created:
                return

            project_id = extra['project_id']
            group_id = filters['group_id']
            key = filters['key']

            buffer.incr(models.GroupTagKey,
                        columns={
                            'values_seen': 1,
                        },
                        filters={
                            'project_id': project_id,
                            'group_id': group_id,
                            'key': key,
                        })

    def create_tag_key(self, project_id, environment_id, key, **kwargs):
        return models.TagKey.objects.create(project_id=project_id, key=key, **kwargs)

    def get_or_create_tag_key(self, project_id, environment_id, key, **kwargs):
        return models.TagKey.objects.get_or_create(project_id=project_id, key=key, **kwargs)

    def create_tag_value(self, project_id, environment_id, key, value, **kwargs):
        return models.TagValue.objects.create(project_id=project_id, key=key, value=value, **kwargs)

    def get_or_create_tag_value(self, project_id, environment_id,
                                key, value, key_id=None, **kwargs):
        return models.TagValue.objects.get_or_create(
            project_id=project_id, key=key, value=value, **kwargs)

    def create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        return models.GroupTagKey.objects.create(project_id=project_id, group_id=group_id,
                                                 key=key, **kwargs)

    def get_or_create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        return models.GroupTagKey.objects.get_or_create(project_id=project_id, group_id=group_id,
                                                        key=key, **kwargs)

    def create_group_tag_value(self, project_id, group_id, environment_id, key, value, **kwargs):
        return models.GroupTagValue.objects.create(
            project_id=project_id, group_id=group_id, key=key, value=value, **kwargs)

    def get_or_create_group_tag_value(self, project_id, group_id,
                                      environment_id, key, value, **kwargs):
        return models.GroupTagValue.objects.get_or_create(
            project_id=project_id, group_id=group_id, key=key, value=value, **kwargs)

    def create_event_tags(self, project_id, group_id, environment_id,
                          event_id, tags, date_added=None):
        if date_added is None:
            date_added = timezone.now()

        tag_ids = []
        for key, value in tags:
            tagkey, _ = self.get_or_create_tag_key(project_id, environment_id, key)
            tagvalue, _ = self.get_or_create_tag_value(
                project_id, environment_id, key, value)
            tag_ids.append((tagkey.id, tagvalue.id))

        try:
            # don't let a duplicate break the outer transaction
            with transaction.atomic():
                # Tags are bulk inserted because this is an all-or-nothing situation.
                # Either the whole transaction works, or it doesn't. There's no value
                # in a partial success where we'd need to replay half of the rows.
                models.EventTag.objects.bulk_create([
                    models.EventTag(
                        project_id=project_id,
                        group_id=group_id,
                        event_id=event_id,
                        key_id=key_id,
                        value_id=value_id,
                        date_added=date_added,
                    )
                    for key_id, value_id in tag_ids
                ])
        except IntegrityError:
            pass

    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE):
        from sentry.tagstore.exceptions import TagKeyNotFound

        qs = models.TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        if status is not None:
            qs = qs.filter(status=status)

        try:
            instance = qs.get()
        except models.TagKey.DoesNotExist:
            raise TagKeyNotFound

        return transformers[models.TagKey](instance)

    def get_tag_keys(
        self, project_id, environment_id, status=TagKeyStatus.VISIBLE,
        include_values_seen=False,
    ):
        qs = models.TagKey.objects.filter(project_id=project_id)

        if status is not None:
            qs = qs.filter(status=status)

        return set(map(transformers[models.TagKey], qs))

    def get_tag_value(self, project_id, environment_id, key, value):
        from sentry.tagstore.exceptions import TagValueNotFound

        try:
            instance = models.TagValue.objects.get(
                project_id=project_id,
                key=key,
                value=value
            )
        except models.TagValue.DoesNotExist:
            raise TagValueNotFound

        return transformers[models.TagValue](instance)

    def get_tag_values(self, project_id, environment_id, key):
        qs = models.TagValue.objects.filter(
            project_id=project_id,
            key=key,
        )

        return set(map(transformers[models.TagValue], qs))

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        from sentry.tagstore.exceptions import GroupTagKeyNotFound

        try:
            instance = models.GroupTagKey.objects.get(
                group_id=group_id,
                key=key,
            )
        except models.GroupTagKey.DoesNotExist:
            raise GroupTagKeyNotFound

        return transformers[models.GroupTagKey](instance)

    def get_group_tag_keys(self, project_id, group_id, environment_ids, limit=None, keys=None):
        qs = models.GroupTagKey.objects.filter(group_id=group_id)

        if keys is not None:
            qs = qs.filter(key__in=keys)

        if limit is not None:
            qs = qs[:limit]

        return set(map(transformers[models.GroupTagKey], qs))

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        from sentry.tagstore.exceptions import GroupTagValueNotFound

        value = self.get_group_list_tag_value(
            [project_id],
            [group_id],
            [environment_id] if environment_id is not None else environment_id,
            key,
            value,
        ).get(group_id)

        if value is None:
            raise GroupTagValueNotFound

        return value

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        qs = models.GroupTagValue.objects.filter(
            group_id=group_id,
            key=key,
        )

        return set(map(transformers[models.GroupTagValue], qs))

    def get_group_list_tag_value(self, project_ids, group_id_list, environment_ids, key, value):
        qs = models.GroupTagValue.objects.filter(
            group_id__in=group_id_list,
            key=key,
            value=value,
        )
        t = transformers[models.GroupTagValue]
        return {result.group_id: t(result) for result in qs}

    def delete_tag_key(self, project_id, key):
        from sentry.tagstore.tasks import delete_tag_key as delete_tag_key_task

        tagkeys_qs = models.TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        deleted = []
        for tagkey in tagkeys_qs:
            updated = models.TagKey.objects.filter(
                id=tagkey.id,
                status=TagKeyStatus.VISIBLE,
            ).update(status=TagKeyStatus.PENDING_DELETION)

            if updated:
                delete_tag_key_task.delay(object_id=tagkey.id, model=models.TagKey)
                deleted.append(tagkey)

        return deleted

    def delete_all_group_tag_keys(self, project_id, group_id):
        models.GroupTagKey.objects.filter(
            group_id=group_id,
        ).delete()

    def delete_all_group_tag_values(self, project_id, group_id):
        models.GroupTagValue.objects.filter(
            group_id=group_id,
        ).delete()

    def incr_tag_value_times_seen(self, project_id, environment_id,
                                  key, value, extra=None, count=1):
        buffer.incr(models.TagValue,
                    columns={
                        'times_seen': count,
                    },
                    filters={
                        'project_id': project_id,
                        'key': key,
                        'value': value,
                    },
                    extra=extra)

    def incr_group_tag_value_times_seen(self, project_id, group_id, environment_id,
                                        key, value, extra=None, count=1):
        buffer.incr(models.GroupTagValue,
                    columns={
                        'times_seen': count,
                    },
                    filters={
                        'group_id': group_id,
                        'key': key,
                        'value': value,
                    },
                    extra=extra)

    def get_group_event_filter(self, project_id, group_id, environment_ids, tags, start, end):
        tagkeys = dict(
            models.TagKey.objects.filter(
                project_id=project_id,
                key__in=tags.keys(),
                status=TagKeyStatus.VISIBLE,
            ).values_list('key', 'id')
        )

        tagvalues = {
            (t[1], t[2]): t[0]
            for t in models.TagValue.objects.filter(
                reduce(or_, (Q(key=k, value=v)
                             for k, v in six.iteritems(tags))),
                project_id=project_id,
            ).values_list('id', 'key', 'value')
        }

        try:
            tag_lookups = [(tagkeys[k], tagvalues[(k, v)])
                           for k, v in six.iteritems(tags)]
            # [(1, 10), ...]
        except KeyError:
            # one or more tags were invalid, thus the result should be an empty
            # set
            return None

        # Django doesnt support union, so we limit results and try to find
        # reasonable matches

        # get initial matches to start the filter
        k, v = tag_lookups.pop()
        matches = list(
            models.EventTag.objects.filter(
                key_id=k,
                value_id=v,
                group_id=group_id,
            ).values_list('event_id', flat=True)[:1000]
        )

        # for each remaining tag, find matches contained in our
        # existing set, pruning it down each iteration
        for k, v in tag_lookups:
            matches = list(
                models.EventTag.objects.filter(
                    key_id=k,
                    value_id=v,
                    event_id__in=matches,
                    group_id=group_id,
                ).values_list('event_id', flat=True)[:1000]
            )
            if not matches:
                return None

        return {'id__in': set(matches)}

    def get_groups_user_counts(self, project_ids, group_ids, environment_ids, start=None, end=None):
        # only the snuba backend supports multi project
        if len(project_ids) > 1:
            raise NotImplementedError

        qs = models.GroupTagKey.objects.filter(
            project_id=project_ids[0],
            group_id__in=group_ids,
            key='sentry:user'
        )

        return defaultdict(int, qs.values_list('group_id', 'values_seen'))

    def get_group_tag_value_count(self, project_id, group_id, environment_id, key):
        if db.is_postgres():
            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            using = router.db_for_read(models.GroupTagValue)
            cursor = connections[using].cursor()
            cursor.execute(
                """
                SELECT SUM(t)
                FROM (
                    SELECT times_seen as t
                    FROM sentry_messagefiltervalue
                    WHERE group_id = %s
                    AND key = %s
                    ORDER BY last_seen DESC
                    LIMIT 10000
                ) as a
            """, [group_id, key]
            )
            return cursor.fetchone()[0] or 0

        cutoff = timezone.now() - timedelta(days=7)
        return models.GroupTagValue.objects.filter(
            group_id=group_id,
            key=key,
            last_seen__gte=cutoff,
        ).aggregate(t=Sum('times_seen'))['t']

    def get_top_group_tag_values(self, project_id, group_id,
                                 environment_id, key, limit=TOP_VALUES_DEFAULT_LIMIT):
        if db.is_postgres():
            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            return list(
                map(
                    transformers[models.GroupTagValue],
                    models.GroupTagValue.objects.raw(
                        """
                        SELECT *
                        FROM (
                            SELECT *
                            FROM sentry_messagefiltervalue
                            WHERE group_id = %%s
                            AND key = %%s
                            ORDER BY last_seen DESC
                            LIMIT 10000
                        ) as a
                        ORDER BY times_seen DESC
                        LIMIT %d
                        """ % limit, [group_id, key]
                    )
                )
            )

        cutoff = timezone.now() - timedelta(days=7)
        return list(
            map(
                transformers[models.GroupTagValue],
                models.GroupTagValue.objects.filter(
                    group_id=group_id,
                    key=key,
                    last_seen__gte=cutoff,
                ).order_by('-times_seen')[:limit]
            )
        )

    def get_first_release(self, project_id, group_id):
        try:
            first_release = models.GroupTagValue.objects.filter(
                project_id=project_id,
                group_id=group_id,
                key__in=('sentry:release', 'release'),
            ).order_by('first_seen')[0]
        except IndexError:
            return None
        else:
            return first_release.value

    def get_last_release(self, project_id, group_id):
        try:
            last_release = models.GroupTagValue.objects.filter(
                project_id=project_id,
                group_id=group_id,
                key__in=('sentry:release', 'release'),
            ).order_by('-last_seen')[0]
        except IndexError:
            return None

        return last_release.value

    def get_release_tags(self, project_ids, environment_id, versions):
        return set(
            map(
                transformers[models.TagValue],
                models.TagValue.objects.filter(
                    project_id__in=project_ids,
                    key='sentry:release',
                    value__in=versions,
                ),
            )
        )

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        return set(
            models.GroupTagValue.objects.filter(
                key='sentry:user',
                value__in=[eu.tag_value for eu in event_users],
                project_id__in=project_ids,
            ).order_by('-last_seen').values_list('group_id', flat=True)[:limit]
        )

    def get_group_tag_values_for_users(self, event_users, limit=100):
        tag_filters = [Q(value=eu.tag_value, project_id=eu.project_id) for eu in event_users]
        return list(
            map(
                transformers[models.GroupTagValue],
                models.GroupTagValue.objects.filter(
                    reduce(or_, tag_filters),
                    key='sentry:user',
                ).order_by('-last_seen')[:limit],
            )
        )

    def get_group_ids_for_search_filter(
            self, project_id, environment_id, tags, candidates=None, limit=1000):

        from sentry.search.base import ANY
        # Django doesnt support union, so we limit results and try to find
        # reasonable matches

        # ANY matches should come last since they're the least specific and
        # will provide the largest range of matches
        tag_lookups = sorted(six.iteritems(tags), key=lambda k_v: k_v[1] == ANY)

        # get initial matches to start the filter
        matches = candidates or []

        # for each remaining tag, find matches contained in our
        # existing set, pruning it down each iteration
        for k, v in tag_lookups:
            if v != ANY:
                base_qs = models.GroupTagValue.objects.filter(
                    key=k,
                    value=v,
                    project_id=project_id,
                )

            else:
                base_qs = models.GroupTagValue.objects.filter(
                    key=k,
                    project_id=project_id,
                ).distinct()

            if matches:
                base_qs = base_qs.filter(group_id__in=matches)
            else:
                # restrict matches to only the most recently seen issues
                base_qs = base_qs.order_by('-last_seen')

            matches = list(base_qs.values_list('group_id', flat=True)[:limit])

            if not matches:
                return []

        return set(matches)

    def update_group_tag_key_values_seen(self, project_id, group_ids):
        gtk_qs = models.GroupTagKey.objects.filter(
            project_id=project_id,
            group_id__in=group_ids
        )

        for instance in gtk_qs:
            instance.update(
                values_seen=models.GroupTagValue.objects.filter(
                    project_id=instance.project_id,
                    group_id=instance.group_id,
                    key=instance.key,
                ).count(),
            )

    def get_tag_value_paginator(self, project_id, environment_id, key, query=None,
                                order_by='-last_seen'):
        from sentry.api.paginator import DateTimePaginator

        queryset = models.TagValue.objects.filter(
            project_id=project_id,
            key=key,
        )

        if query:
            queryset = queryset.filter(value__contains=query)

        return DateTimePaginator(
            queryset=queryset,
            order_by=order_by,
            on_results=lambda results: map(transformers[models.TagValue], results)
        )

    def get_group_tag_value_iter(self, project_id, group_id, environment_id, key, callbacks=()):
        from sentry.utils.query import RangeQuerySetWrapper

        qs = self.get_group_tag_value_qs(
            project_id, group_id, environment_id, key
        )

        return RangeQuerySetWrapper(queryset=qs, callbacks=callbacks)

    def get_group_tag_value_paginator(self, project_id, group_id, environment_id, key,
                                      order_by='-id'):
        from sentry.api.paginator import DateTimePaginator, Paginator

        qs = self.get_group_tag_value_qs(project_id, group_id, environment_id, key)

        if order_by in ('-last_seen', '-first_seen'):
            paginator_cls = DateTimePaginator
        elif order_by == '-id':
            paginator_cls = Paginator
        else:
            raise ValueError("Unsupported order_by: %s" % order_by)

        return paginator_cls(
            queryset=qs,
            order_by=order_by,
            on_results=lambda results: map(transformers[models.GroupTagValue], results)
        )

    def get_group_tag_value_qs(self, project_id, group_id, environment_id, key, value=None):
        queryset = models.GroupTagValue.objects.filter(key=key)

        if isinstance(group_id, collections.Iterable):
            queryset = queryset.filter(group_id__in=group_id)
        else:
            queryset = queryset.filter(group_id=group_id)

        if value is not None:
            queryset = queryset.filter(value=value)

        return queryset

    def get_event_tag_qs(self, project_id, environment_id, key, value):
        raise NotImplementedError  # there is no index that can appopriate satisfy this query

    def update_group_for_events(self, project_id, event_ids, destination_id):
        return models.EventTag.objects.filter(
            project_id=project_id,
            event_id__in=event_ids,
        ).update(group_id=destination_id)

    def delay_index_event_tags(self, organization_id, project_id, group_id,
                               environment_id, event_id, tags, date_added):
        index_event_tags.delay(
            organization_id=organization_id,
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            event_id=event_id,
            tags=tags,
            date_added=date_added,
        )
