"""
sentry.tagstore.legacy.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from collections import OrderedDict, defaultdict
from datetime import timedelta
from django.db import connections, router, IntegrityError, transaction
from django.db.models import Q, Sum
from django.utils import timezone
from operator import or_
from six.moves import reduce

from sentry import buffer
from sentry.tagstore import TagKeyStatus
from sentry.tagstore.base import TagStorage
from sentry.utils import db

from .models import EventTag, GroupTagKey, GroupTagValue, TagKey, TagValue


selectivity_hints = {
    'environment': 0.3,
    'release': 0.6,
    'transaction': 0.8,
}

order_by_expression_templates = {
    'priority': lambda table: 'log({0}.times_seen) * 600 + {0}.last_seen::abstime::int'.format(table),
    'date': lambda table: '{}.last_seen DESC'.format(table),
    'new': lambda table: '{}.first_seen DESC'.format(table),
    'freq': lambda table: '{}.times_seen DESC'.format(table),
}


def build_search_query(project_id, tags, order_by=None):
    from sentry.search.base import ANY

    assert len(tags) > 0

    tags = sorted(
        tags.items(),
        key=lambda (k, v): selectivity_hints.get(k, 0.75),
        reverse=True,
    )

    specific_tags = OrderedDict()
    presence_tags = []

    for key, value in tags:
        if value is ANY:
            presence_tags.append(key)
        else:
            specific_tags[key] = value

    join_conditions = []
    lateral_queries = []
    where_conditions = []
    where_parameters = []
    table_aliases = {}

    # Build lateral queries for non-specific tag lookups (these will be
    # performed after all of the specific ones, so we'll get better performance
    # -- these should also be performed as index only scans.)
    for i, key in enumerate(presence_tags):
        lateral_queries.append('LATERAL (SELECT * FROM {table} WHERE group_id = t.group_id AND key = %s LIMIT 1) as tl{index}'.format(
            index=i,
            table=GroupTagValue._meta.db_table,
        ))
        where_parameters.append(key)

    # NOTE: This isn't a hard requirement and could be rewritten to be smarter
    # if only presence tags are actually provided.
    key, value = specific_tags.popitem(False)

    table_aliases[key] = 't'
    where_conditions.append('(t.project_id = %s AND t.key = %s AND t.value = %s)')
    where_parameters.extend([project_id, key, value])

    # Build the base query out of all of the specific tag lookups.
    for i, (key, value) in enumerate(specific_tags.items()):
        alias = table_aliases[key] = 't{}'.format(i)
        join_conditions.append(
            'INNER JOIN {table} {alias} ON {previous_alias}.group_id = {alias}.group_id'.format(
                table=GroupTagValue._meta.db_table,
                alias=alias,
                previous_alias='t{}'.format(i if i > 0 else ''),
            )
        )
        where_conditions.append('({alias}.key = %s AND {alias}.value = %s)'.format(alias=alias))
        where_parameters.extend([key, value])

    if order_by is not None:
        order_by_tag_key, template_name = order_by
        order_by_expression_template = order_by_expression_templates[template_name]
        order_by_expression = 'ORDER BY {}'.format(
            order_by_expression_template(
                table_aliases[order_by_tag_key]))
    else:
        order_by_expression = ''

    return """\
        SELECT t.group_id
        FROM {table} t
        {lateral_queries}
        {join_conditions}
        WHERE {where_conditions}
        {order_by}
        """.format(
        table=GroupTagValue._meta.db_table,
        lateral_queries=''.join(map(
            lambda query: ', {}'.format(query),
            lateral_queries,
        )),
        join_conditions='\n'.join(join_conditions),
        where_conditions='\n  AND '.join(where_conditions),
        order_by=order_by_expression,
    ), where_parameters


class LegacyTagStorage(TagStorage):
    """\
    The legacy tagstore backend ignores the ``environment_id`` (because it doesn't store this information
    in its models) and stores ``times_seen`` and ``values_seen`` in Postgres.
    """

    def setup(self):
        self.setup_deletions(
            tagvalue_model=TagValue,
            grouptagkey_model=GroupTagKey,
            grouptagvalue_model=GroupTagValue,
            eventtag_model=EventTag,
        )

        self.setup_cleanup(
            tagvalue_model=TagValue,
            grouptagvalue_model=GroupTagValue,
            eventtag_model=EventTag,
        )

        self.setup_merge(
            grouptagkey_model=GroupTagKey,
            grouptagvalue_model=GroupTagValue,
        )

        self.setup_receivers(
            tagvalue_model=TagValue,
            grouptagvalue_model=GroupTagValue,
        )

    def setup_deletions(self, **kwargs):
        super(LegacyTagStorage, self).setup_deletions(**kwargs)

        from sentry.deletions import default_manager as deletion_manager
        from sentry.deletions.base import ModelRelation, ModelDeletionTask
        from sentry.models import Project

        class TagKeyDeletionTask(ModelDeletionTask):
            def get_child_relations(self, instance):
                # in bulk
                model_list = (GroupTagValue, GroupTagKey, TagValue)
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

        deletion_manager.register(TagKey, TagKeyDeletionTask)
        deletion_manager.add_dependencies(Project, [
            lambda instance: ModelRelation(TagKey, {'project_id': instance.id}),
            lambda instance: ModelRelation(TagValue, {'project_id': instance.id}),
            lambda instance: ModelRelation(GroupTagKey, {'project_id': instance.id}),
            lambda instance: ModelRelation(GroupTagValue, {'project_id': instance.id}),
        ])

    def setup_receivers(self, **kwargs):
        super(LegacyTagStorage, self).setup_receivers(**kwargs)

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

        @buffer_incr_complete.connect(sender=TagValue, weak=False)
        def record_project_tag_count(filters, created, **kwargs):
            if not created:
                return

            project_id = filters['project_id']
            key = filters['key']

            buffer.incr(TagKey,
                        columns={
                            'values_seen': 1,
                        },
                        filters={
                            'project_id': project_id,
                            'key': key,
                        })

        @buffer_incr_complete.connect(sender=GroupTagValue, weak=False)
        def record_group_tag_count(filters, created, extra, **kwargs):
            if not created:
                return

            project_id = extra['project_id']
            group_id = filters['group_id']
            key = filters['key']

            buffer.incr(GroupTagKey,
                        columns={
                            'values_seen': 1,
                        },
                        filters={
                            'project_id': project_id,
                            'group_id': group_id,
                            'key': key,
                        })

    def create_tag_key(self, project_id, environment_id, key, **kwargs):
        return TagKey.objects.create(project_id=project_id, key=key, **kwargs)

    def get_or_create_tag_key(self, project_id, environment_id, key, **kwargs):
        return TagKey.objects.get_or_create(project_id=project_id, key=key, **kwargs)

    def create_tag_value(self, project_id, environment_id, key, value, **kwargs):
        return TagValue.objects.create(project_id=project_id, key=key, value=value, **kwargs)

    def get_or_create_tag_value(self, project_id, environment_id,
                                key, value, key_id=None, **kwargs):
        return TagValue.objects.get_or_create(
            project_id=project_id, key=key, value=value, **kwargs)

    def create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        return GroupTagKey.objects.create(project_id=project_id, group_id=group_id,
                                          key=key, **kwargs)

    def get_or_create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        return GroupTagKey.objects.get_or_create(project_id=project_id, group_id=group_id,
                                                 key=key, **kwargs)

    def create_group_tag_value(self, project_id, group_id, environment_id, key, value, **kwargs):
        return GroupTagValue.objects.create(
            project_id=project_id, group_id=group_id, key=key, value=value, **kwargs)

    def get_or_create_group_tag_value(self, project_id, group_id,
                                      environment_id, key, value, **kwargs):
        return GroupTagValue.objects.get_or_create(
            project_id=project_id, group_id=group_id, key=key, value=value, **kwargs)

    def create_event_tags(self, project_id, group_id, environment_id, event_id, tags):
        tag_ids = []
        for key, value in tags:
            tagkey, _ = self.get_or_create_tag_key(project_id, environment_id, key)
            tagvalue, _ = self.get_or_create_tag_value(
                project_id, environment_id, key, value)
            tag_ids.append((tagkey.id, tagvalue.id))

        date_added = timezone.now()

        try:
            # don't let a duplicate break the outer transaction
            with transaction.atomic():
                # Tags are bulk inserted because this is an all-or-nothing situation.
                # Either the whole transaction works, or it doesn't. There's no value
                # in a partial success where we'd need to replay half of the rows.
                EventTag.objects.bulk_create([
                    EventTag(
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

        qs = TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        if status is not None:
            qs = qs.filter(status=status)

        try:
            return qs.get()
        except TagKey.DoesNotExist:
            raise TagKeyNotFound

    def get_tag_keys(self, project_id, environment_id, status=TagKeyStatus.VISIBLE):
        qs = TagKey.objects.filter(project_id=project_id)

        if status is not None:
            qs = qs.filter(status=status)

        return list(qs)

    def get_tag_value(self, project_id, environment_id, key, value):
        from sentry.tagstore.exceptions import TagValueNotFound

        try:
            return TagValue.objects.get(
                project_id=project_id,
                key=key,
                value=value
            )
        except TagValue.DoesNotExist:
            raise TagValueNotFound

    def get_tag_values(self, project_id, environment_id, key):
        qs = TagValue.objects.filter(
            project_id=project_id,
            key=key,
        )

        return list(qs)

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        from sentry.tagstore.exceptions import GroupTagKeyNotFound

        try:
            return GroupTagKey.objects.get(
                group_id=group_id,
                key=key,
            )
        except GroupTagKey.DoesNotExist:
            raise GroupTagKeyNotFound

    def get_group_tag_keys(self, project_id, group_id, environment_id, limit=None):
        qs = GroupTagKey.objects.filter(group_id=group_id)

        if limit is not None:
            qs = qs[:limit]

        return list(qs)

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        from sentry.tagstore.exceptions import GroupTagValueNotFound

        try:
            return GroupTagValue.objects.get(
                group_id=group_id,
                key=key,
                value=value,
            )
        except GroupTagValue.DoesNotExist:
            raise GroupTagValueNotFound

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        qs = GroupTagValue.objects.filter(
            group_id=group_id,
            key=key,
        )

        return list(qs)

    def delete_tag_key(self, project_id, key):
        from sentry.tagstore.tasks import delete_tag_key as delete_tag_key_task

        tagkeys_qs = TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        deleted = []
        for tagkey in tagkeys_qs:
            updated = TagKey.objects.filter(
                id=tagkey.id,
                status=TagKeyStatus.VISIBLE,
            ).update(status=TagKeyStatus.PENDING_DELETION)

            if updated:
                delete_tag_key_task.delay(object_id=tagkey.id, model=TagKey)
                deleted.append(tagkey)

        return deleted

    def delete_all_group_tag_keys(self, project_id, group_id):
        GroupTagKey.objects.filter(
            group_id=group_id,
        ).delete()

    def delete_all_group_tag_values(self, project_id, group_id):
        GroupTagValue.objects.filter(
            group_id=group_id,
        ).delete()

    def incr_tag_value_times_seen(self, project_id, environment_id,
                                  key, value, extra=None, count=1):
        buffer.incr(TagValue,
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
        buffer.incr(GroupTagValue,
                    columns={
                        'times_seen': count,
                    },
                    filters={
                        'group_id': group_id,
                        'key': key,
                        'value': value,
                    },
                    extra=extra)

    def get_group_event_ids(self, project_id, group_id, environment_id, tags):
        tagkeys = dict(
            TagKey.objects.filter(
                project_id=project_id,
                key__in=tags.keys(),
                status=TagKeyStatus.VISIBLE,
            ).values_list('key', 'id')
        )

        tagvalues = {
            (t[1], t[2]): t[0]
            for t in TagValue.objects.filter(
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
            return []

        # Django doesnt support union, so we limit results and try to find
        # reasonable matches

        # get initial matches to start the filter
        k, v = tag_lookups.pop()
        matches = list(
            EventTag.objects.filter(
                key_id=k,
                value_id=v,
                group_id=group_id,
            ).values_list('event_id', flat=True)[:1000]
        )

        # for each remaining tag, find matches contained in our
        # existing set, pruning it down each iteration
        for k, v in tag_lookups:
            matches = list(
                EventTag.objects.filter(
                    key_id=k,
                    value_id=v,
                    event_id__in=matches,
                    group_id=group_id,
                ).values_list('event_id', flat=True)[:1000]
            )
            if not matches:
                return []

        return matches

    def get_groups_user_counts(self, project_id, group_ids, environment_id):
        qs = GroupTagKey.objects.filter(
            project_id=project_id,
            group_id__in=group_ids,
            key='sentry:user'
        )

        return defaultdict(int, qs.values_list('group_id', 'values_seen'))

    def get_group_tag_value_count(self, project_id, group_id, environment_id, key):
        if db.is_postgres():
            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            using = router.db_for_read(GroupTagValue)
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
        return GroupTagValue.objects.filter(
            group_id=group_id,
            key=key,
            last_seen__gte=cutoff,
        ).aggregate(t=Sum('times_seen'))['t']

    def get_top_group_tag_values(self, project_id, group_id, environment_id, key, limit=3):
        if db.is_postgres():
            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            return list(
                GroupTagValue.objects.raw(
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

        cutoff = timezone.now() - timedelta(days=7)
        return list(
            GroupTagValue.objects.filter(
                group_id=group_id,
                key=key,
                last_seen__gte=cutoff,
            ).order_by('-times_seen')[:limit]
        )

    def get_first_release(self, project_id, group_id):
        try:
            first_release = GroupTagValue.objects.filter(
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
            last_release = GroupTagValue.objects.filter(
                project_id=project_id,
                group_id=group_id,
                key__in=('sentry:release', 'release'),
            ).order_by('-last_seen')[0]
        except IndexError:
            return None

        return last_release.value

    def get_release_tags(self, project_ids, environment_id, versions):
        return list(TagValue.objects.filter(
            project_id__in=project_ids,
            key='sentry:release',
            value__in=versions,
        ))

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        return list(GroupTagValue.objects.filter(
            key='sentry:user',
            value__in=[eu.tag_value for eu in event_users],
            project_id__in=project_ids,
        ).order_by('-last_seen').values_list('group_id', flat=True)[:limit])

    def get_group_tag_values_for_users(self, event_users, limit=100):
        tag_filters = [Q(value=eu.tag_value, project_id=eu.project_id) for eu in event_users]
        return list(GroupTagValue.objects.filter(
            reduce(or_, tag_filters),
            key='sentry:user',
        ).order_by('-last_seen')[:limit])

    def get_group_ids_for_search_filter(
            self, project_id, environment_id, tags, sort_by=None, limit=1000):
        from django.db import connections
        from sentry.search.base import EMPTY

        assert tags
        if any(v is EMPTY for v in tags.values()):
            return []

        if sort_by is not None:
            assert 'environment' in tags
            sort_by = ('environment', sort_by)

        using = router.db_for_read(GroupTagValue)
        cursor = connections[using].cursor()
        cursor.execute(*build_search_query(project_id, tags, sort_by))
        return map(
            lambda row: int(row[0]),
            cursor.fetchall(),
        )

    def update_group_tag_key_values_seen(self, project_id, group_ids):
        gtk_qs = GroupTagKey.objects.filter(
            project_id=project_id,
            group_id__in=group_ids
        )

        for instance in gtk_qs:
            instance.update(
                values_seen=GroupTagValue.objects.filter(
                    project_id=instance.project_id,
                    group_id=instance.group_id,
                    key=instance.key,
                ).count(),
            )

    def get_tag_value_qs(self, project_id, environment_id, key, query=None):
        queryset = TagValue.objects.filter(
            project_id=project_id,
            key=key,
        )

        if query:
            queryset = queryset.filter(value__contains=query)

        return queryset

    def get_group_tag_value_qs(self, project_id, group_id, environment_id, key):
        return GroupTagValue.objects.filter(
            group_id=group_id,
            key=key,
        )

    def update_group_for_events(self, project_id, event_ids, destination_id):
        return EventTag.objects.filter(
            project_id=project_id,
            event_id__in=event_ids,
        ).update(group_id=destination_id)
