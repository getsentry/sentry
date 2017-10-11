"""
sentry.tagstore.legacy.models.grouptagvalue
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.db import models
from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.constants import MAX_TAG_KEY_LENGTH, MAX_TAG_VALUE_LENGTH
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, BaseManager, sane_repr)


class GroupTagValue(Model):
    """
    Stores the total number of messages seen by a group matching
    the given filter.
    """
    __core__ = False

    project_id = BoundedPositiveIntegerField(db_index=True, null=True)
    group_id = BoundedPositiveIntegerField(db_index=True)
    times_seen = BoundedPositiveIntegerField(default=0)
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    value = models.CharField(max_length=MAX_TAG_VALUE_LENGTH)
    last_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_messagefiltervalue'
        unique_together = (('group_id', 'key', 'value'), )
        index_together = (('project_id', 'key', 'value', 'last_seen'), )

    __repr__ = sane_repr('project_id', 'group_id', 'key', 'value')

    def save(self, *args, **kwargs):
        if not self.first_seen:
            self.first_seen = self.last_seen
        super(GroupTagValue, self).save(*args, **kwargs)


@register(GroupTagValue)
class GroupTagValueSerializer(Serializer):
    def get_attrs(self, item_list, user):
        from sentry import tagstore

        result = {}
        for item in item_list:
            result[item] = {
                'name': tagstore.get_tag_value_label(item.key, item.value),
            }

        return result

    def serialize(self, obj, attrs, user):
        from sentry import tagstore

        return {
            'id': six.text_type(obj.id),
            'name': attrs['name'],
            'key': tagstore.get_standardized_key(obj.key),
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }
