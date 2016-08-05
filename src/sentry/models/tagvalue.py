"""
sentry.models.tagvalue
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from datetime import timedelta
from django.db import models
from django.utils import timezone
from hashlib import md5

from sentry.constants import MAX_TAG_KEY_LENGTH, MAX_TAG_VALUE_LENGTH
from sentry.db.models import (
    Model, BoundedPositiveIntegerField, FlexibleForeignKey, GzippedDictField,
    BaseManager, sane_repr
)
from sentry.utils.cache import cache


class TagValue(Model):
    """
    Stores references to available filters.
    """
    __core__ = False

    project = FlexibleForeignKey('sentry.Project', null=True)
    key = models.CharField(max_length=MAX_TAG_KEY_LENGTH)
    value = models.CharField(max_length=MAX_TAG_VALUE_LENGTH)
    data = GzippedDictField(blank=True, null=True)
    times_seen = BoundedPositiveIntegerField(default=0)
    last_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)
    first_seen = models.DateTimeField(
        default=timezone.now, db_index=True, null=True)

    objects = BaseManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_filtervalue'
        unique_together = (('project', 'key', 'value'),)

    __repr__ = sane_repr('project_id', 'key', 'value')

    @classmethod
    def is_valid_value(cls, value):
        return '\n' not in value

    @classmethod
    def get_cache_key(cls, project_id, key, value):
        return 'tagvalue:1:%s:%s' % (project_id, md5(u'{}:{}'.format(
            key, value
        )).hexdigest())

    @classmethod
    def get_or_create(cls, project, key, value, datetime):
        cache_key = cls.get_cache_key(project.id, key, value)

        obj = cache.get(cache_key)
        if obj is None:
            obj, created = cls.objects.get_or_create(
                project=project,
                key=key,
                value=value,
                defaults={
                    'first_seen': datetime,
                    'last_seen': datetime,
                }
            )
            # update last_seen up to once an hour
            if created and obj.last_seen < (datetime - timedelta(hours=1)):
                obj.update(last_seen=datetime)
            cache.set(cache_key, obj, 3600)

        return obj

    def get_label(self):
        # HACK(dcramer): quick and dirty way to hack in better display states
        if self.key == 'sentry:release' and len(self.value) == 40:
            return self.value[:12]
        return self.value
