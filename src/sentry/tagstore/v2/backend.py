"""
sentry.tagstore.v2.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from django.db import IntegrityError, transaction

# from sentry.signals import buffer_incr_complete
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

        self.setup_tasks(
            tagkey_model=TagKey,
        )

        # TODO(brett): v2-specific receivers for keeping environment aggregates up to date, including deletes
        # self.setup_receivers(
        #     tagvalue_model=TagValue,
        #     grouptagvalue_model=GroupTagValue,
        # )

        # @buffer_incr_complete.connect(sender=GroupTagKey, weak=False)
        # def todo(filters, created, extra, **kwargs):
        #     pass

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
        key_id = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs).id

        return TagValue.objects.create(
            project_id=project_id,
            environment_id=environment_id,
            key_id=key_id,
            value=value,
            **kwargs
        )

    def get_or_create_tag_value(self, project_id, environment_id, key, value, **kwargs):
        key_id = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs).id

        return TagValue.objects.get_or_create(
            project_id=project_id,
            environment_id=environment_id,
            key_id=key_id,
            value=value,
            **kwargs
        )

    def create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        key_id = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs).id

        return GroupTagKey.objects.create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key_id=key_id,
            **kwargs
        )

    def get_or_create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        key_id = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs).id

        return GroupTagKey.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key_id=key_id,
            **kwargs
        )

    def create_group_tag_value(self, project_id, group_id, environment_id, key, value, **kwargs):
        key_id = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs).id

        value_id = self.get_or_create_tag_value(
            project_id, environment_id, key, value, **kwargs).id

        return GroupTagValue.objects.create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key_id=key_id,
            value_id=value_id,
            **kwargs
        )

    def get_or_create_group_tag_value(self, project_id, group_id,
                                      environment_id, key, value, **kwargs):
        key_id = self.get_or_create_tag_key(
            project_id, environment_id, key, **kwargs).id

        value_id = self.get_or_create_tag_value(
            project_id, environment_id, key, value, **kwargs).id

        return GroupTagValue.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key_id=key_id,
            value_id=value_id,
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

    def get_tag_keys(self, project_id, environment_id, status=TagKeyStatus.VISIBLE):
        qs = TagKey.objects.filter(project_id=project_id)

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        if status is not None:
            qs = qs.filter(status=status)

        return list(qs)

    def get_tag_value(self, project_id, environment_id, key, value):
        from sentry.tagstore.exceptions import TagKeyNotFound, TagValueNotFound

        try:
            key_id = self.get_tag_key(project_id, environment_id, key).id
        except TagKeyNotFound:
            # TagValue can't exist, so let's raise a sensible exception
            raise TagValueNotFound

        qs = TagValue.objects.filter(
            project_id=project_id,
            key_id=key_id,
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

    def get_tag_values(self, project_id, environment_id, key):
        tagkey_qs = TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        if environment_id is None:
            tagkey_qs = tagkey_qs.filter(environment_id__isnull=True)
        else:
            tagkey_qs = tagkey_qs.filter(environment_id=environment_id)

        qs = TagValue.objects.filter(
            key_id__in=list([tk.id for tk in tagkey_qs]),
        )

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        return list(qs)

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        from sentry.tagstore.exceptions import TagKeyNotFound, GroupTagKeyNotFound

        try:
            key_id = self.get_tag_key(project_id, environment_id, key).id
        except TagKeyNotFound:
            # GroupTagKey can't exist, so let's raise a sensible exception
            raise GroupTagKeyNotFound

        qs = GroupTagKey.objects.filter(
            group_id=group_id,
            key_id=key_id,
        )

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        try:
            return qs.get()
        except GroupTagKey.DoesNotExist:
            raise GroupTagKeyNotFound

    def get_group_tag_keys(self, project_id, group_ids, environment_id, limit=None):
        if isinstance(group_ids, six.integer_types):
            qs = GroupTagKey.objects.filter(group_id=group_ids)
        else:
            qs = GroupTagKey.objects.filter(group_id__in=group_ids)

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        if limit is not None:
            qs = qs[:limit]

        return list(qs)

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        from sentry.tagstore.exceptions import TagKeyNotFound, TagValueNotFound, GroupTagValueNotFound

        try:
            key_id = self.get_tag_key(project_id, environment_id, key).id
        except TagKeyNotFound:
            # GroupTagValue can't exist, so let's raise a sensible exception
            raise GroupTagValueNotFound

        try:
            value_id = self.get_tag_value(project_id, environment_id, key, value).id
        except TagValueNotFound:
            # GroupTagValue can't exist, so let's raise a sensible exception
            raise GroupTagValueNotFound

        qs = GroupTagValue.objects.get(
            group_id=group_id,
            key_id=key_id,
            value_id=value_id,
        )

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

        try:
            return qs.get()
        except GroupTagValue.DoesNotExist:
            raise GroupTagValueNotFound

    def get_group_tag_values(self, project_id, group_ids, environment_id, key):
        from sentry.tagstore.exceptions import TagKeyNotFound

        try:
            key_id = self.get_tag_key(project_id, environment_id, key).id
        except TagKeyNotFound:
            return []

        qs = GroupTagValue.objects.filter(key_id=key_id)

        if isinstance(group_ids, six.integer_types):
            qs = qs.filter(group_id=group_ids)
        else:
            qs = qs.filter(group_id__in=group_ids)

        if environment_id is None:
            qs = qs.filter(environment_id__isnull=True)
        else:
            qs = qs.filter(environment_id=environment_id)

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
