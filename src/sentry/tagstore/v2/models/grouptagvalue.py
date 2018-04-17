"""
sentry.tagstore.v2.models.grouptagvalue
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.db import models, router, transaction, DataError, connections
from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, BoundedBigIntegerField, FlexibleForeignKey, sane_repr
)
from sentry.tagstore.query import TagStoreManager


class GroupTagValue(Model):
    """
    Stores the total number of messages seen by a group matching
    the given filter.
    """
    __core__ = False

    project_id = BoundedBigIntegerField(db_index=True)
    group_id = BoundedBigIntegerField(db_index=True)
    times_seen = BoundedPositiveIntegerField(default=0)
    _key = FlexibleForeignKey('tagstore.TagKey', db_column='key_id')
    _value = FlexibleForeignKey('tagstore.TagValue', db_column='value_id')
    last_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)

    objects = TagStoreManager()

    class Meta:
        app_label = 'tagstore'
        unique_together = (('project_id', 'group_id', '_key', '_value'), )
        index_together = (('project_id', '_key', '_value', 'last_seen'), )

    __repr__ = sane_repr('project_id', 'group_id', '_key_id', '_value_id')

    def delete(self):
        using = router.db_for_read(GroupTagValue)
        cursor = connections[using].cursor()
        cursor.execute(
            """
            DELETE FROM tagstore_grouptagvalue
            WHERE project_id = %s
              AND id = %s
        """, [self.project_id, self.id]
        )

    @property
    def key(self):
        if hasattr(self, '_set_key'):
            return self._set_key

        if hasattr(self, '__key_cache'):
            return self._key.key

        # fallback
        from sentry.tagstore.v2.models import TagKey

        tk = TagKey.objects.filter(
            project_id=self.project_id,
            id=self._key_id,
        ).values_list('key', flat=True).get()

        # cache for future calls
        self.key = tk

        return tk

    @key.setter
    def key(self, key):
        self._set_key = key

    @property
    def value(self):
        if hasattr(self, '_set_value'):
            return self._set_value

        if hasattr(self, '__value_cache'):
            return self._value.value

        # fallback
        from sentry.tagstore.v2.models import TagValue

        tv = TagValue.objects.filter(
            project_id=self.project_id,
            id=self._value_id,
        ).values_list('value', flat=True).get()

        # cache for future calls
        self.value = tv

        return tv

    @value.setter
    def value(self, value):
        self._set_value = value

    def save(self, *args, **kwargs):
        if not self.first_seen:
            self.first_seen = self.last_seen
        super(GroupTagValue, self).save(*args, **kwargs)

    def merge_counts(self, new_group):
        try:
            with transaction.atomic(using=router.db_for_write(GroupTagValue)):
                new_obj = GroupTagValue.objects.get(
                    group_id=new_group.id,
                    project_id=new_group.project_id,
                    _key_id=self._key_id,
                    _value_id=self._value_id,
                )

                GroupTagValue.objects.filter(
                    id=new_obj.id,
                    project_id=new_group.project_id,
                ).update(
                    first_seen=min(new_obj.first_seen, self.first_seen),
                    last_seen=max(new_obj.last_seen, self.last_seen),
                    times_seen=new_obj.times_seen + self.times_seen,
                )
        except DataError:
            # it's possible to hit an out of range value for counters
            pass


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
