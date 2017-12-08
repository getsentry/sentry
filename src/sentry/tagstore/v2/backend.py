"""
sentry.tagstore.v2.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

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
from sentry.tagstore.base import TagStorage
from sentry.utils import db

from .models import EventTag, GroupTagKey, GroupTagValue, TagKey, TagValue


class TagStorage(TagStorage):
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

        self.setup_tasks(
            tagkey_model=TagKey,
        )

        self.setup_receivers(
            tagvalue_model=TagValue,
            grouptagvalue_model=GroupTagValue,
        )

        # TODO(brett): v2-specific receivers for keeping environment aggregates up to date

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
        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs)

        return TagValue.objects.create(
            project_id=project_id,
            environment_id=environment_id,
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
            environment_id=environment_id,
            _key_id=key_id,
            value=value,
            **kwargs
        )

    def create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs)

        return GroupTagKey.objects.create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            _key_id=tag_key.id,
            **kwargs
        )

    def get_or_create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs)

        return GroupTagKey.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            _key_id=tag_key.id,
            **kwargs
        )

    def create_group_tag_value(self, project_id, group_id, environment_id, key, value, **kwargs):
        tag_key, _ = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs)

        tag_value, _ = self.get_or_create_tag_value(
            project_id, environment_id, key, value, **kwargs)

        return GroupTagValue.objects.create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
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
            environment_id=environment_id,
            _key_id=tag_key.id,
            _value_id=tag_value.id,
            **kwargs
        )

    def create_event_tags(self, project_id, group_id, environment_id, event_id, tags):
        try:
            # don't let a duplicate break the outer transaction
            with transaction.atomic():
                # Tags are bulk inserted because this is an all-or-nothing situation.
                # Either the whole transaction works, or it doesn't. There's no value
                # in a partial success where we'd need to replay half of the rows.
                EventTag.objects.bulk_create([
                    EventTag(
                        project_id=project_id,
                        environment_id=environment_id,
                        group_id=group_id,
                        event_id=event_id,
                        key_id=key_id,
                        value_id=value_id,
                    )
                    for key_id, value_id in tags
                ])
        except IntegrityError:
            pass

    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE):
        from sentry.tagstore.exceptions import TagKeyNotFound

        qs = TagKey.objects.filter(
            project_id=project_id,
            key=key,
            **self._get_environment_filter(environment_id)
        )

        if status is not None:
            qs = qs.filter(status=status)

        try:
            return qs.get()
        except TagKey.DoesNotExist:
            raise TagKeyNotFound

    def get_tag_keys(self, project_id, environment_id, status=TagKeyStatus.VISIBLE):
        qs = TagKey.objects.filter(
            project_id=project_id,
            **self._get_environment_filter(environment_id)
        )

        if status is not None:
            qs = qs.filter(status=status)

        return list(qs)

    def get_tag_value(self, project_id, environment_id, key, value):
        from sentry.tagstore.exceptions import TagValueNotFound

        qs = TagValue.objects.filter(
            project_id=project_id,
            _key__key=key,
            value=value,
            **self._get_environment_filter(environment_id)
        )

        try:
            return qs.get()
        except TagValue.DoesNotExist:
            raise TagValueNotFound

    def get_tag_values(self, project_id, environment_id, key):
        qs = TagValue.objects.filter(
            project_id=project_id,
            _key__key=key,
            **self._get_environment_filter(environment_id)
        )

        return list(qs)

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        from sentry.tagstore.exceptions import GroupTagKeyNotFound

        qs = GroupTagKey.objects.filter(
            project_id=project_id,
            group_id=group_id,
            _key__key=key,
            **self._get_environment_filter(environment_id)
        )

        try:
            return qs.get()
        except GroupTagKey.DoesNotExist:
            raise GroupTagKeyNotFound

    def get_group_tag_keys(self, project_id, group_id, environment_id, limit=None):
        qs = GroupTagKey.objects.filter(
            group_id=group_id,
            **self._get_environment_filter(environment_id)
        )

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
            **self._get_environment_filter(environment_id)
        )

        try:
            return qs.get()
        except GroupTagValue.DoesNotExist:
            raise GroupTagValueNotFound

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        qs = GroupTagValue.objects.filter(
            group_id=group_id,
            _key__key=key,
            **self._get_environment_filter(environment_id)
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
                delete_tag_key_task.delay(object_id=tagkey.id)
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

    def incr_tag_key_values_seen(self, project_id, environment_id, key, count=1):
        buffer.incr(TagKey,
                    columns={
                        'values_seen': count,
                    },
                    filters={
                        'project_id': project_id,
                        'environment_id': environment_id,
                        'key': key,
                    })

    def incr_tag_value_times_seen(self, project_id, environment_id,
                                  key, value, extra=None, count=1):
        buffer.incr(TagValue,
                    columns={
                        'times_seen': count,
                    },
                    filters={
                        'project_id': project_id,
                        'environment_id': environment_id,
                        'key': key,
                        'value': value,
                    },
                    extra=extra)

    def incr_group_tag_key_values_seen(self, project_id, group_id, environment_id, key, count=1):
        buffer.incr(GroupTagKey,
                    columns={
                        'values_seen': count,
                    },
                    filters={
                        'project_id': project_id,
                        'group_id': group_id,
                        'environment_id': environment_id,
                        'key': key,
                    })

    def incr_group_tag_value_times_seen(self, project_id, group_id, environment_id,
                                        key, value, extra=None, count=1):
        buffer.incr(GroupTagValue,
                    columns={
                        'times_seen': count,
                    },
                    filters={
                        'project_id': project_id,
                        'group_id': group_id,
                        'environment_id': environment_id,
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
                **self._get_environment_filter(environment_id)
            ).values_list('key', 'id')
        )

        tagvalues = {
            (t[1], t[2]): t[0]
            for t in TagValue.objects.filter(
                reduce(or_, (Q(_key__key=k, value=v)
                             for k, v in six.iteritems(tags))),
                project_id=project_id,
                **self._get_environment_filter(environment_id)
            ).values_list('id', '_key__key', 'value')
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
                project_id=project_id,
                group_id=group_id,
                key_id=k,
                value_id=v,
                **self._get_environment_filter(environment_id)
            ).values_list('event_id', flat=True)[:1000]
        )

        # for each remaining tag, find matches contained in our
        # existing set, pruning it down each iteration
        for k, v in tag_lookups:
            matches = list(
                EventTag.objects.filter(
                    project_id=project_id,
                    group_id=group_id,
                    event_id__in=matches,
                    key_id=k,
                    value_id=v,
                    **self._get_environment_filter(environment_id)
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
            **self._get_environment_filter(environment_id)
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
                    FROM tagstore_grouptagvalue
                    INNER JOIN tagstore_tagkey
                    ON (tagstore_grouptagvalue.key_id = tagstore_tagkey.id)
                    WHERE tagstore_grouptagvalue.group_id = %s
                    AND tagstore_grouptagvalue.environment_id = %s
                    AND tagstore_tagkey.key = %s
                    ORDER BY last_seen DESC
                    LIMIT 10000
                ) as a
            """, [group_id, environment_id, key]
            )
            return cursor.fetchone()[0] or 0

        cutoff = timezone.now() - timedelta(days=7)
        return GroupTagValue.objects.filter(
            group_id=group_id,
            _key__key=key,
            last_seen__gte=cutoff,
            **self._get_environment_filter(environment_id)
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
                    FROM tagstore_grouptagvalue
                    INNER JOIN tagstore_tagkey
                    ON (tagstore_grouptagvalue.key_id = tagstore_tagkey.id)
                    WHERE tagstore_grouptagvalue.group_id = %%s
                    AND tagstore_grouptagvalue.environment_id = %%s
                    AND tagstore_tagkey.key = %%s
                    ORDER BY last_seen DESC
                    LIMIT 10000
                ) as a
                ORDER BY times_seen DESC
                LIMIT %d
            """ % limit, [group_id, environment_id, key]
                )
            )

        cutoff = timezone.now() - timedelta(days=7)
        return list(
            GroupTagValue.objects.filter(
                group_id=group_id,
                _key__key=key,
                last_seen__gte=cutoff,
                **self._get_environment_filter(environment_id)
            ).order_by('-times_seen')[:limit]
        )

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
        return list(TagValue.objects.filter(
            project_id__in=project_ids,
            _key__key='sentry:release',
            value__in=versions,
            **self._get_environment_filter(environment_id)
        ))

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        return list(GroupTagValue.objects.filter(
            project_id__in=project_ids,
            environment_id__isnull=True,
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
            environment_id__isnull=True,
            _key__key='sentry:user',
        ).order_by('-last_seen')[:limit])

    def get_group_ids_for_search_filter(self, project_id, environment_id, tags):
        from sentry.search.base import ANY, EMPTY
        # Django doesnt support union, so we limit results and try to find
        # reasonable matches

        # ANY matches should come last since they're the least specific and
        # will provide the largest range of matches
        tag_lookups = sorted(six.iteritems(tags), key=lambda x: x != ANY)

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
                    **self._get_environment_filter(environment_id)
                )

            else:
                base_qs = GroupTagValue.objects.filter(
                    project_id=project_id,
                    _key__key=k,
                    **self._get_environment_filter(environment_id)
                ).distinct()

            if matches:
                base_qs = base_qs.filter(group_id__in=matches)
            else:
                # restrict matches to only the most recently seen issues
                base_qs = base_qs.order_by('-last_seen')

            matches = list(base_qs.values_list('group_id', flat=True)[:1000])

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
                    environment_id=instance.environment_id,
                    key=instance.key,
                ).count(),
            )

    def get_tag_value_qs(self, project_id, environment_id, key, query=None):
        queryset = TagValue.objects.filter(
            project_id=project_id,
            key=key,
            **self._get_environment_filter(environment_id)
        )

        if query:
            queryset = queryset.filter(value__contains=query)

        return queryset

    def get_group_tag_value_qs(self, project_id, group_id, environment_id, key):
        return GroupTagValue.objects.filter(
            project_id=project_id,
            group_id=group_id,
            key=key,
            **self._get_environment_filter(environment_id)
        )

    def update_group_for_events(self, project_id, event_ids, destination_id):
        return EventTag.objects.filter(
            project_id=project_id,
            event_id__in=event_ids,
        ).update(group_id=destination_id)

    def _get_environment_filter(self, environment_id):
        if environment_id is None:
            return {'environment_id__isnull': True}
        else:
            return {'environment_id': environment_id}
