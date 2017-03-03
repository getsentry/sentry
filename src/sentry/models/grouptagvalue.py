"""
sentry.models.grouptagvalue
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from datetime import timedelta
from django.db import connections, models
from django.db.models import Sum
from django.utils import timezone

from sentry.constants import MAX_TAG_KEY_LENGTH, MAX_TAG_VALUE_LENGTH
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, BaseManager, FlexibleForeignKey,
    sane_repr
)
from sentry.utils import db


class GroupTagValue(Model):
    """
    Stores the total number of messages seen by a group matching
    the given filter.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True, related_name='grouptag')
    group = FlexibleForeignKey('sentry.Group', related_name='grouptag')
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
        unique_together = (
            ('group', 'key', 'value'),
        )
        index_together = (
            ('project', 'key', 'value', 'last_seen'),
        )

    __repr__ = sane_repr('project_id', 'group_id', 'key', 'value')

    def save(self, *args, **kwargs):
        if not self.first_seen:
            self.first_seen = self.last_seen
        super(GroupTag, self).save(*args, **kwargs)

    @classmethod
    def get_value_count(cls, group_id, key):
        if db.is_postgres():
            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            cursor = connections['default'].cursor()
            cursor.execute("""
                SELECT SUM(t)
                FROM (
                    SELECT times_seen as t
                    FROM sentry_messagefiltervalue
                    WHERE group_id = %s
                    AND key = %s
                    ORDER BY last_seen DESC
                    LIMIT 10000
                ) as a
            """, [group_id, key])
            return cursor.fetchone()[0] or 0

        cutoff = timezone.now() - timedelta(days=7)
        return cls.objects.filter(
            group=group_id,
            key=key,
            last_seen__gte=cutoff,
        ).aggregate(t=Sum('times_seen'))['t']

    @classmethod
    def get_top_values(cls, group_id, key, limit=3):
        if db.is_postgres():
            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            return list(cls.objects.raw("""
                SELECT *
                FROM (
                    SELECT *
                    FROM sentry_messagefiltervalue
                    WHERE group_id = %%s
                    AND key = %%s
                    ORDER BY last_seen DESC
                    LIMIT 10000
                ) as a
                ORDER BY times_seen DESC
                LIMIT %d
            """ % limit, [group_id, key]))

        cutoff = timezone.now() - timedelta(days=7)
        return list(cls.objects.filter(
            group=group_id,
            key=key,
            last_seen__gte=cutoff,
        ).order_by('-times_seen')[:limit])

GroupTag = GroupTagValue
