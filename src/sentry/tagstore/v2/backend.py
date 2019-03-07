"""
sentry.tagstore.v2.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import collections
import six

import logging
from collections import defaultdict
from datetime import timedelta
from django.db import connections, router, IntegrityError, transaction
from django.db.models import F, Q, Sum
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


logger = logging.getLogger('sentry.tagstore.v2')

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

AGGREGATE_ENVIRONMENT_ID = 0


class V2TagStorage(TagStorage):
    """\
    The v2 tagstore backend stores and respects ``environment_id``.

    An ``environment_id`` value of ``None`` is used to keep track of the aggregate value across
    all environments.
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
                                                {'event_id__in': [i.id for i in instance_list],
                                                 'project_id': instance_list[0].project_id},
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
                    'project_id': instance.project_id
                },
                partition_key={'project_id': instance.project_id}),
            lambda instance: ModelRelation(
                models.GroupTagKey,
                query={
                    'group_id': instance.id,
                    'project_id': instance.project_id
                },
                partition_key={'project_id': instance.project_id}),
            lambda instance: ModelRelation(
                models.GroupTagValue,
                query={
                    'group_id': instance.id,
                    'project_id': instance.project_id
                },
                partition_key={'project_id': instance.project_id}),
        ])

        deletion_manager.add_dependencies(Project, [
            lambda instance: ModelRelation(models.TagKey,
                                           query={'project_id': instance.id}),
            lambda instance: ModelRelation(models.TagValue,
                                           query={'project_id': instance.id},
                                           partition_key={'project_id': instance.id}),
            lambda instance: ModelRelation(models.GroupTagKey,
                                           query={'project_id': instance.id},
                                           partition_key={'project_id': instance.id}),
            lambda instance: ModelRelation(models.GroupTagValue,
                                           query={'project_id': instance.id},
                                           partition_key={'project_id': instance.id}),
        ])

        # NOTE: EventTag is handled by cleanup

        class TagKeyDeletionTask(ModelDeletionTask):
            def get_child_relations(self, instance):
                # in bulk
                model_list = (models.GroupTagValue, models.GroupTagKey, models.TagValue)

                # required to deal with custom SQL queries and the ORM
                # in `bulk_delete_objects`
                key_id_field_name = 'key_id' if (db.is_postgres() or db.is_mysql()) else '_key_id'

                relations = [
                    ModelRelation(m, query={
                        'project_id': instance.project_id,
                        key_id_field_name: instance.id,
                    }, partition_key={'project_id': instance.project_id}) for m in model_list
                ]
                return relations

            def mark_deletion_in_progress(self, instance_list):
                for instance in instance_list:
                    if instance.status != TagKeyStatus.DELETION_IN_PROGRESS:
                        models.TagKey.objects.filter(
                            id=instance.id,
                            project_id=instance.project_id,
                        ).update(status=TagKeyStatus.DELETION_IN_PROGRESS)

        deletion_manager.register(models.TagKey, TagKeyDeletionTask)

    def setup_receivers(self):
        from django.db.models.signals import post_save

        def record_project_tag_count(instance, created, **kwargs):
            if not created:
                return

            buffer.incr(models.TagKey,
                        columns={
                            'values_seen': 1,
                        },
                        filters={
                            'id': instance._key_id,
                            'project_id': instance.project_id,
                        })

        def record_group_tag_count(instance, created, **kwargs):
            if not created:
                return

            buffer.incr(models.GroupTagKey,
                        columns={
                            'values_seen': 1,
                        },
                        filters={
                            'project_id': instance.project_id,
                            'group_id': instance.group_id,
                            '_key_id': instance._key_id,
                        })

        post_save.connect(record_project_tag_count, sender=models.TagValue, weak=False)
        post_save.connect(record_group_tag_count, sender=models.GroupTagValue, weak=False)

    def create_tag_key(self, project_id, environment_id, key, **kwargs):
        environment_id = AGGREGATE_ENVIRONMENT_ID if environment_id is None else environment_id

        return models.TagKey.objects.create(
            project_id=project_id,
            environment_id=environment_id,
            key=key,
            **kwargs
        )

    def get_or_create_tag_keys_bulk(self, project_id, environment_id, keys):
        assert environment_id is not None

        return models.TagKey.get_or_create_bulk(
            project_id=project_id,
            environment_id=environment_id,
            keys=keys,
        )

    def get_or_create_tag_values_bulk(self, project_id, tags):
        return models.TagValue.get_or_create_bulk(
            project_id=project_id,
            tags=tags,
        )

    def get_or_create_tag_key(self, project_id, environment_id, key, **kwargs):
        assert environment_id is not None

        return models.TagKey.get_or_create(
            project_id=project_id,
            environment_id=environment_id,
            key=key,
            **kwargs
        )

    def create_tag_value(self, project_id, environment_id, key, value, **kwargs):
        environment_id = AGGREGATE_ENVIRONMENT_ID if environment_id is None else environment_id

        tag_key_kwargs = kwargs.copy()
        for k in ['times_seen', 'first_seen', 'last_seen']:
            tag_key_kwargs.pop(k, None)

        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **tag_key_kwargs)

        tv = models.TagValue.objects.create(
            project_id=project_id,
            _key_id=tag_key.id,
            value=value,
            **kwargs
        )

        tv.key = key
        return tv

    def get_or_create_tag_value(self, project_id, environment_id,
                                key, value, key_id=None, **kwargs):
        assert environment_id is not None

        if key_id is None:
            tag_key, _ = self.get_or_create_tag_key(
                project_id, environment_id, key, **kwargs)
            key_id = tag_key.id

        tv, created = models.TagValue.get_or_create(
            project_id=project_id,
            _key_id=key_id,
            value=value,
            **kwargs
        )

        tv.key = key
        return (tv, created)

    def create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        environment_id = AGGREGATE_ENVIRONMENT_ID if environment_id is None else environment_id

        tag_key_kwargs = kwargs.copy()
        tag_key_kwargs.pop('values_seen', None)

        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **tag_key_kwargs)

        gtk = models.GroupTagKey.objects.create(
            project_id=project_id,
            group_id=group_id,
            _key_id=tag_key.id,
            **kwargs
        )

        gtk.key = key
        return gtk

    def get_or_create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        assert environment_id is not None

        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs)

        gtk, created = models.GroupTagKey.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            _key_id=tag_key.id,
            **kwargs
        )

        gtk.key = key
        return (gtk, created)

    def create_group_tag_value(self, project_id, group_id, environment_id,
                               key, value, **kwargs):
        environment_id = AGGREGATE_ENVIRONMENT_ID if environment_id is None else environment_id

        other_kwargs = kwargs.copy()
        for k in ['times_seen', 'first_seen', 'last_seen']:
            other_kwargs.pop(k, None)

        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **other_kwargs)

        tag_value, _ = self.get_or_create_tag_value(
            project_id, environment_id, key, value, key_id=tag_key.id, **other_kwargs)

        gtv = models.GroupTagValue.objects.create(
            project_id=project_id,
            group_id=group_id,
            _key_id=tag_key.id,
            _value_id=tag_value.id,
            **kwargs
        )

        gtv.key = key
        gtv.value = value
        return gtv

    def get_or_create_group_tag_value(self, project_id, group_id,
                                      environment_id, key, value, **kwargs):
        assert environment_id is not None

        if 'defaults' in kwargs:
            # while backfilling v2 it is possible that a user performs an unmerge
            # (which contains default values in kwargs) AND where the TagKey actually
            # doesn't exist in the v2 database yet, so the defaults are used in create
            # and explode because the fields don't actually exist in TagKey
            # this is solved here as a one-off because it's very seldomly used and in
            # the hot path for basically everything to do with tags
            kcopy = kwargs.copy()
            kcopy.pop('defaults')
            tag_key, _ = self.get_or_create_tag_key(project_id, environment_id, key, **kcopy)

            tag_value, _ = self.get_or_create_tag_value(
                project_id, environment_id, key, value, key_id=tag_key.id, **kcopy)

        else:
            tag_key, _ = self.get_or_create_tag_key(project_id, environment_id, key, **kwargs)

            tag_value, _ = self.get_or_create_tag_value(
                project_id, environment_id, key, value, key_id=tag_key.id, **kwargs)

        gtv, created = models.GroupTagValue.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            _key_id=tag_key.id,
            _value_id=tag_value.id,
            **kwargs
        )

        gtv.key = key
        gtv.value = value
        return (gtv, created)

    def create_event_tags(self, project_id, group_id, environment_id,
                          event_id, tags, date_added=None):
        assert environment_id is not None

        if date_added is None:
            date_added = timezone.now()

        tagkeys = self.get_or_create_tag_keys_bulk(project_id, environment_id, [t[0] for t in tags])
        tagvalues = self.get_or_create_tag_values_bulk(
            project_id, [(tagkeys[t[0]], t[1]) for t in tags])
        tag_ids = [(tk.id, tv.id) for (tk, _), tv in tagvalues.items()]

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
            logger.error(
                'tagstore.create_event_tags.integrity_error',
                extra={
                    'project_id': project_id,
                    'group_id': group_id,
                    'event_id': event_id,
                },
                exc_info=True
            )

    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE):
        from sentry.tagstore.exceptions import TagKeyNotFound

        qs = models.TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        qs = self._add_environment_filter(qs, environment_id)

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
        qs = models.TagKey.objects.filter(
            project_id=project_id,
        )

        qs = self._add_environment_filter(qs, environment_id)

        if status is not None:
            qs = qs.filter(status=status)

        return set(
            map(
                transformers[models.TagKey],
                qs,
            )
        )

    def get_tag_value(self, project_id, environment_id, key, value):
        from sentry.tagstore.exceptions import TagValueNotFound

        qs = models.TagValue.objects.select_related('_key').filter(
            project_id=project_id,
            _key__project_id=project_id,
            _key__key=key,
            value=value,
        )

        qs = self._add_environment_filter(qs, environment_id)

        try:
            instance = qs.get()
        except models.TagValue.DoesNotExist:
            raise TagValueNotFound

        return transformers[models.TagValue](instance)

    def get_tag_values(self, project_id, environment_id, key):
        qs = models.TagValue.objects.select_related('_key').filter(
            project_id=project_id,
            _key__project_id=project_id,
            _key__key=key,
        )

        qs = self._add_environment_filter(qs, environment_id)

        return set(
            map(
                transformers[models.TagValue],
                qs,
            )
        )

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        from sentry.tagstore.exceptions import GroupTagKeyNotFound

        qs = models.GroupTagKey.objects.select_related('_key').filter(
            project_id=project_id,
            group_id=group_id,
            _key__project_id=project_id,
            _key__key=key,
        )

        qs = self._add_environment_filter(qs, environment_id)

        try:
            instance = qs.get()
        except models.GroupTagKey.DoesNotExist:
            raise GroupTagKeyNotFound

        return transformers[models.GroupTagKey](instance)

    def get_group_tag_keys(self, project_id, group_id, environment_ids, limit=None, keys=None):
        # only the snuba backend supports multi env
        if environment_ids and len(environment_ids) > 1:
            raise NotImplementedError

        environment_id = environment_ids[0] if environment_ids else None

        qs = models.GroupTagKey.objects.select_related('_key').filter(
            project_id=project_id,
            group_id=group_id,
            _key__project_id=project_id,
        )
        if keys is not None:
            qs = qs.filter(_key__key__in=keys)

        qs = self._add_environment_filter(qs, environment_id)

        if limit is not None:
            qs = qs[:limit]

        return set(
            map(
                transformers[models.GroupTagKey],
                qs,
            )
        )

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        from sentry.tagstore.exceptions import GroupTagValueNotFound

        value = self.get_group_list_tag_value(
            [project_id],
            [group_id],
            [environment_id],
            key,
            value,
        ).get(group_id)

        if value is None:
            raise GroupTagValueNotFound

        return value

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        qs = models.GroupTagValue.objects.select_related('_key', '_value').filter(
            project_id=project_id,
            group_id=group_id,
            _key__project_id=project_id,
            _key__key=key,
            _value__project_id=project_id,
        )

        qs = self._add_environment_filter(qs, environment_id)

        return list(
            map(
                transformers[models.GroupTagValue],
                qs,
            )
        )

    def get_group_list_tag_value(self, project_ids, group_id_list, environment_ids, key, value):
        # only the snuba backend supports multi project/env
        if len(project_ids) > 1 or environment_ids and len(environment_ids) > 1:
            raise NotImplementedError

        qs = models.GroupTagValue.objects.select_related('_key', '_value').filter(
            project_id=project_ids[0],
            group_id__in=group_id_list,
            _key__project_id=project_ids[0],
            _key__key=key,
            _value__project_id=project_ids[0],
            _value__value=value,
        )

        qs = self._add_environment_filter(qs, environment_ids[0])
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
                project_id=project_id,
                status=TagKeyStatus.VISIBLE,
            ).update(status=TagKeyStatus.PENDING_DELETION)

            if updated:
                delete_tag_key_task.delay(object_id=tagkey.id, model=models.TagKey)
                deleted.append(tagkey)

        return deleted

    def delete_all_group_tag_keys(self, project_id, group_id):
        using = router.db_for_read(models.GroupTagKey)
        cursor = connections[using].cursor()
        cursor.execute(
            """
            DELETE FROM tagstore_grouptagkey
            WHERE project_id = %s
              AND group_id = %s
        """, [project_id, group_id]
        )

    def delete_all_group_tag_values(self, project_id, group_id):
        using = router.db_for_read(models.GroupTagValue)
        cursor = connections[using].cursor()
        cursor.execute(
            """
            DELETE FROM tagstore_grouptagvalue
            WHERE project_id = %s
              AND group_id = %s
        """, [project_id, group_id]
        )

    def incr_tag_value_times_seen(self, project_id, environment_id,
                                  key, value, extra=None, count=1):
        for env in [environment_id, AGGREGATE_ENVIRONMENT_ID]:
            tagkey, _ = self.get_or_create_tag_key(project_id, env, key)

            buffer.incr(models.TagValue,
                        columns={
                            'times_seen': count,
                        },
                        filters={
                            'project_id': project_id,
                            '_key_id': tagkey.id,
                            'value': value,
                        },
                        extra=extra)

    def incr_group_tag_value_times_seen(self, project_id, group_id, environment_id,
                                        key, value, extra=None, count=1):
        for env in [environment_id, AGGREGATE_ENVIRONMENT_ID]:
            tagkey, _ = self.get_or_create_tag_key(project_id, env, key)
            tagvalue, _ = self.get_or_create_tag_value(
                project_id, env, key, value, key_id=tagkey.id)

            buffer.incr(models.GroupTagValue,
                        columns={
                            'times_seen': count,
                        },
                        filters={
                            'project_id': project_id,
                            'group_id': group_id,
                            '_key_id': tagkey.id,
                            '_value_id': tagvalue.id,
                        },
                        extra=extra)

    def get_group_event_filter(self, project_id, group_id, environment_ids, tags, start, end):
        # NOTE: `environment_id=None` needs to be filtered differently in this method.
        # EventTag never has NULL `environment_id` fields (individual Events always have an environment),
        # and so `environment_id=None` needs to query EventTag for *all* environments (except, ironically
        # the aggregate environment).
        if environment_ids:
            # only the snuba backend supports multi env
            if len(environment_ids) > 1:
                raise NotImplementedError
            environment_id = environment_ids[0]
        else:
            environment_id = None

        if environment_id is None:
            # filter for all 'real' environments
            exclude = {'_key__environment_id': AGGREGATE_ENVIRONMENT_ID}
            env_filter = {}
        else:
            exclude = {}
            env_filter = {'_key__environment_id': environment_id}

        tagvalue_qs = models.TagValue.objects.filter(
            reduce(or_, (Q(_key__key=k, _key__status=TagKeyStatus.VISIBLE, value=v)
                         for k, v in six.iteritems(tags))),
            project_id=project_id,
            _key__project_id=project_id,
            **env_filter
        )

        if exclude:
            tagvalue_qs = tagvalue_qs.exclude(**exclude)

        tagvalue_qs = tagvalue_qs.values_list('_key_id', 'id', '_key__key', 'value')

        tagvalues = defaultdict(list)
        for key_id, value_id, key, value in tagvalue_qs:
            tagvalues[(key, value)].append((key_id, value_id))
        tagvalues = dict(tagvalues)

        try:
            # ensure all key/value pairs were found
            tag_lookups = [tagvalues[(k, v)] for k, v in six.iteritems(tags)]
            # [[(key0, value0), (key1, value1)], ...]
        except KeyError:
            # one or more tags were invalid, thus the result should be an empty
            # set
            return None

        # Django doesnt support union, so we limit results and try to find
        # reasonable matches

        date_filters = Q()
        if start:
            date_filters &= Q(date_added__gte=start)
        if end:
            date_filters &= Q(date_added__lte=end)

        # get initial matches to start the filter
        kv_pairs = tag_lookups.pop()
        matches = list(
            models.EventTag.objects.filter(
                reduce(or_, (Q(key_id=k, value_id=v)
                             for k, v in kv_pairs)),
                date_filters,
                project_id=project_id,
                group_id=group_id,
            ).values_list('event_id', flat=True)[:1000]
        )

        # for each remaining tag, find matches contained in our
        # existing set, pruning it down each iteration
        for kv_pairs in tag_lookups:
            matches = list(
                models.EventTag.objects.filter(
                    reduce(or_, (Q(key_id=k, value_id=v)
                                 for k, v in kv_pairs)),
                    date_filters,
                    project_id=project_id,
                    group_id=group_id,
                    event_id__in=matches,
                ).values_list('event_id', flat=True)[:1000]
            )
            if not matches:
                return None

        return {'id__in': set(matches)}

    def get_groups_user_counts(self, project_ids, group_ids, environment_ids, start=None, end=None):
        # only the snuba backend supports multi project/env
        if len(project_ids) > 1 or environment_ids and len(environment_ids) > 1:
            raise NotImplementedError

        qs = models.GroupTagKey.objects.filter(
            project_id=project_ids[0],
            group_id__in=group_ids,
            _key__project_id=project_ids[0],
            _key__key='sentry:user',
        )

        qs = self._add_environment_filter(qs, environment_ids and environment_ids[0])

        return defaultdict(int, qs.values_list('group_id', 'values_seen'))

    def get_group_tag_value_count(self, project_id, group_id, environment_id, key):
        if db.is_postgres():
            environment_id = AGGREGATE_ENVIRONMENT_ID if environment_id is None else environment_id

            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            using = router.db_for_read(models.GroupTagValue)
            cursor = connections[using].cursor()
            cursor.execute(
                """
                SELECT SUM(t)
                FROM (
                    SELECT tagstore_grouptagvalue.times_seen as t
                    FROM tagstore_grouptagvalue
                    INNER JOIN tagstore_tagkey
                    ON (tagstore_grouptagvalue.key_id = tagstore_tagkey.id)
                    WHERE tagstore_grouptagvalue.group_id = %s
                    AND tagstore_tagkey.project_id = %s
                    AND tagstore_grouptagvalue.project_id = %s
                    AND tagstore_tagkey.environment_id = %s
                    AND tagstore_tagkey.key = %s
                    ORDER BY last_seen DESC
                    LIMIT 10000
                ) as a
                """,
                [group_id, project_id, project_id, environment_id, key]
            )
            return cursor.fetchone()[0] or 0

        cutoff = timezone.now() - timedelta(days=7)
        qs = models.GroupTagValue.objects.filter(
            project_id=project_id,
            group_id=group_id,
            _key__project_id=project_id,
            _key__key=key,
            last_seen__gte=cutoff,
        )
        qs = self._add_environment_filter(qs, environment_id)
        return qs.aggregate(t=Sum('times_seen'))['t']

    def get_top_group_tag_values(self, project_id, group_id,
                                 environment_id, key, limit=TOP_VALUES_DEFAULT_LIMIT):
        if db.is_postgres():
            environment_id = AGGREGATE_ENVIRONMENT_ID if environment_id is None else environment_id

            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            return list(
                map(
                    transformers[models.GroupTagValue],
                    models.GroupTagValue.objects.raw(
                        """
                        SELECT *
                        FROM (
                            SELECT tagstore_grouptagvalue.*
                            FROM tagstore_grouptagvalue
                            INNER JOIN tagstore_tagkey
                            ON (tagstore_grouptagvalue.key_id = tagstore_tagkey.id)
                            WHERE tagstore_grouptagvalue.group_id = %%s
                            AND tagstore_tagkey.project_id = %%s
                            AND tagstore_grouptagvalue.project_id = %%s
                            AND tagstore_tagkey.environment_id = %%s
                            AND tagstore_tagkey.key = %%s
                            ORDER BY last_seen DESC
                            LIMIT 10000
                        ) as a
                        ORDER BY times_seen DESC
                        LIMIT %d
                        """ % limit,
                        [group_id, project_id, project_id, environment_id, key]
                    ),
                )
            )

        cutoff = timezone.now() - timedelta(days=7)
        qs = models.GroupTagValue.objects.select_related('_key', '_value').filter(
            project_id=project_id,
            group_id=group_id,
            _key__project_id=project_id,
            _key__key=key,
            _value__project_id=project_id,
            last_seen__gte=cutoff,
        )
        qs = self._add_environment_filter(qs, environment_id)
        return list(
            map(
                transformers[models.GroupTagValue],
                qs.order_by('-times_seen')[:limit],
            )
        )

    def get_first_release(self, project_id, group_id):
        try:
            first_release = models.GroupTagValue.objects.select_related('_value').filter(
                project_id=project_id,
                group_id=group_id,
                _key__project_id=project_id,
                _key__key__in=('sentry:release', 'release'),
                _value__project_id=project_id,
            ).order_by('first_seen')[0]
        except IndexError:
            return None
        else:
            return first_release.value

    def get_last_release(self, project_id, group_id):
        try:
            last_release = models.GroupTagValue.objects.select_related('_value').filter(
                project_id=project_id,
                group_id=group_id,
                _key__project_id=project_id,
                _key__key__in=('sentry:release', 'release'),
                _value__project_id=project_id,
            ).order_by('-last_seen')[0]
        except IndexError:
            return None

        return last_release.value

    def get_release_tags(self, project_ids, environment_id, versions):
        qs = models.TagValue.objects.select_related('_key').filter(
            project_id__in=project_ids,
            _key__project_id__in=project_ids,
            _key__key='sentry:release',
            value__in=versions,
        ).extra(where=[
            # Force the join also through the shard
            'tagstore_tagvalue.project_id = tagstore_tagkey.project_id',
        ])

        qs = self._add_environment_filter(qs, environment_id)

        return set(
            map(
                transformers[models.TagValue],
                qs,
            )
        )

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        return set(models.GroupTagValue.objects.filter(
            project_id__in=project_ids,
            _key__project_id__in=project_ids,
            _key__environment_id=AGGREGATE_ENVIRONMENT_ID,
            _key__key='sentry:user',
            _value___key=F('_key'),
            _value__value__in=[eu.tag_value for eu in event_users],
        ).extra(where=[
            # Force the join also through the shard
            'tagstore_grouptagvalue.project_id = tagstore_tagkey.project_id',
            'tagstore_grouptagvalue.project_id = tagstore_tagvalue.project_id',
        ]).order_by('-last_seen').values_list('group_id', flat=True)[:limit])

    def get_group_tag_values_for_users(self, event_users, limit=100):
        tag_filters = [
            Q(_value__value=eu.tag_value, _value__project_id=eu.project_id)
            for eu in event_users
        ]

        project_ids = {eu.project_id for eu in event_users}

        return list(
            map(
                transformers[models.GroupTagValue],
                models.GroupTagValue.objects.select_related('_value').filter(
                    reduce(or_, tag_filters),
                    project_id__in=project_ids,
                    _key__project_id__in=project_ids,
                    _key__environment_id=AGGREGATE_ENVIRONMENT_ID,
                    _key__key='sentry:user',
                    _value__project_id__in=project_ids,
                ).extra(where=[
                    # Force the join also through the shard
                    'tagstore_grouptagvalue.project_id = tagstore_tagkey.project_id',
                    'tagstore_grouptagvalue.project_id = tagstore_tagvalue.project_id',
                ]).order_by('-last_seen')[:limit],
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
                    project_id=project_id,
                    _key__project_id=project_id,
                    _key__key=k,
                    _value__project_id=project_id,
                    _value___key=F('_key'),
                    _value__value=v,
                )
                base_qs = self._add_environment_filter(base_qs, environment_id)

            else:
                base_qs = models.GroupTagValue.objects.filter(
                    project_id=project_id,
                    _key__project_id=project_id,
                    _key__key=k,
                )
                base_qs = self._add_environment_filter(base_qs, environment_id).distinct()

            if matches:
                base_qs = base_qs.filter(group_id__in=matches)
            else:
                # restrict matches to only the most recently seen issues
                base_qs = base_qs.order_by('-last_seen')

            matches = list(base_qs.values_list('group_id', flat=True)[:limit])

            if not matches:
                return []

        return matches

    def update_group_tag_key_values_seen(self, project_id, group_ids):
        gtk_qs = models.GroupTagKey.objects.filter(
            project_id=project_id,
            group_id__in=group_ids
        )

        for instance in gtk_qs:
            models.GroupTagKey.objects.filter(
                id=instance.id,
                project_id=project_id,
            ).update(
                values_seen=models.GroupTagValue.objects.filter(
                    project_id=instance.project_id,
                    group_id=instance.group_id,
                    _key_id=instance._key_id,
                ).count(),
            )

    def get_tag_value_paginator(self, project_id, environment_id, key, query=None,
                                order_by='-last_seen'):
        from sentry.api.paginator import DateTimePaginator

        qs = models.TagValue.objects.select_related('_key').filter(
            project_id=project_id,
            _key__project_id=project_id,
            _key__key=key,
        )

        qs = self._add_environment_filter(qs, environment_id)

        if query:
            qs = qs.filter(value__contains=query)

        return DateTimePaginator(
            queryset=qs,
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
        qs = models.GroupTagValue.objects.select_related('_key', '_value').filter(
            project_id=project_id,
            _key__project_id=project_id,
            _key__key=key,
            _value__project_id=project_id,
        )

        if isinstance(group_id, collections.Iterable):
            qs = qs.filter(group_id__in=group_id)
        else:
            qs = qs.filter(group_id=group_id)

        if value is not None:
            qs = qs.filter(_value__project_id=project_id, _value__value=value)

        qs = self._add_environment_filter(qs, environment_id)
        return qs

    def get_event_tag_qs(self, project_id, environment_id, key, value):
        qs = models.EventTag.objects.filter(
            project_id=project_id,
            key__project_id=project_id,
            key__key=key,
            value__project_id=project_id,
            value__value=value,
        )

        qs = self._add_environment_filter(qs, environment_id)

        return qs

    def update_group_for_events(self, project_id, event_ids, destination_id):
        return models.EventTag.objects.filter(
            project_id=project_id,
            event_id__in=event_ids,
        ).update(group_id=destination_id)

    def _add_environment_filter(self, queryset, environment_id):
        """\
        Filter a queryset by the provided `environment_id`, handling
        whether a JOIN is required or not depending on the model.
        """
        if environment_id is None:
            environment_id = AGGREGATE_ENVIRONMENT_ID

        if queryset.model == models.TagKey:
            return queryset.filter(environment_id=environment_id)
        elif queryset.model in (models.EventTag,):
            return queryset.filter(key__environment_id=environment_id)
        elif queryset.model in (models.TagValue, models.GroupTagKey, models.GroupTagValue):
            return queryset.filter(_key__environment_id=environment_id)
        else:
            raise ValueError("queryset of unsupported model '%s' provided" % queryset.model)

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
