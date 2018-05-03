"""
sentry.tagstore.legacy.models.grouptagvalue
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.db import models, router, transaction, DataError
from django.utils import timezone

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

    def merge_counts(self, new_group):
        try:
            with transaction.atomic(using=router.db_for_write(GroupTagValue)):
                new_obj = GroupTagValue.objects.get(
                    group_id=new_group.id,
                    key=self.key,
                    value=self.value,
                )
                new_obj.update(
                    first_seen=min(new_obj.first_seen, self.first_seen),
                    last_seen=max(new_obj.last_seen, self.last_seen),
                    times_seen=new_obj.times_seen + self.times_seen,
                )
        except DataError:
            # it's possible to hit an out of range value for counters
            pass
