"""
sentry.tagstore.v2.models.tagvalue
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import six

from django.db import models
from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.constants import MAX_TAG_VALUE_LENGTH
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, GzippedDictField, BaseManager, FlexibleForeignKey, sane_repr
)


class TagValue(Model):
    """
    Stores references to available filters.
    """
    __core__ = False

    project_id = BoundedPositiveIntegerField(db_index=True)
    environment_id = BoundedPositiveIntegerField(null=True)
    key = FlexibleForeignKey('tagstore.TagKey')
    value = models.CharField(max_length=MAX_TAG_VALUE_LENGTH)
    data = GzippedDictField(blank=True, null=True)
    # times_seen will live in Redis
    last_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', 'environment_id', 'key', 'value'), )
        # TODO: environment index(es)
        index_together = (('project_id', 'key', 'last_seen'), )

    __repr__ = sane_repr('project_id', 'environment_id', 'key', 'value')

    # TODO: key property to fetch actual key string?

    def get_label(self):
        from sentry import tagstore

        return tagstore.get_tag_value_label(self.key, self.value)


@register(TagValue)
class TagValueSerializer(Serializer):
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
            'key': tagstore.get_standardized_key(obj.key),
            'name': attrs['name'],
            'value': obj.value,
            'count': obj.times_seen,
            'lastSeen': obj.last_seen,
            'firstSeen': obj.first_seen,
        }
