from __future__ import absolute_import

import threading

from celery.signals import task_postrun
from django.core.signals import request_finished
from django.db import models

from sentry.exceptions import CacheNotPopulated
from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.db.models.manager import BaseManager

ERR_CACHE_MISISNG = "Cache not populated for instance id=%s"


class GroupMetaManager(BaseManager):
    def __init__(self, *args, **kwargs):
        super(GroupMetaManager, self).__init__(*args, **kwargs)
        self.__local_cache = threading.local()

    def __getstate__(self):
        d = self.__dict__.copy()
        d.pop("_GroupMetaManager__local_cache", None)
        return d

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.__local_cache = threading.local()

    def _get_cache(self):
        if not hasattr(self.__local_cache, "value"):
            self.__local_cache.value = {}
        return self.__local_cache.value

    def _set_cache(self, value):
        self.__local_cache.value = value

    __cache = property(_get_cache, _set_cache)

    def contribute_to_class(self, model, name):
        model.CacheNotPopulated = CacheNotPopulated
        super(GroupMetaManager, self).contribute_to_class(model, name)
        task_postrun.connect(self.clear_local_cache)
        request_finished.connect(self.clear_local_cache)

    def clear_local_cache(self, **kwargs):
        self.__cache = {}

    def populate_cache(self, instance_list):
        for group in instance_list:
            self.__cache.setdefault(group.id, {})

        results = self.filter(group__in=instance_list).values_list("group", "key", "value")
        for group_id, key, value in results:
            self.__cache[group_id][key] = value

    def get_value_bulk(self, instance_list, key, default=None):
        results = {}
        for instance in instance_list:
            try:
                inst_cache = self.__cache[instance.id]
            except KeyError:
                raise self.model.CacheNotPopulated(ERR_CACHE_MISISNG % (instance.id,))
            results[instance] = inst_cache.get(key, default)
        return results

    def get_value(self, instance, key, default=None):
        try:
            inst_cache = self.__cache[instance.id]
        except KeyError:
            raise self.model.CacheNotPopulated(ERR_CACHE_MISISNG % (instance.id,))
        return inst_cache.get(key, default)

    def unset_value(self, instance, key):
        self.filter(group=instance, key=key).delete()
        try:
            del self.__cache[instance.id][key]
        except KeyError:
            pass

    def set_value(self, instance, key, value):
        self.create_or_update(group=instance, key=key, values={"value": value})
        self.__cache.setdefault(instance.id, {})
        self.__cache[instance.id][key] = value


class GroupMeta(Model):
    """
    Arbitrary key/value store for Groups.

    Generally useful for things like storing metadata
    provided by plugins.
    """

    __core__ = False

    group = FlexibleForeignKey("sentry.Group")
    key = models.CharField(max_length=64)
    value = models.TextField()

    objects = GroupMetaManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupmeta"
        unique_together = (("group", "key"),)

    __repr__ = sane_repr("group_id", "key", "value")
