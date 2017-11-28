"""
sentry.tagstore.v2.models.grouptagkey
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.db import router, transaction, DataError

from sentry.api.serializers import Serializer, register
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, BaseManager, sane_repr
)


class GroupTagKey(Model):
    """
    Stores a unique tag key name for a group.

    An example key might be "url" or "server_name".
    """
    __core__ = False

    project_id = BoundedPositiveIntegerField(db_index=True)
    group_id = BoundedPositiveIntegerField(db_index=True)
    environment_id = BoundedPositiveIntegerField(null=True)
    key_id = BoundedPositiveIntegerField()
    # values_seen will be in Redis

    objects = BaseManager()

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', 'group_id', 'environment_id', 'key_id'), )
        # TODO: environment index(es)

    __repr__ = sane_repr('project_id', 'group_id', 'environment_id', 'key_id')

    # TODO: key property to fetch actual key string?

    # TODO: this will have to iterate all of the possible environments a group has?
    # TODO: values_seen will live in Redis
    def merge_counts(self, new_group):
        from sentry.tagstore.v2.models import GroupTagValue

        try:
            with transaction.atomic(using=router.db_for_write(GroupTagKey)):
                GroupTagKey.objects.filter(
                    group_id=new_group.id,
                    key_id=self.key_id,
                ).update(
                    values_seen=GroupTagValue.objects.filter(
                        group_id=new_group.id,
                        key_id=self.key_id,
                    ).count()
                )
        except DataError:
            # it's possible to hit an out of range value for counters
            pass


@register(GroupTagKey)
class GroupTagKeySerializer(Serializer):
    def get_attrs(self, item_list, user):
        from sentry import tagstore

        result = {}
        for item in item_list:
            key = tagstore.get_standardized_key(item.key)
            result[item] = {
                'name': tagstore.get_tag_key_label(item.key),
                'key': key,
            }

        return result

    def serialize(self, obj, attrs, user):
        return {
            'id': six.text_type(obj.id),
            'name': attrs['name'],
            'key': attrs['key'],
            'uniqueValues': obj.values_seen,
        }
