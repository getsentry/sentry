"""
sentry.tagstore.v2.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from django.db import IntegrityError, transaction

from sentry.signals import buffer_incr_complete
from sentry.tagstore import TagKeyStatus
from sentry.tagstore.base import TagStorage

from .models import EventTag, GroupTagKey, GroupTagValue, TagKey, TagValue


class TagStorage(TagStorage):
    """\
    The v2 tagstore backend stores and respects ``environment_id`` arguments and stores
    ``times_seen`` and ``values_seen`` in Redis for cheap incr/decrs.

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

        # TODO: remove this?
        self.setup_receivers(
            tagvalue_model=TagValue,
            grouptagvalue_model=GroupTagValue,
        )

        self.setup_tasks(
            tagkey_model=TagKey,
        )

        # TODO: also need to handle deletes of non-aggregate decr-ing aggregate

        # TODO: v2-specific receivers for keeping environment aggregates up to date
        @buffer_incr_complete.connect(sender=GroupTagKey, weak=False)
        def todo(filters, created, extra, **kwargs):
            pass

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
        tag_key = self.get_or_create_tag_key(project_id, environment_id, key, **kwargs)

        return TagValue.objects.create(
            project_id=project_id,
            environment_id=environment_id,
            key_id=tag_key.id,
            value=value,
            **kwargs
        )

    def get_or_create_tag_value(self, project_id, environment_id, key, value, **kwargs):
        tag_key = self.get_or_create_tag_key(project_id, environment_id, key, **kwargs)

        return TagValue.objects.get_or_create(
            project_id=project_id,
            environment_id=environment_id,
            key_id=tag_key.id,
            value=value,
            **kwargs
        )

    def create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        tag_key = self.get_or_create_tag_key(project_id, environment_id, key, **kwargs)

        return GroupTagKey.objects.create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key_id=tag_key.id,
            **kwargs
        )

    def get_or_create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        tag_key = self.get_or_create_tag_key(project_id, environment_id, key, **kwargs)

        return GroupTagKey.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key_id=tag_key.id,
            **kwargs
        )

    def create_group_tag_value(self, project_id, group_id, environment_id, key, value, **kwargs):
        tag_key = self.get_or_create_tag_key(project_id, environment_id, key, **kwargs)
        tag_value = self.get_or_create_tag_value(project_id, environment_id, key, value, **kwargs)

        return GroupTagValue.objects.create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key_id=tag_key.id,
            value_id=tag_value.id,
            **kwargs
        )

    def get_or_create_group_tag_value(self, project_id, group_id,
                                      environment_id, key, value, **kwargs):
        tag_key = self.get_or_create_tag_key(project_id, environment_id, key, **kwargs)
        tag_value = self.get_or_create_tag_value(project_id, environment_id, key, value, **kwargs)

        return GroupTagValue.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key_id=tag_key,
            value_id=tag_value,
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
        )

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        if status is not None:
            qs = qs.filter(status=status)

        try:
            return qs.get()
        except TagKey.DoesNotExist:
            raise TagKeyNotFound

    def get_tag_keys(self, project_ids, environment_id, keys=None, status=TagKeyStatus.VISIBLE):
        if isinstance(project_ids, six.integer_types):
            qs = TagKey.objects.filter(project_id=project_ids)
        else:
            qs = TagKey.objects.filter(project_id__in=project_ids)

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        if status is not None:
            qs = qs.filter(status=status)

        if keys is not None:
            if isinstance(keys, six.string_types):
                qs = qs.filter(key=keys)
            else:
                qs = qs.filter(key__in=keys)

        return list(qs)

    def get_tag_value(self, project_id, environment_id, key, value):
        from sentry.tagstore.exceptions import TagKeyNotFound, TagValueNotFound

        try:
            tag_key = self.get_tag_key(project_id, environment_id, key)
        except TagKeyNotFound:
            # TagValue can't exist, so let's raise a sensible exception
            raise TagValueNotFound

        qs = TagValue.objects.filter(
            project_id=project_id,
            key_id=tag_key.id,
            value=value,
        )

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        try:
            return qs.get()
        except TagValue.DoesNotExist:
            raise TagValueNotFound

    def get_tag_values(self, project_ids, environment_id, key, values=None):
        tag_keys = self.get_tag_keys(project_ids, environment_id, key)

        qs = TagValue.objects.filter(
            key_id__in=set([tk.id for tk in tag_keys]),
        )

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        if values is not None:
            qs = qs.filter(value__in=values)

        return list(qs)

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        from sentry.tagstore.exceptions import TagKeyNotFound, GroupTagKeyNotFound

        try:
            tag_key = self.get_tag_key(project_id, environment_id, key)
        except TagKeyNotFound:
            # GroupTagKey can't exist, so let's raise a sensible exception
            raise GroupTagKeyNotFound

        qs = GroupTagKey.objects.filter(
            group_id=group_id,
            key_id=tag_key.id,
        )

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        try:
            return qs.get()
        except GroupTagKey.DoesNotExist:
            raise GroupTagKeyNotFound

    def get_group_tag_keys(self, project_id, group_ids, environment_id, keys=None, limit=None):
        if isinstance(group_ids, six.integer_types):
            qs = GroupTagKey.objects.filter(group_id=group_ids)
        else:
            qs = GroupTagKey.objects.filter(group_id__in=group_ids)

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        if keys is not None:
            if isinstance(keys, six.string_types):
                qs = qs.filter(key=keys)
            else:
                qs = qs.filter(key__in=keys)

        if limit is not None:
            qs = qs[:limit]

        return list(qs)

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        from sentry.tagstore.exceptions import GroupTagValueNotFound

        qs = GroupTagValue.objects.get(
            group_id=group_id,
            key=key,
            value=value,
        )

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        try:
            return qs.get()
        except GroupTagValue.DoesNotExist:
            raise GroupTagValueNotFound

    def get_group_tag_values(self, project_id, group_ids, environment_id, keys=None, values=None):
        if isinstance(group_ids, six.integer_types):
            qs = GroupTagValue.objects.filter(group_id=group_ids)
        else:
            qs = GroupTagValue.objects.filter(group_id__in=group_ids)

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        if keys is not None:
            if isinstance(keys, six.string_types):
                qs = qs.filter(key=keys)
            else:
                qs = qs.filter(key__in=keys)

        if values is not None:
            if isinstance(values, six.string_types):
                qs = qs.filter(value=values)
            else:
                qs = qs.filter(value__in=values)

        return list(qs)

    def delete_tag_key(self, project_id, key, environment_id=None):
        from sentry.tagstore.tasks import delete_tag_key as delete_tag_key_task

        tagkeys_qs = TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        if environment_id is not None:
            tagkeys_qs = tagkeys_qs.filter(environment_id=environment_id)

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

    def delete_all_group_tag_keys(self, group_id):
        GroupTagKey.objects.filter(
            group_id=group_id,
        ).delete()

    def delete_all_group_tag_values(self, group_id):
        GroupTagValue.objects.filter(
            group_id=group_id,
        ).delete()

    # TODO below

    def incr_tag_key_values_seen(self, project_id, environment_id, key, count=1):
        buffer.incr(TagKey,
                    columns={
                        'values_seen': count,
                    },
                    filters={
                        'project_id': project_id,
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
                        'key': key,
                    })

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
