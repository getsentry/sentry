"""
sentry.tagstore.v2.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

import logging
from collections import defaultdict
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


logger = logging.getLogger('sentry.tagstore.v2')


class V2TagStorage(TagStorage):
    """\
    The v2 tagstore backend stores and respects ``environment_id``.

    An ``environment_id`` value of ``None`` is used to keep track of the aggregate value across
    all environments.
    """

    def setup(self):
        self.setup_deletions(
            tagkey_model=TagKey,
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
        super(V2TagStorage, self).setup_deletions(**kwargs)

        from sentry.deletions import default_manager as deletion_manager
        from sentry.deletions.base import ModelRelation, ModelDeletionTask

        class TagKeyDeletionTask(ModelDeletionTask):
            def get_child_relations(self, instance):
                # in bulk
                model_list = (GroupTagValue, GroupTagKey, TagValue)
                relations = [
                    ModelRelation(m, {
                        'project_id': instance.project_id,
                        'key_id': instance.id,
                    }) for m in model_list
                ]
                return relations

            def mark_deletion_in_progress(self, instance_list):
                for instance in instance_list:
                    if instance.status != TagKeyStatus.DELETION_IN_PROGRESS:
                        instance.update(status=TagKeyStatus.DELETION_IN_PROGRESS)

        deletion_manager.register(TagKey, TagKeyDeletionTask)

    def setup_receivers(self, **kwargs):
        super(V2TagStorage, self).setup_receivers(**kwargs)

        from sentry.signals import buffer_incr_complete

        @buffer_incr_complete.connect(sender=TagValue, weak=False)
        def record_project_tag_count(filters, created, **kwargs):
            if not created:
                return

            project_id = filters['project_id']
            key_id = filters['_key_id']

            buffer.incr(TagKey,
                        columns={
                            'values_seen': 1,
                        },
                        filters={
                            'id': key_id,
                            'project_id': project_id,
                        })

        @buffer_incr_complete.connect(sender=GroupTagValue, weak=False)
        def record_group_tag_count(filters, created, extra, **kwargs):
            if not created:
                return

            project_id = extra['project_id']
            group_id = filters['group_id']
            key_id = filters['_key_id']

            buffer.incr(GroupTagKey,
                        columns={
                            'values_seen': 1,
                        },
                        filters={
                            'project_id': project_id,
                            'group_id': group_id,
                            '_key_id': key_id,
                        })

    def create_tag_key(self, project_id, environment_id, key, **kwargs):
        return TagKey.objects.create(
            project_id=project_id,
            environment_id=environment_id,
            key=key,
            **kwargs
        )

    def get_or_create_tag_key(self, project_id, environment_id, key, **kwargs):
        return TagKey.objects.get_or_create(
            project_id=project_id,
            environment_id=environment_id,
            key=key,
            **kwargs
        )

    def create_tag_value(self, project_id, environment_id, key, value, **kwargs):
        tag_key_kwargs = kwargs.copy()
        for k in ['times_seen', 'first_seen', 'last_seen']:
            tag_key_kwargs.pop(k, None)

        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **tag_key_kwargs)

        return TagValue.objects.create(
            project_id=project_id,
            _key_id=tag_key.id,
            value=value,
            **kwargs
        )

    def get_or_create_tag_value(self, project_id, environment_id,
                                key, value, key_id=None, **kwargs):
        if key_id is None:
            tag_key, _ = self.get_or_create_tag_key(
                project_id, environment_id, key, **kwargs)
            key_id = tag_key.id

        return TagValue.objects.get_or_create(
            project_id=project_id,
            _key_id=key_id,
            value=value,
            **kwargs
        )

    def create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        tag_key_kwargs = kwargs.copy()
        tag_key_kwargs.pop('values_seen', None)

        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **tag_key_kwargs)

        return GroupTagKey.objects.create(
            project_id=project_id,
            group_id=group_id,
            _key_id=tag_key.id,
            **kwargs
        )

    def get_or_create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs)

        return GroupTagKey.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            _key_id=tag_key.id,
            **kwargs
        )

    def create_group_tag_value(self, project_id, group_id, environment_id,
                               key, value, **kwargs):
        other_kwargs = kwargs.copy()
        for k in ['times_seen', 'first_seen', 'last_seen']:
            other_kwargs.pop(k, None)

        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **other_kwargs)

        tag_value, _ = self.get_or_create_tag_value(
            project_id, environment_id, key, value, **other_kwargs)

        return GroupTagValue.objects.create(
            project_id=project_id,
            group_id=group_id,
            _key_id=tag_key.id,
            _value_id=tag_value.id,
            **kwargs
        )

    def get_or_create_group_tag_value(self, project_id, group_id,
                                      environment_id, key, value, **kwargs):
        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs)

        tag_value, _ = self.get_or_create_tag_value(
            project_id, environment_id, key, value, **kwargs)

        return GroupTagValue.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            _key_id=tag_key.id,
            _value_id=tag_value.id,
            **kwargs
        )

    def create_event_tags(self, project_id, group_id, environment_id, event_id, tags):
        assert environment_id is not None

        tag_ids = []
        for key, value in tags:
            tagkey, _ = self.get_or_create_tag_key(project_id, environment_id, key)
            tagvalue, _ = self.get_or_create_tag_value(
                project_id, environment_id, key, value, key_id=tagkey.id)
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
            logger.error(
                'tagstore.create_event_tags.integrity_error',
                extra={
                    'project_id': project_id,
                    'group_id': group_id,
                    'event_id': event_id,
                }
            )

    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE):
        from sentry.tagstore.exceptions import TagKeyNotFound

        qs = TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        qs = self._add_environment_filter(qs, environment_id)

        if status is not None:
            qs = qs.filter(status=status)

        try:
            return qs.get()
        except TagKey.DoesNotExist:
            raise TagKeyNotFound

    def get_tag_keys(self, project_id, environment_id, status=TagKeyStatus.VISIBLE):
        qs = TagKey.objects.filter(
            project_id=project_id,
        )

        qs = self._add_environment_filter(qs, environment_id)

        if status is not None:
            qs = qs.filter(status=status)

        return list(qs)

    def get_tag_value(self, project_id, environment_id, key, value):
        from sentry.tagstore.exceptions import TagValueNotFound

        qs = TagValue.objects.filter(
            project_id=project_id,
            _key__key=key,
            value=value,
        )

        qs = self._add_environment_filter(qs, environment_id)

        try:
            return qs.get()
        except TagValue.DoesNotExist:
            raise TagValueNotFound

    def get_tag_values(self, project_id, environment_id, key):
        qs = TagValue.objects.filter(
            project_id=project_id,
            _key__key=key,
        )

        qs = self._add_environment_filter(qs, environment_id)

        return list(qs)

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        from sentry.tagstore.exceptions import GroupTagKeyNotFound

        qs = GroupTagKey.objects.filter(
            project_id=project_id,
            group_id=group_id,
            _key__key=key,
        )

        qs = self._add_environment_filter(qs, environment_id)

        try:
            return qs.get()
        except GroupTagKey.DoesNotExist:
            raise GroupTagKeyNotFound

    def get_group_tag_keys(self, project_id, group_id, environment_id, limit=None):
        qs = GroupTagKey.objects.filter(
            group_id=group_id,
        )

        qs = self._add_environment_filter(qs, environment_id)

        if limit is not None:
            qs = qs[:limit]

        return list(qs)

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        from sentry.tagstore.exceptions import GroupTagValueNotFound

        qs = GroupTagValue.objects.filter(
            project_id=project_id,
            group_id=group_id,
            _key__key=key,
            _value__value=value,
        )

        qs = self._add_environment_filter(qs, environment_id)

        try:
            return qs.get()
        except GroupTagValue.DoesNotExist:
            raise GroupTagValueNotFound

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        qs = GroupTagValue.objects.filter(
            group_id=group_id,
            _key__key=key,
        )

        qs = self._add_environment_filter(qs, environment_id)

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
            project_id=project_id,
            group_id=group_id,
        ).delete()

    def delete_all_group_tag_values(self, project_id, group_id):
        GroupTagValue.objects.filter(
            project_id=project_id,
            group_id=group_id,
        ).delete()

    def incr_tag_value_times_seen(self, project_id, environment_id,
                                  key, value, extra=None, count=1):
        for env in [environment_id, None]:
            tagkey, _ = self.get_or_create_tag_key(project_id, env, key)

            buffer.incr(TagValue,
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
        for env in [environment_id, None]:
            tagkey, _ = self.get_or_create_tag_key(project_id, env, key)
            tagvalue, _ = self.get_or_create_tag_value(project_id, env, key, value)

            buffer.incr(GroupTagValue,
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

    def get_group_event_ids(self, project_id, group_id, environment_id, tags):
        # NOTE: `environment_id=None` needs to be filtered differently in this method.
        # EventTag never has NULL `environment_id` fields (individual Events always have an environment),
        # and so `environment_id=None` needs to query EventTag for *all* environments (except, ironically
        # the aggregate environment, which is NULL).

        if environment_id is None:
            # filter for all 'real' environments
            env_filter = {'_key__environment_id__isnull': False}
        else:
            env_filter = {'_key__environment_id': environment_id}

        tagvalue_qs = TagValue.objects.filter(
            reduce(or_, (Q(_key__key=k, _key__status=TagKeyStatus.VISIBLE, value=v)
                         for k, v in six.iteritems(tags))),
            project_id=project_id,
            **env_filter
        ).values_list('_key_id', 'id', '_key__key', 'value')

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
            return []

        # Django doesnt support union, so we limit results and try to find
        # reasonable matches

        # get initial matches to start the filter
        kv_pairs = tag_lookups.pop()
        matches = list(
            EventTag.objects.filter(
                reduce(or_, (Q(key_id=k, value_id=v)
                             for k, v in kv_pairs)),
                project_id=project_id,
                group_id=group_id,
            ).values_list('event_id', flat=True)[:1000]
        )

        # for each remaining tag, find matches contained in our
        # existing set, pruning it down each iteration
        for kv_pairs in tag_lookups:
            matches = list(
                EventTag.objects.filter(
                    reduce(or_, (Q(key_id=k, value_id=v)
                                 for k, v in kv_pairs)),
                    project_id=project_id,
                    group_id=group_id,
                    event_id__in=matches,
                ).values_list('event_id', flat=True)[:1000]
            )
            if not matches:
                return []

        return matches

    def get_groups_user_counts(self, project_id, group_ids, environment_id):
        qs = GroupTagKey.objects.filter(
            project_id=project_id,
            group_id__in=group_ids,
            _key__key='sentry:user',
        )

        qs = self._add_environment_filter(qs, environment_id)

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
                    SELECT tagstore_grouptagvalue.times_seen as t
                    FROM tagstore_grouptagvalue
                    INNER JOIN tagstore_tagkey
                    ON (tagstore_grouptagvalue.key_id = tagstore_tagkey.id)
                    WHERE tagstore_grouptagvalue.group_id = %%s
                    AND tagstore_tagkey.environment_id %s %%s
                    AND tagstore_tagkey.key = %%s
                    ORDER BY last_seen DESC
                    LIMIT 10000
                ) as a
            """ % ('IS' if environment_id is None else '='), [group_id, environment_id, key]
            )
            return cursor.fetchone()[0] or 0

        cutoff = timezone.now() - timedelta(days=7)
        qs = GroupTagValue.objects.filter(
            group_id=group_id,
            _key__key=key,
            last_seen__gte=cutoff,
        )
        qs = self._add_environment_filter(qs, environment_id)
        return qs.aggregate(t=Sum('times_seen'))['t']

    def get_top_group_tag_values(self, project_id, group_id, environment_id, key, limit=3):
        if db.is_postgres():
            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            return list(
                GroupTagValue.objects.raw(
                    """
                SELECT *
                FROM (
                    SELECT tagstore_grouptagvalue.id,
                           tagstore_grouptagvalue.project_id,
                           tagstore_grouptagvalue.group_id,
                           tagstore_grouptagvalue.times_seen,
                           tagstore_grouptagvalue.key_id,
                           tagstore_grouptagvalue.value_id,
                           tagstore_grouptagvalue.last_seen,
                           tagstore_grouptagvalue.first_seen
                    FROM tagstore_grouptagvalue
                    INNER JOIN tagstore_tagkey
                    ON (tagstore_grouptagvalue.key_id = tagstore_tagkey.id)
                    WHERE tagstore_grouptagvalue.group_id = %%s
                    AND tagstore_tagkey.environment_id %s %%s
                    AND tagstore_tagkey.key = %%s
                    ORDER BY last_seen DESC
                    LIMIT 10000
                ) as a
                ORDER BY times_seen DESC
                LIMIT %d
            """ % ('IS' if environment_id is None else '=', limit), [group_id, environment_id, key]
                )
            )

        cutoff = timezone.now() - timedelta(days=7)
        qs = GroupTagValue.objects.filter(
            group_id=group_id,
            _key__key=key,
            last_seen__gte=cutoff,
        )
        qs = self._add_environment_filter(qs, environment_id)
        return list(qs.order_by('-times_seen')[:limit])

    def get_first_release(self, project_id, group_id):
        try:
            first_release = GroupTagValue.objects.filter(
                project_id=project_id,
                group_id=group_id,
                _key__key__in=('sentry:release', 'release'),
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
                _key__key__in=('sentry:release', 'release'),
            ).order_by('-last_seen')[0]
        except IndexError:
            return None

        return last_release.value

    def get_release_tags(self, project_ids, environment_id, versions):
        qs = TagValue.objects.filter(
            project_id__in=project_ids,
            _key__key='sentry:release',
            value__in=versions,
        )

        qs = self._add_environment_filter(qs, environment_id)

        return list(qs)

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        return list(GroupTagValue.objects.filter(
            project_id__in=project_ids,
            _key__environment_id__isnull=True,
            _key__key='sentry:user',
            _value__value__in=[eu.tag_value for eu in event_users],
        ).order_by('-last_seen').values_list('group_id', flat=True)[:limit])

    def get_group_tag_values_for_users(self, event_users, limit=100):
        tag_filters = [
            Q(_value__value=eu.tag_value, project_id=eu.project_id)
            for eu in event_users
        ]

        return list(GroupTagValue.objects.filter(
            reduce(or_, tag_filters),
            _key__environment_id__isnull=True,
            _key__key='sentry:user',
        ).order_by('-last_seen')[:limit])

    def get_group_ids_for_search_filter(self, project_id, environment_id, tags, limit=1000):
        from sentry.search.base import ANY, EMPTY
        # Django doesnt support union, so we limit results and try to find
        # reasonable matches

        # ANY matches should come last since they're the least specific and
        # will provide the largest range of matches
        tag_lookups = sorted(six.iteritems(tags), key=lambda (k, v): v == ANY)

        # get initial matches to start the filter
        matches = None

        # for each remaining tag, find matches contained in our
        # existing set, pruning it down each iteration
        for k, v in tag_lookups:
            if v is EMPTY:
                return None

            elif v != ANY:
                base_qs = GroupTagValue.objects.filter(
                    project_id=project_id,
                    _key__key=k,
                    _value__value=v,
                )
                base_qs = self._add_environment_filter(base_qs, environment_id)

            else:
                base_qs = GroupTagValue.objects.filter(
                    project_id=project_id,
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
                return None

        return matches

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
                    _key_id=instance._key_id,
                ).count(),
            )

    def get_tag_value_qs(self, project_id, environment_id, key, query=None):
        qs = TagValue.objects.filter(
            project_id=project_id,
            _key__key=key,
        )

        qs = self._add_environment_filter(qs, environment_id)

        if query:
            qs = qs.filter(value__contains=query)

        return qs

    def get_group_tag_value_qs(self, project_id, group_id, environment_id, key):
        qs = GroupTagValue.objects.filter(
            project_id=project_id,
            group_id=group_id,
            _key__key=key,
        )
        qs = self._add_environment_filter(qs, environment_id)
        return qs

    def update_group_for_events(self, project_id, event_ids, destination_id):
        return EventTag.objects.filter(
            project_id=project_id,
            event_id__in=event_ids,
        ).update(group_id=destination_id)

    def _add_environment_filter(self, queryset, environment_id):
        """\
        Filter a queryset by the provided `environment_id`, handling
        whether a JOIN is required or not depending on the model.
        """
        if queryset.model == TagKey:
            if environment_id is None:
                return queryset.filter(environment_id__isnull=True)
            else:
                return queryset.filter(environment_id=environment_id)
        elif queryset.model in (TagValue, GroupTagKey, GroupTagValue):
            if environment_id is None:
                return queryset.filter(_key__environment_id__isnull=True)
            else:
                return queryset.filter(_key__environment_id=environment_id)
        else:
            raise ValueError("queryset of unsupported model '%s' provided" % queryset.model)
