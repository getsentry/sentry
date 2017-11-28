"""
sentry.tagstore.v2.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import six

from django.db import IntegrityError, transaction

from sentry.tagstore import TagKeyStatus
from sentry.tagstore.base import TagStorage

from .models import EventTag, GroupTagKey, GroupTagValue, TagKey, TagValue


class TagStorage(TagStorage):
    def setup(self):
        self.setup_deletions(
            tagkey_model=TagKey,
            tagvalue_model=TagValue,
            grouptagkey_model=GroupTagKey,
            grouptagvalue_model=GroupTagValue,
            eventtag_model=EventTag
        )

        self.setup_cleanup(
            tagvalue_model=TagValue,
            grouptagvalue_model=GroupTagValue,
            eventtag_model=EventTag
        )

        self.setup_merge(
            grouptagkey_model=GroupTagKey,
            grouptagvalue_model=GroupTagValue
        )

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
        return TagValue.objects.create(
            project_id=project_id,
            environment_id=environment_id,
            key=key,
            value=value,
            **kwargs
        )

    def get_or_create_tag_value(self, project_id, environment_id, key, value, **kwargs):
        return TagValue.objects.get_or_create(
            project_id=project_id,
            environment_id=environment_id,
            key=key,
            value=value,
            **kwargs
        )

    def create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        return GroupTagKey.objects.create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key=key,
            **kwargs
        )

    def get_or_create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        return GroupTagKey.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key=key,
            **kwargs
        )

    def create_group_tag_value(self, project_id, group_id, environment_id, key, value, **kwargs):
        return GroupTagValue.objects.create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key=key,
            value=value,
            **kwargs
        )

    def get_or_create_group_tag_value(self, project_id, group_id,
                                      environment_id, key, value, **kwargs):
        return GroupTagValue.objects.get_or_create(
            project_id=project_id,
            group_id=group_id,
            environment_id=environment_id,
            key=key,
            value=value,
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

    # TODO is env required?
    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE):
        from sentry.tagstore.exceptions import TagKeyNotFound

        qs = TagKey.objects.filter(
            project_id=project_id,
            key=key,
        )

        if environment_id is not None:
            qs = qs.filter(environment_id=environment_id)

        if status is not None:
            qs = qs.filter(status=status)

        try:
            return qs.get()
        except TagKey.DoesNotExist:
            raise TagKeyNotFound

    # TODO if env isn't provided do we return duplicate tagkeys (one for each
    # env)? or the aggregate key?
    def get_tag_keys(self, project_ids, environment_id, keys=None, status=TagKeyStatus.VISIBLE):
        if isinstance(project_ids, six.integer_types):
            qs = TagKey.objects.filter(project_id=project_ids)
        else:
            qs = TagKey.objects.filter(project_id__in=project_ids)

        if environment_id is not None:
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
        from sentry.tagstore.exceptions import TagValueNotFound

        try:
            return TagValue.objects.get(
                project_id=project_id,
                key=key,
                value=value
            )
        except TagValue.DoesNotExist:
            raise TagValueNotFound

    def get_tag_values(self, project_ids, environment_id, key, values=None):
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

    def get_group_tag_key(self, group_id, environment_id, key):
        from sentry.tagstore.exceptions import GroupTagKeyNotFound

        try:
            return GroupTagKey.objects.get(
                group_id=group_id,
                key=key,
            )
        except GroupTagKey.DoesNotExist:
            raise GroupTagKeyNotFound

    def get_group_tag_keys(self, group_ids, environment_id, keys=None, limit=None):
        if isinstance(group_ids, six.integer_types):
            qs = GroupTagKey.objects.filter(group_id=group_ids)
        else:
            qs = GroupTagKey.objects.filter(group_id__in=group_ids)

        if keys is not None:
            if isinstance(keys, six.string_types):
                qs = qs.filter(key=keys)
            else:
                qs = qs.filter(key__in=keys)

        if limit is not None:
            qs = qs[:limit]

        return list(qs)

    def get_group_tag_value(self, group_id, environment_id, key, value):
        from sentry.tagstore.exceptions import GroupTagValueNotFound

        try:
            return GroupTagValue.objects.get(
                group_id=group_id,
                key=key,
                value=value,
            )
        except GroupTagValue.DoesNotExist:
            raise GroupTagValueNotFound

    def get_group_tag_values(self, group_ids, environment_id, keys=None, values=None):
        if isinstance(group_ids, six.integer_types):
            qs = GroupTagValue.objects.filter(group_id=group_ids)
        else:
            qs = GroupTagValue.objects.filter(group_id__in=group_ids)

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
