"""
sentry.models.groupmeta
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from celery.signals import task_postrun
from django.core.signals import request_finished
from django.db import models

from sentry.db.models import Model, sane_repr
from sentry.db.models.manager import BaseManager


class GroupMetaManager(BaseManager):
    def __init__(self, *args, **kwargs):
        super(GroupMetaManager, self).__init__(*args, **kwargs)
        task_postrun.connect(self.clear_local_cache)
        request_finished.connect(self.clear_local_cache)
        self.__cache = {}

    def __getstate__(self):
        d = self.__dict__.copy()
        d.pop('_GroupMetaManager__cache', None)
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__cache = {}

    def clear_local_cache(self, **kwargs):
        self.__cache = {}

    def populate_cache(self, instance_list):
        results = self.filter(
            group__in=instance_list,
        ).values_list('group', 'key', 'value')
        for group_id, key, value in results:
            self.__cache.setdefault(group_id, {})
            self.__cache[group_id][key] = value

    def get_value_bulk(self, instance_list, key):
        return dict(
            (i, self.__cache.get(i.id, {}).get(key))
            for i in instance_list
        )

    def get_value(self, instance, key, default=None):
        return self.__cache.get(instance.id, {}).get(key, default)

    def unset_value(self, instance, key):
        self.filter(group=instance, key=key).delete()
        try:
            del self.__cache[instance.id][key]
        except KeyError:
            pass

    def set_value(self, instance, key, value):
        self.create_or_update(
            group=instance,
            key=key,
            defaults={
                'value': value,
            },
        )
        self.__cache.setdefault(instance.id, {})
        self.__cache[instance.id][key] = value


class GroupMeta(Model):
    """
    Arbitrary key/value store for Groups.

    Generally useful for things like storing metadata
    provided by plugins.
    """
    group = models.ForeignKey('sentry.Group')
    key = models.CharField(max_length=64)
    value = models.TextField()

    objects = GroupMetaManager()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_groupmeta'
        unique_together = (('group', 'key'),)

    __repr__ = sane_repr('group_id', 'key', 'value')
