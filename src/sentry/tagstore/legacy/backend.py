"""
sentry.tagstore.legacy.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from collections import defaultdict, Iterable
from django.db.models import Q
from operator import or_
from six.moves import reduce

from sentry import buffer
from sentry.tagstore import TagKeyStatus
from sentry.models import GroupTagKey, TagKey, TagValue, EventTag
from sentry.tagstore.base import TagStorage
from sentry.utils.cache import cache
from sentry.tasks.deletion import delete_tag_key


class LegacyTagStorage(TagStorage):
    def create_tag_key(self, project_id, key, **kwargs):
        return TagKey.objects.create(project_id=project_id, key=key, **kwargs)

    def get_or_create_tag_key(self, project_id, key, **kwargs):
        return TagKey.objects.get_or_create(project_id=project_id, key=key, defaults=kwargs)

    def create_tag_value(self, project_id, key, value, **kwargs):
        return TagValue.objects.create(project_id=project_id, key=key, value=value, **kwargs)

    def get_or_create_tag_value(self, project_id, key, value, **kwargs):
        return TagValue.objects.get_or_create(
            project_id=project_id, key=key, value=value, defaults=kwargs)

    def create_group_tag_key(self, project_id, group_id, key, **kwargs):
        return GroupTagKey.objects.create(project_id=project_id, group_id=group_id,
                                          key=key, **kwargs)

    def get_or_create_group_tag_key(self, project_id, group_id, key, **kwargs):
        return GroupTagKey.objects.get_or_create(project_id=project_id, group_id=group_id,
                                                 key=key, defaults=kwargs)

    def get_tag_key(self, project_id, key, status=TagKeyStatus.VISIBLE):
        from sentry.tagstore.exceptions import TagKeyNotFound

        qs = TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        if status:
            qs = qs.filter(status=status)

        try:
            return qs.get()
        except TagKey.DoesNotExist:
            raise TagKeyNotFound

    def _get_tag_keys_cache_key(self, project_ids, status):
        if isinstance(project_ids, Iterable):
            project_ids = "-".join(sorted(project_ids))
        return 'filterkey:all:%s:%s' % (project_ids, status)

    def get_tag_keys(self, project_ids, keys=None, status=TagKeyStatus.VISIBLE):
        def _get_base_qs():
            if isinstance(project_ids, six.integer_types):
                qs = TagKey.objects.filter(project_id=project_ids)
            else:
                qs = TagKey.objects.filter(project_id__in=project_ids)

            if status:
                qs = qs.filter(status=status)

            return qs

        if not keys:
            # TODO: cache invalidation via post_save/post_delete signals much like BaseManager
            key = self._get_tag_keys_cache_key(project_ids, status)
            result = cache.get(key)
            if result is None:
                qs = _get_base_qs()
                result = list(qs.order_by('-values_seen')[:20])
                cache.set(key, result, 60)
            return result

        qs = _get_base_qs()

        if status:
            qs = qs.filter(status=status)

        return list(qs)

    def get_tag_value(self, project_id, key, value):
        from sentry.tagstore.exceptions import TagValueNotFound

        try:
            return TagValue.objects.get(
                project_id=project_id,
                key=key,
                value=value
            )
        except TagValue.DoesNotExist:
            raise TagValueNotFound

    def get_tag_values(self, project_ids, key, values=None):
        qs = TagValue.objects.filter(key=key)

        if isinstance(project_ids, six.integer_types):
            qs = qs.filter(project_id=project_ids)
        else:
            qs = qs.filter(project_id__in=project_ids)

        qs = TagValue.objects.filter(
            project_id__in=project_ids,
            key=key
        )

        if values is not None:
            qs = qs.filter(value__in=values)

        return list(qs)

    def get_group_tag_key(self, group_id, key):
        from sentry.tagstore.exceptions import GroupTagKeyNotFound

        try:
            return GroupTagKey.objects.get(
                group_id=group_id,
                key=key,
            )
        except GroupTagKey.DoesNotExist:
            raise GroupTagKeyNotFound

    def get_group_tag_keys(self, group_ids, keys=None, limit=None):
        if isinstance(group_ids, six.integer_types):
            qs = GroupTagKey.objects.filter(group_id=group_ids)
        else:
            qs = GroupTagKey.objects.filter(group_id__in=group_ids)

        if keys is not None:
            if isinstance(keys, six.text_type):
                qs = qs.filter(key=keys)
            else:
                qs = qs.filter(key__in=keys)

        if limit is not None:
            qs = qs[:limit]

        return list(qs)

    def delete_tag_key(self, project_id, key):
        tagkey = self.get_tag_key(project_id, key, status=None)

        updated = TagKey.objects.filter(
            id=tagkey.id,
            status=TagKeyStatus.VISIBLE,
        ).update(status=TagKeyStatus.PENDING_DELETION)

        if updated:
            delete_tag_key.delay(object_id=tagkey.id)

        return (updated, tagkey)

    def delete_group_tag_key(self, group_id, key):
        GroupTagKey.objects.filter(
            group_id=group_id,
            key=key
        ).delete()

    def delete_all_group_tag_keys(self, group_id):
        GroupTagKey.objects.filter(
            group_id=group_id,
        ).delete()

    def incr_values_seen(self, project_id, key, count=1):
        buffer.incr(TagKey, {
            'values_seen': count,
        }, {
            'project_id': project_id,
            'key': key,
        })

    def incr_times_seen(self, project_id, key, value, extra=None, count=1):
        buffer.incr(TagValue, {
            'times_seen': count,
        }, {
            'project_id': project_id,
            'key': key,
            'value': value,
        }, extra)

    def get_group_event_ids(self, project_id, group_id, tags):
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

    def get_tag_value_qs(self, project_id, key, query=None):
        queryset = TagValue.objects.filter(
            project_id=project_id,
            key=key,
        )

        if query:
            queryset = queryset.filter(value__contains=query)

        return queryset

    def get_values_seen(self, group_ids, key):
        if isinstance(group_ids, six.integer_types):
            qs = GroupTagKey.objects.filter(group_id=group_ids)
        else:
            qs = GroupTagKey.objects.filter(group_id__in=group_ids)

        return defaultdict(int, qs.filter(
            key=key,
        ).values_list('group_id', 'values_seen'))
